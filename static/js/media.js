CallApp.assertMediaDevicesAvailable = function assertMediaDevicesAvailable() {
  if (navigator.mediaDevices?.getUserMedia) {
    return;
  }

  if (!window.isSecureContext) {
    throw new Error(
      "camera and microphone require HTTPS when using a LAN IP address. Use https://192.168.1.14:8000 or open http://localhost:8000 on this computer."
    );
  }

  throw new Error("this browser does not provide camera and microphone access.");
};

CallApp.startLocalMedia = async function startLocalMedia() {
  CallApp.assertMediaDevicesAvailable();
  CallApp.setStatus("Requesting camera and microphone permission...");

  CallApp.localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  CallApp.elements.localVideo.srcObject = CallApp.localStream;
};

CallApp.stopLocalMedia = function stopLocalMedia() {
  if (!CallApp.localStream) {
    return;
  }

  for (const track of CallApp.localStream.getTracks()) {
    track.stop();
  }

  CallApp.localStream = null;
  CallApp.elements.localVideo.srcObject = null;
};

CallApp.getAudioTrack = function getAudioTrack() {
  return CallApp.localStream?.getAudioTracks()[0] || null;
};

CallApp.getVideoTrack = function getVideoTrack() {
  return CallApp.localStream?.getVideoTracks()[0] || null;
};
