// ===== CONFIG =====
const CLIENT_ID    = "400513ab495142d5a0a910d7dc443489";
const REDIRECT_URI = "https://mcmusicplayer.com"; // must match dashboard
const SCOPES       = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state"
];
const STATE_KEY    = "spotify_auth_state";
const VERIFIER_KEY = "spotify_code_verifier";

// ===== PKCE Helpers =====
async function generateCodeVerifier(len = 128) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let v = "";
  const array = new Uint8Array(len);
  crypto.getRandomValues(array);
  array.forEach(x => v += chars[x % chars.length]);
  return v;
}
async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ===== Authorization =====
async function redirectToSpotifyAuthorize() {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem(VERIFIER_KEY, verifier);
  const state = crypto.randomUUID();
  localStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SCOPES.join(" ")
  });
  window.location = `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCodeForToken(code) {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  return await res.json();
}

// ===== App Init =====
let accessToken = null;
document.getElementById("login-btn").addEventListener("click", redirectToSpotifyAuthorize);

(async function init() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get("code");
  const state  = params.get("state");

  if (code && state && state === localStorage.getItem(STATE_KEY)) {
    const tokenData = await exchangeCodeForToken(code);
    accessToken = tokenData.access_token;
    window.history.replaceState({}, document.title, REDIRECT_URI);
    startApp();
  }
})();

async function startApp() {
  await loadNewReleases();
  initPlayer();
}

async function loadNewReleases() {
  const container = document.getElementById("release-container");
  container.textContent = "Loading…";
  const res = await fetch(
    "https://api.spotify.com/v1/browse/new-releases?country=US&limit=12",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  container.innerHTML = "";
  data.albums.items.forEach(album => {
    const div = document.createElement("div");
    div.className = "album";
    div.innerHTML = `
      <img src="${album.images[0].url}" alt="${album.name}">
      <p>${album.name}</p>
      <p>${album.artists.map(a => a.name).join(", ")}</p>
      <button data-uri="${album.uri}">▶ Play</button>
    `;
    div.querySelector("button").onclick = () => playAlbum(album.uri);
    container.appendChild(div);
  });
}

// ===== Spotify Web Playback SDK =====
function initPlayer() {
  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: "MC Music Player",
      getOAuthToken: cb => cb(accessToken),
      volume: 0.5
    });

    player.addListener("ready", ({ device_id }) => {
      window.spotifyDeviceId = device_id;
      console.log("Player ready", device_id);
    });

    player.addListener("player_state_changed", s => {
      if (!s) return;
      document.querySelector(".song-title").textContent =
        s.track_window.current_track.name;
      document.querySelector(".artist-name").textContent =
        s.track_window.current_track.artists.map(a => a.name).join(", ");
      document.querySelector(".song-info img").src =
        s.track_window.current_track.album.images[0].url;
    });

    player.connect();
  };
}

function playAlbum(uri) {
  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${window.spotifyDeviceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ context_uri: uri })
  });
}
