import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc, getDocs, collection, query, where, writeBatch, deleteField } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const matchId = process.argv[2];

if (!matchId) {
  console.error("Please provide a matchId. Example: node revert_match.js France_Senegal_1781596800000");
  process.exit(1);
}

async function main() {
  const matchDocRef = doc(db, 'matches', matchId);
  const matchSnap = await getDoc(matchDocRef);
  
  if (!matchSnap.exists()) {
    console.error(`Match with ID ${matchId} not found.`);
    process.exit(1);
  }
  
  const match = { id: matchSnap.id, ...matchSnap.data() };
  console.log(`Reverting match: ${match.homeTeam} vs ${match.awayTeam} (${matchId})`);
  
  const predictionsSnap = await getDocs(query(collection(db, 'predictions'), where('matchId', '==', matchId)));
  const usersSnap = await getDocs(collection(db, 'users'));
  const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  
  const batch = writeBatch(db);
  
  // Map predictions by userId
  const predByUserId = new Map();
  predictionsSnap.docs.forEach(d => {
    predByUserId.set(d.data().userId, { ref: d.ref, ...d.data() });
  });
  
  // Revert each user's points and wrong count
  for (const userData of allUsers) {
    if (userData.role === 'admin') continue;
    
    const prediction = predByUserId.get(userData.uid);
    let pointsToSubtract = 0;
    let wrongCountToSubtract = 0;
    
    if (prediction) {
      pointsToSubtract = prediction.pointsEarned || 0;
      
      // If prediction is a penalty created by scoring (choice is null), delete it
      if (prediction.choice === null || prediction.choice === undefined) {
        console.log(`Deleting penalty prediction for user: ${userData.displayName || userData.uid}`);
        batch.delete(prediction.ref);
      } else {
        // Otherwise reset prediction scores
        batch.update(prediction.ref, {
          pointsEarned: deleteField(),
          isResultCorrect: deleteField()
        });
      }
      
      // Check if prediction was wrong and round is group, decrement wrong count
      if (match.round === 'group' || match.round === 'top32') {
        if (prediction.isResultCorrect === false && prediction.choice !== null) {
          wrongCountToSubtract = 1;
        }
      }
    }
    
    const newPoints = (userData.points || 0) - pointsToSubtract;
    const currentWrongCount = userData.round1_wrong_count || 0;
    let newWrongCount = Math.max(0, currentWrongCount - wrongCountToSubtract);
    
    let yellowCards = userData.yellow_cards || 0;
    let redCards = userData.red_cards || 0;
    let bannedMatchIds = [...(userData.bannedMatchIds || [])];
    
    // Cards & Bans reversion logic:
    if ((match.round === 'group' || match.round === 'top32') && wrongCountToSubtract > 0) {
      if (currentWrongCount === 12 && newWrongCount === 11) {
        yellowCards = Math.max(0, yellowCards - 1);
        if (bannedMatchIds.length > 0) {
          const removedMatchId = bannedMatchIds.pop();
          console.log(`Reverting ban for match ${removedMatchId} for user ${userData.displayName}`);
          const predId = `${userData.uid}_${removedMatchId}`;
          const pDoc = await getDoc(doc(db, 'predictions', predId));
          if (pDoc.exists()) {
            batch.update(pDoc.ref, { isVoided: false });
          }
        }
      }
      else if (currentWrongCount === 24 && newWrongCount === 23) {
        redCards = Math.max(0, redCards - 1);
        for (let k = 0; k < 2; k++) {
          if (bannedMatchIds.length > 0) {
            const removedMatchId = bannedMatchIds.pop();
            console.log(`Reverting ban for match ${removedMatchId} for user ${userData.displayName}`);
            const predId = `${userData.uid}_${removedMatchId}`;
            const pDoc = await getDoc(doc(db, 'predictions', predId));
            if (pDoc.exists()) {
              batch.update(pDoc.ref, { isVoided: false });
            }
          }
        }
      }
    }
    
    const userRef = doc(db, 'users', userData.uid);
    batch.update(userRef, {
      points: newPoints,
      round1_wrong_count: newWrongCount,
      yellow_cards: yellowCards,
      red_cards: redCards,
      bannedMatchIds: bannedMatchIds
    });
  }
  
  // Revert match document
  batch.update(matchDocRef, {
    status: 'scheduled',
    homeScore: deleteField(),
    awayScore: deleteField(),
    manualWinner: deleteField()
  });
  
  await batch.commit();
  console.log(`Successfully reverted match ${match.homeTeam} vs ${match.awayTeam} to scheduled!`);
  process.exit(0);
}

main().catch(console.error);
