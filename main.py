from fastapi import FastAPI, WebSocket

app = FastAPI()

clients = {}

@app.websocket("/ws/{client_id}")
async def ws(websocket: WebSocket, client_id: str):
    await websocket.accept()
    clients[client_id] = websocket

    try:
        while True:
            data = await websocket.receive_text()
            target, msg = data.split("|", 1)

            if target in clients:
                await clients[target].send_text(msg)

    except:
        clients.pop(client_id, None)