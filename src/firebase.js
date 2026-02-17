// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ここにコピーしたconfigを貼る
const firebaseConfig = {
  aapiKey: "AIzaSyBPyyqCXd35TBFnhlnE4SA13p49B97PAk8",
  authDomain: "kakeibo-5dd02.firebaseapp.com",
  projectId: "kakeibo-5dd02",
  storageBucket: "kakeibo-5dd02.firebasestorage.app",
  messagingSenderId: "354982671434",
  appId: "1:354982671434:web:5b965a2d6f864fcff9a2b3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
