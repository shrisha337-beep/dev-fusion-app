import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from 'firebase/firestore';
import { FirebaseApp } from 'firebase/app';

// Expo v56 exposes client-side environment variables prefixed with EXPO_PUBLIC_
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let db: Firestore | null = null;
let isFirebaseConfigured = false;

// Check if projectId exists to decide if we should initialize Firebase
if (firebaseConfig.projectId && firebaseConfig.apiKey) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    
    // Initialize Firestore with local cache support (highly useful for mobile apps)
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    isFirebaseConfigured = true;
    console.log('Firebase successfully initialized for SplitSmart!');
  } catch (error) {
    console.warn('Firebase initialization failed, running in LocalStorage mode:', error);
  }
} else {
  console.log('No Firebase credentials found in environment. Running in offline LocalStorage mode.');
}

export { db, isFirebaseConfigured };
