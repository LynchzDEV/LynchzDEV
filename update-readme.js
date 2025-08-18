import { writeFileSync } from "fs";

// Get arguments from GitHub Actions
const [, , trackName, artistName, isPlayingStr] = process.argv;

console.log("📝 Script arguments received:");
console.log("  Track:", trackName);
console.log("  Artist:", artistName);
console.log("  Is Playing:", isPlayingStr);

const isPlaying = isPlayingStr === "true";
const playingStatus = isPlaying ? "🔴 NOW PLAYING" : "⏸️ LAST PLAYED";
const trackDisplay = artistName ? `${trackName} - ${artistName}` : trackName;
const playingEmoji = isPlaying ? "🎵" : "⏸️";
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

<div style="margin: 20px 0;">
  <img src="https://readme-typing-svg.herokuapp.com?font=Inter&weight=300&size=22&duration=3000&pause=1000&color=374151&center=true&vCenter=true&width=435&lines=CS+Student+%26+Music+Enthusiast;J-Rock+%26+Metal+Fan;TypeScript+Developer" alt="Typing SVG" />
</div>

<!-- Spotify Now Playing -->
<table align="center" style="border: none;">
  <tr>
    <td align="center" style="border: none;">
      <div style="background: #ffffff; border: 1px solid #e1e8ed; border-radius: 8px; padding: 16px; min-width: 300px;">
        <div style="display: flex; align-items: center; justify-content: center;">
          <div style="margin-right: 12px; font-size: 20px;">
            ${playingEmoji}
          </div>
          <div style="text-align: left;">
            <div style="font-size: 10px; color: #657786; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              ${playingStatus}
            </div>
            <div style="font-weight: 500; color: #14171a; font-size: 14px; line-height: 1.2;">
              ${trackDisplay}
            </div>
          </div>
        </div>
      </div>
    </td>
  </tr>
</table>

## 💻 Tech Stack

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)

</div>

## 📊 GitHub Stats

<div align="center">

![GitHub Stats](https://github-readme-stats.vercel.app/api?username=LynchzDEV&show_icons=true&theme=default&hide_border=true&bg_color=ffffff&title_color=2d2d2d&text_color=6b6b6b&icon_color=a8a8a8)

</div>

## 🎵 Music Preferences

<div align="center">

| Genre | Why I Love It |
|-------|---------------|
| **J-Rock** 🎸 | Energy and emotion in perfect harmony |
| **Metal** 🤘 | Raw power that fuels my coding sessions |
| **Bass Heavy** 🎵 | Deep rhythms that keep me in the zone |

</div>

## 🚀 Currently

<div align="center">

🔹 **Learning**: Advanced TypeScript patterns
🔹 **Building**: Full-stack web applications
🔹 **Listening**: J-Rock while coding
🔹 **Exploring**: Modern web technologies

</div>

## 📫 Connect With Me

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/LynchzDEV)

</div>

---

<div align="center">
  <sub>🤖 Auto-updated via GitHub Actions • Last sync: ${timestamp}</sub>
</div>

</div>`;

try {
  writeFileSync("README.md", readmeContent);
  console.log("✅ README updated successfully!");
  console.log(`🎵 Current track: ${trackDisplay}`);
  console.log(`📅 Updated at: ${timestamp}`);
} catch (error) {
  console.error("❌ Error updating README:", error);
  process.exit(1);
}
