const joinForm = document.querySelector("#joinForm");
const roomInput = document.querySelector("#roomInput");
const localVideo = document.querySelector("#localVideo");
const remoteVideo = document.querySelector("#remoteVideo");
const muteButton = document.querySelector("#muteButton");
const cameraButton = document.querySelector("#cameraButton");
const hangupButton = document.querySelector("#hangupButton");
const statusText = document.querySelector("#status");

const clientId = createClientId();
const peerConnections = new Map();
const pendingCandidates = new Map();
const offeredPeers = new Set();
const peerConnectionConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

let socket = null;
let localStream = null;
let joinedRoom = null;
let peerWaitTimer = null;

function createClientId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function assertMediaDevicesAvailable() {
  if (navigator.mediaDevices?.getUserMedia) {
    return;
  }

  if (!window.isSecureContext) {
    throw new Error(
      "camera and microphone require HTTPS when using a LAN IP address. Use https://192.168.1.14:8000 or open http://localhost:8000 on this computer."
    );
  }

  throw new Error("this browser does not provide camera and microphone access.");
}

function websocketUrl(room) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/${encodeURIComponent(room)}/${clientId}`;
}

function enableCallControls(enabled) {
  muteButton.disabled = !enabled;
  cameraButton.disabled = !enabled;
  hangupButton.disabled = !enabled;
}

function startPeerWaitTimer() {
  clearTimeout(peerWaitTimer);
  peerWaitTimer = setTimeout(() => {
    if (peerConnections.size === 0) {
      setStatus("Still waiting for another peer. If this is deployed on Vercel, the WebSocket signaling server is probably not running.");
    }
  }, 8000);
}

function shouldCreateOffer(peerId) {
  return clientId > peerId;
}

function getAudioTrack() {
  return localStream?.getAudioTracks()[0] || null;
}

function getVideoTrack() {
  return localStream?.getVideoTracks()[0] || null;
}

async function joinRoom(room) {
  joinedRoom = room;
  assertMediaDevicesAvailable();
  setStatus("Requesting camera and microphone permission...");

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;

  socket = new WebSocket(websocketUrl(room));
  socket.addEventListener("open", () => {
    setStatus(`Joined room "${room}". Waiting for another peer...`);
    enableCallControls(true);
    startPeerWaitTimer();
  });
  socket.addEventListener("message", handleSignalMessage);
  socket.addEventListener("error", () => {
    setStatus("Signaling WebSocket failed. Deploy this app on a host that supports long-running WebSockets.");
  });
  socket.addEventListener("close", () => {
    if (joinedRoom) {
      setStatus("Disconnected from signaling server. On Vercel, FastAPI WebSockets will not work for this call server.");
    }
  });
}

async function handleSignalMessage(event) {
  const message = JSON.parse(event.data);

  if (message.type === "peer-list") {
    await handlePeerList(message.data.peers || []);
    return;
  }

  if (message.type === "offer") {
    await handleOffer(message);
    return;
  }

  if (message.type === "answer") {
    await handleAnswer(message);
    return;
  }

  if (message.type === "ice-candidate") {
    await handleIceCandidate(message);
    return;
  }

  if (message.type === "leave") {
    closePeer(message.sender);
    setStatus("The other peer left the call.");
  }
}

async function handlePeerList(peers) {
  for (const peerId of peers) {
    const pc = createPeerConnection(peerId);

    if (shouldCreateOffer(peerId) && !offeredPeers.has(peerId)) {
      offeredPeers.add(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal("offer", peerId, pc.localDescription);
      setStatus("Calling peer...");
    }
  }
}

function createPeerConnection(peerId) {
  if (peerConnections.has(peerId)) {
    return peerConnections.get(peerId);
  }

  const pc = new RTCPeerConnection(peerConnectionConfig);
  peerConnections.set(peerId, pc);
  clearTimeout(peerWaitTimer);

  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      sendSignal("ice-candidate", peerId, event.candidate);
    }
  });

  pc.addEventListener("track", (event) => {
    const [remoteStream] = event.streams;
    remoteVideo.srcObject = remoteStream;
    setStatus("Call connected.");
  });

  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "connected") {
      setStatus("Call connected.");
    }
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      setStatus(`Peer connection ${pc.connectionState}.`);
    }
  });

  pc.addEventListener("iceconnectionstatechange", () => {
    if (pc.iceConnectionState === "failed") {
      setStatus("Network connection failed. A TURN server may be needed if the devices are on different networks.");
    }
  });

  return pc;
}

async function handleOffer(message) {
  const pc = createPeerConnection(message.sender);
  await pc.setRemoteDescription(message.data);
  await flushPendingCandidates(message.sender, pc);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  sendSignal("answer", message.sender, pc.localDescription);
  setStatus("Answered call.");
}

async function handleAnswer(message) {
  const pc = peerConnections.get(message.sender);
  if (!pc) {
    return;
  }

  await pc.setRemoteDescription(message.data);
  await flushPendingCandidates(message.sender, pc);
  setStatus("Call connected.");
}

async function handleIceCandidate(message) {
  const pc = peerConnections.get(message.sender);

  if (!pc || !pc.remoteDescription) {
    const candidates = pendingCandidates.get(message.sender) || [];
    candidates.push(message.data);
    pendingCandidates.set(message.sender, candidates);
    return;
  }

  await pc.addIceCandidate(message.data);
}

async function flushPendingCandidates(peerId, pc) {
  const candidates = pendingCandidates.get(peerId) || [];

  for (const candidate of candidates) {
    await pc.addIceCandidate(candidate);
  }

  pendingCandidates.delete(peerId);
}

function sendSignal(type, target, data) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({
    type,
    sender: clientId,
    target,
    data,
  }));
}

function closePeer(peerId) {
  const pc = peerConnections.get(peerId);
  if (pc) {
    pc.close();
  }

  peerConnections.delete(peerId);
  pendingCandidates.delete(peerId);
  offeredPeers.delete(peerId);
  remoteVideo.srcObject = null;
}

function hangUp() {
  for (const peerId of peerConnections.keys()) {
    sendSignal("leave", peerId, {});
    closePeer(peerId);
  }

  if (socket) {
    socket.close();
    socket = null;
  }

  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
    localStream = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  joinedRoom = null;
  clearTimeout(peerWaitTimer);
  joinForm.querySelector("button").disabled = false;
  enableCallControls(false);
  setStatus("Call ended.");
}

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const room = roomInput.value.trim();

  if (!room) {
    setStatus("Enter a room name first.");
    return;
  }

  try {
    joinForm.querySelector("button").disabled = true;
    await joinRoom(room);
  } catch (error) {
    joinForm.querySelector("button").disabled = false;
    setStatus(`Could not start call: ${error.message}`);
  }
});

muteButton.addEventListener("click", () => {
  const track = getAudioTrack();
  if (!track) {
    return;
  }

  track.enabled = !track.enabled;
  muteButton.textContent = track.enabled ? "Mute" : "Unmute";
});

cameraButton.addEventListener("click", () => {
  const track = getVideoTrack();
  if (!track) {
    return;
  }

  track.enabled = !track.enabled;
  cameraButton.textContent = track.enabled ? "Camera Off" : "Camera On";
});

hangupButton.addEventListener("click", hangUp);

window.addEventListener("beforeunload", () => {
  if (joinedRoom) {
    hangUp();
  }
});
