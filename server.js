const WebSocket = require("ws");

/* ================== PORT ================== */
const PORT = process.env.PORT || 3000;

/* ================== WS SERVER ================== */
const wss = new WebSocket.Server({
  port: PORT,
  path: "/ws"
});

console.log("✅ Nexus Prime Cloud Server running on /ws");

/* ================== BROADCAST HELPERS ================== */
function broadcastAll(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(msg);
    }
  });
}

function broadcastNode2(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(msg);
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
       NODE 1 : SENSOR / TELEMETRY  (RESTORED & SAFE)
       ===================================================== */
    if (data.node === 1) {

      const normalizedPayload = {
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

      broadcastAll(normalizedPayload);
      return;
    }

    /* =====================================================
       NODE 2 : ACTUATION (BLIND FORWARD ONLY)
       ===================================================== */
    if (data.node === 2) {
      // DO NOT interpret content
      // Node-2 decides motor / relay / servo
      broadcastNode2(data);
      return;
    }

    /* =====================================================
       ESP32-CAM / OTHER STATUS
       ===================================================== */
    if (data.type === "CAM_STATUS") {
      broadcastAll(data);
      return;
    }
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
  });
});
