const WebSocket = require("ws");

/* ================== PORT ================== */
const PORT = process.env.PORT || 3000;

/* ================== WS SERVER ================== */
const wss = new WebSocket.Server({
  port: PORT,
  path: "/ws"
});

console.log("✅ Nexus Prime Cloud Server running on /ws");

/* ================== SAFETY CONSTANTS ================== */
const RADAR_EMERGENCY_CM = 30;   // HARD STOP
const RADAR_SLOW_CM = 80;        // SPEED REDUCTION

/* ================== GLOBAL STATE ================== */
let emergencyStop = false;
let aiActive = false;
let lastRadar = { front: 999 };

/* ================== SPEED FROM DISTANCE ================== */
function speedFromDistance(dist) {
  if (dist < RADAR_EMERGENCY_CM) return 0;
  if (dist < RADAR_SLOW_CM) return 60;
  return 120;
}

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

    /* ========== NODE 1 : SENSOR NODE (RADAR / IMU) ========== */
    if (data.node === 1) {

      if (data.radar) {
        lastRadar = data.radar;

        /* -------- RADAR EMERGENCY OVERRIDE -------- */
        if (data.radar.front < RADAR_EMERGENCY_CM) {

          if (!emergencyStop) {
            emergencyStop = true;
            console.log("🚨 RADAR EMERGENCY STOP");

            broadcastJSON({
              type: "ACTUATION",
              node: 2,
              move: "STOP",
              speed: 0,
              source: "RADAR"
            });
          }
          return; // NOTHING overrides radar
        }

        /* -------- CLEAR EMERGENCY -------- */
        if (emergencyStop && data.radar.front >= RADAR_EMERGENCY_CM) {
          emergencyStop = false;
          console.log("🟢 RADAR CLEAR");
        }
      }

      /* Forward telemetry to dashboard */
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

      return;
    }

    /* ========== NODE 3 : CAMERA REGISTER ========== */
    if (data.type === "CAM_REGISTER") {
      ws.node = 3;
      console.log("📷 Camera node registered");
      broadcastJSON({ type: "CAM_STATUS", status: "ONLINE" });
      return;
    }

    /* ========== YOLO REGISTER ========== */
    if (data.register === "yolo") {
      ws.node = "YOLO";
      console.log("🧠 YOLO node connected");
      return;
    }

    /* ========== YOLO VISUAL DATA ========== */
    if (data.type === "YOLO") {
      broadcastJSON(data); // dashboard only
      return;
    }

    /* ========== AI COMMANDS (ARBITRATED) ========== */
    if (data.type === "AI_CMD") {

      /* AI RELEASE */
      if (data.cmd === "CLEAR") {
        aiActive = false;
        console.log("🧠 AI control released");
        return;
      }

      /* Radar always wins */
      if (emergencyStop) return;

      aiActive = true;

      const speed = speedFromDistance(lastRadar.front);

      if (speed === 0) {
        broadcastJSON({
          type: "ACTUATION",
          node: 2,
          move: "STOP",
          speed: 0,
          source: "RADAR"
        });
        return;
      }

      let move = "STOP";
      if (data.cmd === "FORWARD") move = "FORWARD";
      if (data.cmd === "TURN_LEFT") move = "LEFT";
      if (data.cmd === "TURN_RIGHT") move = "RIGHT";
      if (data.cmd === "STOP") move = "STOP";

      broadcastJSON({
        type: "ACTUATION",
        node: 2,
        move,
        speed,
        source: "AI"
      });

      return;
    }

    /* ========== MANUAL ACTUATION (LOWEST PRIORITY) ========== */
    if (data.type === "ACTUATION" || data.type === "PAN_TILT") {

      if (emergencyStop) return; // radar override
      if (aiActive) return;      // AI override

      broadcastJSON(data);
      return;
    }
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
  });
});
