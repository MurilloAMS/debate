// 🔥 FIREBASE
import { auth, db, onAuthStateChanged } from '/firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔥 LIVEKIT
import { Room } from 'https://esm.sh/livekit-client';

const feed = document.getElementById('feed');

let roomsData = [];
let followingList = [];
let currentRooms = {}; // salas ativas

let ws;

// ===================== LOGIN =====================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = 'login.html';
    return;
  }

  // 🔥 PROTEÇÃO FIRESTORE
  try {
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));

    if (userSnap.exists()) {
      followingList = userSnap.data().seguindo || [];
    } else {
      followingList = [];
    }

  } catch (err) {
    console.log("Erro ao buscar usuário:", err);
    followingList = []; // evita quebrar o app
  }

  initWebSocket();
});

// ===================== WEBSOCKET =====================
function initWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';

  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    console.log("✅ WebSocket conectado");
    ws.send(JSON.stringify({ type: 'get-rooms' }));
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === 'rooms-list') {
      roomsData = (msg.rooms || []).sort((a, b) => b.score - a.score);
      renderFeed();
    }

    if (msg.type === 'like-update') {
      const el = document.querySelector(`[data-room="${msg.room}"] .likes`);
      if (el) el.textContent = msg.likes;
    }
  };

  ws.onerror = (err) => {
    console.log("❌ Erro WebSocket:", err);
  };
}

// ===================== FEED =====================
function renderFeed() {
  feed.innerHTML = '';

  roomsData.forEach(roomData => {

    const div = document.createElement('div');
    div.className = 'feed-item';
    div.dataset.room = roomData.room;

    div.innerHTML = `
      <video autoplay muted playsinline data-room="${roomData.room}"></video>

      <div>
        <h3>${roomData.room}</h3>
        <p>🎤 ${roomData.host || "Usuário"}</p>
        <p>👥 ${roomData.count}</p>
      </div>

      <div>
        ❤️ <span class="likes">${roomData.likes || 0}</span>
      </div>

      <button class="enter-btn">Entrar</button>
    `;

    // 🔥 ENTRAR
    div.querySelector('.enter-btn').onclick = () => {
      location.href = `sala.html?room=${roomData.room}&role=audience`;
    };

    feed.appendChild(div);

    // 🔥 PREVIEW
    startLivePreview(roomData.room);
  });
}

// ===================== LIVEKIT PREVIEW =====================
async function startLivePreview(roomName) {

  if (currentRooms[roomName]) return;

  try {
    const video = document.querySelector(`[data-room="${roomName}"]`);
    if (!video) return;

    const user = auth.currentUser;

    if (!user) return;

    const res = await fetch(`/get-token?room=${roomName}&username=${user.uid}`);

    if (!res.ok) {
      console.log("Erro ao buscar token");
      return;
    }

    const data = await res.json();

    if (!data.token || !data.url) {
      console.log("Token inválido");
      return;
    }

    const room = new Room();

    await room.connect(data.url, data.token);

    currentRooms[roomName] = room;

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