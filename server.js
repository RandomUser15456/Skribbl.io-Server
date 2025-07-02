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

/*
const REMOTE_BASE = 'https://skribbl.io';
const LOCAL_BASE = path.join(__dirname, 'public');
const NF = () => 0;

app.use(async (req, res) => {
  const requestedPath = req.path === '/' ? '/index.html' : req.path;
  const localPath = path.join(LOCAL_BASE, requestedPath);

  console.log(`Requested path: ${requestedPath}`);

  try {
    // Check if file exists in cache
    try {
      await fs.access(localPath);
      console.log(`Serving from cache: ${localPath}`);
      return res.sendFile(localPath);
    } catch {
      // File not in cache, proceed to fetch
    }

    // Fetch from remote
    const remoteUrl = REMOTE_BASE + requestedPath;
    console.log(`Fetching remote URL: ${remoteUrl}`);
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      return res.status(404).send('File not found remotely');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);


    await fs.mkdir(path.dirname(localPath), { recursive: true }, NF);
    await fs.writeFile(localPath, buffer, () => {
      console.log(`Cached: ${localPath}`);
      res.sendFile(localPath);
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching or serving file');
  }
});
*/
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});