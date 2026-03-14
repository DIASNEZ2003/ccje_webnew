// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database"; 

const firebaseConfig = {
  apiKey: "AIzaSyCnOhgJ-tAUyiR0wHcHy54uJIlewTE-Eh8",
  authDomain: "ccje-1f127.firebaseapp.com",
  databaseURL: "https://ccje-1f127-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ccje-1f127",
  storageBucket: "ccje-1f127.firebasestorage.app",
  messagingSenderId: "72915282252",
  appId: "1:72915282252:web:c96575f13d56a0508e87e9",
  measurementId: "G-MZXVLW22GW"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getDatabase(app);

