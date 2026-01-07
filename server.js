const WebSocket = require("ws");

/* ================== PORT ================== */
const PORT = process.env.PORT || 3000;

/* ================== WS SERVER ================== */
const wss = new WebSocket.Server({
  port: PORT,
  path: "/ws"
});

console.log("✅ Nexus Prime Cloud Server running on /ws");

/* ================== CLIENT REGISTRY ================== */
const clients = {
  dashboard: new Set(),
  node1: new Set(),
  node2: new Set()
};

/* ================== CONNECTION ================== */
wss.on("connection", ws => {
  console.log("🟢 Client connected");

  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }

    /* -------- REGISTER CLIENT -------- */
    if (data.register) {
      ws.role = data.register;
      clients[data.register]?.add(ws);
      console.log(`🔐 Registered as ${data.register}`);
      return;
    }

    /* -------- NODE-1 TELEMETRY -------- */
    if (data.node === 1) {
      clients.dashboard.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(data));
      });
      return;
    }

    /* -------- NODE-2 COMMAND -------- */
    if (data.node === 2 && data.type === "ACTUATION") {
      clients.node2.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(data));
      });
      return;
    }

    /* -------- PAN TILT -------- */
    if (data.node === 2 && data.type === "PAN_TILT") {
      clients.node2.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(data));
      });
      return;
    }
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
    Object.values(clients).forEach(set => set.delete(ws));
  });
});
