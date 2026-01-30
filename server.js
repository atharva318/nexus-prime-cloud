const WebSocket = require("ws");

/* ================== PORT ================== */
const PORT = process.env.PORT || 3000;

/* ================== WS SERVER ================== */
const wss = new WebSocket.Server({
  port: PORT,
  path: "/ws"
});

console.log("✅ Nexus Prime Cloud Server running on /ws");

/* ================== CLIENT REGISTRY (OPTIONAL) ================== */
const clients = {
  dashboard: new Set(),
  node1: new Set(),
  node2: new Set()
};

/* ================== BROADCAST ================== */
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

/* ================== CONNECTION ================== */
wss.on("connection", ws => {
  console.log("🟢 Client connected");

  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      console.log("❌ Invalid JSON");
      return;
    }

    /* =====================================================
       OPTIONAL REGISTRATION (NEVER BLOCKS FLOW)
       ===================================================== */
    if (data.register && clients[data.register]) {
      ws.role = data.register;
      clients[data.register].add(ws);
      console.log(`🔐 Registered as ${data.register}`);
      // DO NOT return — allow packet to continue if needed
    }

    /* =====================================================
       NODE 1 : SENSOR / TELEMETRY
       ===================================================== */
    if (data.node === 1) {
      // Normalize but NEVER restrict
      const payload = {
        node: 1,
        radar: data.radar || null,
        imu: data.imu || null,
        power: data.power || null,
        env: {
          temp: data.temp ?? null,
          hum:  data.hum  ?? null,
          lux:  data.lux  ?? null
        }
      };

      broadcast(payload);
      return;
    }

    /* =====================================================
       NODE 2 : ACTUATION / PAN-TILT / RELAYS
       ===================================================== */
    if (data.node === 2) {
      // Forward AS-IS (this is critical for motor movement)
      broadcast(data);
      return;
    }

    /* =====================================================
       OTHER (CAM, STATUS, FUTURE NODES)
       ===================================================== */
    if (data.type) {
      broadcast(data);
      return;
    }
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
    Object.values(clients).forEach(set => set.delete(ws));
  });
});
