import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
	apiKey: 'AIzaSyCvI_IAAcpBFMRpWSJ7wt2RND9fhCgpSRw',
	authDomain: 'music-routine-app.firebaseapp.com',
	projectId: 'music-routine-app',
	storageBucket: 'music-routine-app.firebasestorage.app',
	messagingSenderId: '908433154492',
	appId: '1:908433154492:web:36c81821c5b5b7f183cbb9'
};

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

try {
	_app = initializeApp(firebaseConfig);
	_db = initializeFirestore(_app, {
		localCache: persistentLocalCache()
	});
	_auth = getAuth(_app);
} catch (e) {
	console.warn('Firebase initialization failed (offline mode):', e);
}

export const app = _app!;
export const db = _db!;
export const auth = _auth!;
