import { writeFileSync } from "fs";

// Get arguments from GitHub Actions
const [, , trackName, artistName, isPlayingStr, albumImage] = process.argv;

console.log("📝 Script arguments received:");
console.log("  Track:", trackName);
console.log("  Artist:", artistName);
console.log("  Is Playing:", isPlayingStr);
console.log("  Album Image:", albumImage);

const isPlaying = isPlayingStr === "true";

// Fallback data when not listening
const fallbackData = {
  name: "I'm getting on the bus to the other world, see ya!",
  artist: "TUYU",
  album: "It's Raining After All",
  image: "https://i.scdn.co/image/ab67616d0000b273ec61804d798b2c42fe23f7c3",
};

// Use fallback if no track is playing
const displayTrack =
  trackName === "Nothing playing" ? fallbackData.name : trackName;
const displayArtist =
  trackName === "Nothing playing" ? fallbackData.artist : artistName;
const displayImage =
  trackName === "Nothing playing"
    ? fallbackData.image
    : albumImage || fallbackData.image;

const playingStatus = isPlaying ? "🔴 LIVE NOW" : "🎵 LAST VIBES";
const trackDisplay = displayArtist ? `${displayTrack}` : displayTrack;
const artistDisplay = displayArtist;

const timestamp = new Date().toLocaleString("en-US", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const readmeContent = `<div align="center">

# Hi, I'm Lynchz 👋

<img src="./inabak.gif" width="200" alt="Inaba Gif" />

<div style="margin: 20px 0;">
  <img src="https://readme-typing-svg.herokuapp.com?font=Inter&weight=300&size=22&duration=3000&pause=1000&color=374151&center=true&vCenter=true&width=500&lines=CS+Student+%26+Music+Enthusiast;J-Rock+%26+Metal+Fan;TypeScript+Developer;Bass+Line+Addict" alt="Typing SVG" />
</div>

<!-- Enhanced Spotify Now Playing -->
<table align="center" style="border: none; margin: 30px 0;">
  <tr>
    <td align="center" style="border: none;">
      <div style="background: linear-gradient(135deg, #1db954 0%, #1ed760 100%); border-radius: 20px; padding: 3px; box-shadow: 0 8px 32px rgba(29, 185, 84, 0.3);">
        <div style="background: #ffffff; border-radius: 17px; padding: 20px; min-width: 350px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <!-- Album Art -->
            <div style="position: relative;">
              <img src="${displayImage}" width="80" height="80" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" alt="Album Art" />
              ${isPlaying ? '<div style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: #1db954; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; animation: pulse 2s infinite;">🎵</div>' : ""}
            </div>

            <!-- Track Info -->
            <div style="text-align: left; flex: 1; min-width: 0;">
              <div style="font-size: 11px; color: #1db954; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
                ${playingStatus}
              </div>
              <div style="font-weight: 600; color: #191414; font-size: 16px; line-height: 1.2; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${trackDisplay}
              </div>
              <div style="font-weight: 400; color: #666; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${artistDisplay}
              </div>
            </div>
          </div>

          <!-- Audio Visualizer Effect -->
          <div style="display: flex; justify-content: center; align-items: end; gap: 2px; margin-top: 16px; height: 20px;">
            ${Array.from(
              { length: 12 },
              (_, i) =>
                `<div style="width: 3px; background: linear-gradient(to top, #1db954, #1ed760); border-radius: 2px; height: ${Math.random() * 15 + 5}px; animation: wave ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate;"></div>`,
            ).join("")}
          </div>
        </div>
      </div>
    </td>
  </tr>
</table>

<!-- Music Stats with Visual Flair -->
<div style="margin: 40px 0;">
  <h2 style="color: #2d2d2d; margin-bottom: 20px;">🎵 My Musical DNA</h2>

  <table align="center" style="border: none;">
    <tr>
      <td align="center" style="border: none; padding: 10px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px; padding: 20px; min-width: 120px; color: white;">
          <div style="font-size: 24px; margin-bottom: 8px;">🎸</div>
          <div style="font-weight: 600; font-size: 18px;">J-Rock</div>
          <div style="font-size: 12px; opacity: 0.9;">Soul & Energy</div>
        </div>
      </td>
      <td align="center" style="border: none; padding: 10px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 15px; padding: 20px; min-width: 120px; color: white;">
          <div style="font-size: 24px; margin-bottom: 8px;">🤘</div>
          <div style="font-weight: 600; font-size: 18px;">Metal</div>
          <div style="font-size: 12px; opacity: 0.9;">Raw Power</div>
        </div>
      </td>
      <td align="center" style="border: none; padding: 10px;">
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 15px; padding: 20px; min-width: 120px; color: white;">
          <div style="font-size: 24px; margin-bottom: 8px;">🎵</div>
          <div style="font-weight: 600; font-size: 18px;">Bass</div>
          <div style="font-size: 12px; opacity: 0.9;">Deep Vibes</div>
        </div>
      </td>
    </tr>
  </table>
</div>

## 💻 Tech Arsenal

<div align="center" style="margin: 30px 0;">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)

</div>

## 📊 GitHub Rhythm

<div align="center">

![GitHub Stats](https://github-readme-stats.vercel.app/api?username=LynchzDEV&show_icons=true&theme=default&hide_border=true&bg_color=ffffff&title_color=2d2d2d&text_color=6b6b6b&icon_color=1db954)

![Top Languages](https://github-readme-stats.vercel.app/api/top-langs/?username=LynchzDEV&layout=compact&theme=default&hide_border=true&bg_color=ffffff&title_color=2d2d2d&text_color=6b6b6b)

</div>

## 🚀 Current Frequency

<div align="center" style="margin: 30px 0;">

<table style="border: none;">
  <tr>
    <td align="center" style="border: none; padding: 15px;">
      <div style="background: #f8f9fa; border-radius: 10px; padding: 15px; min-width: 150px;">
        <div style="font-size: 20px; margin-bottom: 8px;">📚</div>
        <div style="font-weight: 600; color: #2d2d2d;">Learning</div>
        <div style="font-size: 12px; color: #666;">Advanced TypeScript</div>
      </div>
    </td>
    <td align="center" style="border: none; padding: 15px;">
      <div style="background: #f8f9fa; border-radius: 10px; padding: 15px; min-width: 150px;">
        <div style="font-size: 20px; margin-bottom: 8px;">🛠️</div>
        <div style="font-weight: 600; color: #2d2d2d;">Building</div>
        <div style="font-size: 12px; color: #666;">Full-stack Apps</div>
      </div>
    </td>
    <td align="center" style="border: none; padding: 15px;">
      <div style="background: #f8f9fa; border-radius: 10px; padding: 15px; min-width: 150px;">
        <div style="font-size: 20px; margin-bottom: 8px;">🎧</div>
        <div style="font-weight: 600; color: #2d2d2d;">Vibing</div>
        <div style="font-size: 12px; color: #666;">To ${isPlaying ? "live music" : "TUYU"}</div>
      </div>
    </td>
  </tr>
</table>

</div>

## 📫 Connect & Vibe

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/LynchzDEV)
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/your-discord)

</div>

---

<div align="center">
  <sub>🤖 Powered by music & code • Auto-synced every 10min • ${timestamp}</sub>
  <br>
  <sub>💫 Made with TypeScript, Spotify API & lots of ☕</sub>
</div>

<style>
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

@keyframes wave {
  0% { height: 5px; }
  100% { height: 20px; }
}
</style>

</div>`;

try {
  writeFileSync("README.md", readmeContent);
  console.log("✅ README updated successfully!");
  console.log(`🎵 Current track: ${trackDisplay} by ${artistDisplay}`);
  console.log(`🖼️ Album art: ${displayImage}`);
  console.log(`📅 Updated at: ${timestamp}`);
} catch (error) {
  console.error("❌ Error updating README:", error);
  process.exit(1);
}
