// 🔥 FIREBASE
import { auth, db, onAuthStateChanged } from '/firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔥 LIVEKIT
import { Room } from 'https://esm.sh/livekit-client';

const feed = document.getElementById('feed');
const usernameEl = document.getElementById('username');

let roomsData = [];
let currentRooms = {};
let ws;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = 'login.html';
    return;
  }

  try {
    const snap = await getDoc(doc(db, "usuarios", user.uid));

    if (snap.exists()) {
      usernameEl.textContent = snap.data().nome || "Usuário";
    } else {
      usernameEl.textContent = user.email.split('@')[0];
    }

  } catch {
    usernameEl.textContent = user.email.split('@')[0];
  }

  initWebSocket();
});

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

      // evita duplicar sala
      const exists = roomsData.find(r => r.room === msg.room);
      if (!exists) {
        roomsData.unshift({
          room: msg.room,
          host: msg.host,
          count: 1,
          likes: 0
        });

        renderFeed();
      }
    }
  };
}

function renderFeed() {
  feed.innerHTML = '';

  roomsData.forEach(room => {

    const div = document.createElement('div');
    div.className = 'feed-item';

    div.innerHTML = `
      <video autoplay muted playsinline></video>

      <div class="info">
        <h3>${room.room}</h3>
        <p>🎤 ${room.host || "Usuário"}</p>
        <p>👥 ${room.count}</p>
      </div>

      <button class="enter">Entrar</button>
    `;

    div.querySelector('.enter').onclick = () => {
      location.href = `sala.html?room=${room.room}`;
    };

    feed.appendChild(div);

    startPreview(div, room.room);
  });
}

async function startPreview(container, roomName) {

  if (currentRooms[roomName]) return;

  try {
    const video = container.querySelector('video');
    const user = auth.currentUser;

    const res = await fetch(`/get-token?room=${roomName}&username=${user.uid}`);
    const data = await res.json();

    if (!data.token) return;

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