# HIDE OR DIE — Blackridge Research Facility

HIDE OR DIE is a browser-based first-person 3D survival-horror game built with Three.js, Express and Socket.IO. This repository is structured to deploy directly from its root directory as a Node web service.

## Included gameplay

- First-person 3D camera, mouse look, WASD movement, sprint, crouch and pointer lock.
- Procedurally assembled 15-room Blackridge research facility.
- Flashlight with battery, first-person arms, minimap, stamina, mission timer and interaction prompts.
- Locker hiding, server-validated player movement and hiding.
- Grid-based monster pathfinding, patrol, investigation, chase and line-of-sight checks.
- Three randomized power-cell objectives and emergency extraction.
- Private multiplayer rooms for up to 10 players, host-controlled match start, shared player state and server-side monster simulation.
- Solo incidents with changing narrative, clue labels and collectible placement within the Blackridge facility.
- Procedural ambient drone, footsteps, threat stingers, proximity heartbeat and jumpscare audio.
- Character appearance customization (skin, hair, outfit and accessories).
- Health endpoint at /healthz.

## Controls

| Action | Keyboard / mouse |
|---|---|
| Move | W, A, S, D |
| Look | Mouse (click game view to lock pointer) |
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

Open http://localhost:3000 in a modern browser with WebGL enabled.

Run automated tests:

```bash
npm test
```

## Deploy on Render

This must be a **Node Web Service**, not a static site. The root-level render.yaml is configured for this repository layout.

- Build command: npm install
- Start command: npm start
- Health check: /healthz
- Runtime: Node

The service listens on 0.0.0.0 and uses Render's PORT environment variable.

## Important release status

This is an active game build, **not yet a verified commercial/AAA release**. The environment, props, monster and first-person hands are procedural geometry rather than photogrammetry assets or motion-captured animation. Solo incidents vary story text, clue selection and clue placement inside the same Blackridge facility; separate hospital, motel, school and mansion maps are not yet implemented. The multiplayer server currently keeps room state in memory and is designed for a single server instance. Persistent accounts, matchmaking, reconnect recovery, moderation, anti-cheat and multi-instance room storage are not implemented. The current game does not include player voice chat.

Before calling this a final release, run the automated tests and full browser/device QA, verify a public deployment, and complete the outstanding release items above.