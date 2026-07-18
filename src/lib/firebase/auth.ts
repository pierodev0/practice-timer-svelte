import {
	GoogleAuthProvider,
	signInWithPopup,
	signInWithRedirect,
	getRedirectResult,
	signOut,
	onAuthStateChanged,
	type UserCredential,
	type User
} from 'firebase/auth';
import { auth } from './config.js';

const provider = new GoogleAuthProvider();

/**
 * Sign in with Google via popup. Falls back to redirect if popup is blocked.
 */
export async function loginGoogle(): Promise<UserCredential | null> {
	try {
		return await signInWithPopup(auth, provider);
	} catch (err: any) {
		if (err.code === 'auth/popup-blocked') {
			await signInWithRedirect(auth, provider);
			return null;
		}
		throw err;
	}
}

/**
 * Handle redirect result (for mobile fallback).
 */
export async function handleRedirectResult(): Promise<UserCredential | null> {
	try {
		return await getRedirectResult(auth);
	} catch (err) {
		console.warn('Redirect result error:', err);
		return null;
	}
}

/**
 * Sign out.
 */
export async function logoutGoogle(): Promise<void> {
	await signOut(auth);
}

/**
 * Subscribe to auth state changes. Returns unsubscribe function.
 */
export function observeAuth(callback: (user: User | null) => void): () => void {
	return onAuthStateChanged(auth, callback);
}
