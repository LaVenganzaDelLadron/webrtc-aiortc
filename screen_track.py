import asyncio
import numpy as np
import cv2
from mss import mss

from aiortc import VideoStreamTrack
from av import VideoFrame


class ScreenTrack(VideoStreamTrack):
    def __init__(self):
        super().__init__()
        self.sct = mss()
        self.monitor = self.sct.monitors[1]  # primary screen

    async def recv(self):
        img = np.array(self.sct.grab(self.monitor))

        frame = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        video_frame = VideoFrame.from_ndarray(frame, format="bgr24")
        video_frame.pts, video_frame.time_base = await self.next_timestamp()

        return video_frame