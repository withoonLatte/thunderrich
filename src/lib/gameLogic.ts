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
  [TournamentRound.TOP16]: { correct: 3, wrong: -2 },
  [TournamentRound.TOP8]: { correct: 4, wrong: -2 },
  [TournamentRound.TOP4]: { correct: 5, wrong: -3 },
  [TournamentRound.THIRD_PLACE]: { correct: 5, wrong: -3 },
  [TournamentRound.FINAL]: { correct: 7, wrong: -3 },
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
  // 1. Fetch match and all predictions
  const matchDocRef = doc(db, 'matches', matchId);
  const matchSnap = await getDoc(matchDocRef);
  
  if (!matchSnap.exists()) return;
  const match = { id: matchSnap.id, ...matchSnap.data() } as Match;

  if (match.homeScore === undefined || match.awayScore === undefined) return;

  const predictionsSnap = await getDocs(query(collection(db, 'predictions'), where('matchId', '==', matchId)));
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

  for (const predDoc of predictionsSnap.docs) {
    const prediction = predDoc.data() as Prediction;
    const userRef = doc(db, 'users', prediction.userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) continue;
    const userData = userSnap.data() as User;
    if (userData.role === 'admin') continue;

    let pointsChange = 0;
    let isCorrect = false;
    let wrongCountIncrement = 0;

    if (matchWinner === 'push') {
      pointsChange = 0;
      isCorrect = false; // It's a push, not correct nor wrong for penalty
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

    // Update Prediction
    batch.update(predDoc.ref, {
      pointsEarned: pointsChange,
      isResultCorrect: isCorrect,
    });

    // Update User
    let newPoints = userData.points + pointsChange;
    let newWrongCount = (userData.round1_wrong_count || 0) + wrongCountIncrement;
    let newYellowCards = userData.yellow_cards || 0;
    let newRedCards = userData.red_cards || 0;
    let newBannedMatchIds = [...(userData.bannedMatchIds || [])];

    // Card Logic (Group Stage Only)
    if (match.round === TournamentRound.GROUP && wrongCountIncrement > 0) {
      // Check for Yellow Card (12 wrong)
      if (newWrongCount === 12) {
        newYellowCards += 1;
        // Ban for 1 next upcoming match
        await applyBan(newBannedMatchIds, 1, prediction.userId, batch);
      } 
      // Check for Red Card (24 wrong - 2nd Yellow)
      else if (newWrongCount === 24) {
        newRedCards += 1;
        // Ban for 2 next upcoming matches
        await applyBan(newBannedMatchIds, 2, prediction.userId, batch);
      }
    }

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
