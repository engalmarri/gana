import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAE5T4yvDNKmo8sik4eFDbhjvc4K0uUi7M",
  authDomain: "sallahkuthar.firebaseapp.com",
  projectId: "sallahkuthar",
  storageBucket: "sallahkuthar.firebasestorage.app",
  messagingSenderId: "5993973139",
  appId: "1:5993973139:web:735a1648d623dddf9b1466"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
