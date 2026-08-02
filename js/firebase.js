import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {

apiKey:
"AIzaSyA0rFoNBEodMDTnjVfWrEN1el4h_glnsfc",

authDomain:
"gana-f8e1f.firebaseapp.com",

projectId:
"gana-f8e1f",

storageBucket:
"gana-f8e1f.firebasestorage.app",

messagingSenderId:
"679621972460",

appId:
"1:679621972460:web:1d9da658bfa8fd414cf0c9"

};

const app =
initializeApp(firebaseConfig);

const db =
getFirestore(app);

export { db };
