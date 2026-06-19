import asyncio
import json
import websockets

from aiortc import RTCPeerConnection, RTCSessionDescription
from sharescreen.screen_track import ScreenTrack

SIGNAL = "ws://localhost:8000/ws/clientA"
TARGET = "clientB"

pc = RTCPeerConnection()

# Add screen track
pc.addTrack(ScreenTrack())


async def run():
    async with websockets.connect(SIGNAL) as ws:

        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        await ws.send(f"{TARGET}|{json.dumps({
            'sdp': pc.localDescription.sdp,
            'type': pc.localDescription.type
        })}")

        data = await ws.recv()
        answer = json.loads(data)

        await pc.setRemoteDescription(
            RTCSessionDescription(answer["sdp"], answer["type"])
        )

        await asyncio.Future()

asyncio.run(run())