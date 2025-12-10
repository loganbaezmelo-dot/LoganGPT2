import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB4cutqVoseRk2yl9qEAAxwS5OBFLKNPL0",
  authDomain: "logangpt-22854.firebaseapp.com",
  projectId: "logangpt-22854",
  storageBucket: "logangpt-22854.firebasestorage.app",
  messagingSenderId: "76925732538",
  appId: "1:76925732538:web:f31f456283df2f16e7e483",
  measurementId: "G-JMCJL5RFMD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
