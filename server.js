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
const RADAR_EMERGENCY_CM = 30;
const RADAR_SLOW_CM = 80;
const RADAR_SIDE_CM = 40;

/* ================== MODES ================== */
const MODES = {
  MANUAL: "MANUAL",
  FOLLOW: "FOLLOW",
  GUARD: "GUARD",
  PATROL: "PATROL",
  EMERGENCY: "EMERGENCY"
};

/* ================== GLOBAL STATE ================== */
let mode = MODES.MANUAL;
let emergencyStop = false;
let aiActive = false;
let followDistance = 100;

let lastRadar = {
  front: 999,
  left: 999,
  right: 999
};

let manualOverrideUntil = 0;
let patrolTimer = null;

/* ================== SPEED FROM DISTANCE ================== */
function speedFromDistance(dist) {
  if (dist < RADAR_EMERGENCY_CM) return 0;
  if (dist < RADAR_SLOW_CM) return 60;
  return 120;
}

/* ================== SIDE AVOIDANCE ================== */
function sideAvoidance(radar) {
  if (!radar) return null;
  if (radar.left < RADAR_SIDE_CM) return "RIGHT";
  if (radar.right < RADAR_SIDE_CM) return "LEFT";
  return null;
}

/* ================== BROADCAST ================== */
function broadcastJSON(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(msg);
    }
  });
}

/* ================== PATROL LOOP ================== */
function startPatrol() {
  stopPatrol();

  patrolTimer = setInterval(() => {
    if (mode !== MODES.PATROL || emergencyStop) return;

    broadcastJSON({
      type: "ACTUATION",
      node: 2,
      move: "FORWARD",
      speed: 50,
      source: "PATROL"
    });
  }, 3000);

  console.log("🚶 PATROL mode active");
}

function stopPatrol() {
  if (patrolTimer) {
    clearInterval(patrolTimer);
    patrolTimer = null;
  }
}

/* ================== CONNECTION ================== */
wss.on("connection", ws => {
  console.log("🟢 Client connected");

  ws.on("message", (msg, isBinary) => {

    /* ========== CAMERA STREAM ========= */
    if (isBinary) {
      if (ws.node === 3) {
        wss.clients.forEach(c => {
          if (c.readyState === WebSocket.OPEN && c !== ws) {
            c.send(msg, { binary: true });
          }
        });
      }
      return;
    }

    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      console.log("❌ Invalid JSON");
      return;
    }

    /* ========== MODE SWITCH ========= */
    if (data.type === "MODE") {
      mode = data.mode;
      aiActive = false;

      if (mode === MODES.PATROL) startPatrol();
      else stopPatrol();

      console.log("🔄 MODE CHANGED →", mode);
      broadcastJSON({ type: "MODE_STATUS", mode });
      return;
    }

    /* ========== FOLLOW DISTANCE ========= */
    if (data.type === "FOLLOW_DIST") {
      followDistance = data.value;
      console.log("🎯 Follow distance:", followDistance);
      return;
    }

    /* ========== NODE 1 : SENSORS ========= */
    if (data.node === 1) {

      if (data.radar) {
        lastRadar = data.radar;

        if (data.radar.front < RADAR_EMERGENCY_CM) {
          emergencyStop = true;
          mode = MODES.EMERGENCY;

          broadcastJSON({
            type: "ACTUATION",
            node: 2,
            move: "STOP",
            speed: 0,
            source: "RADAR"
          });

          console.log("🚨 EMERGENCY STOP");
          return;
        }

        if (emergencyStop && data.radar.front >= RADAR_EMERGENCY_CM) {
          emergencyStop = false;
          mode = MODES.MANUAL;
          console.log("🟢 Emergency cleared");
        }
      }

      broadcastJSON({
        radar: data.radar || null,
        imu: data.imu || null,
        power: data.power || null,
        env: {
          temp: data.temp ?? null,
          hum: data.hum ?? null,
          lux: data.lux ?? null
        }
      });

      return;
    }

    /* ========== CAMERA REGISTER ========= */
    if (data.type === "CAM_REGISTER") {
      ws.node = 3;
      console.log("📷 Camera node registered");
      broadcastJSON({ type: "CAM_STATUS", status: "ONLINE" });
      return;
    }

    /* ========== YOLO REGISTER ========= */
    if (data.register === "yolo") {
      ws.node = "YOLO";
      console.log("🧠 YOLO node connected");
      return;
    }

    /* ========== YOLO VISUAL ========= */
    if (data.type === "YOLO") {
      broadcastJSON(data);
      return;
    }

    /* ========== AI COMMANDS ========= */
    if (data.type === "AI_CMD") {

      if (mode === MODES.MANUAL || emergencyStop) return;
      if (Date.now() < manualOverrideUntil) return;

      aiActive = true;

      let move = data.cmd;
      const avoid = sideAvoidance(lastRadar);

      if (avoid) move = avoid;

      const speed = speedFromDistance(lastRadar.front);
      if (speed === 0) return;

      if (mode === MODES.GUARD && move === "FORWARD") return;

      broadcastJSON({
        type: "ACTUATION",
        node: 2,
        move,
        speed,
        source: "AI"
      });

      return;
    }

    /* ========== MANUAL CONTROL ========= */
    if (data.type === "ACTUATION" || data.type === "PAN_TILT") {
      if (emergencyStop) return;

      manualOverrideUntil = Date.now() + 500;
      aiActive = false;
      mode = MODES.MANUAL;

      broadcastJSON(data);
      return;
    }
  });

  ws.on("close", () => {
    console.log("🔴 Client disconnected");
  });
});
