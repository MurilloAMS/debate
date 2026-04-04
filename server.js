const videoStats = {};
const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

app.use(express.json());

// ===================== STATIC =====================
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ===================== UPLOAD =====================
const upload = multer({ dest: 'uploads/' });

// ===================== DB =====================
const DB_FILE = './replays.json';

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

function getDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ===================== UPLOAD LIVE =====================
app.post('/upload', upload.single('video'), (req, res) => {
  const file = req.file;
  const room = req.body.room;
  const userId = req.body.userId;

  const newPath = `uploads/${userId}-${Date.now()}.webm`;

  fs.renameSync(file.path, newPath);

  const db = getDB();

  db.push({
    id: Date.now().toString(),
    path: '/' + newPath,
    room,
    userId,
    likes: 0,
    comments: [],
    views: 0,
    watchTime: 0,
    createdAt: Date.now()
  });

  saveDB(db);

  console.log('🎥 Live salva:', newPath);

  res.send({ ok: true });
});

// ===================== REPLAYS =====================
app.post('/replays', (req, res) => {
  const { seguindo = [] } = req.body;

  const db = getDB();
  const now = Date.now();

  const sorted = db.sort((a, b) => {
    const scoreA =
      (a.likes * 2) +
      (a.comments.length * 3) +
      (a.views) +
      (a.watchTime * 0.001) +
      ((now - (a.createdAt || now)) * -0.00001);

    const scoreB =
      (b.likes * 2) +
      (b.comments.length * 3) +
      (b.views) +
      (b.watchTime * 0.001) +
      ((now - (b.createdAt || now)) * -0.00001);

    return scoreB - scoreA;
  });

  const followingVideos = [];
  const others = [];

  sorted.forEach(v => {
    if (seguindo.includes(v.userId)) followingVideos.push(v);
    else others.push(v);
  });

  res.json([...followingVideos, ...others]);
});

// ===================== WATCH TIME =====================
app.post('/watch-time', (req, res) => {
  const { id, tempo } = req.body;

  const db = getDB();
  const video = db.find(v => v.id === id);

  if (video) {
    video.watchTime = (video.watchTime || 0) + tempo;
    saveDB(db);
  }

  res.send({ ok: true });
});

// ===================== LIKE =====================
app.post('/like-replay', (req, res) => {
  const { id } = req.body;

  const db = getDB();
  const video = db.find(v => v.id === id);

  if (video) {
    video.likes++;
    saveDB(db);
  }

  res.send({ ok: true });
});

// ===================== COMMENT =====================
app.post('/comment-replay', (req, res) => {
  const { id, text } = req.body;

  const db = getDB();
  const video = db.find(v => v.id === id);

  if (video) {
    video.comments.push(text);
    saveDB(db);
  }

  res.send({ ok: true });
});

// ===================== VIEW =====================
app.post('/view-replay', (req, res) => {
  const { id } = req.body;

  const db = getDB();
  const video = db.find(v => v.id === id);

  if (video) {
    video.views++;
    saveDB(db);
  }

  res.send({ ok: true });
});

// ===================== SERVIR VIDEOS =====================
app.use('/uploads', express.static('uploads'));

// ===================== WEBSOCKET =====================
const wss = new WebSocketServer({ server });

// roomId -> dados
const rooms = new Map();

