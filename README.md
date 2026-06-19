# WebRTC Audio, Video, and Screen Sharing

This project has two WebRTC examples:

- A browser-based two-way audio/video call.
- A Python screen-sharing demo using `aiortc`, MSS, and OpenCV.

The browser call is the recommended way to test audio and video because the browser handles camera, microphone, speakers, and video display safely.

## Features

- Room-based WebRTC signaling so two browsers can connect using the same room name.
- Automatic unique client IDs generated for each browser tab or device.
- Live status updates for waiting, connecting, and disconnecting peers.
- Mute, camera toggle, and hang-up controls during a call.
- Clear guidance for HTTPS access when testing from a LAN IP address.

## Requirements

- Python 3.9 or newer
- `pip`
- A browser with WebRTC support, such as Chrome, Chromium, Firefox, or Edge
- Camera and microphone permission in the browser

## Installation

```bash
bash install.sh
```

Manual setup:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run the Browser Audio/Video Call

Start the FastAPI server:

```bash
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Open this page in two browser tabs or on two devices:

```text
http://localhost:8000
```

Use the same room name in both tabs, then click **Join**. The browser will ask for camera and microphone permission. After both sides join, each browser should show local video and remote video.

For another device on the same network, the browser needs HTTPS before it allows camera and microphone access on a LAN IP address.

Create a local certificate:

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout localhost.key \
  -out localhost.crt \
  -days 365 \
  -subj "/CN=192.168.1.14" \
  -addext "subjectAltName=IP:192.168.1.14,DNS:localhost"
```

Start the server with HTTPS:

```bash
.venv/bin/python -m uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --ssl-keyfile localhost.key \
  --ssl-certfile localhost.crt
```

Then open this URL from the other device:

```text
https://192.168.1.14:8000
```

Your browser may warn that the certificate is self-signed. Accept the warning for local testing.

## Deployment note

This project uses FastAPI WebSockets for call signaling. The page can be hosted as static files anywhere, but the `/ws/{room_id}/{client_id}` signaling route must run on a server that supports long-running WebSocket connections and shared in-memory room state.

Do not use Vercel serverless as the only backend for this version of the app. On Vercel, the page may load, camera permission may work, and both users may join the same room, but the WebSocket signaling server will not behave like the local `uvicorn` server. The result is usually a black remote video area or both peers waiting forever.

Use one of these instead:

- Run locally on your laptop with `uvicorn` for same-Wi-Fi testing.
- Deploy the FastAPI app to a persistent server host such as Render, Railway, Fly.io, or a VPS.
- Keep Vercel for the frontend only, then point the frontend to a separate WebSocket signaling backend.

## Browser Call Controls

- **Mute** turns your microphone track off.
- **Unmute** turns your microphone track back on.
- **Camera Off** turns your camera video track off.
- **Camera On** turns your camera video track back on.
- **Hang Up** closes the peer connection and stops your camera and microphone.

## How the Browser Call Works

### `main.py`

`main.py` is the FastAPI server.

It does two jobs:

- Serves the browser page at `/`.
- Relays WebRTC signaling messages through WebSockets.

The browser call uses this WebSocket path:

```text
/ws/{room_id}/{client_id}
```

The server stores connected clients by room. When a browser joins, the server sends a `peer-list` message so each browser knows who else is in the room.

The server does not process camera or microphone data. It only passes setup messages between browsers.

### `static/index.html`

`static/index.html` is the call page.

It contains:

- A room input.
- A join button.
- A local video element.
- A remote video element.
- Mute, camera, and hangup buttons.

### Browser JavaScript modules

The browser logic is split across several files in `static/js`:

- `state.js` stores the shared app state, DOM references, and the generated client ID.
- `signaling.js` opens the WebSocket URL and sends/receives signaling messages.
- `webrtc.js` creates peer connections, handles offers/answers, shares ICE candidates, and closes connections.
- `ui.js` wires up the join, mute, camera, and hang-up buttons.
- `media.js` requests camera and microphone permission and starts or stops local tracks.

The setup messages are:

- `offer`: one browser asks to start a call.
- `answer`: the other browser accepts the call.
- `ice-candidate`: browsers share network connection options.
- `leave`: one browser left the call.

The actual audio and video flow directly through WebRTC. The FastAPI server is only the messenger that helps the browsers find and connect to each other.