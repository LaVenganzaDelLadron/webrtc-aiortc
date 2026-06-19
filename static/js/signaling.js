// This file handles the WebSocket connection used to exchange call setup messages.
// The browser and server use this channel to say things like "I have an offer" or "here is an answer".

CallApp.websocketUrl = function websocketUrl(room) {
  // Use wss:// on HTTPS pages, and ws:// on HTTP pages.
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  // The URL includes both the room name and this browser's unique client ID.
  return `${protocol}//${window.location.host}/ws/${encodeURIComponent(room)}/${CallApp.clientId}`;
};

CallApp.connectSignaling = function connectSignaling(room) {
  // Open a socket for this room so the server can route messages correctly.
  CallApp.socket = new WebSocket(CallApp.websocketUrl(room));

  // When the socket opens, the user is officially in the room.
  CallApp.socket.addEventListener("open", () => {
    CallApp.setStatus(`Joined room "${room}". Waiting for another peer...`);
    CallApp.enableCallControls(true);
    CallApp.startPeerWaitTimer();
  });

  // Every message from the server is passed to the main WebRTC handler.
  CallApp.socket.addEventListener("message", CallApp.handleSignalMessage);

  // If the socket fails, tell the user what likely went wrong.
  CallApp.socket.addEventListener("error", () => {
    CallApp.setStatus("Signaling WebSocket failed. Deploy this app on a host that supports long-running WebSockets.");
  });

  // If the socket closes unexpectedly, show a helpful warning.
  CallApp.socket.addEventListener("close", () => {
    if (CallApp.joinedRoom) {
      CallApp.setStatus("Disconnected from signaling server. On Vercel, FastAPI WebSockets will not work for this call server.");
    }
  });
};

CallApp.sendSignal = function sendSignal(type, target, data) {
  // Do nothing if the socket is not ready yet.
  if (!CallApp.socket || CallApp.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  // Send the message as JSON so both sides can read it easily.
  CallApp.socket.send(JSON.stringify({
    type,
    sender: CallApp.clientId,
    target,
    data,
  }));
};
