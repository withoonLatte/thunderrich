import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";

// Initialize Firebase Admin
// Note: In Cloud Run, it will auto-detect credentials if the service account has permissions.
// Otherwise, you need to provide a service account JSON.
if (!admin.apps.length) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Developer route to seed the first admin (USE ONLY IN SETUP)
  app.post("/api/dev/seed-admin", async (req, res) => {
    const { username, password, displayName, secret } = req.body;
    
    // Very basic protection for this dev route
    if (secret !== "wc2026-setup") {
      return res.status(403).json({ error: "Invalid setup secret." });
    }

    try {
      const email = `${username.toLowerCase().trim()}@wcpro.app`;
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
      });

      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        displayName,
        email,
        role: 'admin',
        points: 0,
        round1_wrong_count: 0,
        yellow_cards: 0,
        red_cards: 0,
        bannedMatchIds: []
      });

      res.json({ success: true, message: "Admin seeded successfully!" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Route to create a new friend account
  app.post("/api/admin/create-user", async (req, res) => {
    const { adminUid, username, password, displayName } = req.body;

    try {
      // 1. Verify Requesting User is Admin
      const adminDoc = await db.collection('users').doc(adminUid).get();
      if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized. Admin access required." });
      }

      // 2. Create Auth User
      const email = `${username.toLowerCase().trim()}@wcpro.app`;
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
      });

      // 3. Create Firestore Profile
      const newUserProfile = {
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

      await db.collection('users').doc(userRecord.uid).set(newUserProfile);

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
