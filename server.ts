import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";

// Initialize Firebase Admin
try {
  if (!admin.apps.length) {
    admin.initializeApp();
    console.log("Firebase Admin initialized successfully");
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

const auth = admin.auth();
const db = admin.firestore();

async function startServer() {
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
    console.log("Creating user request received:", req.body);
    const { adminUid, username, password, displayName } = req.body;

    if (!adminUid) {
      return res.status(400).json({ error: "adminUid is required" });
    }

    try {
      // 1. Verify Requesting User is Admin
      console.log("Verifying admin permissions for:", adminUid);
      const adminDoc = await db.collection('users').doc(adminUid).get();
      
      if (!adminDoc.exists) {
        console.error("Admin document not found for UID:", adminUid);
        return res.status(403).json({ error: "Unauthorized. Admin profile not found on server." });
      }

      if (adminDoc.data()?.role !== 'admin') {
        console.error("User is not an admin:", adminDoc.data()?.role);
        return res.status(403).json({ error: "Unauthorized. Admin access required." });
      }

      // 2. Create Auth User
      const email = `${username.toLowerCase().trim()}@wcpro.app`;
      console.log("Creating auth user:", email);
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
      });

      // 3. Create Firestore Profile
      console.log("Creating firestore profile for:", userRecord.uid);
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

      console.log("User created successfully:", userRecord.uid);
      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 404 handler for API routes to prevent falling through to Vite for missing endpoints
  app.all("/api/*", (req, res) => {
    console.warn(`API 404: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
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
