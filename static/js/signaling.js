CallApp.websocketUrl = function websocketUrl(room) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/${encodeURIComponent(room)}/${CallApp.clientId}`;
};

CallApp.connectSignaling = function connectSignaling(room) {
  CallApp.socket = new WebSocket(CallApp.websocketUrl(room));

  CallApp.socket.addEventListener("open", () => {
    CallApp.setStatus(`Joined room "${room}". Waiting for another peer...`);
    CallApp.enableCallControls(true);
    CallApp.startPeerWaitTimer();
  });

  CallApp.socket.addEventListener("message", CallApp.handleSignalMessage);

  CallApp.socket.addEventListener("error", () => {
    CallApp.setStatus("Signaling WebSocket failed. Deploy this app on a host that supports long-running WebSockets.");
  });

  CallApp.socket.addEventListener("close", () => {
    if (CallApp.joinedRoom) {
      CallApp.setStatus("Disconnected from signaling server. On Vercel, FastAPI WebSockets will not work for this call server.");
    }
  });
};

CallApp.sendSignal = function sendSignal(type, target, data) {
  if (!CallApp.socket || CallApp.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  CallApp.socket.send(JSON.stringify({
    type,
    sender: CallApp.clientId,
    target,
    data,
  }));
};
