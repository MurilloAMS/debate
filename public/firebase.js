import { auth, signOut } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore();
const btnPerfil = document.getElementById('btnPerfil');

(() => {
  // Observa o estado do login
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("funcionou login Google");

      // Mostra nome e foto no topo
      btnPerfil.innerHTML = `
        <img src="${user.photoURL || 'default-avatar.png'}" style="width:30px;height:30px;border-radius:50%;margin-right:5px;vertical-align:middle;">
        ${user.displayName || user.email}
        <button id="logoutBtn" style="margin-left:10px;padding:4px 8px;font-size:12px;">Sair</button>
      `;

      // Salva usuário no Firestore
      await setDoc(doc(db, "usuarios", user.uid), {
        uid: user.uid,
        nome: user.displayName || user.email,
        email: user.email,
        foto: user.photoURL || null,
        seguindo: [],
        seguidores: []
      }, { merge: true });

      // Logout
      document.getElementById('logoutBtn').onclick = async () => {
        await signOut(auth);
        window.location.href = 'login.html';
      };

      // Carrega feed
      initFeed(user.uid);

    } else {
      window.location.href = 'login.html';
    }
  });

  // ===================== WebSocket Feed =====================
  let ws;
  let roomsData = [];
  let currentIndex = 0;
  const previewPlayers = {};

  async function initFeed(currentUid) {
    ws = new WebSocket(`ws://${location.host}`);
    const feed = document.getElementById('feed');

    ws.onopen = () => ws.send(JSON.stringify({ type: 'get-rooms' }));

    ws.onmessage = async (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'rooms-list') {
        roomsData = msg.rooms.sort((a, b) => b.score - a.score);
        renderFeed(currentUid);
        preloadVideos();
      }

      if (msg.type === 'preview') {
        startPreview(msg.room, msg.sdp);
      }

      if (msg.type === 'comment') {
        showFloatingComment(msg.text);
      }

      if (msg.type === 'like-update') {
        const el = document.querySelector(`[data-room="${msg.room}"] .likes`);
        if (el) el.textContent = msg.likes;
      }
    };

    function renderFeed(currentUid) {
      feed.innerHTML = '';

      roomsData.forEach(async (roomData, index) => {
        const div = document.createElement('div');
        div.className = 'feed-item';
        div.dataset.index = index;
        div.dataset.room = roomData.room;

        // Busca dados do host do Firestore
        let hostData = null;
        try {
          const docSnap = await getDoc(doc(db, "usuarios", roomData.hostUid || roomData.host));
          if (docSnap.exists()) hostData = docSnap.data();
        } catch {}

        const isFollowing = hostData?.seguidores?.includes(currentUid);

        div.innerHTML = `
          <video autoplay muted playsinline data-room="${roomData.room}"></video>

          <div class="overlay">
            <h3>${roomData.room}</h3>
            <p>🎤 ${roomData.host}</p>
            <p>👥 ${roomData.count}</p>
            <button class="follow-btn" style="margin-top:5px;">
              ${isFollowing ? 'Seguindo' : 'Seguir'}
            </button>
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

        // Seguir/Deixar de seguir
        const followBtn = div.querySelector('.follow-btn');
        followBtn.onclick = async () => {
          if (!hostData) return;

          if (followBtn.textContent === 'Seguir') {
            // Seguir
            await updateDoc(doc(db, "usuarios", currentUid), {
              seguindo: arrayUnion(hostData.uid)
            });
            await updateDoc(doc(db, "usuarios", hostData.uid), {
              seguidores: arrayUnion(currentUid)
            });
            followBtn.textContent = 'Seguindo';
          } else {
            // Deixar de seguir
            await updateDoc(doc(db, "usuarios", currentUid), {
              seguindo: arrayRemove(hostData.uid)
            });
            await updateDoc(doc(db, "usuarios", hostData.uid), {
              seguidores: arrayRemove(currentUid)
            });
            followBtn.textContent = 'Seguir';
          }
        };

        // entrar
        div.querySelector('.enter-btn').onclick = () => {
          location.href = `sala.html?room=${roomData.room}&role=audience`;
        };

        // like
        div.querySelector('.like-btn').onclick = () => {
          ws.send(JSON.stringify({ type: 'like', room: roomData.room }));
        };

        // comentário
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
  }
})();