import asyncio
import json
import websockets
import cv2

from aiortc import RTCPeerConnection, RTCSessionDescription

SIGNAL = "ws://localhost:8000/ws/clientB"
TARGET = "clientA"

pc = RTCPeerConnection()


@pc.on("track")
def on_track(track):

    print("Track received:", track.kind)

    async def display():
        while True:
            frame = await track.recv()
            img = frame.to_ndarray(format="bgr24")

            cv2.imshow("Screen Share", img)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    asyncio.create_task(display())


async def run():
    async with websockets.connect(SIGNAL) as ws:

        data = await ws.recv()
        offer = json.loads(data)

        await pc.setRemoteDescription(
            RTCSessionDescription(offer["sdp"], offer["type"])
        )

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await ws.send(f"{TARGET}|{json.dumps({
            'sdp': pc.localDescription.sdp,
            'type': pc.localDescription.type
        })}")

        await asyncio.Future()

asyncio.run(run())