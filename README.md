
# Music App Prototype 🎵

A frontend-only **Music App** built with **HTML, CSS, JavaScript**.  
It simulates a Spotify-like streaming site with Artist/Streamer dashboards and an Admin panel.

## Features
- **Login/Register with verification simulation** (artist or streamer roles).
- **Artist Dashboard**: upload tracks/videos (metadata only), wallet balance ($3/1000 streams + $1 per 5hrs active), withdrawals (min $200).
- **Streamer Dashboard**: wallet updates, withdrawals (min $100), follow artists, interact with uploads.
- **Admin Panel**: manage users, approve withdrawals, remove uploads, block/unblock users.
- **Player controls**: play/pause, prev/next, shuffle/repeat, volume.
- **Responsive UI**: works on desktop, tablet, and phone.

⚠️ **Note:** This is a **client-side demo only**. File uploads are only available for playback during the same session. Metadata persists in `localStorage`.  
A real backend would be required for production (auth, storage, payments, moderation).

## Admin Account
```
Email: admin@musicapp.test
Password: admin
```

## Getting Started

### Option 1 — Open in Browser
Simply double-click `index.html` to open in your browser.

### Option 2 — Run Local Server (Recommended)
If you have Node.js installed:

```bash
# Install a simple static server
npm install -g http-server

# Run the server
http-server .

# Open in browser
http://localhost:8080
```

### Option 3 — Live Server Extension (VS Code)
If you're using VS Code, install the **Live Server** extension and click "Go Live" to run.

## File Structure
```
.
├── index.html      # Main entry
├── styles.css      # Styles (responsive)
├── app.js          # Core logic
└── README.md       # This file
```

## Next Steps (Future Work)
- Add backend (Node/Express, database, file storage).
- Implement real authentication & secure payments.
- Store and stream real audio/video files.
- Improve UI/UX with animations and richer playlist features.

---
MIT License © 2025
