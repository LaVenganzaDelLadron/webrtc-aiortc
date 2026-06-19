import json
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

legacy_clients = {}
rooms = {}


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.websocket("/ws/{client_id}")
async def legacy_ws(websocket: WebSocket, client_id: str):
    """Keep the original Python screen-share signaling route working."""
    await websocket.accept()
    legacy_clients[client_id] = websocket

    try:
        while True:
            data = await websocket.receive_text()
            target, msg = data.split("|", 1)

            if target in legacy_clients:
                await legacy_clients[target].send_text(msg)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if legacy_clients.get(client_id) is websocket:
            legacy_clients.pop(client_id, None)


async def send_peer_list(room_id: str):
    room = rooms.get(room_id, {})
    peer_ids = list(room.keys())

    for peer_id, websocket in list(room.items()):
        peers = [other_id for other_id in peer_ids if other_id != peer_id]
        await websocket.send_json({
            "type": "peer-list",
            "sender": "server",
            "target": peer_id,
            "data": {"peers": peers},
        })


async def relay_to_peer(room_id: str, message: dict):
    target = message.get("target")
    target_socket = rooms.get(room_id, {}).get(target)

    if target_socket is not None:
        await target_socket.send_json(message)


@app.websocket("/ws/{room_id}/{client_id}")
async def call_ws(websocket: WebSocket, room_id: str, client_id: str):
    """Room-based signaling for browser audio/video calls."""
    await websocket.accept()
    room = rooms.setdefault(room_id, {})
    room[client_id] = websocket
    await send_peer_list(room_id)

    try:
        while True:
            message = await websocket.receive_json()
            message.setdefault("sender", client_id)

            if message.get("type") in {"offer", "answer", "ice-candidate", "leave"}:
                await relay_to_peer(room_id, message)
    except WebSocketDisconnect:
        pass
    except json.JSONDecodeError:
        pass
    except Exception:
        pass
    finally:
        room = rooms.get(room_id, {})
        if room.get(client_id) is websocket:
            room.pop(client_id, None)

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
            rooms.pop(room_id, None)
