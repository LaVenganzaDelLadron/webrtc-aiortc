CallApp.handleSignalMessage = async function handleSignalMessage(event) {
  const message = JSON.parse(event.data);

  if (message.type === "peer-list") {
    await CallApp.handlePeerList(message.data.peers || []);
    return;
  }

  if (message.type === "offer") {
    await CallApp.handleOffer(message);
    return;
  }

  if (message.type === "answer") {
    await CallApp.handleAnswer(message);
    return;
  }

  if (message.type === "ice-candidate") {
    await CallApp.handleIceCandidate(message);
    return;
  }

  if (message.type === "leave") {
    CallApp.closePeer(message.sender);
    CallApp.setStatus("The other peer left the call.");
  }
};

CallApp.handlePeerList = async function handlePeerList(peers) {
  for (const peerId of peers) {
    const pc = CallApp.createPeerConnection(peerId);

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
  if (CallApp.peerConnections.has(peerId)) {
    return CallApp.peerConnections.get(peerId);
  }

  const pc = new RTCPeerConnection(CallApp.peerConnectionConfig);
  CallApp.peerConnections.set(peerId, pc);
  clearTimeout(CallApp.peerWaitTimer);

  for (const track of CallApp.localStream.getTracks()) {
    pc.addTrack(track, CallApp.localStream);
  }

  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      CallApp.sendSignal("ice-candidate", peerId, event.candidate);
    }
  });

  pc.addEventListener("track", (event) => {
    const [remoteStream] = event.streams;
    CallApp.elements.remoteVideo.srcObject = remoteStream;
    CallApp.setStatus("Call connected.");
  });

  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "connected") {
      CallApp.setStatus("Call connected.");
    }
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      CallApp.setStatus(`Peer connection ${pc.connectionState}.`);
    }
  });

  pc.addEventListener("iceconnectionstatechange", () => {
    if (pc.iceConnectionState === "failed") {
      CallApp.setStatus("Network connection failed. A TURN server may be needed if the devices are on different networks.");
    }
  });

  return pc;
};

CallApp.handleOffer = async function handleOffer(message) {
  const pc = CallApp.createPeerConnection(message.sender);
  await pc.setRemoteDescription(message.data);
  await CallApp.flushPendingCandidates(message.sender, pc);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  CallApp.sendSignal("answer", message.sender, pc.localDescription);
  CallApp.setStatus("Answered call.");
};

CallApp.handleAnswer = async function handleAnswer(message) {
  const pc = CallApp.peerConnections.get(message.sender);
  if (!pc) {
    return;
  }

  await pc.setRemoteDescription(message.data);
  await CallApp.flushPendingCandidates(message.sender, pc);
  CallApp.setStatus("Call connected.");
};

CallApp.handleIceCandidate = async function handleIceCandidate(message) {
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
  const candidates = CallApp.pendingCandidates.get(peerId) || [];

  for (const candidate of candidates) {
    await pc.addIceCandidate(candidate);
  }

  CallApp.pendingCandidates.delete(peerId);
};

CallApp.closePeer = function closePeer(peerId) {
  const pc = CallApp.peerConnections.get(peerId);
  if (pc) {
    pc.close();
  }

  CallApp.peerConnections.delete(peerId);
  CallApp.pendingCandidates.delete(peerId);
  CallApp.offeredPeers.delete(peerId);
  CallApp.elements.remoteVideo.srcObject = null;
};

CallApp.hangUp = function hangUp() {
  for (const peerId of CallApp.peerConnections.keys()) {
    CallApp.sendSignal("leave", peerId, {});
    CallApp.closePeer(peerId);
  }

  if (CallApp.socket) {
    CallApp.socket.close();
    CallApp.socket = null;
  }

  CallApp.stopLocalMedia();
  CallApp.elements.remoteVideo.srcObject = null;
  CallApp.joinedRoom = null;
  clearTimeout(CallApp.peerWaitTimer);
  CallApp.elements.joinForm.querySelector("button").disabled = false;
  CallApp.enableCallControls(false);
  CallApp.setStatus("Call ended.");
};
