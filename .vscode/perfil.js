import { auth, onAuthStateChanged } from './firebase.js';
import {
  getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove
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

// 🔥 REMOVIDO WebRTC antigo
let rooms = [];
let currentUser;
let perfilData;

// 🔥 WEBSOCKET CORRIGIDO (HTTPS SAFE)
const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProto}://${location.host}`);

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'get-rooms' }));
};

ws.onmessage = (event) => {
  let msg;
  try { msg = JSON.parse(event.data); } catch { return; }

  if (msg.type === 'rooms-list') {
    rooms = msg.rooms;
    renderLives();
    renderFeedPerfil();
  }
};

// 🔥 PARAMS
const params = new URLSearchParams(location.search);
const perfilUid = params.get('uid');

// ===================== LOGIN =====================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = 'login.html';
    return;
  }

  currentUser = user;
  const uid = perfilUid || user.uid;

  const snap = await getDoc(doc(db, "usuarios", uid));
  perfilData = snap.data();

  foto.src = perfilData?.foto || user.photoURL || 'default-avatar.png';
  nome.textContent = perfilData?.nome || user.email;
  bioView.textContent = perfilData?.bio || 'Sem bio ainda';

  seguidores.textContent = perfilData?.seguidores?.length || 0;
  seguindo.textContent = perfilData?.seguindo?.length || 0;

  bioInput.value = perfilData?.bio || '';

  loadReplays();

  // ===================== FOLLOW =====================
  if (uid !== user.uid) {
    const isFollowing = perfilData?.seguidores?.includes(user.uid);
    followBtn.textContent = isFollowing ? 'Deixar de seguir' : 'Seguir';

    followBtn.onclick = async () => {
      if (isFollowing) {
        await updateDoc(doc(db, "usuarios", user.uid), {
          seguindo: arrayRemove(uid)
        });
        await updateDoc(doc(db, "usuarios", uid), {
          seguidores: arrayRemove(user.uid)
        });
        followBtn.textContent = 'Seguir';
      } else {
        await updateDoc(doc(db, "usuarios", user.uid), {
          seguindo: arrayUnion(uid)
        });
        await updateDoc(doc(db, "usuarios", uid), {
          seguidores: arrayUnion(user.uid)
        });
        followBtn.textContent = 'Deixar de seguir';
      }
    };
  } else {
    followBtn.style.display = 'none';
  }
});

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
  alert('Perfil atualizado!');
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

// ===================== LIVES =====================
function renderLives() {
  const uid = perfilUid || currentUser.uid;
  const userLives = rooms.filter(r => r.hostUid === uid);

  livesEl.innerHTML = '';

  userLives.forEach(l => {
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

// ===================== FEED PERFIL =====================
function renderFeedPerfil() {
  const uid = perfilUid || currentUser.uid;
  const userRooms = rooms.filter(r => r.hostUid === uid);

  feedPerfil.innerHTML = '';

  userRooms.forEach(roomData => {
    const div = document.createElement('div');
    div.className = 'feed-item-perfil';

    div.innerHTML = `
      <div class="feed-overlay">
        🔴 ${roomData.room} • 👥 ${roomData.count}
      </div>

      <button class="enter-btn-perfil">Entrar</button>
    `;

    div.querySelector('.enter-btn-perfil').onclick = () => {
      location.href = `sala.html?room=${roomData.room}`;
    };

    feedPerfil.appendChild(div);
  });
}

// ===================== REPLAYS =====================
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

// ===================== NAVEGAÇÃO =====================
window.abrirSeguidores = () => {
  location.href = `seguidores.html?uid=${perfilUid || currentUser.uid}`;
};

window.abrirSeguindo = () => {
  location.href = `seguindo.html?uid=${perfilUid || currentUser.uid}`;
};