import express from "express";
import path from "path";
import apiRouter from "./src/backend/api-router";

const app = express();
app.use(express.json());

// API routes
app.use("/api", apiRouter);

// Static assets & SPA fallback (Cloud Run / Local)
async function setupStatic() {
  if (process.env.NODE_ENV !== "production") {
    // Lazy import vite only in dev
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite not found, skipping middleware");
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Don't serve index.html for API routes
      if (!req.url.startsWith('/api')) {
        const indexPath = path.join(distPath, 'index.html');
        res.sendFile(indexPath);
      }
    });
  }
}

// Only start the server if not on Vercel
if (!process.env.VERCEL) {
  setupStatic().then(() => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on port ${PORT}`);
    });
  });
}

export default app;
