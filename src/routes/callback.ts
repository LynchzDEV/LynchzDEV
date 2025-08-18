import { Router } from "express";
import { SpotifyClient } from "../utils/spotify-client.js";
import type { SpotifyConfig } from "../types/spotify.js";

const router = Router();

router.get("/", async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.status(400).send("Authorization code not found");
  }

  const ngrokUrl = process.env.NGROK_URL || `https://${process.env.DOMAIN}`;

  const config: SpotifyConfig = {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    refreshToken: "",
    redirectUri: `${ngrokUrl}/api/callback`,
  };

  try {
    const client = new SpotifyClient(config);
    const tokens = await client.exchangeCodeForTokens(code);

    console.log("🎵 Refresh token obtained:", tokens.refresh_token);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Auth Success</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
              padding: 40px;
              background: linear-gradient(135deg, #1db954 0%, #1ed760 100%);
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 16px;
              max-width: 600px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            .token {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              font-family: 'SF Mono', Monaco, monospace;
              word-break: break-all;
              border: 1px solid #e9ecef;
              font-size: 12px;
            }
            .success { color: #1db954; margin-bottom: 20px; }
            .copy-btn {
              background: #1db954;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              margin-top: 10px;
              font-size: 12px;
            }
            .env-example {
              background: #f1f3f4;
              padding: 15px;
              border-radius: 6px;
              margin-top: 15px;
              font-family: monospace;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="success">✅ Ngrok Authentication Successful!</h2>
            <p>Copy this refresh token and add it to your <code>.env</code> file:</p>

            <div class="env-example">
              SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}
            </div>

            <button class="copy-btn" onclick="copyToken()">Copy Token</button>

            <p style="margin-top: 20px; color: #666; font-size: 14px;">
              1. Add this to your <code>.env</code> file<br>
              2. Restart your server with <code>bun run dev</code><br>
              3. Test with: <code>curl "${ngrokUrl}/api/spotify"</code>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">
              🔒 Keep this token secure! You can close this page now.
            </p>
          </div>
          <script>
            function copyToken() {
              const token = "${tokens.refresh_token}";
              navigator.clipboard.writeText(token).then(() => {
                alert('Token copied to clipboard!');
              }).catch(() => {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = token;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('Token copied to clipboard!');
              });
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    res.status(500).send(`
      <h2>❌ Error</h2>
      <p>Failed to exchange code for tokens. Check the server logs.</p>
      <p>Make sure your ngrok URL is correctly set in Spotify app settings.</p>
    `);
  }
});

export default router;
