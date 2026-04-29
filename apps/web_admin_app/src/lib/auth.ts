import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
  User,
} from "firebase/auth";
import { auth } from "./firebase";

export async function registerWithEmail(
  email: string,
  password: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function sendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function reloadUser(user: User): Promise<void> {
  await user.reload();
}

export interface SocialSignInResult {
  user: User;
  isNewUser: boolean;
}

export async function signInWithGoogle(): Promise<SocialSignInResult> {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return { user: result.user, isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false };
}

export async function signInWithFacebook(): Promise<SocialSignInResult> {
  const result = await signInWithPopup(auth, new FacebookAuthProvider());
  return { user: result.user, isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false };
}

export async function signInWithApple(): Promise<SocialSignInResult> {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  const result = await signInWithPopup(auth, provider);
  return { user: result.user, isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false };
}

export { onAuthStateChanged, auth };
