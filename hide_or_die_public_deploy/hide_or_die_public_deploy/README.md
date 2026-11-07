# HIDE OR DIE — Blackridge Research Facility

HIDE OR DIE is a browser-based first-person survival-horror prototype built with Three.js, Express and Socket.IO. It runs as a Node.js web service and supports private co-op rooms.

## What is implemented

- First-person 3D camera with mouse look, WASD movement, sprinting, crouching and pointer-lock controls.
- Procedurally assembled 12-room research facility: Cafeteria, Security, Med Bay, Offices, Storage, Central Hub, Laboratory, Isolation, Loading Bay, Generator, Reactor and Emergency Exit.
- Flashlight with a draining battery, visible first-person arms/flashlight, minimap, stamina, mission timer and interaction prompts.
- Locker hiding spots. Hidden operators are ignored by the monster's target selection until they leave the locker; the server validates that hiding occurs near a locker.
- Grid-based monster pathfinding keeps AI inside connected rooms and corridors. Co-op monster senses distinguish running noise, line of sight and quieter crouching; the monster searches a last-known position before returning to patrol.
- Three power-cell objectives and an emergency extraction objective.
- Multiplayer private room codes for 2–10 players. Host-controlled start, shared player positions, shared objectives and a server-simulated monster that patrols, investigates noise/running and chases visible survivors.
- Solo incidents with changing incident narrative, clue labels, collectible positions, corridor-aware local monster pathfinding and an escalating threat.
- Procedural ambient drone, footsteps, interaction tones, threat stingers and jump-scare audio using Web Audio.
- No player voice chat. The game does not request microphone permission or access the microphone.
- `/healthz` endpoint for service health checks.

## Controls

| Action | Keyboard / mouse |
|---|---|
| Move | W, A, S, D |
| Look | Mouse (click the game view to lock the pointer) |
| Sprint | Shift |
| Crouch | Ctrl |
| Flashlight | F |
| Hide / leave locker | H near a locker |
| Interact / collect / extract | E |
| Release mouse | Esc |

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open `http://localhost:3000` in a modern desktop browser with WebGL enabled.

Run the geometry and monster-path regression test suite with:

```bash
npm test
```

## Render deployment

This must be a **Node Web Service**, not a static site, because Socket.IO needs a running server and WebSocket support.

- Root directory: `hide_or_die_public_deploy/hide_or_die_public_deploy`
- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node

The service listens on `0.0.0.0` and uses Render's `PORT` environment variable. The `render.yaml` health-check path is `/healthz`.

The current deployment is designed for one server instance. Room data is held in memory, so a service restart clears active rooms. A free Render instance may sleep when idle; the first connection after sleep can take longer. Players should use a fresh room code after a restart.

## Current prototype limits

This is now a playable 3D first-person prototype, not a photorealistic AAA release. The environment, props, monster and first-person hands are procedural geometry; they are not scan-based photoreal assets or motion-captured animation. Solo incidents vary story text, clue selection and clue placement inside the same Blackridge facility; they do not yet load separate hospital, motel, school or mansion maps. Co-op match state and monster logic are server-side, but this is not yet a hardened production backend with persistent accounts, matchmaking, anti-cheat, reconnect recovery, moderation, or multi-instance room storage.

A modern browser and a discrete or integrated GPU with WebGL support are recommended. Performance varies by device.