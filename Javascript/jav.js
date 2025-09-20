  const clientId = "YOUR_SPOTIFY_CLIENT_ID"; // replace with your Client ID
  const redirectUri = window.location.origin + window.location.pathname;
  const scopes = "user-read-private user-read-email";
  const authEndpoint = "https://accounts.spotify.com/authorize";
  const loginUrl = `${authEndpoint}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=token&show_dialog=true`;

  let token = null;
  let playlist = [];
  let currentIndex = 0;
  let audio = new Audio();

  // Parse token from URL
  function getTokenFromUrl() {
    const hash = window.location.hash.substring(1).split("&").reduce((acc, item) => {
      if (item) {
        const parts = item.split("=");
        acc[parts[0]] = decodeURIComponent(parts[1]);
      }
      return acc;
    }, {});
    return hash.access_token;
  }

  token = getTokenFromUrl();

  // If no token, show login button
  if (!token) {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Login with Spotify";
    loginBtn.style.margin = "20px";
    loginBtn.onclick = () => { window.location = loginUrl; };
    document.querySelector(".content-section").prepend(loginBtn);
  } else {
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
    loadNewReleases();
  }

  // Fetch New Releases
  async function loadNewReleases() {
    const res = await fetch("https://api.spotify.com/v1/browse/new-releases?limit=8", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    const artistsContainer = document.querySelector(".artists");
    artistsContainer.innerHTML = "";

    playlist = []; // reset

    for (let album of data.albums.items) {
      const tracksRes = await fetch(`https://api.spotify.com/v1/albums/${album.id}/tracks?limit=1`, {
        headers: { Authorization: "Bearer " + token }
      });
      const tracksData = await tracksRes.json();
      const track = tracksData.items[0];
      if (!track?.preview_url) continue; // skip if no preview

      playlist.push({
        title: track.name,
        artist: album.artists.map(a => a.name).join(", "),
        cover: album.images[0]?.url,
        url: track.preview_url
      });

      const div = document.createElement("div");
      div.classList.add("artist");
      div.innerHTML = `
        <img src="${album.images[0]?.url}" alt="${album.name}">
        <p><strong>${album.name}</strong></p>
        <p>${album.artists.map(a => a.name).join(", ")}</p>
        <button onclick="playTrack(${playlist.length - 1})">▶️ Preview</button>`;
    
      artistsContainer.appendChild(div);
    }
  }

  // Update bottom player UI
  function updatePlayerUI(track) {
    document.querySelector(".song-title").textContent = track.title;
    document.querySelector(".artist-name").textContent = track.artist;
    document.querySelector(".song-info img").src = track.cover;
  }

  // Play a track from playlist
  function playTrack(index) {
    currentIndex = index;
    const track = playlist[currentIndex];
    if (!track) return;

    audio.pause();
    audio = new Audio(track.url);
    audio.play();

    updatePlayerUI(track);
    document.querySelector(".play").textContent = "⏸️";
  }

  // Toggle play/pause
  function togglePlay() {
    if (audio.paused) {
      audio.play();
      document.querySelector(".play").textContent = "⏸️";
    } else {
      audio.pause();
      document.querySelector(".play").textContent = "▶️";
    }
  }

  // Next / Previous
  function nextTrack() {
    currentIndex = (currentIndex + 1) % playlist.length;
    playTrack(currentIndex);
  }

  function prevTrack() {
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(currentIndex);
  }

  // Hook up bottom player buttons
  document.querySelector(".play").addEventListener("click", togglePlay);
  document.querySelector(".control-buttons button:nth-child(2)").addEventListener("click", prevTrack);
  document.querySelector(".control-buttons button:nth-child(4)").addEventListener("click", nextTrack);

  // Progress bar update
  const progressBar = document.querySelector(".progress input");
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      progressBar.value = (audio.currentTime / audio.duration) * 100;
    }
  });
  progressBar.addEventListener("input", () => {
    audio.currentTime = (progressBar.value / 100) * audio.duration;
  });

  // Volume control
  const volumeBar = document.querySelector(".extras input[type=range]");
  volumeBar.addEventListener("input", () => {
    audio.volume = volumeBar.value / 100;
  });

  // Expose playTrack for buttons in album list
  window.playTrack = playTrack;
