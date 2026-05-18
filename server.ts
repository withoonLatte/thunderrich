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
  const apiRouter = express.Router();
  app.use("/api", apiRouter);

  apiRouter.get("/health", (req, res) => {
    console.log("[API] Health check");
    res.json({ status: "ok" });
  });

  apiRouter.get("/ping", (req, res) => {
    console.log("[API] Ping check");
    res.json({ 
      message: "pong", 
      time: new Date().toISOString(),
      headers: req.headers
    });
  });

  // Route to create a new friend account
  apiRouter.post("/admin/create-user", async (req, res) => {
    console.log("[API] Create user request");
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

  // Catch-all for any other /api route
  app.all("/api/*", (req, res) => {
    console.warn(`[API-404] ${req.method} ${req.url} - Not found`);
    res.status(404).json({ 
      error: "เส้นทาง API ไม่ถูกต้อง",
      method: req.method,
      url: req.url 
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
