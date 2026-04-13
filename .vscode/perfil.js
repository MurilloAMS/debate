import { auth, onAuthStateChanged } from './firebase.js';
import {
  getFirestore, doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const db = getFirestore();
const storage = getStorage();

const foto = document.getElementById('foto');
const uploadFoto = document.getElementById('uploadFoto');
const nome = document.getElementById('nome');
const bioView = document.getElementById('bioView');
const bioInput = document.getElementById('bio');

const seguidores = document.getElementById('seguidores');
const seguindo = document.getElementById('seguindo');

const followBtn = document.getElementById('followBtn');
const editarBtn = document.getElementById('editarBtn');
const editArea = document.getElementById('editArea');
const salvar = document.getElementById('salvar');

const livesEl = document.getElementById('lives');
const feedPerfil = document.getElementById('feedPerfil');
const videosGrid = document.getElementById('videosGrid');

let rooms = [];
let currentUser;
let perfilData;
let wsInterval;

// 🔥 WEBSOCKET PROFISSIONAL
const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProto}://${location.host}`);

ws.onopen = () => {

  ws.send(JSON.stringify({ type: 'get-rooms' }));

  // 🔥 evita duplicação
  if (wsInterval) clearInterval(wsInterval);

  wsInterval = setInterval(() => {
    ws.send(JSON.stringify({ type: 'get-rooms' }));
  }, 3000);
};

ws.onmessage = (event) => {
  let msg;
  try { msg = JSON.parse(event.data); } catch { return; }

  if (msg.type === 'rooms-list') {
    rooms = msg.rooms;
    renderLives();
    renderFeedCompleto();
  }
};

// 🔥 PARAMS
const params = new URLSearchParams(location.search);
const perfilUid = params.get('uid');

// ===================== LOGIN =====================
onAuthStateChanged(auth, async (user) => {

  if (!user) return location.href = 'login.html';

  currentUser = user;
  const uid = perfilUid || user.uid;

  let refUser = doc(db, "usuarios", uid);
  let snap = await getDoc(refUser);

  if (!snap.exists()) {
    await setDoc(refUser, {
      nome: "Usuário",
      bio: "",
      foto: "",
      seguidores: [],
      seguindo: []
    });
    snap = await getDoc(refUser);
  }

  perfilData = snap.data();

  foto.src = perfilData?.foto || user.photoURL || 'default-avatar.png';
  nome.textContent = perfilData?.nome || user.email;
  bioView.textContent = perfilData?.bio || 'Sem bio ainda';

  seguidores.textContent = perfilData?.seguidores?.length || 0;
  seguindo.textContent = perfilData?.seguindo?.length || 0;

  bioInput.value = perfilData?.bio || '';

  loadReplays();
  setupFollow(uid);
});

// ===================== FOLLOW =====================
async function setupFollow(uid) {

  if (uid === currentUser.uid) {
    followBtn.style.display = 'none';
    return;
  }

  const mySnap = await getDoc(doc(db, "usuarios", currentUser.uid));
  const isFollowing = mySnap.data()?.seguindo?.includes(uid);

  updateFollowUI(isFollowing);

  followBtn.onclick = async () => {

    if (isFollowing) {
      await updateDoc(doc(db, "usuarios", currentUser.uid), {
        seguindo: arrayRemove(uid)
      });
      await updateDoc(doc(db, "usuarios", uid), {
        seguidores: arrayRemove(currentUser.uid)
      });
    } else {
      await updateDoc(doc(db, "usuarios", currentUser.uid), {
        seguindo: arrayUnion(uid)
      });
      await updateDoc(doc(db, "usuarios", uid), {
        seguidores: arrayUnion(currentUser.uid)
      });
    }

    location.reload();
  };
}

function updateFollowUI(isFollowing) {
  followBtn.textContent = isFollowing ? 'Seguindo' : 'Seguir';
}

// ===================== EDITAR =====================
editarBtn.onclick = () => {
  editArea.style.display =
    editArea.style.display === 'none' ? 'block' : 'none';
};

