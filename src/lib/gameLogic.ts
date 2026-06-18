import { 
  collection, 
  getDocs, 
  getDoc,
  query, 
  where, 
  writeBatch, 
  doc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Match, 
  Prediction, 
  TournamentRound, 
  User, 
  PredictionChoice 
} from '../types';

const SCORING_MATRIX = {
  [TournamentRound.GROUP]: { correct: 1, wrong: 0 },
  [TournamentRound.TOP32]: { correct: 2, wrong: -1 },
  [TournamentRound.TOP16]: { correct: 3, wrong: -2 },
  [TournamentRound.TOP8]: { correct: 4, wrong: -2 },
  [TournamentRound.TOP4]: { correct: 5, wrong: -3 },
  [TournamentRound.THIRD_PLACE]: { correct: 5, wrong: -3 },
  [TournamentRound.FINAL]: { correct: 7, wrong: -3 },
};

const NO_PRED_PENALTY = {
  [TournamentRound.GROUP]: -1,
  [TournamentRound.TOP32]: -1,
  [TournamentRound.TOP16]: -2,
  [TournamentRound.TOP8]: -2,
  [TournamentRound.TOP4]: -3,
  [TournamentRound.THIRD_PLACE]: -3,
  [TournamentRound.FINAL]: -3,
};

