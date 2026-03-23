import { useState, useEffect, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import Wallet from './components/Wallet';
import Games from './components/Games';
import Status from './components/Status';
import AdminPanel from './components/AdminPanel';
import { UserProfile, AppSettings, Announcement, Call } from './types';
import { doc, setDoc, onSnapshot, collection, query, orderBy, where, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firebaseError';
import { ShieldAlert, Phone, PhoneOff } from 'lucide-react';
import { cn } from './utils';
import VoiceCall from './components/VoiceCall';
import Header from './components/Header';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'wallet' | 'games' | 'admin'>('chats');
  const [selectedChat, setSelectedChat] = useState<UserProfile | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);

  const [isEmulator, setIsEmulator] = useState(false);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (incomingCall) {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
        ringtoneRef.current.loop = true;
      }
      ringtoneRef.current.play().catch(e => console.error('Ringtone failed:', e));
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [incomingCall]);

  useEffect(() => {
    // Enhanced Emulator Detection (Elite Feature)
    const detectEmulator = () => {
      const ua = navigator.userAgent.toLowerCase();
      const platform = navigator.platform.toLowerCase();
      const isEmulator = 
        ua.includes('bluestacks') || 
        ua.includes('nox') || 
        ua.includes('memu') ||
        ua.includes('nexus') || 
        ua.includes('pixel') || 
        (ua.includes('android') && (platform.includes('win') || platform.includes('mac') || platform.includes('linux'))) ||
        navigator.webdriver ||
        (window as any)._phantom ||
        (window as any).__nightmare ||
        (window as any).callPhantom;

      if (isEmulator) {
        setIsEmulator(true);
        console.warn('Potential emulator detected!');
      }
    };
    detectEmulator();
  }, []);

  useEffect(() => {
    // Push Notification Permission (Elite Feature)
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          // In a real app, get FCM token and save to user profile
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubS = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) setAppSettings(doc.data() as AppSettings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const qA = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubA = onSnapshot(qA, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'announcements');
    });

    return () => {
      unsubS();
      unsubA();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'calling')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Call;
        // Only show if not already in a call
        if (!activeCall && !incomingCall) {
          setIncomingCall(callData);
          // Play ringtone logic could go here
        }
      } else {
        setIncomingCall(null);
      }
    });

    return () => unsubscribe();
  }, [user, activeCall, incomingCall]);

  const handleAcceptCall = () => {
    if (incomingCall) {
      setActiveCall(incomingCall);
      setIncomingCall(null);
    }
  };

  const handleDeclineCall = async () => {
    if (incomingCall?.id) {
      await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'rejected' });
      setIncomingCall(null);
    }
  };

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      let lastUpdate = 0;
      let lastStatus = true;
      
      const updateStatus = async (isOnline: boolean) => {
        const now = Date.now();
        // Only update if status changed OR if it's been more than 1 minute since last update
        if (isOnline === lastStatus && now - lastUpdate < 60000) return;
        
        try {
          await updateDoc(userRef, { 
            isOnline, 
            lastSeen: new Date().toISOString() 
          });
          lastUpdate = now;
          lastStatus = isOnline;
        } catch (error) {
          console.debug("Status update skipped or failed:", error);
        }
      };

      updateStatus(true);

      const handleVisibilityChange = () => {
        const isOnline = document.visibilityState === 'visible';
        updateStatus(isOnline);
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [user?.uid]); // Use user.uid to avoid re-running on every user object change

  useEffect(() => {
    if (user && user.email === 'abdulrehmanhabib.com@gmail.com' && profile?.isBanned) {
      const unbanAdmin = async () => {
        try {
          await updateDoc(doc(db, 'users', user.uid), { isBanned: false });
        } catch (error) {
          console.error("Failed to unban admin:", error);
        }
      };
      unbanAdmin();
    }
  }, [user?.uid, profile?.isBanned]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F0F2F5]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-[#25D366] rounded-full mb-4 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <p className="text-[#54656F] font-medium">Alpha Chat</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Auth />;
  }

  // Maintenance Mode Check (Admins bypass)
  const isAdmin = profile.role === 'admin' || user.email === 'abdulrehmanhabib.com@gmail.com';
  if (appSettings?.isMaintenanceMode && !isAdmin) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#111B21] text-white p-6 text-center">
        <ShieldAlert size={64} className="text-red-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-bold mb-4">System Under Maintenance</h1>
        <p className="text-[#667781] max-w-md leading-relaxed">
          We are currently performing scheduled maintenance to improve your experience. 
          Please check back in a few minutes.
        </p>
        <div className="mt-8 px-6 py-3 bg-[#202C33] rounded-xl border border-[#2b2b2b] text-sm text-[#858585]">
          Estimated time: 15-30 minutes
        </div>
      </div>
    );
  }

  if (profile.isBanned && user.email !== 'abdulrehmanhabib.com@gmail.com') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F0F2F5]">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Account Banned</h1>
          <p className="text-[#54656F]">Your account has been suspended for violating our terms of service.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#F0F2F5] overflow-hidden">
      <Header profile={profile} onTabChange={setActiveTab} />
      
      {/* System Announcement Ticker (Elite Feature) */}
      {appSettings?.tickerMessages && appSettings.tickerMessages.length > 0 && (
        <div className="bg-[#128C7E] text-white py-1.5 px-4 overflow-hidden whitespace-nowrap relative z-50 border-b border-[#075E54]">
          <div className="inline-block animate-marquee hover:pause">
            {appSettings.tickerMessages.map((msg, i) => (
              <span key={i} className="mx-12 font-bold uppercase text-xs tracking-wider">
                🔥 {msg} 🔥
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Announcement Ticker */}
      {announcements.length > 0 && (
        <div className="bg-[#00A884] text-white py-2 px-4 overflow-hidden whitespace-nowrap relative z-50">
          <div className="inline-block animate-marquee hover:pause">
            {announcements.map((a, i) => (
              <span key={a.id} className="mx-8 font-medium">
                {a.text}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse md:flex-row flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        {(!selectedChat || activeTab !== 'chats') && (
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} />
        )}

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
        {activeTab === 'chats' && (
          <>
            <div className={cn(
              "w-full md:w-[400px] border-r border-[#D1D7DB] bg-white flex flex-col",
              selectedChat ? "hidden md:flex" : "flex"
            )}>
              <ChatList onSelectChat={setSelectedChat} selectedChat={selectedChat} />
            </div>
            <div className={cn(
              "flex-1 bg-[#EFEAE2] relative",
              selectedChat ? "flex" : "hidden md:flex"
            )}>
              {selectedChat ? (
                <ChatWindow chat={selectedChat} currentUser={profile} onBack={() => setSelectedChat(null)} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-10">
                  <div className="w-64 h-64 bg-gray-200 rounded-full mb-8 flex items-center justify-center opacity-50">
                    <svg className="w-32 h-32 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                  </div>
                  <h2 className="text-3xl font-light text-[#41525d] mb-4">Alpha Chat Web</h2>
                  <p className="text-[#667781] text-sm max-w-sm">
                    Send and receive messages without keeping your phone online. Use Alpha Chat on up to 4 linked devices and 1 phone at the same time.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'status' && <Status profile={profile} />}
        {activeTab === 'wallet' && <Wallet profile={profile} />}
        {activeTab === 'games' && <Games profile={profile} />}
        {activeTab === 'admin' && (profile.role === 'admin' || profile.email === 'abdulrehmanhabib.com@gmail.com') && <AdminPanel />}
        </div>
      </div>

      {/* Incoming Call UI */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-[#111B21]/95 backdrop-blur-md flex flex-col items-center justify-between p-12 text-white"
          >
            <div className="flex flex-col items-center gap-6 mt-20">
              <div className="relative">
                <div className="absolute inset-0 bg-[#00A884] rounded-full animate-ping opacity-20"></div>
                <img 
                  src={incomingCall.callerPhoto || `https://ui-avatars.com/api/?name=${incomingCall.callerName}`}
                  className="w-32 h-32 rounded-full border-4 border-[#00A884] shadow-2xl relative z-10"
                  alt=""
                />
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-2">{incomingCall.callerName}</h2>
                <p className="text-[#8696A0] text-lg animate-pulse">Incoming voice call...</p>
              </div>
            </div>

            <div className="flex gap-16 mb-20">
              <div className="flex flex-col items-center gap-3">
                <button 
                  onClick={handleDeclineCall}
                  className="p-6 bg-red-500 rounded-full hover:bg-red-600 transition-all shadow-xl hover:scale-110 active:scale-95"
                >
                  <PhoneOff size={32} />
                </button>
                <span className="text-sm font-medium text-[#8696A0]">Decline</span>
              </div>

              <div className="flex flex-col items-center gap-3">
                <button 
                  onClick={handleAcceptCall}
                  className="p-6 bg-[#00A884] rounded-full hover:bg-[#008F6F] transition-all shadow-xl hover:scale-110 active:scale-95 animate-bounce"
                >
                  <Phone size={32} />
                </button>
                <span className="text-sm font-medium text-[#8696A0]">Accept</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Overlay */}
      <AnimatePresence>
        {activeCall && (
          <VoiceCall 
            currentUser={profile}
            otherUser={{ 
              uid: activeCall.callerId === profile.uid ? activeCall.receiverId : activeCall.callerId,
              displayName: activeCall.callerName,
              photoURL: activeCall.callerPhoto
            } as UserProfile}
            callId={activeCall.id}
            isIncoming={activeCall.receiverId === profile.uid}
            onEnd={() => setActiveCall(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
