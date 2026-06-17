import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const querySnapshot = await getDocs(collection(db, "matches"));
  console.log("Finished Matches:");
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.status === 'finished') {
      console.log(`- ID: ${doc.id} | ${data.homeTeam} vs ${data.awayTeam} | Score: ${data.homeScore}-${data.awayScore}`);
    }
  });
  process.exit(0);
}

main().catch(console.error);
