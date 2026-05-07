import { getAuth, GoogleAuthProvider, EmailAuthProvider } from 'firebase/auth';
import { app } from './firebase';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const emailProvider = EmailAuthProvider;
