let watchStart = {};
const feed = document.getElementById('feed');

let videos = [];
let observer;

// =========================
// 🔥 CARREGAR
// =========================
async function carregar() {
  const usuario = JSON.parse(localStorage.getItem('usuarioLogado')) || {};
  const seguindo = usuario.seguindo || [];

  const res = await fetch('/replays', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ seguindo })
  });

  videos = await res.json();

  render();
  iniciarObserver();
}

// =========================
// 🔥 RENDER
// =========================
function render() {
  feed.innerHTML = '';

  videos.forEach((v, index) => {
    const div = document.createElement('div');
    div.className = 'video';

    div.innerHTML = `
      <video src="${v.path}" muted playsinline preload="auto"></video>

      <div class="overlay">
        <div class="top-info">
          <strong>@${v.userId}</strong>
        </div>

        <div class="comments" id="comments-${v.id}"></div>

        <div class="comment-box">
          <input placeholder="Comentar..." id="input-${v.id}">
          <button onclick="comentar('${v.id}')">Enviar</button>
        </div>

        <div class="actions">
          <button onclick="like('${v.id}')">❤️ ${v.likes}</button>
        </div>
      </div>
    `;

    const videoEl = div.querySelector('video');

    // 👁️ VIEW
    fetch('/view-replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: v.id })
    });

    // ⏱️ tempo assistido
    videoEl.onplay = () => {
      watchStart[v.id] = Date.now();
    };

    videoEl.onpause = () => {
      enviarTempo(v.id);
    };

    feed.appendChild(div);

    mostrarComentarios(v);
  });
}

// =========================
// 🔥 OBSERVER (CORAÇÃO)
// =========================
function iniciarObserver() {
  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;

      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, {
    threshold: 0.7
  });

  document.querySelectorAll('video').forEach(video => {
    observer.observe(video);
  });
}

// =========================
// 🔥 WATCH TIME
// =========================
function enviarTempo(id) {
  if (!watchStart[id]) return;

  const tempo = Date.now() - watchStart[id];

  fetch('/watch-time', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id, tempo })
  });

  delete watchStart[id];
}

// =========================
// 🔥 COMENTAR
// =========================
window.comentar = async (id) => {
  const input = document.getElementById(`input-${id}`);
  const text = input.value;

  if (!text) return;

  await fetch('/comment-replay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, text })
  });

  adicionarComentarioNaTela(id, text);
  input.value = '';
};

// =========================
// 🔥 COMENTÁRIOS
// =========================
function mostrarComentarios(video) {
  const container = document.getElementById(`comments-${video.id}`);
  if (!container) return;

  container.innerHTML = '';

  video.comments.slice(-5).forEach(c => {
    criarComentario(container, c);
  });
}

function adicionarComentarioNaTela(id, text) {
  const container = document.getElementById(`comments-${id}`);
  if (!container) return;

  criarComentario(container, text);
}

function criarComentario(container, text) {
  const div = document.createElement('div');
  div.className = 'comment';
  div.textContent = text;

  container.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateY(-20px)';
  }, 4000);

  setTimeout(() => {
    div.remove();
  }, 5000);
}

// =========================
// ❤️ LIKE
// =========================
window.like = async (id) => {
  await fetch('/like-replay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });

  carregar();
};

// =========================
// 🔄 INFINITE SCROLL
// =========================
feed.addEventListener('scroll', () => {
  const scrollBottom = feed.scrollTop + feed.clientHeight;
  const height = feed.scrollHeight;

  if (scrollBottom >= height - 200) {
    carregar(); // carrega mais vídeos
  }
});

// START
carregar();