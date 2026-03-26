import React, { useState } from 'react';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { doc, setDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { LogIn, Mail, Lock, User, ArrowRight, Github } from 'lucide-react';
import { cn } from '../utils';

export default function Auth() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        setError('Login cancelled. Please keep the popup open to sign in.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setError('Multiple login requests detected. Please try again.');
      } else {
        setError(error.message);
      }
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
        
        // Explicitly create user profile for email registration to ensure displayName is saved
        const userRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email || '',
          displayName: displayName || '',
          photoURL: '',
          phoneNumber: '',
          balance: 0,
          role: 'user',
          isOnline: true,
          lastSeen: new Date().toISOString(),
          isVerified: true,
          isBanned: false,
          level: 'Bronze',
          experience: 0,
          createdAt: serverTimestamp()
        });
      } else {
        let loginEmail = email;
        
        // If the input doesn't look like an email, try to find the user by displayName
        if (!email.includes('@')) {
          const q = query(collection(db, 'users'), where('displayName', '==', email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            loginEmail = querySnapshot.docs[0].data().email;
          } else {
            throw { code: 'auth/user-not-found', message: 'No account found with this display name.' };
          }
        }
        
        await signInWithEmailAndPassword(auth, loginEmail, password);
      }
    } catch (error: any) {
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.';
      } else if (error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password. Please check your credentials.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak. Please use at least 6 characters.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Please check your internet connection.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please try again later.';
      }
      setError(message);
      console.error('Auth error:', error.code, error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#111B21] p-4 font-sans">
      <div className="bg-[#202C33] p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-md w-full border border-[#2b2b2b]">
        <div className="w-20 h-20 bg-[#00A884] rounded-full mb-6 flex items-center justify-center shadow-lg ring-4 ring-[#00A884]/20">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Alpha Chat</h1>
        <p className="text-[#8696a0] text-center mb-8 text-sm">Connect, Chat, and Earn Rewards Daily.</p>

        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-xs mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="w-full space-y-4">
          {isRegistering && (
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" />
              <input
                type="text"
                placeholder="Full Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[#111B21] border border-[#2b2b2b] focus:border-[#00A884] rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none transition-all"
                required={isRegistering}
              />
            </div>
          )}
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" />
            <input
              type="text"
              placeholder={isRegistering ? "Email Address" : "Email or Display Name"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#111B21] border border-[#2b2b2b] focus:border-[#00A884] rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none transition-all"
              required
            />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#111B21] border border-[#2b2b2b] focus:border-[#00A884] rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00A884] hover:bg-[#008F6F] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isRegistering ? 'Create Account' : 'Sign In'}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="w-full flex items-center gap-4 my-6">
          <div className="flex-1 h-[1px] bg-[#2b2b2b]" />
          <span className="text-[#8696a0] text-xs uppercase tracking-widest font-bold">OR</span>
          <div className="flex-1 h-[1px] bg-[#2b2b2b]" />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-3 active:scale-95"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="mt-6 text-[#00A884] hover:underline text-sm font-medium"
        >
          {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
        </button>

        <p className="mt-8 text-[10px] text-[#8696a0] text-center leading-relaxed">
          By continuing, you agree to Alpha Chat's <br />
          <span className="text-[#00A884] cursor-pointer">Terms of Service</span> and <span className="text-[#00A884] cursor-pointer">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
