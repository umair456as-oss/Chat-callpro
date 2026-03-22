import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseError';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              phoneNumber: firebaseUser.phoneNumber || '',
              balance: 0,
              role: 'user',
              isOnline: true,
              lastSeen: new Date().toISOString(),
              isVerified: false,
              isBanned: false,
              level: 'Bronze',
              experience: 0,
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            // Listen for real-time profile updates (like balance)
            unsubProfile = onSnapshot(userRef, (doc) => {
              if (doc.exists()) {
                setProfile(doc.data() as UserProfile);
              }
            }, (error) => {
              handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
            });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return { user, profile, loading };
}
