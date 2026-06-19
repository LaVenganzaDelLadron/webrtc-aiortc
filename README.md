# WebRTC Screen Sharing with aiortc

This project is a small WebRTC-based screen-sharing demo. It lets one peer capture its screen and send the stream to another peer, while a lightweight signaling server coordinates the connection setup.

## Purpose

The app demonstrates how to:
- capture the screen using MSS
- stream video over WebRTC with aiortc
- exchange connection details through a WebSocket signaling server
- display the remote stream with OpenCV

## Requirements

Before running the project, make sure you have:
- Python 3.9 or newer
- `pip` installed
- a working display environment (Linux, macOS, or Windows)
- access to a terminal to run the scripts

## Installation

### Option 1: Automated setup (recommended)

Run:

```bash
bash install.sh
```

The script will:
1. create a virtual environment named `.venv`
2. upgrade `pip`
3. install all dependencies from `requirements.txt`

### Option 2: Manual setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## How to use

### 1. Start the signaling server

From one terminal:

```bash
python main.py
```

This runs the FastAPI server that relays WebRTC signaling messages.

### 2. Start the receiver

From a second terminal:

```bash
python server.py
```

This peer waits for the offer and displays the remote screen.

### 3. Start the sender

From a third terminal:

```bash
python client.py
```

This peer captures the screen and sends it to the receiver.

## Project files

- [main.py](main.py) — FastAPI signaling server
- [client.py](client.py) — sender peer that captures and streams the screen
- [server.py](server.py) — receiver peer that displays the screen
- [screem_track.py](screem_track.py) — screen-capture track implementation
- [requirements.txt](requirements.txt) — Python dependencies
- [install.sh](install.sh) — automated setup script

## Notes

- The sender and receiver communicate through the WebSocket server in [main.py](main.py).
- The capture logic is implemented in [screem_track.py](screem_track.py).
- Press `q` while the display window is focused to stop the viewer.

## Troubleshooting

- If the import fails, make sure [client.py](client.py) uses the correct module name.
- If the connection does not start, ensure [main.py](main.py) is running before launching the peers.
- If the video window does not appear, check that your display environment is working correctly.
