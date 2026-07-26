import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

if (!apiKey || !projectId) {
  if (import.meta.env.PROD) {
    throw new Error(
      "Critical Environment Variable Missing: Please configure VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in your production hosting environment settings."
    );
  }
}

const firebaseConfig = {
  apiKey: apiKey || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "expenso-79acc.firebaseapp.com",
  projectId: projectId || "expenso-79acc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "expenso-79acc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "385082089799",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:385082089799:web:7751fc34a5afa48580ec62",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