wss.on('connection', (ws) => {
  ws.roomId = null;
  ws.userId = null;
  ws.username = 'Anônimo';
  ws.role = 'audience';

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // ===== JOIN =====
    if (msg.type === 'join') {
      const room = msg.room || 'default';

      ws.roomId = room;
      ws.userId = msg.userId;
      ws.username = msg.username || 'Anônimo';
      ws.role = msg.role || 'audience';

      if (!rooms.has(room)) {
        rooms.set(room, {
          clients: new Set(),
          hostName: null,
          hostUid: null,
          thumbnail: null,
          createdAt: Date.now(),
          likes: 0,
          reports: 0
        });
      }

      const roomData = rooms.get(room);
      roomData.clients.add(ws);

      if (ws.role === 'host') {
        roomData.hostName = ws.username;
        roomData.hostUid = ws.userId;
        roomData.thumbnail = msg.thumbnail || null;

        // 🔥 NOTIFICA TODO MUNDO QUE COMEÇOU LIVE
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'room-started',
              room: room,
              host: ws.username,
              hostUid: ws.userId
            }));
          }
        });
      }

      sendUsers(room);
      broadcastRooms();
      return;
    }

    // ===== LIKE =====
    if (msg.type === 'like') {
      const roomData = rooms.get(ws.roomId);
      if (!roomData) return;

      roomData.likes++;

      broadcastToRoom(ws.roomId, {
        type: 'like-update',
        room: ws.roomId,
        likes: roomData.likes
      });

      return;
    }

    // ===== REPORT =====
    if (msg.type === 'report') {
      const roomData = rooms.get(ws.roomId);
      if (!roomData) return;

      roomData.reports++;

      if (roomData.reports >= 5) {
        broadcastToRoom(ws.roomId, {
          type: 'end-live'
        });

        rooms.delete(ws.roomId);
        broadcastRooms();
      }

      return;
    }

    // ===== ROOMS =====
    if (msg.type === 'get-rooms') {
      sendRooms(ws);
      return;
    }

    // ===== PREVIEW REQUEST =====
    if (msg.type === 'request-preview') {
      const roomData = rooms.get(msg.room);
      if (!roomData) return;

      roomData.clients.forEach(client => {
        if (client.role === 'host') {
          client.send(JSON.stringify({
            type: 'request-preview',
            room: msg.room
          }));
        }
      });
      return;
    }

    // ===== PREVIEW RESPONSE =====
    if (msg.type === 'preview') {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(msg));
        }
      });
      return;
    }

    if (!ws.roomId) return;

    broadcast(ws, {
      ...msg,
      username: ws.username
    });
  });

  ws.on('close', () => {
    const room = ws.roomId;

    if (room && rooms.has(room)) {
      const roomData = rooms.get(room);
      roomData.clients.delete(ws);

      if (roomData.clients.size === 0) {
        rooms.delete(room);
      }

      sendUsers(room);
      broadcastRooms();
    }
  });
});

// ===================== USERS =====================
function sendUsers(room) {
  if (!rooms.has(room)) return;

  const roomData = rooms.get(room);
  const users = [];

  roomData.clients.forEach(c => {
    users.push({ username: c.username, role: c.role });
  });

  const data = JSON.stringify({ type: 'users', users });

  roomData.clients.forEach(c => {
    if (c.readyState === 1) c.send(data);
  });
}

// ===================== ROOMS =====================
function sendRooms(ws) {
  const list = [];
  const now = Date.now();

  for (const [roomId, data] of rooms.entries()) {
    const score =
      (data.clients.size * 2) +
      Math.floor((now - data.createdAt) / 10000);

    list.push({
      room: roomId,
      count: data.clients.size,
      host: data.hostName,
      hostUid: data.hostUid,
      likes: data.likes,
      score
    });
  }

  ws.send(JSON.stringify({ type: 'rooms-list', rooms: list }));
}

function broadcastRooms() {
  const list = [];
  const now = Date.now();

  for (const [roomId, data] of rooms.entries()) {
    const score =
      (data.clients.size * 2) +
      Math.floor((now - data.createdAt) / 10000);

    list.push({
      room: roomId,
      count: data.clients.size,
      host: data.hostName,
      hostUid: data.hostUid,
      likes: data.likes,
      score
    });
  }

  const json = JSON.stringify({ type: 'rooms-list', rooms: list });

  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(json);
  });
}

// ===================== BROADCAST =====================
function broadcast(sender, data) {
  const room = sender.roomId;
  if (!room || !rooms.has(room)) return;

  const roomData = rooms.get(room);

  roomData.clients.forEach(c => {
    if (c !== sender && c.readyState === 1) {
      c.send(JSON.stringify(data));
    }
  });
}

function broadcastToRoom(room, data) {
  if (!rooms.has(room)) return;

  rooms.get(room).clients.forEach(c => {
    if (c.readyState === 1) {
      c.send(JSON.stringify(data));
    }
  });
}

// =====================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🔥 Servidor rodando: http://localhost:${PORT}`);
});