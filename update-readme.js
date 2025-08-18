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

const playingStatus = isPlaying ? "🔴 NOW PLAYING" : "⏸️ LAST PLAYED";
const trackDisplay = displayArtist
  ? `${displayTrack} - ${displayArtist}`
  : displayTrack;
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

<!-- Custom GIF -->
<img src="./inabak.gif" width="150" alt="Inaba Gif" />

<div style="margin: 20px 0;">
  <img src="https://readme-typing-svg.herokuapp.com?font=Inter&weight=300&size=22&duration=3000&pause=1000&color=374151&center=true&vCenter=true&width=435&lines=CS+Student+%26+Music+Enthusiast;J-Rock+%26+Metal+Fan;TypeScript+Developer" alt="Typing SVG" />
  <div align="center">
    Live with passion, <br/>
    Learn with purpose, <br/>
    Act without hesitation. <br/>
    Share it all as if there's no tomorrow. :D
  </div>
  <br/>
</div>

<!-- Enhanced Spotify Now Playing with Album Art -->
<table align="center" style="border: none;">
  <tr>
    <td align="center" style="border: none;">
      <div style="background: #ffffff; border: 1px solid #e1e8ed; border-radius: 8px; padding: 16px; min-width: 350px;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
          <!-- Album Art -->
          <div style="position: relative;">
            <img src="${displayImage}" width="50" height="50" style="border-radius: 6px; object-fit: cover;" alt="Album Art" />
            ${isPlaying ? '<div style="position: absolute; top: -3px; right: -3px; width: 12px; height: 12px; background: #1db954; border-radius: 50%; border: 2px solid white;"></div>' : ""}
          </div>

          <!-- Music Icon -->
          <div style="margin-right: 8px; font-size: 20px;">
            ${playingEmoji}
          </div>

          <!-- Track Info -->
          <div style="text-align: left; flex: 1;">
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

## 🚀 Currently

<div align="center">
<!--   <div align="left">  -->
    <ul>lovin in japanese culture</ul>
    <ul>also studying psychology in saitir path</ul>
    <ul>familiar with typescript and functional programming</ul>
    <ul>interesting with AI integration in productivity and efficiency </ul>
<!--   </div> -->
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
  console.log(`🖼️ Album art: ${displayImage}`);
  console.log(`📅 Updated at: ${timestamp}`);
} catch (error) {
  console.error("❌ Error updating README:", error);
  process.exit(1);
}
