// ================== CONFIG ==================
const CLIENT_ID = "400513ab495142d5a0a910d7dc443489";     // <-- Replace with your Spotify client ID
const REDIRECT_URI = "https://mcmusicplayer.com";  // <-- Replace with your redirect URI
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state"
];
const AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES.join('%20')}`;

// ================== AUTH ==================
function getTokenFromHash() {
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.substring(1));
  return params.get("access_token");
}

let accessToken = getTokenFromHash();
if (!accessToken) {
  // Redirect to Spotify Auth if no token
  window.location = AUTH_URL;
} else {
  window.history.pushState("", document.title, window.location.pathname); // Clean URL
  initApp();
}

// ================== MAIN APP ==================
async function initApp() {
  await loadNewReleases();
  initPlayer();
}

// Fetch latest releases from Spotify
async function loadNewReleases() {
  const releaseContainer = document.getElementById("release-container");
  releaseContainer.innerHTML = "<p>Loading new releases...</p>";

  try {
    const res = await fetch("https://api.spotify.com/v1/browse/new-releases?country=US&limit=12", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    releaseContainer.innerHTML = "";

    data.albums.items.forEach(album => {
      const albumDiv = document.createElement("div");
      albumDiv.className = "album";

      albumDiv.innerHTML = `
        <img src="${album.images[0].url}" alt="${album.name}">
        <p class="album-name">${album.name}</p>
        <p class="album-artist">${album.artists.map(a => a.name).join(', ')}</p>
        <button class="play-btn" data-uri="${album.uri}">▶ Play</button>
      `;

      releaseContainer.appendChild(albumDiv);
    });

    // Play button events
    document.querySelectorAll(".play-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        const uri = e.target.dataset.uri;
        playTrack(uri);
      });
    });

  } catch (err) {
    releaseContainer.innerHTML = `<p>Error loading releases: ${err}</p>`;
  }
}

// ================== SPOTIFY WEB PLAYBACK SDK ==================
function initPlayer() {
  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: "MC Music Player",
      getOAuthToken: cb => { cb(accessToken); },
      volume: 0.5
    });

    // Error handling
    player.addListener("initialization_error", ({ message }) => console.error(message));
    player.addListener("authentication_error", ({ message }) => console.error(message));
    player.addListener("account_error", ({ message }) => console.error(message));
    player.addListener("playback_error", ({ message }) => console.error(message));

    // Playback status updates
    player.addListener("player_state_changed", state => {
      if (!state) return;
      document.querySelector(".song-title").textContent = state.track_window.current_track.name;
      document.querySelector(".artist-name").textContent =
        state.track_window.current_track.artists.map(a => a.name).join(", ");
      document.querySelector(".song-info img").src =
        state.track_window.current_track.album.images[0].url;
    });

    // Ready
    player.addListener("ready", ({ device_id }) => {
      console.log("Ready with Device ID", device_id);
      window.spotifyDeviceId = device_id; // Store for playback
    });

    player.connect();
  };
}

// Play a track/album on the player device
function playTrack(uri) {
  if (!window.spotifyDeviceId) return alert("Player not ready yet. Please wait a few seconds.");

  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${window.spotifyDeviceId}`, {
    method: "PUT",
    body: JSON.stringify({ context_uri: uri }),
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    }
  });
}
