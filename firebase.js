import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {

apiKey:
"AIzaSyDmmwICZYXE_eTzUt8YuZ8VhOtFOO3DssQ",

authDomain:
"sallahorders-3d3bb.firebaseapp.com",

projectId:
"sallahorders-3d3bb",

storageBucket:
"sallahorders-3d3bb.firebasestorage.app",

messagingSenderId:
"1063050925586",

appId:
"1:1063050925586:web:327700c149dde96f1eaacb"

};

const app =
initializeApp(firebaseConfig);

const db =
getFirestore(app);

export { db };
