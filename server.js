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

    /* ========== NODE 1 : SENSOR NODE ========== */
    if (data.node === 1) {

      const normalizedPayload = {
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
    }

    /* ========== NODE 2 : ACTUATION / CONTROL ========== */
    if (data.type === "ACTUATION" || data.type === "PAN_TILT") {
      broadcast(data);
    }

    /* ========== NODE 4 : ESP32-CAM (PLACEHOLDER) ========== */
    if (data.type === "CAM_STATUS") {
      broadcast(data);
    }
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
  });
});
