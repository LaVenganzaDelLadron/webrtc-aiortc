// This file is responsible for asking the browser for camera and microphone access.
// It also helps the app turn those tracks on and off.

CallApp.assertMediaDevicesAvailable = function assertMediaDevicesAvailable() {
  // If the browser supports getUserMedia, we can continue.
  if (navigator.mediaDevices?.getUserMedia) {
    return;
  }

  // On some LAN IP addresses, HTTPS is required before the browser allows media access.
  if (!window.isSecureContext) {
    throw new Error(
      "camera and microphone require HTTPS when using a LAN IP address. Use https://192.168.1.14:8000 or open http://localhost:8000 on this computer."
    );
  }

  throw new Error("this browser does not provide camera and microphone access.");
};

CallApp.startLocalMedia = async function startLocalMedia() {
  // Make sure this browser can actually request the media devices.
  CallApp.assertMediaDevicesAvailable();
  CallApp.setStatus("Requesting camera and microphone permission...");

  // Ask for both video and audio tracks.
  CallApp.localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  // Show the user's own video in the small preview box.
  CallApp.elements.localVideo.srcObject = CallApp.localStream;
};

CallApp.stopLocalMedia = function stopLocalMedia() {
  // If there is no stream, nothing needs to be cleaned up.
  if (!CallApp.localStream) {
    return;
  }

  // Stop every track so the camera and mic are released.
  for (const track of CallApp.localStream.getTracks()) {
    track.stop();
  }

  CallApp.localStream = null;
  CallApp.elements.localVideo.srcObject = null;
};

CallApp.getAudioTrack = function getAudioTrack() {
  // Return the first audio track if the stream exists.
  return CallApp.localStream?.getAudioTracks()[0] || null;
};

CallApp.getVideoTrack = function getVideoTrack() {
  // Return the first video track if the stream exists.
  return CallApp.localStream?.getVideoTracks()[0] || null;
};
