import { Router } from "express";
import { SpotifyClient } from "../utils/spotify-client.js";
import type { SpotifyConfig } from "../types/spotify.js";

const router = Router();

router.get("/", (req, res) => {
  try {
    const config: SpotifyConfig = {
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      refreshToken: process.env.SPOTIFY_REFRESH_TOKEN!,
      redirectUri: `https://${process.env.DOMAIN}/api/callback`,
    };

    const client = new SpotifyClient(config);
    const authUrl = client.generateAuthUrl();

    res.redirect(authUrl);
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).send("Authentication setup error");
  }
});

export default router;
