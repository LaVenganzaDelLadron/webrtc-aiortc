// This file connects the buttons and form to the actual call logic.
// It is the part that makes the page feel interactive.

CallApp.joinRoom = async function joinRoom(room) {
  // Remember which room this browser is joining.
  CallApp.joinedRoom = room;

  // First ask for camera and microphone access.
  await CallApp.startLocalMedia();

  // Then connect to the signaling server for the room.
  CallApp.connectSignaling(room);
};

// When the user submits the join form, read the room name and start the flow.
CallApp.elements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const room = CallApp.elements.roomInput.value.trim();

  if (!room) {
    CallApp.setStatus("Enter a room name first.");
    return;
  }

  try {
    // Prevent duplicate joins while the app is starting.
    CallApp.elements.joinForm.querySelector("button").disabled = true;
    await CallApp.joinRoom(room);
  } catch (error) {
    // If something fails, let the user try again.
    CallApp.elements.joinForm.querySelector("button").disabled = false;
    CallApp.setStatus(`Could not start call: ${error.message}`);
  }
});

// Toggle microphone mute state.
CallApp.elements.muteButton.addEventListener("click", () => {
  const track = CallApp.getAudioTrack();
  if (!track) {
    return;
  }

  track.enabled = !track.enabled;
  CallApp.elements.muteButton.textContent = track.enabled ? "Mute" : "Unmute";
});

// Toggle camera on/off without ending the call.
CallApp.elements.cameraButton.addEventListener("click", () => {
  const track = CallApp.getVideoTrack();
  if (!track) {
    return;
  }

  track.enabled = !track.enabled;
  CallApp.elements.cameraButton.textContent = track.enabled ? "Camera Off" : "Camera On";
});

// End the current call when the user clicks Hang Up.
CallApp.elements.hangupButton.addEventListener("click", CallApp.hangUp);

// Make sure the app cleans up if the tab closes while a call is active.
window.addEventListener("beforeunload", () => {
  if (CallApp.joinedRoom) {
    CallApp.hangUp();
  }
});
