import numpy as np
import cv2
from mss import mss

from aiortc import VideoStreamTrack
from av import VideoFrame


class ScreenTrack(VideoStreamTrack):
    def __init__(self, monitor_index: int = 1):
        super().__init__()
        self.sct = mss()
        self.monitor_index = monitor_index
        self.monitor = self.sct.monitors[self.monitor_index]

    async def recv(self):
        # Grab raw screen pixels from the selected monitor.
        sct_img = self.sct.grab(self.monitor)
        img = np.array(sct_img)

        # Convert BGRA -> BGR for OpenCV and WebRTC compatibility.
        frame = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        # Ensure the frame is valid before constructing the video frame.
        if frame.size == 0:
            raise RuntimeError("Captured frame is empty")

        video_frame = VideoFrame.from_ndarray(frame, format="bgr24")
        video_frame.pts, video_frame.time_base = await self.next_timestamp()

        return video_frame