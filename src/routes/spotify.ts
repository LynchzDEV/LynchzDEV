import { Router } from "express";
import { SpotifyClient } from "../utils/spotify-client.js";
import type { SpotifyConfig, ReadmeTrackInfo } from "../types/spotify.js";

const router = Router();

// Cache for avoiding too many API calls
let cachedTrack: ReadmeTrackInfo | null = null;
let lastFetch = 0;
const CACHE_DURATION = 30 * 1000; // 30 seconds

router.get("/", async (req, res) => {
  try {
    // Return cached data if it's fresh
    if (cachedTrack && Date.now() - lastFetch < CACHE_DURATION) {
      return res.json(cachedTrack);
    }

    const config: SpotifyConfig = {
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      refreshToken: process.env.SPOTIFY_REFRESH_TOKEN!,
      redirectUri: `https://${process.env.DOMAIN}/api/callback`,
    };

    const client = new SpotifyClient(config);
    const track = await client.getTrackInfo();

    const fallback: ReadmeTrackInfo = {
      name: "Nothing playing",
      artist: "",
      album: "",
      isPlaying: false,
    };

    const result = track ?? fallback;

    // Update cache
    cachedTrack = result;
    lastFetch = Date.now();

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json(result);
  } catch (error) {
    console.error("Error fetching Spotify data:", error);

    // Return cached data if available, otherwise fallback
    if (cachedTrack) {
      return res.json(cachedTrack);
    }

    res.status(500).json({
      error: "Failed to fetch Spotify data",
      name: "Error",
      artist: "",
      album: "",
      isPlaying: false,
    });
  }
});

export default router;
