CallApp.joinRoom = async function joinRoom(room) {
  CallApp.joinedRoom = room;
  await CallApp.startLocalMedia();
  CallApp.connectSignaling(room);
};

CallApp.elements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const room = CallApp.elements.roomInput.value.trim();

  if (!room) {
    CallApp.setStatus("Enter a room name first.");
    return;
  }

  try {
    CallApp.elements.joinForm.querySelector("button").disabled = true;
    await CallApp.joinRoom(room);
  } catch (error) {
    CallApp.elements.joinForm.querySelector("button").disabled = false;
    CallApp.setStatus(`Could not start call: ${error.message}`);
  }
});

CallApp.elements.muteButton.addEventListener("click", () => {
  const track = CallApp.getAudioTrack();
  if (!track) {
    return;
  }

  track.enabled = !track.enabled;
  CallApp.elements.muteButton.textContent = track.enabled ? "Mute" : "Unmute";
});

CallApp.elements.cameraButton.addEventListener("click", () => {
  const track = CallApp.getVideoTrack();
  if (!track) {
    return;
  }

  track.enabled = !track.enabled;
  CallApp.elements.cameraButton.textContent = track.enabled ? "Camera Off" : "Camera On";
});

CallApp.elements.hangupButton.addEventListener("click", CallApp.hangUp);

window.addEventListener("beforeunload", () => {
  if (CallApp.joinedRoom) {
    CallApp.hangUp();
  }
});
