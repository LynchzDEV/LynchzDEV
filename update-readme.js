import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

// Get arguments from GitHub Actions
const [, , trackName, artistName, isPlayingStr, albumImage] = process.argv;

console.log("📝 Script arguments received:");
console.log("  Track:", trackName);
console.log("  Artist:", artistName);
console.log("  Is Playing:", isPlayingStr);
console.log("  Album Image:", albumImage);

const isPlaying = isPlayingStr === "true";

// Track file to store last song info
const LAST_SONG_FILE = ".last-song.json";

// Check if the current song is the same as the last one
function isSameSong(currentTrack, currentArtist) {
  if (!existsSync(LAST_SONG_FILE)) {
    return false;
  }
  
  try {
    const lastSongData = JSON.parse(readFileSync(LAST_SONG_FILE, "utf8"));
    return lastSongData.track === currentTrack && lastSongData.artist === currentArtist;
  } catch (error) {
    console.log("⚠️ Could not read last song file:", error.message);
    return false;
  }
}

// Save current song info
function saveCurrentSong(track, artist) {
  try {
    const songData = { track, artist, timestamp: new Date().toISOString() };
    writeFileSync(LAST_SONG_FILE, JSON.stringify(songData, null, 2));
  } catch (error) {
    console.log("⚠️ Could not save current song:", error.message);
  }
}

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

// Check if this is the same song as last time
if (isSameSong(displayTrack, displayArtist)) {
  console.log("🔄 Same song as last update, skipping README update");
  console.log(`🎵 Current track: ${displayTrack} by ${displayArtist}`);
  process.exit(0);
}

// Generate random progress for the progress bar (you can make this dynamic later)
const currentTime = Math.floor(Math.random() * 180) + 30; // 30s to 3:30
const totalTime = Math.floor(Math.random() * 120) + 180; // 3:00 to 5:00
const currentTimeStr = `${Math.floor(currentTime / 60)}:${(currentTime % 60).toString().padStart(2, "0")}`;
const totalTimeStr = `${Math.floor(totalTime / 60)}:${(totalTime % 60).toString().padStart(2, "0")}`;
const progress = Math.floor((currentTime / totalTime) * 15); // 15 chars for progress bar

// Create progress bar
const progressBar = "━".repeat(progress) + "●" + "─".repeat(15 - progress);

// Generate random volume level
const volumeLevel = Math.floor(Math.random() * 8) + 1;
const volumeBar = "■".repeat(volumeLevel) + "□".repeat(8 - volumeLevel);

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
<table style="width: 100%; margin: 20px 0;">
  <tr>
    <!-- Left Column -->
    <td style="width: 50%; vertical-align: top; padding-right: 10px;">
      <div align="center">
        <img src="./inabak.gif" width="350" alt="Inaba Gif" />
      </div>
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
    </td>
    <!-- Right Column -->
    <td style="width: 50%; vertical-align: top; padding-left: 10px;">
<!--      <div style="text-align: left; color: white; font-size: 32px; line-height: 1.4;">Currently Listing To:</div> -->
<!--       <table align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"> -->
<!--         <tr> -->
<!--           <td align="center"> -->
            <div style="background: #181818; border: 1px solid #282828; border-radius: 8px; padding: 16px; min-width: 350px; max-width: 400px;" align="center">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                  <img src="${displayImage}" width="240" height="240" style="border-radius: 6px; object-fit: cover; flex-shrink: 0;" alt="Album Art" />
                  <div style="text-align: left; color: white; font-size: 12px; line-height: 1.4;">
                    🎶 <span style="font-weight: bold;">listening to:</span> ${displayTrack} by: ${displayArtist} 🎶 <br/>
                    ${currentTimeStr} ${progressBar} ${totalTimeStr} <br/>
                    Volume: ${volumeBar} <br/>
                    <span>↻      ◁ ${isPlaying ? "⏸" : "▹"} ▷     ↺ </span>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.7;">
                    <path d="M4 18L4 6M20 18L10 12L20 6V18Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 20V4L19 12L5 20Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.7;">
                    <path d="M20 6V18M4 6L14 12L4 18V6Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
<!--           </td>
        </tr>
      </table> -->
    </td>
  </tr>
</table>

<br/>

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
  
  // Save current song info for next time
  saveCurrentSong(displayTrack, displayArtist);
  
  console.log("✅ README updated successfully!");
  console.log(`🎵 Current track: ${displayTrack} by ${displayArtist}`);
  console.log(`🖼️ Album art: ${displayImage}`);
  console.log(`📅 Updated at: ${timestamp}`);
} catch (error) {
  console.error("❌ Error updating README:", error);
  process.exit(1);
}
