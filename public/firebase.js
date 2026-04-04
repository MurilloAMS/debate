// 🔥 FIREBASE IMPORTS
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

// 🔥 CONFIG (A SUA)
const firebaseConfig = {
  apiKey: "AIzaSyAJCSs1r8rwmGQ1PvfGEAUwpkkmHgJ6HUQ",
  authDomain: "debate-7904f.firebaseapp.com",
  projectId: "debate-7904f",
  storageBucket: "debate-7904f.firebasestorage.app",
  messagingSenderId: "293851758581",
  appId: "1:293851758581:web:07548e25f9e0dbd6422abc"
};

// 🔥 INICIALIZA
const app = initializeApp(firebaseConfig);

// 🔥 EXPORTA CERTO
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};