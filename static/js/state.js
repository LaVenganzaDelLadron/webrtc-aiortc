// This file creates the main app object and keeps track of shared browser state.
// Think of it as the app's memory: DOM elements, peer connections, and current room info.
window.CallApp = {
  // Store references to important HTML elements so the code can update the UI.
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

  // Give this browser tab a unique ID so the server can tell peers apart.
  clientId: createClientId(),

  // Track each active peer connection, any ICE candidates waiting to be sent,
  // and which peers have already been offered a call.
  peerConnections: new Map(),
  pendingCandidates: new Map(),
  offeredPeers: new Set(),

  // STUN servers help browsers discover how to connect to each other.
  peerConnectionConfig: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },

  // WebSocket and media state are loaded only after the user joins.
  socket: null,
  localStream: null,
  joinedRoom: null,
  peerWaitTimer: null,
};

// Create a unique client ID for this browser session.
// If the browser supports randomUUID, it uses that; otherwise it falls back.
function createClientId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Update the status text shown near the UI.
CallApp.setStatus = function setStatus(message) {
  CallApp.elements.statusText.textContent = message;
};

// Enable or disable call buttons based on whether a connection is active.
CallApp.enableCallControls = function enableCallControls(enabled) {
  CallApp.elements.muteButton.disabled = !enabled;
  CallApp.elements.cameraButton.disabled = !enabled;
  CallApp.elements.hangupButton.disabled = !enabled;
};

// Decide which side should start the call.
// The peer with the lexicographically larger client ID creates the offer.
CallApp.shouldCreateOffer = function shouldCreateOffer(peerId) {
  return CallApp.clientId > peerId;
};

// If nobody appears after a short delay, show a helpful message.
CallApp.startPeerWaitTimer = function startPeerWaitTimer() {
  clearTimeout(CallApp.peerWaitTimer);
  CallApp.peerWaitTimer = setTimeout(() => {
    if (CallApp.peerConnections.size === 0) {
      CallApp.setStatus("Still waiting for another peer. If this is deployed on Vercel, the WebSocket signaling server is probably not running.");
    }
  }, 8000);
};
