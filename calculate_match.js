import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc, getDocs, collection, query, where, writeBatch, Timestamp } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const matchId = process.argv[2];

if (!matchId) {
  console.error("Please provide matchId");
  process.exit(1);
}

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
      if (!isNaN(p1) && !isNaN(p2)) return (p1 + p2) / 2;
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

async function applyBan(bannedIds, count, userId, batch) {
  if (count === 1) {
    const match13Id = "Spain_Cape_Verde_1781499600000";
    if (!bannedIds.includes(match13Id)) {
      bannedIds.push(match13Id);
      const predId = `${userId}_${match13Id}`;
      const predSnap = await getDocs(query(collection(db, 'predictions'), where('id', '==', predId)));
      if (!predSnap.empty) {
        batch.update(predSnap.docs[0].ref, {
          isVoided: true,
          pointsEarned: 0
        });
      }
    }
    return;
  }

  const now = Timestamp.now();
  const matchesQuery = query(
    collection(db, 'matches'),
    where('startTime', '>', now),
    where('status', '==', 'scheduled')
  );
  const matchesSnap = await getDocs(matchesQuery);
  const upcomingMatches = matchesSnap.docs
    .map(d => ({ ...d.data(), id: d.id }))
    .sort((a, b) => a.startTime.seconds - b.startTime.seconds)
    .slice(0, count);

  for (const m of upcomingMatches) {
    if (!bannedIds.includes(m.id)) {
      bannedIds.push(m.id);
      const predId = `${userId}_${m.id}`;
      const predSnap = await getDocs(query(collection(db, 'predictions'), where('id', '==', predId)));
      if (!predSnap.empty) {
        batch.update(predSnap.docs[0].ref, {
          isVoided: true,
          pointsEarned: 0
        });
      }
    }
  }
}

async function main() {
  const matchDocRef = doc(db, 'matches', matchId);
  const matchSnap = await getDoc(matchDocRef);
  if (!matchSnap.exists()) {
    console.error("Match not found");
    process.exit(1);
  }
  const match = { id: matchSnap.id, ...matchSnap.data() };
  if (match.homeScore === undefined || match.awayScore === undefined) {
    console.error("Match has no scores");
    process.exit(1);
  }

  const predictionsSnap = await getDocs(query(collection(db, 'predictions'), where('matchId', '==', matchId)));
  const usersSnap = await getDocs(collection(db, 'users'));
  const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  
  const batch = writeBatch(db);
  const predByUserId = new Map();
  predictionsSnap.docs.forEach(d => {
    predByUserId.set(d.data().userId, { ref: d.ref, ...d.data() });
  });

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

  console.log(`Calculating winner for ${match.homeTeam} vs ${match.awayTeam}: ${matchWinner}`);
  const roundScores = SCORING_MATRIX[match.round];

  for (const userData of allUsers) {
    if (userData.role === 'admin') continue;
    const prediction = predByUserId.get(userData.uid);
    let pointsChange = 0;
    let isCorrect = false;
    let wrongCountIncrement = 0;
    const isBanned = userData.bannedMatchIds?.includes(matchId);

    if (prediction) {
      if (prediction.isVoided) {
        if (prediction.choice === null || prediction.choice === undefined) {
          pointsChange = NO_PRED_PENALTY[match.round];
          isCorrect = false;
          wrongCountIncrement = 0;
        } else {
          pointsChange = 0;
          isCorrect = false;
          wrongCountIncrement = 0;
        }
      } else {
        if (matchWinner === 'push') {
          pointsChange = roundScores.correct;
          isCorrect = true;
          wrongCountIncrement = 0;
        } else {
          if (prediction.choice === matchWinner) {
            pointsChange = roundScores.correct;
            isCorrect = true;
          } else {
            pointsChange = roundScores.wrong;
            isCorrect = false;
            if (match.round === 'group') wrongCountIncrement = 1;
          }
        }
      }

      batch.update(prediction.ref, {
        pointsEarned: pointsChange,
        isResultCorrect: isCorrect
      });
    } else {
      if (isBanned) {
        pointsChange = 0;
        isCorrect = false;
        wrongCountIncrement = 0;
      } else {
        pointsChange = NO_PRED_PENALTY[match.round];
        isCorrect = false;
        wrongCountIncrement = 0;
        
        const predId = `${userData.uid}_${matchId}`;
        const newPredRef = doc(db, 'predictions', predId);
        batch.set(newPredRef, {
          id: predId,
          userId: userData.uid,
          matchId,
          choice: null,
          pointsEarned: pointsChange,
          isResultCorrect: false,
          isVoided: true,
          createdAt: Timestamp.now()
        });
      }
    }

    const oldPointsEarned = (prediction && prediction.pointsEarned !== undefined) ? prediction.pointsEarned : 0;
    const newPoints = userData.points - oldPointsEarned + pointsChange;
    const oldWrongIncrement = (prediction && prediction.isResultCorrect === false && prediction.choice !== null && prediction.choice !== undefined) ? 1 : 0;
    const newWrongCount = (userData.round1_wrong_count || 0) - oldWrongIncrement + wrongCountIncrement;
    let newYellowCards = userData.yellow_cards || 0;
    let newRedCards = userData.red_cards || 0;
    const newBannedMatchIds = [...(userData.bannedMatchIds || [])];

    if (match.round === 'group' && wrongCountIncrement > 0) {
      if (newWrongCount === 12) {
        newYellowCards += 1;
        await applyBan(newBannedMatchIds, 1, userData.uid, batch);
      } else if (newWrongCount === 24) {
        newRedCards += 1;
        await applyBan(newBannedMatchIds, 2, userData.uid, batch);
      }
    }

    batch.update(doc(db, 'users', userData.uid), {
      points: newPoints,
      round1_wrong_count: newWrongCount,
      yellow_cards: newYellowCards,
      red_cards: newRedCards,
      bannedMatchIds: newBannedMatchIds
    });
  }

  await batch.commit();
  console.log("Calculations completed successfully!");
  process.exit(0);
}

main().catch(console.error);