const parseHandicap = (h: string | number): number => {
  if (typeof h === 'number') return h;
  if (!h) return 0;

  const str = h.toString().trim().toLowerCase();
  
  // Handle common Thai terms
  if (str === 'เสมอ' || str === 'ขาว' || str === '0') return 0;

  // Handle formats like "0.5/1" or "0.5-1"
  if (str.includes('/') || str.includes('-')) {
    const parts = str.split(/[\/-]/);
    if (parts.length === 2) {
      const p1 = parseFloat(parts[0]);
      const p2 = parseFloat(parts[1]);
      if (!isNaN(p1) && !isNaN(p2)) {
        // For positive handicap, e.g. "0.5/1" -> 0.75
        // For negative handicap, e.g. "-0.5/-1" -> -0.75
        return (p1 + p2) / 2;
      }
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const calculateMatchResults = async (matchId: string) => {
  // 1. Fetch match, all predictions and all users
  const matchDocRef = doc(db, 'matches', matchId);
  const matchSnap = await getDoc(matchDocRef);
  
  if (!matchSnap.exists()) return;
  const match = { id: matchSnap.id, ...matchSnap.data() } as Match;

  if (match.homeScore === undefined || match.awayScore === undefined) return;

  const predictionsSnap = await getDocs(query(collection(db, 'predictions'), where('matchId', '==', matchId)));
  const usersSnap = await getDocs(collection(db, 'users'));
  
  const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User));
  const batch = writeBatch(db);

  // 2. Determine match outcome
  // Priority: manualWinner > Automatic calculation
  let matchWinner: 'home' | 'away' | 'push';
  
  if (match.manualWinner) {
    matchWinner = match.manualWinner;
  } else {
    // Formula: Diff = Home Score - Away Score + Handicap
    const numericHandicap = parseHandicap(match.handicap);
    const handicapDiff = match.homeScore - match.awayScore + numericHandicap;
    
    if (handicapDiff > 0) matchWinner = 'home';
    else if (handicapDiff < 0) matchWinner = 'away';
    else matchWinner = 'push';
  }

  const roundScores = SCORING_MATRIX[match.round];

  // Map predictions by userId for fast lookup
  const predByUserId = new Map<string, any>();
  predictionsSnap.docs.forEach(d => {
    const p = d.data() as Prediction;
    predByUserId.set(p.userId, { docRef: d.ref, ...p });
  });

  // 3. Process scoring for all users
  for (const userData of allUsers) {
    if (userData.role === 'admin') continue;

    const prediction = predByUserId.get(userData.uid);
    let pointsChange = 0;
    let isCorrect = false;
    let wrongCountIncrement = 0;
    const isBanned = userData.bannedMatchIds?.includes(matchId);

    if (prediction) {
      if (prediction.isVoided) {
        // If prediction is voided, check if it was a penalty doc created earlier
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
          pointsChange = (match.customWinScore !== undefined && match.customWinScore !== null) ? match.customWinScore : roundScores.correct;
          isCorrect = true;
          wrongCountIncrement = 0;
        } else {
          if (prediction.choice === matchWinner) {
            pointsChange = (match.customWinScore !== undefined && match.customWinScore !== null) ? match.customWinScore : roundScores.correct;
            isCorrect = true;
          } else {
            pointsChange = (match.customLossScore !== undefined && match.customLossScore !== null) ? match.customLossScore : roundScores.wrong;
            isCorrect = false;
            if (match.round === TournamentRound.GROUP) {
              wrongCountIncrement = 1;
            }
          }
        }
      }

      // Update Prediction
      batch.update(prediction.docRef, {
        pointsEarned: pointsChange,
        isResultCorrect: isCorrect,
      });
    } else {
      // No prediction exists for this user!
      if (isBanned) {
        // Banned users are not penalized since they are not allowed to predict
        pointsChange = 0;
        isCorrect = false;
        wrongCountIncrement = 0;
      } else {
        pointsChange = NO_PRED_PENALTY[match.round];
        isCorrect = false;
        wrongCountIncrement = 0;

        // Create a penalty prediction doc to preserve history and prevent double penalization
        const predId = `${userData.uid}_${matchId}`;
        const newPredRef = doc(db, 'predictions', predId);
        batch.set(newPredRef, {
          id: predId,
          userId: userData.uid,
          matchId,
          choice: null, // null represents no prediction
          pointsEarned: pointsChange,
          isResultCorrect: false,
          isVoided: true,
          createdAt: Timestamp.now()
        });
      }
    }

    // Update User points (with double-calculation protection)
    const oldPointsEarned = (prediction && prediction.pointsEarned !== undefined) ? prediction.pointsEarned : 0;
    const newPoints = userData.points - oldPointsEarned + pointsChange;
    
    const oldWrongIncrement = (prediction && prediction.isResultCorrect === false && prediction.choice !== null && prediction.choice !== undefined) ? 1 : 0;
    const newWrongCount = (userData.round1_wrong_count || 0) - oldWrongIncrement + wrongCountIncrement;
    let newYellowCards = userData.yellow_cards || 0;
    let newRedCards = userData.red_cards || 0;
    const newBannedMatchIds = [...(userData.bannedMatchIds || [])];

    // Card Logic (Group Stage Only)
    if (match.round === TournamentRound.GROUP && wrongCountIncrement > 0) {
      // Check for Yellow Card (12 wrong)
      if (newWrongCount === 12) {
        newYellowCards += 1;
        // Ban for 1 next upcoming match
        await applyBan(newBannedMatchIds, 1, userData.uid, batch);
      } 
      // Check for Red Card (24 wrong - 2nd Yellow)
      else if (newWrongCount === 24) {
        newRedCards += 1;
        // Ban for 2 next upcoming matches
        await applyBan(newBannedMatchIds, 2, userData.uid, batch);
      }
    }

    const userRef = doc(db, 'users', userData.uid);
    batch.update(userRef, {
      points: newPoints,
      round1_wrong_count: newWrongCount,
      yellow_cards: newYellowCards,
      red_cards: newRedCards,
      bannedMatchIds: newBannedMatchIds
    });
  }

  await batch.commit();
};

async function applyBan(bannedIds: string[], count: number, userId: string, batch: any) {
  // Find next upcoming matches
  const now = Timestamp.now();
  const matchesQuery = query(
    collection(db, 'matches'),
    where('startTime', '>', now),
    where('status', '==', 'scheduled')
  );
  const matchesSnap = await getDocs(matchesQuery);
  const upcomingMatches = matchesSnap.docs
    .map(d => ({ ...d.data(), id: d.id } as Match))
    .sort((a, b) => a.startTime.seconds - b.startTime.seconds)
    .slice(0, count);

  for (const m of upcomingMatches) {
    if (!bannedIds.includes(m.id)) {
      bannedIds.push(m.id);
      
      // Void existing prediction if any
      const predId = `${userId}_${m.id}`;
      // In writeBatch, we can update even if it doesn't exist? Actually update() fails if doc doesn't exist.
      // We should check if prediction exists first.
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
