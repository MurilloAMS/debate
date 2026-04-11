import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// 🔥 CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAJCSs1r8rwmGQ1PvfGEAUwpkkmHgJ6HUQ",
  authDomain: "debate-7904f.firebaseapp.com",
  projectId: "debate-7904f",
  storageBucket: "debate-7904f.appspot.com", // ⚠️ corrigido padrão
  messagingSenderId: "293851758581",
  appId: "1:293851758581:web:07548e25f9e0dbd6422abc"
};

// 🔥 INIT
const app = initializeApp(firebaseConfig);

// 🔥 SERVIÇOS
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 🔥 PROVIDER
export const provider = new GoogleAuthProvider();

// 🔥 AUTH EXPORTS
export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};