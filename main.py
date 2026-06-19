import json
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Create the FastAPI app.
# This server serves the web page and also helps browsers exchange call setup data.
app = FastAPI()

# Find the folder that contains the static web files.
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Serve files from the static folder under /static.
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Old screen-sharing demo keeps a simple map of client_id -> websocket.
legacy_clients = {}

# New browser call system keeps a room -> map of client_id -> websocket.
# This lets the server forward messages only to peers in the same room.
rooms = {}


@app.get("/")
async def index():
    # Return the main HTML page when someone opens the site.
    return FileResponse(STATIC_DIR / "index.html")


@app.websocket("/ws/{client_id}")
async def legacy_ws(websocket: WebSocket, client_id: str):
    """Keep the older Python screen-share signaling route working."""
    # Accept the connection and save this socket for later forwarding.
    await websocket.accept()
    legacy_clients[client_id] = websocket

    try:
        while True:
            # Messages use the format: target_client|message_body.
            data = await websocket.receive_text()
            target, msg = data.split("|", 1)

            # If the target client is still connected, send the message to them.
            if target in legacy_clients:
                await legacy_clients[target].send_text(msg)
    except WebSocketDisconnect:
        # The client closed the connection normally.
        pass
    except Exception:
        # Any unexpected error is ignored so the server can keep running.
        pass
    finally:
        # Remove the client only if this exact socket is still registered.
        if legacy_clients.get(client_id) is websocket:
            legacy_clients.pop(client_id, None)


async def send_peer_list(room_id: str):
    # Get all clients currently in the room.
    room = rooms.get(room_id, {})
    peer_ids = list(room.keys())

    # Tell each client which other peers are already here.
    for peer_id, websocket in list(room.items()):
        peers = [other_id for other_id in peer_ids if other_id != peer_id]
        await websocket.send_json({
            "type": "peer-list",
            "sender": "server",
            "target": peer_id,
            "data": {"peers": peers},
        })


async def relay_to_peer(room_id: str, message: dict):
    # Find the intended receiver inside the room.
    target = message.get("target")
    target_socket = rooms.get(room_id, {}).get(target)

    # Forward the message if that peer is still connected.
    if target_socket is not None:
        await target_socket.send_json(message)


@app.websocket("/ws/{room_id}/{client_id}")
async def call_ws(websocket: WebSocket, room_id: str, client_id: str):
    """Room-based signaling for browser audio/video calls."""
    # Accept the WebSocket and register this client in the selected room.
    await websocket.accept()
    room = rooms.setdefault(room_id, {})
    room[client_id] = websocket

    # Notify everyone in the room about the current peer list.
    await send_peer_list(room_id)

    try:
        while True:
            # Read one signaling message from the browser.
            message = await websocket.receive_json()
            message.setdefault("sender", client_id)

            # Only forward the messages that are needed for WebRTC setup.
            if message.get("type") in {"offer", "answer", "ice-candidate", "leave"}:
                await relay_to_peer(room_id, message)
    except WebSocketDisconnect:
        # The browser closed the connection.
        pass
    except json.JSONDecodeError:
        # A bad message can happen during debugging or if the client sends junk.
        pass
    except Exception:
        # A general fallback keeps the server from crashing on a single bad client.
        pass
    finally:
        # Remove this client from the room when the socket closes.
        room = rooms.get(room_id, {})
        if room.get(client_id) is websocket:
            room.pop(client_id, None)

        # If the room still has other members, tell them someone left.
        if room:
            leave_message = {
                "type": "leave",
                "sender": client_id,
                "target": None,
                "data": {},
            }
            for peer_id, peer_socket in list(room.items()):
                await peer_socket.send_json({**leave_message, "target": peer_id})
            await send_peer_list(room_id)
        else:
            # Remove the room if nobody is left.
            rooms.pop(room_id, None)
