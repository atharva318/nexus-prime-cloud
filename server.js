const WebSocket = require("ws");
const express = require("express");
const http = require("http");

/* ================== APP ================== */
const app = express();
const server = http.createServer(app);

/* ================== PORT ================== */
const PORT = process.env.PORT || 3000;

/* ================== WS (MAIN) ================== */
const wss = new WebSocket.Server({ server, path: "/ws" });

/* ================== WS (CAMERA) ================== */
const camWSS = new WebSocket.Server({ server, path: "/camws" });

console.log("✅ Nexus Prime Cloud Server");

/* ================== CLIENT REGISTRY ================== */
const clients = {
  dashboard: new Set(),
  node1: new Set(),
  node2: new Set()
};

/* ================== CAMERA STATE ================== */
let latestFrame = null;
let camStats = {
  fps: 0,
  bitrate: 0,
  lastTs: Date.now()
};

/* ================== CAMERA INGEST ================== */
app.post("/camera", (req, res) => {
  let chunks = [];
  req.on("data", c => chunks.push(c));
  req.on("end", () => {
    latestFrame = Buffer.concat(chunks);

    const now = Date.now();
    camStats.fps = Math.round(1000 / (now - camStats.lastTs));
    camStats.bitrate = Math.round((latestFrame.length * 8) / 1000);
    camStats.lastTs = now;

    res.sendStatus(200);
  });
});

/* ================== CAMERA WS BROADCAST ================== */
camWSS.on("connection", ws => {
  const interval = setInterval(() => {
    if (latestFrame && ws.readyState === WebSocket.OPEN) {
      ws.send(latestFrame);
      ws.send(JSON.stringify({ type: "CAM_TELEM", ...camStats }));
    }
  }, 80); // ~12 FPS

  ws.on("close", () => clearInterval(interval));
});

/* ================== BROADCAST ================== */
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

/* ================== MAIN WS ================== */
wss.on("connection", ws => {
  ws.on("message", msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    if (data.register && clients[data.register]) {
      ws.role = data.register;
      clients[data.register].add(ws);
    }

    if (data.node === 1) {
      broadcast({
        node: 1,
        radar: data.radar,
        imu: data.imu,
        power: data.power,
        env: {
          temp: data.temp ?? null,
          hum: data.hum ?? null,
          lux: data.lux ?? null
        }
      });
      return;
    }

    if (data.node === 2) {
      broadcast(data);
      return;
    }

    if (data.type) broadcast(data);
  });

  ws.on("close", () =>
    Object.values(clients).forEach(s => s.delete(ws))
  );
});

server.listen(PORT, () =>
  console.log(`🚀 Server running on ${PORT}`)
);
