// 🔥 FIREBASE
import { auth, onAuthStateChanged } from '/firebase.js';

// 🔥 LIVEKIT
import { Room } from 'https://esm.sh/livekit-client';

const feed = document.getElementById('feed');

let roomsData = [];
let activeRooms = {};
let ws;
let observer;

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

  let interval;

  ws.onopen = () => {
  console.log("✅ WS conectado");

  // 🔥 busca imediata
  ws.send(JSON.stringify({ type: 'get-rooms' }));

  // 🔥 segunda tentativa rápida (resolve timing)
  setTimeout(() => {
    ws.send(JSON.stringify({ type: 'get-rooms' }));
  }, 1000);

  // 🔥 terceira tentativa
  setTimeout(() => {
    ws.send(JSON.stringify({ type: 'get-rooms' }));
  }, 2000);

  // 🔥 loop contínuo
  interval = setInterval(() => {
    ws.send(JSON.stringify({ type: 'get-rooms' }));
  }, 3000);
};

  ws.onclose = () => {
    clearInterval(interval);
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === 'rooms-list') {
      roomsData = msg.rooms.sort((a, b) => b.score - a.score);
      renderFeed();
    }

    if (msg.type === 'room-started') {
      const exists = roomsData.find(r => r.room === msg.room);

      if (!exists) {
        roomsData.unshift({
          room: msg.room,
          host: msg.host,
          count: 1,
          likes: 0,
          score: 999
        });
      }

      renderFeed(); // 🔥 força atualização sempre
    }
  };
}

// ===================== FEED =====================
function renderFeed() {
  feed.innerHTML = '';

  // 🔥 OBSERVER (único e correto)
  observer = new IntersectionObserver(handleVisibility, {
    threshold: 0.7
  });

  roomsData.forEach(room => {

    const container = document.createElement('div');
    container.className = 'video-container';
    container.dataset.room = room.room;

    container.innerHTML = `
      <video muted playsinline></video>

      <div class="overlay">
        <h3>${room.room}</h3>
        <p>🎤 ${room.host || "Usuário"}</p>
        <p>👥 ${room.count}</p>
      </div>
    `;

    // 👉 entrar na live (só clicando no vídeo)
    container.addEventListener('click', (e) => {
      if (e.target.tagName === 'VIDEO') {
        location.href = `sala.html?room=${room.room}`;
      }
    });

    feed.appendChild(container);

    observer.observe(container); // 👈 correto (observa o container)
  });
}

// ===================== AUTO PLAY =====================
function handleVisibility(entries) {
  entries.forEach(entry => {
    const container = entry.target;
    const roomName = container.dataset.room;
    const video = container.querySelector('video');

    if (entry.isIntersecting) {
      startPreview(container, roomName);
      video.play().catch(()=>{});
    } else {
      stopPreview(roomName);
      video.pause();
      video.srcObject = null;
    }
  });
}

// ===================== START PREVIEW =====================
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

// ===================== STOP PREVIEW =====================
function stopPreview(roomName) {
  if (!activeRooms[roomName]) return;

  try {
    activeRooms[roomName].disconnect();
  } catch {}

  delete activeRooms[roomName];
}
window.addEventListener('focus', () => {
  ws.send(JSON.stringify({ type: 'get-rooms' }));
});