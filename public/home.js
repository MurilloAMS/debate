// 🔥 IMPORTA DO SEU FIREBASE
import { auth, db, onAuthStateChanged } from '/firebase.js';

// 🔥 FIRESTORE
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const feed = document.getElementById('feed');

const notificationIcon = document.getElementById('notificationIcon');
const notificationCounter = document.getElementById('notificationCounter');
const notificationList = document.getElementById('notificationList');

let roomsData = [];
let currentIndex = 0;
const previewPlayers = {};
let followingList = [];
let notifications = [];

let ws;

// ===================== LOGIN =====================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));

    if (userSnap.exists()) {
      followingList = userSnap.data().seguindo || [];
    }
  } catch (err) {
    console.log("Erro ao buscar usuário:", err);
  }

  initWebSocket();
});

// ===================== WEBSOCKET =====================
function initWebSocket() {
  const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';

  ws = new WebSocket(`${wsProto}://${location.host}`);

  ws.onopen = () => {
    console.log("✅ Conectado ao servidor");
    ws.send(JSON.stringify({ type: 'get-rooms' }));
  };

  ws.onmessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    // 🔥 LISTA DE SALAS
    if (msg.type === 'rooms-list') {
      const followed = [];
      const others = [];

      msg.rooms.forEach(r => {
        if (followingList.includes(r.hostUid)) {
          followed.push(r);
        } else {
          others.push(r);
        }
      });

      roomsData = [...followed, ...others].sort((a, b) => b.score - a.score);

      renderFeed();
      preloadVideos();
    }

    // 🔥 PREVIEW
    if (msg.type === 'preview') startPreview(msg.room, msg.sdp);

    // 🔥 COMENTÁRIO
    if (msg.type === 'comment') showFloatingComment(msg.text);

    // 🔥 LIKE
    if (msg.type === 'likes') {
      const el = document.querySelector(`[data-room="${msg.room}"] .likes`);
      if (el) el.textContent = msg.value;
    }

    // 🔥 NOTIFICAÇÃO
    if (msg.type === 'room-started' && followingList.includes(msg.hostUid)) {
      addNotification(msg.hostName, msg.room);
    }
  };

  ws.onerror = (err) => {
    console.log("❌ Erro WebSocket:", err);
  };
}

// ===================== FEED =====================
function renderFeed() {
  feed.innerHTML = '';

  roomsData.forEach((roomData, index) => {
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.dataset.index = index;
    div.dataset.room = roomData.room;

    const nomeExibido = roomData.host || "Usuário";

    div.innerHTML = `
      <video autoplay muted playsinline data-room="${roomData.room}"></video>

      <div class="overlay">
        <h3>${roomData.room}</h3>
        <p style="cursor:pointer;" onclick="location.href='perfil.html?uid=${roomData.hostUid}'">
          🎤 ${nomeExibido}
        </p>
        <p>👥 ${roomData.count}</p>
      </div>

      <div class="like-box">
        ❤️ <span class="likes">${roomData.likes || 0}</span>
      </div>

      <button class="like-btn">❤️</button>

      <div class="comment-input">
        <input placeholder="Comentar..." />
      </div>

      <div class="comments-layer"></div>

      <button class="enter-btn">Entrar</button>
    `;

    // 🔥 ENTRAR
    div.querySelector('.enter-btn').onclick = () => {
      location.href = `sala.html?room=${roomData.room}&role=audience`;
    };

    // 🔥 LIKE
    div.querySelector('.like-btn').onclick = () => {
      ws.send(JSON.stringify({ type: 'like', room: roomData.room }));
    };

    // 🔥 COMENTÁRIO
    const input = div.querySelector('input');
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        ws.send(JSON.stringify({
          type: 'comment',
          text: input.value,
          room: roomData.room
        }));
        input.value = '';
      }
    });

    feed.appendChild(div);
  });

  observeScroll();
}

// ===================== SCROLL =====================
function observeScroll() {
  const items = document.querySelectorAll('.feed-item');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        currentIndex = parseInt(entry.target.dataset.index);
        preloadNext();
      }
    });
  }, { threshold: 0.6 });

  items.forEach(item => observer.observe(item));
}

// ===================== PRELOAD =====================
function preloadNext() {
  const next = roomsData[currentIndex + 1];
  if (!next) return;

  ws.send(JSON.stringify({
    type: 'request-preview',
    room: next.room
  }));
}

function preloadVideos() {
  roomsData.slice(0, 3).forEach(r => {
    ws.send(JSON.stringify({
      type: 'request-preview',
      room: r.room
    }));
  });
}

// ===================== COMENTÁRIOS =====================
function showFloatingComment(text) {
  const currentItem = document.querySelector(`.feed-item[data-index="${currentIndex}"]`);
  if (!currentItem) return;

  const layer = currentItem.querySelector('.comments-layer');

  const c = document.createElement('div');
  c.className = 'comment-float';
  c.textContent = text;
  c.style.top = Math.random() * 80 + '%';

  layer.appendChild(c);

  setTimeout(() => c.remove(), 4000);
}

// ===================== VIDEO =====================
async function startPreview(room, offer) {
  if (previewPlayers[room]) return;

  const video = document.querySelector(`[data-room="${room}"]`);
  if (!video) return;

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  pc.ontrack = (e) => {
    video.srcObject = e.streams[0];
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  previewPlayers[room] = pc;
}

// ===================== NOTIFICAÇÕES =====================
function addNotification(host, room) {
  notifications.push({ host, room });
  updateNotificationUI();
}

function updateNotificationUI() {
  notificationCounter.style.display = notifications.length ? 'inline' : 'none';
  notificationCounter.textContent = notifications.length;

  notificationList.innerHTML = '';

  notifications.slice().reverse().forEach(n => {
    const li = document.createElement('li');
    li.textContent = `${n.host} iniciou live`;
    li.onclick = () => location.href = `sala.html?room=${n.room}`;
    notificationList.appendChild(li);
  });
}

notificationIcon.onclick = () => {
  notificationList.style.display =
    notificationList.style.display === 'block' ? 'none' : 'block';
};