import os
import sys

import asyncio
import json
import websockets

from aiortc import RTCPeerConnection, RTCSessionDescription

SIGNAL = "ws://localhost:8000/ws/clientB"
TARGET = "clientA"

pc = RTCPeerConnection()


def wants_window():
    return "--window" in sys.argv


def has_display():
    if sys.platform.startswith("linux"):
        return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
    return True


def should_open_window():
    if "--headless" in sys.argv:
        return False
    if not has_display():
        return False
    if sys.platform.startswith("linux") and os.environ.get("XDG_SESSION_TYPE") == "wayland":
        return wants_window()
    return True


def configure_qt_backend():
    if not sys.platform.startswith("linux"):
        return

    if os.environ.get("XDG_SESSION_TYPE") == "wayland" or os.environ.get("WAYLAND_DISPLAY"):
        os.environ.setdefault("QT_QPA_PLATFORM", "wayland")
    elif os.environ.get("DISPLAY"):
        os.environ.setdefault("QT_QPA_PLATFORM", "xcb")

    os.environ.setdefault("QT_QPA_FONTDIR", "/usr/share/fonts/truetype/dejavu")


def open_display_window():
    configure_qt_backend()
    import cv2

    cv2.namedWindow("Screen Share", cv2.WINDOW_NORMAL)
    return cv2


@pc.on("track")
def on_track(track):
    print("Track received:", track.kind)

    async def display():
        cv2 = None
        display_enabled = should_open_window()

        if display_enabled:
            try:
                cv2 = open_display_window()
            except Exception as e:
                display_enabled = False
                print(f"Warning: display setup failed: {e}")
                print("Continuing in headless mode.")
        else:
            if "--headless" in sys.argv:
                print("Headless mode requested. Receiving video without opening a window.")
            elif has_display() and sys.platform.startswith("linux") and os.environ.get("XDG_SESSION_TYPE") == "wayland":
                print("Wayland session detected. Receiving video in headless mode.")
                print("To try the OpenCV window anyway, run: python3 server.py --window")
            elif has_display():
                print("Display disabled. Receiving video in headless mode.")
            else:
                print("No display detected. Receiving video in headless mode.")

        try:
            while True:
                try:
                    frame = await asyncio.wait_for(track.recv(), timeout=2)
                    img = frame.to_ndarray(format="bgr24")

                    if img is None or img.size == 0:
                        continue

                    if not display_enabled:
                        continue

                    try:
                        cv2.imshow("Screen Share", img)
                        key = cv2.waitKey(1) & 0xFF
                    except cv2.error as e:
                        display_enabled = False
                        print(f"Warning: display failed: {e}")
                        print("Continuing in headless mode.")
                        continue

                    if key in (ord("q"), 27):
                        print("Viewer requested exit.")
                        await pc.close()
                        break
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    print(f"Frame error: {e}")
                    await asyncio.sleep(0.1)
        finally:
            if cv2 is not None:
                try:
                    cv2.destroyAllWindows()
                except Exception:
                    pass

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


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