// ===================== SALVAR BIO =====================
salvar.onclick = async () => {
  await updateDoc(doc(db, "usuarios", currentUser.uid), {
    bio: bioInput.value
  });

  bioView.textContent = bioInput.value;
};

// ===================== FOTO =====================
foto.onclick = () => {
  if (!perfilUid) uploadFoto.click();
};

uploadFoto.onchange = async () => {

  const file = uploadFoto.files[0];
  if (!file) return;

  const storageRef = ref(storage, 'fotos/' + currentUser.uid);
  await uploadBytes(storageRef, file);

  const url = await getDownloadURL(storageRef);

  await updateDoc(doc(db, "usuarios", currentUser.uid), {
    foto: url
  });

  foto.src = url;
};

// ===================== LIVES
function renderLives() {

  livesEl.innerHTML = '';

  rooms.forEach(l => {

    const div = document.createElement('div');
    div.className = 'live-card';

    div.innerHTML = `
      <div class="live-badge">AO VIVO</div>
      <div class="live-overlay">
        ${l.room} • 👥 ${l.count}
      </div>
    `;

    div.onclick = () => {
      location.href = `sala.html?room=${l.room}`;
    };

    livesEl.appendChild(div);
  });
}

// ===================== REPLAYS
async function loadReplays() {

  try {

    const res = await fetch('/replays');
    const videos = await res.json();

    const uid = perfilUid || currentUser.uid;
    const userVideos = videos.filter(v => v.userId === uid);

    videosGrid.innerHTML = '';

    userVideos.forEach(v => {

      const div = document.createElement('div');
      div.className = 'video-item';

      div.innerHTML = `
        <video src="${v.path}" muted></video>
        <div class="video-overlay">
          ❤️ ${v.likes || 0} | 👁️ ${v.views || 0}
        </div>
      `;

      div.onclick = () => {
        location.href = `replays.html?video=${v.id}`;
      };

      videosGrid.appendChild(div);
    });

  } catch (err) {
    console.error('Erro ao carregar replays:', err);
  }
}

// ===================== FEED PROFISSIONAL
async function renderFeedCompleto() {

  const uid = perfilUid || currentUser.uid;

  let items = [];

  // 🔴 LIVES
  rooms.forEach(l => {
    items.push({
      tipo: 'live',
      room: l.room,
      count: l.count,
      createdAt: Date.now() - (l.tempo || 0) * 60000
    });
  });

  // 🎬 REPLAYS
  try {
    const res = await fetch('/replays');
    const videos = await res.json();

    const userVideos = videos.filter(v => v.userId === uid);

    userVideos.forEach(v => {
      items.push({
        tipo: 'replay',
        video: v,
        createdAt: v.createdAt || 0
      });
    });

  } catch {}

  // 🔥 ORDENAÇÃO
  items.sort((a, b) => b.createdAt - a.createdAt);

  renderFeedUI(items);
}

function renderFeedUI(items) {

  feedPerfil.innerHTML = '';

  items.forEach(item => {

    const div = document.createElement('div');
    div.className = 'feed-item-perfil';

    if (item.tipo === 'live') {

      div.innerHTML = `
        <div class="feed-overlay">
          🔴 AO VIVO<br>
          ${item.room}<br>
          👥 ${item.count}
        </div>

        <button class="enter-btn-perfil">Entrar</button>
      `;

      div.onclick = () => {
        location.href = `sala.html?room=${item.room}`;
      };
    }

    if (item.tipo === 'replay') {

      div.innerHTML = `
        <video src="${item.video.path}" muted autoplay loop></video>

        <div class="feed-overlay">
          ❤️ ${item.video.likes || 0} | 👁️ ${item.video.views || 0}
        </div>
      `;

      div.onclick = () => {
        location.href = `replays.html?video=${item.video.id}`;
      };
    }

    feedPerfil.appendChild(div);
  });
}

// ===================== NAV
window.abrirSeguidores = () => {
  location.href = `seguidores.html?uid=${perfilUid || currentUser.uid}`;
};

window.abrirSeguindo = () => {
  location.href = `seguindo.html?uid=${perfilUid || currentUser.uid}`;
};