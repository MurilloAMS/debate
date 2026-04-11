// 🔥 FIREBASE
import { auth, db, onAuthStateChanged } from '/firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔥 LIVEKIT
import { Room } from 'https://esm.sh/livekit-client';

const feed = document.getElementById('feed');

let roomsData = [];
let activeRooms = {};
let ws;

// ===================== LOGIN =====================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = 'login.html';
    return;
  }

  initWebSocket();
});

// ===================== WEBSOCKET =====================
function initWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'get-rooms' }));
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === 'rooms-list') {
      roomsData = msg.rooms;
      renderFeed();
    }

    if (msg.type === 'room-started') {
      const exists = roomsData.find(r => r.room === msg.room);

      if (!exists) {
        roomsData.unshift({
          room: msg.room,
          host: msg.host,
          count: 1
        });

        renderFeed();
      }
    }
  };
}

// ===================== FEED TIKTOK =====================
function renderFeed() {
  feed.innerHTML = '';

  roomsData.forEach(room => {

    const container = document.createElement('div');
    container.className = 'video-container';

    container.innerHTML = `
      <video autoplay muted playsinline></video>

      <div class="overlay">
        <h3>${room.room}</h3>
        <p>🎤 ${room.host || "Usuário"}</p>
        <p>👥 ${room.count}</p>
      </div>
    `;

    // 👉 clicar entra na live
    container.onclick = () => {
      location.href = `sala.html?room=${room.room}`;
    };

    feed.appendChild(container);

    startPreview(container, room.room);
  });
}

// ===================== PREVIEW =====================
async function startPreview(container, roomName) {

  if (activeRooms[roomName]) return;

  try {
    const video = container.querySelector('video');
    const user = auth.currentUser;

    const res = await fetch(`/get-token?room=${roomName}&username=${user.uid}`);
    const data = await res.json();

    if (!data.token) return;

    const room = new Room();
    await room.connect(data.url, data.token);

    activeRooms[roomName] = room;

    room.on('trackSubscribed', (track) => {
      if (track.kind === 'video') {
        const stream = new MediaStream([track.mediaStreamTrack]);
        video.srcObject = stream;
      }
    });

  } catch (err) {
    console.log("Erro preview:", err);
  }
}