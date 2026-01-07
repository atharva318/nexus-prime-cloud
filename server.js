const WebSocket = require("ws");

/* ================== PORT ================== */
const PORT = process.env.PORT || 3000;

/* ================== WS SERVER ================== */
const wss = new WebSocket.Server({
  port: PORT,
  path: "/ws"
});

console.log("✅ Nexus Prime Cloud Server running on /ws");

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
       NODE 1 : SENSOR TELEMETRY
       ===================================================== */
    if (data.node === 1) {
      broadcast({
        node: 1,
        radar: data.radar || null,
        imu: data.imu || null,
        power: data.power || null,
        env: {
          temp: data.temp ?? null,
          hum:  data.hum  ?? null,
          lux:  data.lux  ?? null
        }
      });
      return;
    }

    /* =====================================================
       NODE 2 : ACTUATION & PAN-TILT
       ===================================================== */
    if (data.node === 2) {
      // IMPORTANT: forward AS-IS
      broadcast(data);
      return;
    }

    /* =====================================================
       OTHER / CAMERA
       ===================================================== */
    if (data.type === "CAM_STATUS") {
      broadcast(data);
      return;
    }
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
  });
});
