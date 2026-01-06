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
    } catch (e) {
      console.log("❌ Invalid JSON received");
      return;
    }

    /* =========================================================
       NODE 1 : SENSOR NODE (UNCHANGED — SAFE)
       ========================================================= */
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

      broadcast(normalizedPayload);
      return;
    }

    /* =========================================================
       NODE 2 : ACTUATION COMMANDS (NEW)
       ========================================================= */
    if (data.node === 2) {
      // Commands are forwarded AS-IS to Node-2
      broadcast(data);
      return;
    }

    /* =========================================================
       NODE 4 : ESP32-CAM STATUS (OPTIONAL)
       ========================================================= */
    if (data.type === "CAM_STATUS") {
      broadcast(data);
      return;
    }
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
  });
});
