// auth.js

import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  provider,
  onAuthStateChanged,
  signOut
} from './firebase.js';

// ===== CADASTRO =====
window.register = async () => {
  const email = document.getElementById('email')?.value;
  const senha = document.getElementById('senha')?.value;

  if (!email || !senha) {
    alert('Preencha todos os campos');
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    alert('Conta criada com sucesso!');
    window.location.href = 'index.html';
  } catch (err) {
    alert('Erro: ' + err.message);
  }
};

// ===== LOGIN =====
window.login = async () => {
  const email = document.getElementById('emailLogin')?.value;
  const senha = document.getElementById('senhaLogin')?.value;

  if (!email || !senha) {
    alert('Preencha todos os campos');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    window.location.href = 'index.html';
  } catch (err) {
    alert('Erro: ' + err.message);
  }
};

// ===== LOGIN GOOGLE =====
window.loginGoogle = async () => {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = 'index.html';
  } catch (err) {
    alert('Erro: ' + err.message);
  }
};

// ===== LOGOUT =====
window.logout = async () => {
  try {
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (err) {
    alert('Erro ao sair');
  }
};

// ===== PROTEGER PÁGINAS =====
window.protegerPagina = () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'login.html';
    }
  });
};

// ===== MOSTRAR USUÁRIO NO TOPO =====
onAuthStateChanged(auth, (user) => {
  const topBar = document.getElementById('usuario-logado');

  if (!topBar) return;

  if (user) {
    const nome = user.displayName || user.email;
    const foto = user.photoURL;

    topBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        ${foto ? `<img src="${foto}" style="width:30px;height:30px;border-radius:50%;">` : ''}
        <span>${nome}</span>
        <button onclick="logout()" style="margin-left:10px;">Sair</button>
      </div>
    `;
  } else {
    topBar.innerHTML = `
      <a href="login.html">Entrar</a>
    `;
  }
});