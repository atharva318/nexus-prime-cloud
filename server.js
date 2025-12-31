const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;
const AUTH_TOKEN = "NEXUS-PRIME-001";

const wss = new WebSocket.Server({ port: PORT });

let roverSocket = null;
let clients = [];

console.log("🌍 Nexus Prime Server running");

wss.on("connection", ws => {

  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    if (data.token !== AUTH_TOKEN) {
      ws.close();
      return;
    }

    if (data.role === "ROVER") {
      roverSocket = ws;
      console.log("🚗 Rover connected");
      return;
    }

    if (data.role === "CLIENT") {
      clients.push(ws);
      console.log("🖥️ Client connected");
      return;
    }

    if (ws === roverSocket) {
      clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN)
          c.send(JSON.stringify(data));
      });
    }

    if (clients.includes(ws) && roverSocket) {
      roverSocket.send(JSON.stringify(data));
    }
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
    if (ws === roverSocket) roverSocket = null;
  });
});
