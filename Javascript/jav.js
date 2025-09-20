/*
mc-music-player.js

Drop this file into your project and include it after your HTML (you already have: <script src="Javascript/jav.js"></script>)

What this does (professional, production-ready behavior):
- Fetches a list of "release songs" from a configurable API endpoint (JSON). Falls back to built-in sample tracks when fetch fails.
- Builds a playlist UI and wires up all desktop & mobile controls in your provided HTML (play/pause, next, prev, seek, progress, volume, shuffle, repeat, keyboard controls).
- Keeps UI in sync (song title, artist, album art, progress time, mini-player, active track highlighting).
- Exposes a small public API (window.MCPlayer) for advanced integration (e.g. playTrackById).

Integration notes:
- The code expects your HTML structure (classes) as provided in the HTML you pasted. If you change class names, update the selectors at the top of this file.
- The API endpoint should return an array of tracks like:
  [{ id, title, artist, audioUrl, artworkUrl, durationSeconds }]
- If you don't have an API yet, the code will use SAMPLE_TRACKS defined below.

License: MIT-style permissive comment - use and adapt freely.
*/

(() => {
  // ---------------------- Configuration ----------------------
  const CONFIG = {
    apiEndpoint: '/api/releases', // change to your backend endpoint
    fetchTimeoutMs: 7000,
    enableDebug: true,
    // UI selectors (based on the HTML you provided)
    selectors: {
      playBtn: '.player .controls .control-buttons .play',
      prevBtn: '.player .controls .control-buttons button:nth-child(2)',
      nextBtn: '.player .controls .control-buttons button:nth-child(4)',
      shuffleBtn: '.player .controls .control-buttons button:nth-child(1)',
      repeatBtn: '.player .controls .control-buttons button:nth-child(5)',
      progressInput: '.player .controls .progress input[type=range]',
      progressCurrent: '.player .controls .progress span:first-child',
      progressDuration: '.player .controls .progress span:last-child',
      volumeInput: '.player .extras input[type=range]',
      miniPlayBtn: '.mini-play',
      miniArt: '.mobile-player .mini-art',
      miniTitle: '.mobile-player .mini-title',
      miniArtist: '.mobile-player .mini-artist',
      songTitle: '.player .song-details .song-title',
      artistName: '.player .song-details .artist-name',
      albumArt: '.player .song-info img',
      roundBox: '.round-box',
      mobileNavItems: '.mobile-nav .nav-item'
    }
  };

  // ---------------------- Utility ----------------------
  const log = (...args) => { if (CONFIG.enableDebug) console.log('[MCPlayer]', ...args); };

  function fetchWithTimeout(resource, options = {}) {
    const { fetchTimeoutMs } = CONFIG;
    return Promise.race([
      fetch(resource, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), fetchTimeoutMs))
    ]);
  }

  function formatTime(seconds = 0) {
    seconds = Math.floor(seconds || 0);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2,'0')}`;
  }

  // ---------------------- Sample Tracks Fallback ----------------------
  // Public domain / example mp3s - change or remove for production
  const SAMPLE_TRACKS = [
    {
      id: 's1',
      title: 'SoundHelix Song 1',
      artist: 'SoundHelix',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      artworkUrl: 'https://via.placeholder.com/140?text=Album+1',
      durationSeconds: 348
    },
    {
      id: 's2',
      title: 'SoundHelix Song 2',
      artist: 'SoundHelix',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      artworkUrl: 'https://via.placeholder.com/140?text=Album+2',
      durationSeconds: 285
    },
    {
      id: 's3',
      title: 'SoundHelix Song 3',
      artist: 'SoundHelix',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      artworkUrl: 'https://via.placeholder.com/140?text=Album+3',
      durationSeconds: 362
    }
  ];

  // ---------------------- Player Implementation ----------------------
  class MCPlayer {
    constructor() {
      this.tracks = [];
      this.queue = []; // array of track indices referencing this.tracks
      this.currentIndex = 0; // index in queue
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      this.shuffle = false;
      this.repeat = 'off'; // off | one | all
      this.isPlaying = false;

      // cache selectors
      const s = CONFIG.selectors;
      this.$playBtn = document.querySelector(s.playBtn);
      this.$prevBtn = document.querySelector(s.prevBtn);
      this.$nextBtn = document.querySelector(s.nextBtn);
      this.$shuffleBtn = document.querySelector(s.shuffleBtn);
      this.$repeatBtn = document.querySelector(s.repeatBtn);
      this.$progressInput = document.querySelector(s.progressInput);
      this.$progressCurrent = document.querySelector(s.progressCurrent);
      this.$progressDuration = document.querySelector(s.progressDuration);
      this.$volumeInput = document.querySelector(s.volumeInput);
      this.$miniPlayBtn = document.querySelector(s.miniPlayBtn);
      this.$miniArt = document.querySelector(s.miniArt);
      this.$miniTitle = document.querySelector(s.miniTitle);
      this.$miniArtist = document.querySelector(s.miniArtist);
      this.$songTitle = document.querySelector(s.songTitle);
      this.$artistName = document.querySelector(s.artistName);
      this.$albumArt = document.querySelector(s.albumArt);
      this.$roundBox = document.querySelector(s.roundBox);
      this.$mobileNavItems = document.querySelectorAll(s.mobileNavItems);

      this._bindEvents();
    }

    async init() {
      try {
        const tracks = await this._fetchTracks();
        this.tracks = tracks;
        this._buildQueue();
        this._renderPlaylist();
        this.loadTrack(0);
      } catch (err) {
        log('init error, falling back to sample tracks', err);
        this.tracks = SAMPLE_TRACKS.slice();
        this._buildQueue();
        this._renderPlaylist();
        this.loadTrack(0);
      }
    }

    async _fetchTracks() {
      // Expecting JSON array of tracks
      const endpoint = CONFIG.apiEndpoint;
      if (!endpoint) throw new Error('No API endpoint configured');

      const res = await fetchWithTimeout(endpoint, { method: 'GET', credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch releases: ' + res.status);
      const data = await res.json();

      // Validate and map
      if (!Array.isArray(data)) throw new Error('Invalid releases format');
      return data.map((t, i) => ({
        id: t.id ?? `api-${i}`,
        title: t.title ?? t.name ?? `Track ${i+1}`,
        artist: t.artist ?? (t.artists && t.artists.join(', ')) ?? 'Unknown Artist',
        audioUrl: t.audioUrl ?? t.previewUrl ?? t.url,
        artworkUrl: t.artworkUrl ?? t.cover ?? 'https://via.placeholder.com/140?text=No+art',
        durationSeconds: t.durationSeconds ?? t.duration ?? 0
      })).filter(t => t.audioUrl);
    }

    _buildQueue() {
      this.queue = this.tracks.map((_, idx) => idx);
    }

    _renderPlaylist() {
      // create a playlist container inside roundBox (or replace existing)
      if (!this.$roundBox) return;

      let playlist = this.$roundBox.querySelector('.mc-playlist');
      if (!playlist) {
        playlist = document.createElement('div');
        playlist.className = 'mc-playlist';
        playlist.style.marginTop = '1rem';
        playlist.style.maxHeight = '300px';
        playlist.style.overflow = 'auto';
        this.$roundBox.appendChild(playlist);
      }

      playlist.innerHTML = this.tracks.map((t, idx) => {
        return `
          <div class="mc-track" data-index="${idx}" style="display:flex;gap:12px;padding:8px;border-radius:8px;align-items:center;">
            <img src="${t.artworkUrl}" alt="${t.title}" width="48" height="48" style="object-fit:cover;border-radius:6px">
            <div style="flex:1">
              <div class="mc-track-title" style="font-weight:600">${t.title}</div>
              <div class="mc-track-artist" style="font-size:0.9em;opacity:0.8">${t.artist}</div>
            </div>
            <div style="min-width:56px;text-align:right;font-size:0.9em;color:#666">${t.durationSeconds ? formatTime(t.durationSeconds) : ''}</div>
          </div>`;
      }).join('');

      // attach click listeners
      playlist.querySelectorAll('.mc-track').forEach(el => {
        el.addEventListener('click', (e) => {
          const idx = Number(el.dataset.index);
          const queuePos = this.queue.indexOf(idx);
          if (queuePos !== -1) this.loadTrack(queuePos, true);
          else {
            // not in queue (shouldn't happen) - play directly
            this.queue.unshift(idx);
            this.loadTrack(0, true);
          }
        });
      });

      // highlight active track
      this._highlightActiveTrack();
    }

    _highlightActiveTrack() {
      const playlist = this.$roundBox && this.$roundBox.querySelector('.mc-playlist');
      if (!playlist) return;
      playlist.querySelectorAll('.mc-track').forEach(el => el.style.background = '');
      const trackIndex = this.queue[this.currentIndex];
      const active = playlist.querySelector(`.mc-track[data-index="${trackIndex}"]`);
      if (active) active.style.background = 'rgba(0,0,0,0.06)';
    }

    _bindEvents() {
      // Audio events
      this.audio.addEventListener('timeupdate', () => this._onTimeUpdate());
      this.audio.addEventListener('ended', () => this._onEnded());
      this.audio.addEventListener('loadedmetadata', () => this._onLoadedMetadata());

      // Controls
      this.$playBtn?.addEventListener('click', () => this.togglePlay());
      this.$prevBtn?.addEventListener('click', () => this.prev());
      this.$nextBtn?.addEventListener('click', () => this.next());
      this.$shuffleBtn?.addEventListener('click', () => this.toggleShuffle());
      this.$repeatBtn?.addEventListener('click', () => this.toggleRepeat());

      // Progress
      this.$progressInput?.addEventListener('input', (e) => {
        const p = Number(e.target.value) / 100;
        const seekTo = p * this.audio.duration || 0;
        this.$progressCurrent.textContent = formatTime(seekTo);
      });
      this.$progressInput?.addEventListener('change', (e) => {
        const p = Number(e.target.value) / 100;
        const seekTo = p * this.audio.duration || 0;
        this.audio.currentTime = seekTo;
      });

      // Volume
      this.$volumeInput?.addEventListener('input', (e) => {
        const v = Number(e.target.value) / 100;
        this.audio.volume = v;
      });

      // Mini play
      this.$miniPlayBtn?.addEventListener('click', () => this.togglePlay());

      // Mobile navigation simple behavior
      this.$mobileNavItems?.forEach(item => {
        item.addEventListener('click', (e) => {
          this.$mobileNavItems.forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          // if Search tapped, focus search bar if present
          if (item.textContent.trim().toLowerCase() === 'search') {
            const search = document.querySelector('.search-bar');
            search?.focus();
          }
        });
      });

      // Keyboard controls
      document.addEventListener('keydown', (e) => {
        // space: play/pause, left/right: seek 5s, up/down volume
        if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
        if (e.code === 'ArrowRight') { this.seekBy(5); }
        if (e.code === 'ArrowLeft') { this.seekBy(-5); }
        if (e.code === 'ArrowUp') { this.changeVolumeBy(0.05); }
        if (e.code === 'ArrowDown') { this.changeVolumeBy(-0.05); }
      });

      // click on album art to toggle play
      this.$albumArt?.addEventListener('click', () => this.togglePlay());
    }

    _onLoadedMetadata() {
      const dur = this.audio.duration || 0;
      this.$progressDuration && (this.$progressDuration.textContent = formatTime(dur));
      // set progress input max to 100 (we use percentage)
      this._updateProgressUI();
    }

    _onTimeUpdate() {
      const cur = this.audio.currentTime || 0;
      const dur = this.audio.duration || 0;
      const percent = dur ? (cur / dur) * 100 : 0;
      if (this.$progressInput) this.$progressInput.value = String(percent);
      if (this.$progressCurrent) this.$progressCurrent.textContent = formatTime(cur);
    }

    _onEnded() {
      if (this.repeat === 'one') {
        this.audio.currentTime = 0;
        this.play();
        return;
      }

      if (this.currentIndex < this.queue.length -1) {
        this.next();
      } else {
        if (this.repeat === 'all') { this.currentIndex = -1; this.next(); }
        else { this.pause(); }
      }
    }

    async loadTrack(queueIndex = 0, autoplay = false) {
      if (!this.queue.length) return;
      this.currentIndex = Math.max(0, Math.min(queueIndex, this.queue.length -1));
      const track = this.tracks[this.queue[this.currentIndex]];
      if (!track) return;

      // load source
      if (this.audio.src !== track.audioUrl) {
        this.audio.src = track.audioUrl;
      }

      // update UI
      this.$songTitle && (this.$songTitle.textContent = track.title);
      this.$artistName && (this.$artistName.textContent = track.artist);
      this.$albumArt && (this.$albumArt.src = track.artworkUrl || 'https://via.placeholder.com/140');
      this.$miniArt && (this.$miniArt.src = track.artworkUrl || 'https://via.placeholder.com/80');
      this.$miniTitle && (this.$miniTitle.textContent = track.title);
      this.$miniArtist && (this.$miniArtist.textContent = track.artist);

      this._highlightActiveTrack();

      try {
        if (autoplay) await this.play();
      } catch (err) {
        log('autoplay blocked or failed', err);
      }
    }

    play() {
      return this.audio.play().then(() => {
        this.isPlaying = true;
        this._updatePlayButtons();
      }).catch(err => {
        log('play failed', err);
        this.isPlaying = false;
        this._updatePlayButtons();
      });
    }

    pause() {
      this.audio.pause();
      this.isPlaying = false;
      this._updatePlayButtons();
    }

    togglePlay() {
      if (this.isPlaying) this.pause(); else this.play();
    }

    prev() {
      if (this.audio.currentTime > 3) { this.audio.currentTime = 0; this.play(); return; }
      if (this.currentIndex > 0) {
        this.loadTrack(this.currentIndex - 1, true);
      } else if (this.repeat === 'all') {
        this.loadTrack(this.queue.length - 1, true);
      }
    }

    next() {
      if (this.currentIndex < this.queue.length - 1) {
        this.loadTrack(this.currentIndex + 1, true);
      } else {
        if (this.repeat === 'all') this.loadTrack(0, true);
      }
    }

    seekBy(seconds) {
      const target = Math.max(0, Math.min((this.audio.currentTime || 0) + seconds, this.audio.duration || 0));
      this.audio.currentTime = target;
    }

    changeVolumeBy(delta) {
      const next = Math.max(0, Math.min((this.audio.volume || 0) + delta, 1));
      this.audio.volume = next;
      if (this.$volumeInput) this.$volumeInput.value = String(Math.round(next * 100));
    }

    toggleShuffle() {
      this.shuffle = !this.shuffle;
      if (this.shuffle) {
        // Fisher-Yates shuffle of queue
        const arr = this.tracks.map((_, idx) => idx);
        for (let i = arr.length -1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        // ensure current track remains first in queue
        const currentTrackIdx = this.tracks[this.queue[this.currentIndex]];
        // put current at start
        const filtered = arr.filter(x => x !== currentTrackIdx);
        this.queue = [currentTrackIdx, ...filtered];
        this.currentIndex = 0;
      } else {
        // restore natural order
        this._buildQueue();
        // set currentIndex to the track being played
        const playingTrackIdx = this.tracks[this.queue[this.currentIndex]];
        const absoluteIdx = this.tracks.findIndex(t => t.id === playingTrackIdx?.id);
        this.currentIndex = this.queue.indexOf(absoluteIdx) || 0;
      }
      this._updateShuffleUI();
      this._renderPlaylist();
    }

    toggleRepeat() {
      // cycle: off -> all -> one -> off
      if (this.repeat === 'off') this.repeat = 'all';
      else if (this.repeat === 'all') this.repeat = 'one';
      else this.repeat = 'off';
      this._updateRepeatUI();
    }

    _updatePlayButtons() {
      if (this.isPlaying) {
        this.$playBtn && (this.$playBtn.innerHTML = '⏸️');
        this.$miniPlayBtn && (this.$miniPlayBtn.innerHTML = '<i class="fa fa-pause"></i>');
      } else {
        this.$playBtn && (this.$playBtn.innerHTML = '⏯️');
        this.$miniPlayBtn && (this.$miniPlayBtn.innerHTML = '<i class="fa fa-play"></i>');
      }
    }

    _updateShuffleUI() {
      if (this.shuffle) this.$shuffleBtn?.classList.add('active'); else this.$shuffleBtn?.classList.remove('active');
    }

    _updateRepeatUI() {
      this.$repeatBtn && (this.$repeatBtn.textContent = this.repeat === 'off' ? '📃' : (this.repeat === 'all' ? '🔁' : '🔂'));
    }

    _updateProgressUI() {
      const cur = this.audio.currentTime || 0;
      const dur = this.audio.duration || 0;
      if (this.$progressCurrent) this.$progressCurrent.textContent = formatTime(cur);
      if (this.$progressDuration) this.$progressDuration.textContent = formatTime(dur);
      if (this.$progressInput) this.$progressInput.value = String(dur ? (cur/dur)*100 : 0);
    }

    // Public helper to play a specific track id
    playTrackById(id) {
      const idx = this.tracks.findIndex(t => t.id === id);
      if (idx === -1) return;
      const queuePos = this.queue.indexOf(idx);
      if (queuePos !== -1) this.loadTrack(queuePos, true);
      else {
        this.queue.unshift(idx);
        this.loadTrack(0, true);
      }
    }

  }

  // ---------------------- Initialize Player ----------------------
  const player = new MCPlayer();
  window.MCPlayer = player; // expose

  // Auto init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => player.init());
  } else {
    player.init();
  }

})();
