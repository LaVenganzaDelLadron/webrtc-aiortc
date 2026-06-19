// This file handles the actual WebRTC setup and connection flow.
// It turns signaling messages into real peer-to-peer audio/video connections.

CallApp.handleSignalMessage = async function handleSignalMessage(event) {
  // Every server message is a JSON payload.
  const message = JSON.parse(event.data);

  // The server tells us who is already in the room.
  if (message.type === "peer-list") {
    await CallApp.handlePeerList(message.data.peers || []);
    return;
  }

  // A peer is asking to start a call.
  if (message.type === "offer") {
    await CallApp.handleOffer(message);
    return;
  }

  // A peer accepted the call and sent its answer.
  if (message.type === "answer") {
    await CallApp.handleAnswer(message);
    return;
  }

  // Network details are being shared so browsers can connect.
  if (message.type === "ice-candidate") {
    await CallApp.handleIceCandidate(message);
    return;
  }

  // Someone left the room, so remove that peer from the UI.
  if (message.type === "leave") {
    CallApp.closePeer(message.sender);
    CallApp.setStatus("The other peer left the call.");
  }
};

CallApp.handlePeerList = async function handlePeerList(peers) {
  // For each peer in the room, create a connection if needed.
  for (const peerId of peers) {
    const pc = CallApp.createPeerConnection(peerId);

    // Only one side should create the offer, so the smaller client ID wins.
    if (CallApp.shouldCreateOffer(peerId) && !CallApp.offeredPeers.has(peerId)) {
      CallApp.offeredPeers.add(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      CallApp.sendSignal("offer", peerId, pc.localDescription);
      CallApp.setStatus("Calling peer...");
    }
  }
};

CallApp.createPeerConnection = function createPeerConnection(peerId) {
  // If a connection already exists, reuse it.
  if (CallApp.peerConnections.has(peerId)) {
    return CallApp.peerConnections.get(peerId);
  }

  // Create a new peer connection object for this peer.
  const pc = new RTCPeerConnection(CallApp.peerConnectionConfig);
  CallApp.peerConnections.set(peerId, pc);
  clearTimeout(CallApp.peerWaitTimer);

  // Add the local camera and microphone tracks to the connection.
  for (const track of CallApp.localStream.getTracks()) {
    pc.addTrack(track, CallApp.localStream);
  }

  // When ICE candidates are found, send them to the other side.
  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      CallApp.sendSignal("ice-candidate", peerId, event.candidate);
    }
  });

  // When the remote stream arrives, show it in the large video area.
  pc.addEventListener("track", (event) => {
    const [remoteStream] = event.streams;
    CallApp.elements.remoteVideo.srcObject = remoteStream;
    CallApp.setStatus("Call connected.");
  });

  // Keep the status text updated as connection state changes.
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "connected") {
      CallApp.setStatus("Call connected.");
    }
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      CallApp.setStatus(`Peer connection ${pc.connectionState}.`);
    }
  });

  // If networking fails, explain that a TURN server may be needed.
  pc.addEventListener("iceconnectionstatechange", () => {
    if (pc.iceConnectionState === "failed") {
      CallApp.setStatus("Network connection failed. A TURN server may be needed if the devices are on different networks.");
    }
  });

  return pc;
};

CallApp.handleOffer = async function handleOffer(message) {
  // Accept the offer and create an answer.
  const pc = CallApp.createPeerConnection(message.sender);
  await pc.setRemoteDescription(message.data);
  await CallApp.flushPendingCandidates(message.sender, pc);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  CallApp.sendSignal("answer", message.sender, pc.localDescription);
  CallApp.setStatus("Answered call.");
};

CallApp.handleAnswer = async function handleAnswer(message) {
  // Apply the remote answer to the existing peer connection.
  const pc = CallApp.peerConnections.get(message.sender);
  if (!pc) {
    return;
  }

  await pc.setRemoteDescription(message.data);
  await CallApp.flushPendingCandidates(message.sender, pc);
  CallApp.setStatus("Call connected.");
};

CallApp.handleIceCandidate = async function handleIceCandidate(message) {
  // If the peer connection is not ready yet, save the candidate for later.
  const pc = CallApp.peerConnections.get(message.sender);

  if (!pc || !pc.remoteDescription) {
    const candidates = CallApp.pendingCandidates.get(message.sender) || [];
    candidates.push(message.data);
    CallApp.pendingCandidates.set(message.sender, candidates);
    return;
  }

  await pc.addIceCandidate(message.data);
};

CallApp.flushPendingCandidates = async function flushPendingCandidates(peerId, pc) {
  // Apply any ICE candidates that arrived before the remote description was ready.
  const candidates = CallApp.pendingCandidates.get(peerId) || [];

  for (const candidate of candidates) {
    await pc.addIceCandidate(candidate);
  }

  CallApp.pendingCandidates.delete(peerId);
};

CallApp.closePeer = function closePeer(peerId) {
  // Close the peer connection if it exists.
  const pc = CallApp.peerConnections.get(peerId);
  if (pc) {
    pc.close();
  }

  // Remove all memory related to that peer so the app can reconnect cleanly.
  CallApp.peerConnections.delete(peerId);
  CallApp.pendingCandidates.delete(peerId);
  CallApp.offeredPeers.delete(peerId);
  CallApp.elements.remoteVideo.srcObject = null;
};

CallApp.hangUp = function hangUp() {
  // Tell each connected peer that this side is leaving.
  for (const peerId of CallApp.peerConnections.keys()) {
    CallApp.sendSignal("leave", peerId, {});
    CallApp.closePeer(peerId);
  }

  // Close the signaling socket.
  if (CallApp.socket) {
    CallApp.socket.close();
    CallApp.socket = null;
  }

  // Stop local camera and microphone tracks and reset the UI.
  CallApp.stopLocalMedia();
  CallApp.elements.remoteVideo.srcObject = null;
  CallApp.joinedRoom = null;
  clearTimeout(CallApp.peerWaitTimer);
  CallApp.elements.joinForm.querySelector("button").disabled = false;
  CallApp.enableCallControls(false);
  CallApp.setStatus("Call ended.");
};
