const WebSocket = require("ws");

/* ================== PORT ================== */
const PORT = process.env.PORT || 3000;

/* ================== WS SERVER ================== */
const wss = new WebSocket.Server({
  port: PORT,
  path: "/ws"
});

console.log("✅ Nexus Prime Cloud Server running on /ws");

/* ================== BROADCAST JSON ================== */
function broadcastJSON(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

/* ================== CONNECTION ================== */
wss.on("connection", ws => {
  console.log("🟢 Client connected");

  ws.on("message", (msg, isBinary) => {

    /* ================= BINARY = CAMERA FRAME ================= */
    if (isBinary) {
      if (ws.node === 3) {
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN && client !== ws) {
            client.send(msg, { binary: true });
          }
        });
      }
      return;
    }

    /* ================= TEXT = JSON ================= */
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      console.log("❌ Invalid JSON received");
      return;
    }

    /* ========== NODE 1 : SENSOR NODE ========== */
    if (data.node === 1) {
      broadcastJSON({
        radar: data.radar || null,
        imu: data.imu || null,
        power: data.power || null,
        env: {
          temp: data.temp ?? null,
          hum:  data.hum  ?? null,
          lux:  data.lux  ?? null
        }
      });
    }

    /* ========== NODE 2 : ACTUATION ========== */
    if (data.type === "ACTUATION" || data.type === "PAN_TILT") {
      broadcastJSON(data);
    }

    /* ========== NODE 3 : CAMERA REGISTER ========== */
    if (data.type === "CAM_REGISTER") {
      ws.node = 3;
      console.log("📷 Camera node registered");
      broadcastJSON({ type: "CAM_STATUS", status: "ONLINE" });
    }
    if (data.register === "yolo") {
  ws.node = "YOLO";
  console.log("🧠 YOLO node connected");
}
    if (data.type === "YOLO") {
  // Forward detections to dashboard + rover
  broadcastJSON(data);
}


  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
  });
});
