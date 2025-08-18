import express from "express";
import helmet from "helmet";
import compression from "compression";
import { corsMiddleware } from "./middleware/cors.js";
import authRouter from "./routes/auth.js";
import callbackRouter from "./routes/callback.js";
import spotifyRouter from "./routes/spotify.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
);

// Compression middleware
app.use(compression());

// CORS middleware
app.use(corsMiddleware);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(join(__dirname, "../public")));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/callback", callbackRouter);
app.use("/api/spotify", spotifyRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root route
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "../public/index.html"));
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
