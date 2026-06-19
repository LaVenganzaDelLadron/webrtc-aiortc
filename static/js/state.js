window.CallApp = {
  elements: {
    joinForm: document.querySelector("#joinForm"),
    roomInput: document.querySelector("#roomInput"),
    localVideo: document.querySelector("#localVideo"),
    remoteVideo: document.querySelector("#remoteVideo"),
    muteButton: document.querySelector("#muteButton"),
    cameraButton: document.querySelector("#cameraButton"),
    hangupButton: document.querySelector("#hangupButton"),
    statusText: document.querySelector("#status"),
  },
  clientId: createClientId(),
  peerConnections: new Map(),
  pendingCandidates: new Map(),
  offeredPeers: new Set(),
  peerConnectionConfig: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
  socket: null,
  localStream: null,
  joinedRoom: null,
  peerWaitTimer: null,
};

function createClientId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

CallApp.setStatus = function setStatus(message) {
  CallApp.elements.statusText.textContent = message;
};

CallApp.enableCallControls = function enableCallControls(enabled) {
  CallApp.elements.muteButton.disabled = !enabled;
  CallApp.elements.cameraButton.disabled = !enabled;
  CallApp.elements.hangupButton.disabled = !enabled;
};

CallApp.shouldCreateOffer = function shouldCreateOffer(peerId) {
  return CallApp.clientId > peerId;
};

CallApp.startPeerWaitTimer = function startPeerWaitTimer() {
  clearTimeout(CallApp.peerWaitTimer);
  CallApp.peerWaitTimer = setTimeout(() => {
    if (CallApp.peerConnections.size === 0) {
      CallApp.setStatus("Still waiting for another peer. If this is deployed on Vercel, the WebSocket signaling server is probably not running.");
    }
  }, 8000);
};
