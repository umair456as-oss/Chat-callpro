import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, or, and } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Message } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { Send, Plus, Search, MoreVertical, Smile, Mic, Gamepad2, ArrowLeft, Image, BadgeCheck, XCircle } from 'lucide-react';
import { formatMessageTime, cn, formatChatDate } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { updateDoc, doc } from 'firebase/firestore';

interface ChatWindowProps {
  chat: UserProfile;
  currentUser: UserProfile;
  onBack?: () => void;
}

export default function ChatWindow({ chat, currentUser, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showGamesMenu, setShowGamesMenu] = useState(false);
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sync queued messages
      const queue = JSON.parse(localStorage.getItem('msg_queue') || '[]');
      if (queue.length > 0) {
        queue.forEach(async (msg: Message) => {
          try {
            await addDoc(collection(db, 'messages'), { ...msg, timestamp: serverTimestamp() });
          } catch (e) {
            console.error('Failed to sync message:', e);
          }
        });
        localStorage.removeItem('msg_queue');
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const wallpapers = [
    'https://images.unsplash.com/photo-1557683316-973673baf926',
    'https://images.unsplash.com/photo-1557683311-eac922347aa1',
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85',
    'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5',
    'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1557683311-eac922347aa1?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?auto=format&fit=crop&q=80&w=1000',
  ];

  const updateWallpaper = async (url: string) => {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      wallpaper: url
    });
    setIsWallpaperModalOpen(false);
  };

  useEffect(() => {
    // Fetch messages between currentUser and chat user
    const q = query(
      collection(db, 'messages'),
      or(
        and(where('senderId', '==', currentUser.uid), where('receiverId', '==', chat.uid)),
        and(where('senderId', '==', chat.uid), where('receiverId', '==', currentUser.uid))
      ),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      
      // Mark unread messages as read (Read Receipts Logic)
      snapshot.docs.forEach(async (doc) => {
        const data = doc.data() as Message;
        if (data.receiverId === currentUser.uid && data.status !== 'read') {
          // Update status to read
          // We should ideally use a batch or a separate function to avoid infinite loops
          // But for now, we'll just update it if it's not read
          // await updateDoc(doc.ref, { status: 'read' });
        }
      });

      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'messages');
    });

    return () => unsubscribe();
  }, [chat.uid, currentUser.uid]);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;

    const msg: Message = {
      senderId: currentUser.uid,
      receiverId: chat.uid,
      text: newMessage,
      timestamp: serverTimestamp(),
      status: 'sent',
      type: 'text',
      replyTo: replyingTo?.id
    };

    setNewMessage('');
    setReplyingTo(null);

    if (!isOnline) {
      // Queue message locally
      const queue = JSON.parse(localStorage.getItem('msg_queue') || '[]');
      queue.push(msg);
      localStorage.setItem('msg_queue', JSON.stringify(queue));
      // Add to local state for immediate feedback
      setMessages(prev => [...prev, { ...msg, id: 'temp-' + Date.now(), status: 'sent' } as Message]);
      return;
    }

    try {
      await addDoc(collection(db, 'messages'), msg);

      // Auto-Reply Bot Logic (Elite Feature)
      if (newMessage.toLowerCase().trim() === 'balance') {
        const botReply: Message = {
          senderId: 'alpha-ai-bot',
          receiverId: currentUser.uid,
          text: `Your current balance is: Rs. ${currentUser.balance.toFixed(2)}`,
          timestamp: serverTimestamp(),
          status: 'sent',
          type: 'text'
        };
        setTimeout(async () => {
          await addDoc(collection(db, 'messages'), botReply);
        }, 1000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // In a real app, upload to Firebase Storage
        // For now, we'll just log it
        console.log('Audio recorded:', audioBlob);
        
        // Send as voice message
        const msg: Message = {
          senderId: currentUser.uid,
          receiverId: chat.uid,
          text: 'Voice Message',
          timestamp: serverTimestamp(),
          status: 'sent',
          type: 'voice',
          audioUrl: URL.createObjectURL(audioBlob) // Mock URL
        };
        await addDoc(collection(db, 'messages'), msg);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      const timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      (mediaRecorder as any).timer = timer;
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval((mediaRecorderRef.current as any).timer);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#EFEAE2] relative overflow-hidden">
      {/* Dynamic Wallpaper (Elite Feature) */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none z-0"
        style={{ 
          backgroundImage: `url(${currentUser.wallpaper || 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      ></div>

      {/* Chat Header */}
      <div className="p-3 bg-[#F0F2F5] flex items-center justify-between border-b border-[#D1D7DB] z-10">
        <div className="flex items-center">
          {onBack && (
            <button 
              onClick={onBack}
              className="md:hidden mr-2 p-1 hover:bg-gray-200 rounded-full text-[#54656F]"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div className="relative">
            <img
              src={chat.photoURL || `https://ui-avatars.com/api/?name=${chat.displayName}`}
              alt={chat.displayName || ''}
              className="w-10 h-10 rounded-full mr-3 border border-gray-300"
              referrerPolicy="no-referrer"
            />
            {chat.isOnline && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#F0F2F5]"></div>}
          </div>
          <div>
            <h3 className="font-medium text-[#111B21] flex items-center gap-1">
              {chat.displayName}
              {chat.isVerified && <BadgeCheck size={14} className="text-blue-400" />}
            </h3>
            <p className="text-[10px] text-[#667781]">
              {chat.isOnline ? 'Online' : `Last seen ${formatChatDate(new Date(chat.lastSeen))}`}
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-[#54656F]">
          <button onClick={() => setIsWallpaperModalOpen(true)} className="p-2 hover:bg-gray-200 rounded-full transition-colors" title="Change Wallpaper">
            <Image size={20} />
          </button>
          <button><Search size={20} /></button>
          <button><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 z-10"
      >
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            drag="x"
            dragConstraints={{ left: 0, right: 100 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.x > 50) setReplyingTo(msg);
            }}
            className={cn(
              "flex w-full",
              msg.senderId === currentUser.uid ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[70%] px-3 py-1.5 rounded-lg shadow-sm relative group",
                msg.senderId === currentUser.uid 
                  ? "bg-[#D9FDD3] rounded-tr-none" 
                  : "bg-white rounded-tl-none"
              )}
            >
              {msg.replyTo && (
                <div className="bg-black/5 border-l-4 border-[#00A884] p-2 rounded mb-1 text-[10px] text-[#667781]">
                  {messages.find(m => m.id === msg.replyTo)?.text.slice(0, 50)}...
                </div>
              )}
              {msg.isForwarded && (
                <div className="flex items-center gap-1 text-[10px] text-[#667781] italic mb-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11 11V5l7 7-7 7v-6H5v-2h6z"/>
                  </svg>
                  Forwarded
                </div>
              )}
              {msg.type === 'voice' ? (
                <div className="flex items-center gap-2 py-2 min-w-[200px]">
                  <button className="text-[#00A884]"><Gamepad2 size={24} /></button>
                  <div className="flex-1 h-1 bg-gray-200 rounded-full relative">
                    <div className="absolute left-0 top-0 h-full bg-[#00A884] rounded-full w-1/3" />
                  </div>
                  <span className="text-[10px] text-[#667781]">0:05</span>
                </div>
              ) : (
                <p className="text-[#111B21] text-sm break-words pr-12">{msg.text}</p>
              )}
              <div className="absolute bottom-1 right-2 flex items-center gap-1">
                <span className="text-[10px] text-[#667781]">
                  {msg.timestamp ? formatMessageTime(msg.timestamp.toDate()) : '...'}
                </span>
                {msg.senderId === currentUser.uid && (
                  <span className="text-[10px] text-[#53bdeb]">
                    {msg.status === 'read' ? '✓✓' : '✓'}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-2 bg-[#F0F2F5] flex flex-col gap-2 z-10">
        <AnimatePresence>
          {replyingTo && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-white p-3 rounded-xl border-l-4 border-[#00A884] flex justify-between items-center shadow-sm"
            >
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-[#00A884] uppercase">Replying to</p>
                <p className="text-xs text-[#667781] truncate">{replyingTo.text}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-[#667781] hover:text-[#111B21]">
                <XCircle size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setShowGamesMenu(!showGamesMenu)}
              className={cn(
                "p-2 rounded-full transition-colors",
                showGamesMenu ? "bg-[#D1D7DB] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
              )}
            >
              <Plus size={24} />
            </button>
          
          <AnimatePresence>
            {showGamesMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-2xl p-4 w-72 grid grid-cols-3 gap-4"
              >
                <div className="flex flex-col items-center gap-1 cursor-pointer hover:bg-gray-100 p-2 rounded-xl transition-colors">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-md">
                    <Gamepad2 size={24} />
                  </div>
                  <span className="text-[10px] font-medium">Games</span>
                </div>
                {/* Add more attachment icons here if needed */}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button className="text-[#54656F] p-2 hover:bg-gray-200 rounded-full"><Smile size={24} /></button>
        
        <form onSubmit={handleSendMessage} className="flex-1">
          <input
            type="text"
            placeholder="Type a message"
            className="w-full bg-white py-2 px-4 rounded-lg text-sm focus:outline-none"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
        </form>

        {newMessage.trim() ? (
          <button 
            onClick={() => handleSendMessage()}
            className="p-2 text-[#00A884] hover:bg-gray-200 rounded-full"
          >
            <Send size={24} />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {isRecording && (
              <div className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full text-red-600 animate-pulse">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                <span className="text-xs font-mono">{Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</span>
              </div>
            )}
            <button 
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={cn(
                "p-2 rounded-full transition-all",
                isRecording ? "bg-red-500 text-white scale-125" : "text-[#54656F] hover:bg-gray-200"
              )}
            >
              <Mic size={24} />
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Wallpaper Picker Modal */}
      <AnimatePresence>
        {isWallpaperModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#111B21]">Chat Wallpaper</h3>
                <button onClick={() => setIsWallpaperModalOpen(false)} className="text-[#54656F] hover:text-[#111B21]">
                  <XCircle size={24} />
                </button>
              </div>
              <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto">
                {wallpapers.map((url, i) => (
                  <div 
                    key={i} 
                    onClick={() => updateWallpaper(url)}
                    className="aspect-[9/16] rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-[#00A884] transition-all shadow-sm"
                  >
                    <img src={url} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="p-6 bg-gray-50 flex justify-end">
                <button 
                  onClick={() => updateWallpaper('')}
                  className="text-sm font-bold text-[#00A884] hover:underline"
                >
                  Reset to Default
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
