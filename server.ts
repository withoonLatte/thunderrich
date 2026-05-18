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
    console.log(`[SERVER] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API routes
  const api = express.Router();
  app.use("/api", api);

  api.get("/health", (req, res) => res.json({ status: "ok" }));
  api.get("/ping", (req, res) => {
    res.json({ 
      message: "pong", 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV
    });
  });

  // Admin: Create User
  api.post("/admin/create-user", async (req, res) => {
    const { adminUid, username, password, displayName } = req.body;
    
    try {
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
      res.json({ success: true, uid: userRecord.uid });
    } catch (err: any) {
      console.error("Create User Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Catch all for API
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
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
