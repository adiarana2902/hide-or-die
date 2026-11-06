# HIDE OR DIE — Public Multiplayer Deployment

This is the same HIDE OR DIE browser game (private multiplayer rooms, solo horror story, and character customization), with Render deployment configuration added.

## Run on your own PC

1. Install Node.js 18 or newer.
2. Open Command Prompt in the folder containing `package.json`.
3. Run `npm install`, then `npm start`.
4. Open `http://localhost:3000`.

## Publish it so friends on other networks can join (Render)

This game is a Node.js + Express + Socket.IO app. It must be deployed as a **Web Service**, not as a Static Site, because Socket.IO needs a running server and WebSocket support.

1. Extract this ZIP.
2. Sign in to GitHub and create a new repository (for example `hide-or-die`).
3. Upload the CONTENTS of this folder to the repository root. The root must show `package.json`, `server.js`, `render.yaml`, and the `public` folder. Do not upload only the ZIP file or place everything inside an extra nested folder.
4. Sign in to Render and choose **New + → Blueprint** (or create a **New + → Web Service** and connect that GitHub repository).
5. If using Blueprint, Render reads `render.yaml`. If creating a Web Service manually, use:
   - Runtime/Language: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance type: `Free` (for testing)
6. Wait for the deploy to show **Live**, then open the `https://...onrender.com` URL shown by Render.
7. Share that exact HTTPS URL with friends. Everyone opens it, and one player creates a private room; friends join using the room code.

## Important notes

- The server listens on `0.0.0.0` and uses Render's `PORT` environment variable, as required for public web services.
- Render Web Services support WebSockets, which Socket.IO uses for real-time rooms and player updates.
- Free Render web services can sleep after 15 minutes without inbound traffic. The next visit/connection can take about a minute to wake up. A restart/sleep can clear rooms because this prototype stores active rooms in server memory. Create a fresh room after reconnecting.
- Keep the game on one server instance for now. The current in-memory room system is not designed to synchronize rooms across multiple server instances.
- HTTPS on Render supports browser microphone permission. Voice chat can still fail on some networks without a production TURN server; movement/rooms do not depend on voice.

## Features

- Private multiplayer rooms for 2–10 players
- Character customization with browser-local saved design and shared room avatar
- Solo horror story with random scenarios, clues, threat events, and endings
- Keyboard and mobile touch controls

## Prototype limitations

This is a playable prototype, not a finished production game. Room state is in memory, voice uses basic WebRTC/STUN, and the visual arena is canvas pseudo-3D rather than photorealistic 3D.
