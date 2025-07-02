const express = require('express'),
  path = require('path'),
  fs = require('fs');
const CreatWebSocketServer = require('./websocket/main'),
  app = express(),
  PORT = 5003






app.use(express.static(path.join(__dirname, 'public')));

const domain = "localhost"
const server = `ws://${domain}:${PORT-1}/`
CreatWebSocketServer(PORT-1);
app.post("/api/play", (req, res) => {
  res.send(server);
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
