import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const usersSnap = await getDocs(collection(db, 'users'));
  const matchesSnap = await getDocs(collection(db, 'matches'));
  const predictionsSnap = await getDocs(collection(db, 'predictions'));

  const matchesMap = {};
  matchesSnap.forEach(d => {
    matchesMap[d.id] = { id: d.id, ...d.data() };
  });

  const predsByUser = {};
  predictionsSnap.forEach(d => {
    const p = d.data();
    if (!predsByUser[p.userId]) {
      predsByUser[p.userId] = [];
    }
    predsByUser[p.userId].push({ id: d.id, ...p });
  });

  const batch = writeBatch(db);

  console.log('--- RECALCULATING WRONG COUNTS ---');

  usersSnap.forEach(userDoc => {
    const userData = userDoc.data();
    if (userData.role === 'admin') return;

    const userPreds = predsByUser[userDoc.id] || [];
    
    // Determine active round for cards: if there is any finished 'top32' match, it's 'top32', else 'group'
    const hasFinishedTop32 = Object.values(matchesMap).some(m => m.round === 'top32' && m.status === 'finished');
    const activeRound = hasFinishedTop32 ? 'top32' : 'group';
    
    // Filter finished active stage matches
    const activeMatches = Object.values(matchesMap).filter(m => m.round === activeRound && m.status === 'finished');
    
    // Sort chronologically
    activeMatches.sort((a, b) => (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0));

    let actualWrongCount = 0;
    
    activeMatches.forEach(match => {
      // Check if user was banned for this match (i.e. did the user have it in bannedMatchIds before calculation?)
      // Wait, to be accurate, if isBanned is true, they were banned.
      const isBanned = userData.bannedMatchIds?.includes(match.id);
      
      if (isBanned) {
        // Banned matches don't count towards wrong count
        return;
      }

      const p = userPreds.find(pred => pred.matchId === match.id);
      if (p) {
        // A prediction is wrong if result is incorrect and choice is not null (real prediction made)
        const isWrong = p.isResultCorrect === false && p.choice !== null && p.choice !== undefined;
        if (isWrong) {
          actualWrongCount++;
        }
      }
    });

    console.log(`User: ${userData.displayName} (${userDoc.id}) | Current wrong_count: ${userData.round1_wrong_count} | Actual wrong_count: ${actualWrongCount}`);

    if (userData.round1_wrong_count !== actualWrongCount) {
      console.log(`  -> Updating wrong_count to ${actualWrongCount}`);
      const userRef = doc(db, 'users', userDoc.id);
      batch.update(userRef, {
        round1_wrong_count: actualWrongCount
      });
    }
  });

  await batch.commit();
  console.log('Successfully updated all user wrong counts in Firestore!');
  process.exit(0);
}

main().catch(console.error);
