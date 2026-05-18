import express from "express";
import { getFirebaseAdmin } from "./firebase";

const router = express.Router();

// Logging middleware specifically for API
router.use((req, res, next) => {
  console.log(`[API-ROUTER] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

router.get("/health", (req, res) => res.json({ status: "ok" }));

router.get("/ping", (req, res) => {
  res.json({ 
    message: "pong from AIS API v4", 
    time: new Date().toISOString(),
    vercel: !!process.env.VERCEL,
    env: process.env.NODE_ENV,
    hasFirebaseVars: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY)
  });
});

// Admin: Create User
router.post("/admin/create-user", async (req, res) => {
  const { adminUid, username, password, displayName } = req.body;
  
  try {
    const firebaseAdmin = getFirebaseAdmin();
    const auth = firebaseAdmin.auth();
    const db = firebaseAdmin.firestore();

    if (!adminUid) return res.status(400).json({ error: "Missing adminUid" });

    // Check Admin
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
    console.log(`[API] User created: ${userRecord.uid}`);
    res.json({ success: true, uid: userRecord.uid });
  } catch (err: any) {
    console.error("Create User Error EXCEPTION:", err);
    res.status(500).json({ 
      error: err.message || "Unknown error",
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Catch-all API 404
router.use("*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
});

export default router;
