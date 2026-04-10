require('dotenv').config(); // 🔥 IMPORTANTE

const { AccessToken } = require('livekit-server-sdk');
const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

app.use(express.json());

// ===================== 🔥 VARIÁVEIS LIVEKIT
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// 🔥 VALIDAÇÃO (ESSENCIAL)
if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  console.error("❌ ERRO: Variáveis do LiveKit não configuradas!");
  console.log({
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    LIVEKIT_URL
  });
}

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

// ===================== SERVIR VIDEOS =====================
app.use('/uploads', express.static('uploads'));

// ===================== WEBSOCKET =====================
const wss = new WebSocketServer({ server });
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
          createdAt: Date.now(),
          likes: 0
        });
      }

      const roomData = rooms.get(room);
      roomData.clients.add(ws);

      if (ws.role === 'host') {
        roomData.hostName = ws.username;
        roomData.hostUid = ws.userId;

        console.log(`🔴 Live iniciada: ${room}`);

        broadcastGlobal({
          type: 'room-started',
          room,
          host: ws.username,
          hostUid: ws.userId
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

    // ===== GET ROOMS =====
    if (msg.type === 'get-rooms') {
      sendRooms(ws);
      return;
    }

    // ===== PREVIEW =====
    if (msg.type === 'preview') {
      broadcastGlobal(msg);
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
        console.log(`❌ Sala encerrada: ${room}`);
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

  broadcastGlobal({
    type: 'rooms-list',
    rooms: list
  });
}

// ===================== BROADCAST =====================
function broadcast(sender, data) {
  const room = sender.roomId;
  if (!room || !rooms.has(room)) return;

  rooms.get(room).clients.forEach(c => {
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

function broadcastGlobal(data) {
  const json = JSON.stringify(data);

  wss.clients.forEach(c => {
    if (c.readyState === 1) {
      c.send(json);
    }
  });
}

// ===================== 🔥 LIVEKIT TOKEN
app.get('/get-token', (req, res) => {
  try {
    const room = req.query.room;
    const username = req.query.username || 'user';

    if (!room) {
      return res.status(400).json({ error: 'Room não informado' });
    }

    const at = new AccessToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      { identity: username }
    );

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true
    });

    const token = at.toJwt();

    res.json({
      token,
      url: LIVEKIT_URL
    });

  } catch (err) {
    console.error("❌ ERRO AO GERAR TOKEN:", err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// =====================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
});