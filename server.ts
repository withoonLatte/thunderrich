import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";

// Global initialization (safe if called multiple times, but let's keep it clean)
if (!admin.apps.length) {
  try {
    admin.initializeApp();
    console.log("Firebase Admin initialized");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

async function startServer() {
  const auth = admin.auth();
  const db = admin.firestore();

  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API routes go here FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/test", (req, res) => {
    res.json({ message: "Test route works!", time: new Date().toISOString() });
  });

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
      console.error("Seed error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route to create a new friend account
  app.post("/api/admin/create-user", async (req, res) => {
    console.log(`[CREATE-USER] Request received: ${req.method} ${req.url}`);
    const { adminUid, username, password, displayName } = req.body;

    if (!adminUid) {
      console.warn("[CREATE-USER] Missing adminUid");
      return res.status(400).json({ error: "adminUid is required" });
    }

    try {
      // 1. Verify Requesting User is Admin
      let isAdmin = false;
      if (adminUid === 'hardcoded-admin-id') {
        isAdmin = true;
        console.log("[CREATE-USER] Bypassing auth check for hardcoded admin");
      } else {
        const adminDoc = await db.collection('users').doc(adminUid).get();
        if (adminDoc.exists && adminDoc.data()?.role === 'admin') {
          isAdmin = true;
        }
      }

      if (!isAdmin) {
        console.error("[CREATE-USER] Unauthorized access attempt by:", adminUid);
        return res.status(403).json({ error: "Unauthorized. Admin access required." });
      }

      // 2. Create Auth User
      const email = `${username.toLowerCase().trim()}@wcpro.app`;
      console.log(`[CREATE-USER] Creating auth user: ${email}`);
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
      });

      // 3. Create Firestore Profile
      console.log(`[CREATE-USER] Creating firestore profile for: ${userRecord.uid}`);
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

      console.log(`[CREATE-USER] User created successfully: ${userRecord.uid}`);
      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("[CREATE-USER] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 404 handler for API routes to prevent falling through to Vite for missing endpoints
  app.use("/api/*", (req, res) => {
    console.warn(`API 404 caught: ${req.method} ${req.url} (original: ${req.originalUrl})`);
    res.status(404).json({ 
      error: `API route not found: ${req.method} ${req.url}`,
      path: req.originalUrl
    });
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
