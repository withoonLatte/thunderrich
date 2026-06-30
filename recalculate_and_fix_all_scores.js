import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const SCORING_MATRIX = {
  'group': { correct: 1, wrong: 0 },
  'top32': { correct: 2, wrong: -1 },
  'top16': { correct: 3, wrong: -2 },
  'top8': { correct: 4, wrong: -2 },
  'top4': { correct: 5, wrong: -3 },
  'third_place': { correct: 5, wrong: -3 },
  'final': { correct: 7, wrong: -3 },
};

const NO_PRED_PENALTY = {
  'group': -1,
  'top32': -1,
  'top16': -2,
  'top8': -2,
  'top4': -3,
  'third_place': -3,
  'final': -3,
};

const parseHandicap = (h) => {
  if (typeof h === 'number') return h;
  if (!h) return 0;
  const str = h.toString().trim().toLowerCase();
  if (str === 'เสมอ' || str === 'ขาว' || str === '0') return 0;
  if (str.includes('/') || str.includes('-')) {
    const parts = str.split(/[\/-]/);
    if (parts.length === 2) {
      const p1 = parseFloat(parts[0]);
      const p2 = parseFloat(parts[1]);
      if (!isNaN(p1) && !isNaN(p2)) {
        return (p1 + p2) / 2;
      }
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

async function main() {
  const usersSnap = await getDocs(collection(db, 'users'));
  const matchesSnap = await getDocs(collection(db, 'matches'));
  const predictionsSnap = await getDocs(collection(db, 'predictions'));

  const allUsers = usersSnap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.role !== 'admin');

  const allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Sort all matches chronologically
  allMatches.sort((a, b) => {
    const timeA = a.startTime?.seconds || 0;
    const timeB = b.startTime?.seconds || 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });

  const allPreds = predictionsSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

  const batch = writeBatch(db);

  // Group predictions by userId
  const predsByUser = {};
  allPreds.forEach(p => {
    if (!predsByUser[p.userId]) {
      predsByUser[p.userId] = [];
    }
    predsByUser[p.userId].push(p);
  });

  // Keep track of prediction docs to delete or update
  const predsToUpdate = {}; // predId -> data

  console.log('--- RETROACTIVE CHRONOLOGICAL SIMULATION ---');

  for (const user of allUsers) {
    let points = 0;
    let wrongCount = 0;
    let yellowCards = 0;
    let redCards = 0;
    const bannedMatchIds = [];
    let hasResetForTop32 = false;
    let hasResetForTop16 = false;

    const userPreds = predsByUser[user.uid] || [];

    // Simulate match calculations chronologically
    for (let i = 0; i < allMatches.length; i++) {
      const match = allMatches[i];
      if (match.status !== 'finished') continue;

      if (match.round === 'top32' && !hasResetForTop32) {
        hasResetForTop32 = true;
        wrongCount = 0;
        yellowCards = 0;
        redCards = 0;
        bannedMatchIds.length = 0;
      }
      if (match.round === 'top16' && !hasResetForTop16) {
        hasResetForTop16 = true;
        wrongCount = 0;
        yellowCards = 0;
        redCards = 0;
        bannedMatchIds.length = 0;
      }

      const isBanned = bannedMatchIds.includes(match.id);
      let earns = 0;
      let isCorrect = false;
      let wrongCountIncrement = 0;

      // Find user's prediction choice
      const p = userPreds.find(pred => pred.matchId === match.id);

      // Determine match winner
      let matchWinner;
      if (match.manualWinner) {
        matchWinner = match.manualWinner;
      } else {
        const numericHandicap = parseHandicap(match.handicap);
        const handicapDiff = match.homeScore - match.awayScore + numericHandicap;
        if (handicapDiff > 0) matchWinner = 'home';
        else if (handicapDiff < 0) matchWinner = 'away';
        else matchWinner = 'push';
      }

      const roundScores = SCORING_MATRIX[match.round];

      if (isBanned) {
        earns = 0;
        isCorrect = false;
        wrongCountIncrement = 0;

        if (p) {
          // Void existing prediction
          predsToUpdate[p.id] = {
            ...p,
            isVoided: true,
            pointsEarned: 0,
            isResultCorrect: false
          };
        }
      } else if (p) {
        // User predicted
        if (p.choice === null || p.choice === undefined) {
          // Penalty doc (missed prediction)
          earns = NO_PRED_PENALTY[match.round] ?? -1;
          isCorrect = false;
          wrongCountIncrement = 0;

          predsToUpdate[p.id] = {
            ...p,
            isVoided: true,
            pointsEarned: earns,
            isResultCorrect: isCorrect
          };
        } else {
          // Regular prediction (might have been voided before, but we restore it if not banned now)
          if (matchWinner === 'push') {
            earns = match.customWinScore ?? roundScores.correct;
            isCorrect = true;
          } else if (p.choice === matchWinner) {
            earns = match.customWinScore ?? roundScores.correct;
            isCorrect = true;
          } else {
            earns = match.customLossScore ?? roundScores.wrong;
            isCorrect = false;
            if (match.round === 'group' || match.round === 'top32') {
              wrongCountIncrement = 1;
            }
          }

          predsToUpdate[p.id] = {
            ...p,
            isVoided: false,
            pointsEarned: earns,
            isResultCorrect: isCorrect
          };
        }
      } else {
        // Missed prediction penalty
        earns = NO_PRED_PENALTY[match.round] ?? -1;
        isCorrect = false;
        wrongCountIncrement = 0;

        // Create penalty prediction doc
        const predId = `${user.uid}_${match.id}`;
        predsToUpdate[predId] = {
          id: predId,
          userId: user.uid,
          matchId: match.id,
          choice: null,
          pointsEarned: earns,
          isResultCorrect: false,
          isVoided: true,
          createdAt: { seconds: Date.now() / 1000 } // simulated
        };
      }

      points += earns;
      wrongCount += wrongCountIncrement;

      // Card Trigger Logic
      if ((match.round === 'group' || match.round === 'top32') && wrongCountIncrement > 0) {
        if (wrongCount === 12) {
          yellowCards += 1;
          // Ban the next chronological match
          const nextMatches = allMatches.slice(i + 1, i + 2);
          nextMatches.forEach(m => {
            if (!bannedMatchIds.includes(m.id)) {
              bannedMatchIds.push(m.id);
            }
          });
        } else if (wrongCount === 24) {
          redCards += 1;
          // Ban the next 2 chronological matches
          const nextMatches = allMatches.slice(i + 1, i + 3);
          nextMatches.forEach(m => {
            if (!bannedMatchIds.includes(m.id)) {
              bannedMatchIds.push(m.id);
            }
          });
        }
      }
    }

    console.log(`User: ${user.displayName} (${user.uid})`);
    console.log(`  Points: ${user.points} -> ${points}`);
    console.log(`  WrongCount: ${user.round1_wrong_count} -> ${wrongCount}`);
    console.log(`  YellowCards: ${user.yellow_cards} -> ${yellowCards}`);
    console.log(`  BannedMatches: ${JSON.stringify(user.bannedMatchIds)} -> ${JSON.stringify(bannedMatchIds)}`);

    const userRef = doc(db, 'users', user.uid);
    batch.update(userRef, {
      points,
      round1_wrong_count: wrongCount,
      yellow_cards: yellowCards,
      red_cards: redCards,
      bannedMatchIds
    });
  }

  // Update or create predictions
  console.log('\nUpdating prediction documents in Firestore...');
  for (const [predId, data] of Object.entries(predsToUpdate)) {
    const pRef = doc(db, 'predictions', predId);
    batch.set(pRef, {
      id: data.id,
      userId: data.userId,
      matchId: data.matchId,
      choice: data.choice,
      pointsEarned: data.pointsEarned,
      isResultCorrect: data.isResultCorrect,
      isVoided: data.isVoided,
      createdAt: data.createdAt || { seconds: Date.now() / 1000 }
    });
  }

  // Clean up any old penalty predictions that are no longer valid (e.g. if the user is now banned on that match)
  // Wait, if a user was banned on a match, they get points = 0 and isVoided = true, which we update.
  // What if we have predictions in Firestore that are not in our calculated list?
  // Only penalty docs that were created before but are no longer penalty docs (e.g. they became banned instead).
  // Our loop handles it because we rewrite them in `predsToUpdate` with `isVoided = true` and `choice = null` (or they are kept).
  // So batch.set will overwrite them correctly.

  await batch.commit();
  console.log('\nRetroactive calculation and corrections completed successfully!');
  process.exit(0);
}

main().catch(console.error);
