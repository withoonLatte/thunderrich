import express from "express";
import admin from "firebase-admin";

// Inline Firebase helper
function getFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (projectId && clientEmail && privateKey) {
        console.log("[FIREBASE] Initializing with ENV credentials for project:", projectId);
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        console.log("[FIREBASE] Initializing with Defaults (Expected on AIS/Cloud Run)");
        admin.initializeApp();
      }
    } catch (error: any) {
      console.error("[FIREBASE-INIT-ERROR]", error);
    }
  }
  return admin;
}

const app = express();
app.use(express.json());

app.get("/api/ping", (req, res) => {
  res.json({ 
    message: "pong v6 (Vercel)", 
    vercel: true, 
    time: new Date().toISOString(),
    hasFirebaseVars: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY)
  });
});

app.post("/api/admin/create-user", async (req, res) => {
  const { adminUid, username, password, displayName } = req.body;
  
  try {
    const firebaseAdmin = getFirebaseAdmin();
    
    // Check for Vercel missing vars
    if (!!process.env.VERCEL && (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL)) {
      throw new Error("Missing Firebase credentials in Vercel environment variables. Please add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
    }

    const auth = firebaseAdmin.auth();
    const db = firebaseAdmin.firestore();

    if (!adminUid) return res.status(400).json({ error: "Missing adminUid" });

    let isAdmin = adminUid === 'hardcoded-admin-id';
    if (!isAdmin) {
      const adminDoc = await db.collection('users').doc(adminUid).get();
      isAdmin = adminDoc.exists && adminDoc.data()?.role === 'admin';
    }

    if (!isAdmin) return res.status(403).json({ error: "Access Denied" });

    const email = `${username.toLowerCase().trim()}@wcpro.app`;
    const userRecord = await auth.createUser({ email, password, displayName });

    const profile = {
      uid: userRecord.uid,
      displayName,
      email,
      role: 'user',
      points: 0,
      round1_wrong_count: 0,
      yellow_cards: 0,
      red_cards: 0,
      bannedMatchIds: [],
      mustChangePassword: true
    };

    await db.collection('users').doc(userRecord.uid).set(profile);
    res.json({ success: true, uid: userRecord.uid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
