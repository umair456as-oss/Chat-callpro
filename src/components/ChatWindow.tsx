import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, or, and } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Message } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { Send, Plus, Search, MoreVertical, Smile, Mic, Gamepad2, ArrowLeft, Image, BadgeCheck, XCircle, Phone, Play, Pause, Trash2, Share2, Check } from 'lucide-react';
import { formatMessageTime, cn, formatChatDate, toSafeDate } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc, doc } from 'firebase/firestore';
import VoiceCall from './VoiceCall';

const MessageBubble = React.memo(({ 
  msg, 
  currentUser, 
  chat, 
  messageMap, 
  onDelete, 
  onForward, 
  onReply 
}: { 
  msg: Message; 
  currentUser: UserProfile; 
  chat: UserProfile;
  messageMap: Record<string, Message>;
  onDelete: (msg: Message) => void;
  onForward: (msg: Message) => void;
  onReply: (msg: Message) => void;
}) => {
  const isOutgoing = msg.senderId === currentUser.uid;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      drag="x"
      dragConstraints={{ left: 0, right: 100 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.x > 50) onReply(msg);
      }}
      className={cn(
        "flex w-full mb-2",
        isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] px-4 py-2 rounded-2xl relative group transition-all duration-300",
          msg.isDeletedForEveryone ? "bg-gray-100 italic text-gray-400 shadow-sm" : (
            isOutgoing 
              ? "bg-[#D9FDD3] rounded-tr-none shadow-md hover:shadow-lg ring-1 ring-[#D9FDD3] hover:ring-[#c5fbc0] shadow-[0_0_15px_rgba(217,253,211,0.4)]" 
              : "bg-white rounded-tl-none shadow-sm hover:shadow-md ring-1 ring-white"
          )
        )}
      >
        {/* Actions */}
        {!msg.isDeletedForEveryone && (
          <div className={cn(
            "absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20",
            isOutgoing ? "-left-20" : "-right-20"
          )}>
            <button 
              onClick={() => onDelete(msg)}
              className="p-1.5 bg-white/80 backdrop-blur-sm shadow-sm rounded-full text-gray-400 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
            <button 
              onClick={() => onForward(msg)}
              className="p-1.5 bg-white/80 backdrop-blur-sm shadow-sm rounded-full text-gray-400 hover:text-[#00A884] transition-colors"
              title="Forward"
            >
              <Share2 size={14} />
            </button>
          </div>
        )}

        {/* Reply Preview */}
        {msg.replyTo && (
          <div className="bg-black/5 border-l-4 border-[#00A884] p-2 rounded-lg mb-2 text-[11px] text-[#667781] flex flex-col">
            <span className="font-bold text-[#00A884] mb-0.5">
              {messageMap[msg.replyTo]?.senderId === currentUser.uid ? 'You' : chat.displayName}
            </span>
            <span className="truncate">
              {messageMap[msg.replyTo]?.text || 'Voice Message'}
            </span>
          </div>
        )}

        {/* Forwarded Tag */}
        {msg.isForwarded && (
          <div className="flex items-center gap-1 text-[10px] text-[#667781] italic mb-1">
            <Share2 size={10} className="rotate-180" />
            Forwarded
          </div>
        )}

        {/* Content */}
        {msg.type === 'voice' ? (
          <VoiceMessage audioUrl={msg.audioUrl || ''} />
        ) : (
          <p className="text-[#111B21] text-[15px] leading-relaxed break-words pr-14">{msg.text}</p>
        )}

        {/* Meta (Time & Ticks) */}
        <div className="absolute bottom-1.5 right-2.5 flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-[#667781]/80">
            {msg.timestamp ? formatMessageTime(toSafeDate(msg.timestamp)) : '...'}
          </span>
          {isOutgoing && (
            <motion.div 
              initial={false}
              animate={{ color: msg.status === 'read' ? '#53bdeb' : '#8696a0' }}
              className="flex items-center"
            >
              {msg.status === 'read' ? (
                <div className="flex -space-x-1.5">
                  <Check size={13} strokeWidth={3} />
                  <Check size={13} strokeWidth={3} />
                </div>
              ) : (
                <Check size={13} strokeWidth={3} />
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

MessageBubble.displayName = 'MessageBubble';

const VoiceMessage = ({ audioUrl }: { audioUrl: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioUrl) {
      setError(true);
      return;
    }

    try {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      const setAudioData = () => {
        if (!isNaN(audio.duration)) setDuration(audio.duration);
      };
      const setAudioTime = () => setCurrentTime(audio.currentTime);
      const onEnded = () => setIsPlaying(false);
      const onError = () => {
        // Only log error if it's not a temporary blob URL or a large data URL (which are expected to fail on some browsers)
        if (!audioUrl.startsWith('blob:') && !audioUrl.startsWith('data:')) {
          console.error('Audio load error for URL:', audioUrl.slice(0, 50) + '...');
        }
        setError(true);
      };

      audio.addEventListener('loadedmetadata', setAudioData);
      audio.addEventListener('timeupdate', setAudioTime);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      return () => {
        audio.pause();
        audio.removeEventListener('loadedmetadata', setAudioData);
        audio.removeEventListener('timeupdate', setAudioTime);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };
    } catch (e) {
      console.error('Failed to initialize audio:', e);
      setError(true);
    }
  }, [audioUrl]);

  if (error) {
    return (
      <div className="flex items-center gap-2 py-2 text-red-500 italic text-[11px] bg-red-50 px-3 rounded-lg border border-red-100">
        <XCircle size={14} />
        <span>Audio unavailable</span>
      </div>
    );
  }

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
        }).catch(error => {
          if (error.name !== 'AbortError') {
            console.error("Playback failed:", error);
          }
        });
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generate a pseudo-waveform
  const waveformBars = [30, 50, 80, 40, 60, 90, 30, 50, 70, 40, 60, 80, 30, 50, 90, 40, 60, 70, 30, 50];

  return (
    <div className="flex items-center gap-3 py-2 min-w-[220px] bg-black/5 px-3 rounded-xl border border-black/5">
      <button 
        onClick={togglePlayback}
        className="w-10 h-10 flex items-center justify-center bg-[#00A884] text-white rounded-full hover:bg-[#008F70] transition-all shadow-sm active:scale-95"
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
      </button>
      
      <div className="flex-1 flex items-end gap-[2px] h-8 relative">
        {waveformBars.map((height, i) => {
          const progress = (currentTime / (duration || 1)) * 100;
          const barProgress = (i / waveformBars.length) * 100;
          const isActive = barProgress <= progress;
          
          return (
            <div 
              key={i}
              className={cn(
                "w-[3px] rounded-full transition-all duration-200",
                isActive ? "bg-[#00A884]" : "bg-gray-300"
              )}
              style={{ height: `${height}%` }}
            />
          );
        })}
        
        {/* Hidden range input for seeking */}
        <input 
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={(e) => {
            const time = parseFloat(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = time;
            setCurrentTime(time);
          }}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
        />
      </div>

      <div className="flex flex-col items-end min-w-[35px]">
        <span className="text-[10px] font-medium text-[#667781]">
          {isPlaying ? formatTime(currentTime) : formatTime(duration)}
        </span>
      </div>
    </div>
  );
};

interface ChatWindowProps {
  chat: UserProfile;
  currentUser: UserProfile;
  onBack?: () => void;
}

export default function ChatWindow({ chat, currentUser, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageMap, setMessageMap] = useState<Record<string, Message>>({});
  const [newMessage, setNewMessage] = useState('');
  const [showGamesMenu, setShowGamesMenu] = useState(false);
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeCall, setActiveCall] = useState<boolean>(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch all users for forwarding
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== currentUser.uid);
      setAllUsers(usersList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sync queued messages
      const queue = JSON.parse(localStorage.getItem('msg_queue') || '[]');
      if (queue.length > 0) {
        queue.forEach(async (msg: Message) => {
          try {
            await addDoc(collection(db, 'messages'), { 
              ...msg, 
              replyTo: msg.replyTo || null,
              timestamp: serverTimestamp() 
            });
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
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          // Fallback for serverTimestamp which is null in local cache
          timestamp: data.timestamp || { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
        } as Message;
      });
      setMessages(msgs);
      
      const map: Record<string, Message> = {};
      msgs.forEach(m => { if (m.id) map[m.id] = m; });
      setMessageMap(map);
      
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

    const messageText = newMessage;
    const currentReplyingTo = replyingTo;

    const msg: Message = {
      senderId: currentUser.uid,
      receiverId: chat.uid,
      text: messageText,
      timestamp: serverTimestamp(),
      status: 'sent',
      type: 'text',
      replyTo: currentReplyingTo?.id || null
    };

    setNewMessage('');
    setReplyingTo(null);

    if (!isOnline) {
      // Queue message locally
      const queue = JSON.parse(localStorage.getItem('msg_queue') || '[]');
      queue.push(msg);
      localStorage.setItem('msg_queue', JSON.stringify(queue));
      // Add to local state for immediate feedback
      setMessages(prev => [...prev, { ...msg, id: 'temp-' + Date.now(), status: 'sent', timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } } as Message]);
      return;
    }

    try {
      await addDoc(collection(db, 'messages'), msg);

      // Auto-Reply Bot Logic (Elite Feature)
      if (messageText.toLowerCase().trim() === 'balance') {
        const botReply: Message = {
          senderId: 'alpha-ai-bot',
          receiverId: currentUser.uid,
          text: `Your current balance is: Rs. ${currentUser.balance.toFixed(2)}`,
          timestamp: serverTimestamp(),
          status: 'sent',
          type: 'text',
          replyTo: null
        };
        setTimeout(async () => {
          try {
            await addDoc(collection(db, 'messages'), botReply);
          } catch (err) {
            console.error('Bot reply failed:', err);
          }
        }, 1000);
      }
    } catch (error) {
      // Restore message if it failed
      setNewMessage(messageText);
      setReplyingTo(currentReplyingTo);
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (recordedAudio) return; // Don't start if we have a pending recording
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support audio recording.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Find best supported MIME type for recording
      const mimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg'];
      const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      
      const mediaRecorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : {});
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setRecordedAudio({
          blob: audioBlob,
          url: URL.createObjectURL(audioBlob)
        });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      const timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      (mediaRecorder as any).timer = timer;
    } catch (error: any) {
      console.error('Error starting recording:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Microphone permission denied. Please enable microphone access in your browser settings and ensure the site is served over HTTPS.');
      } else {
        alert('Could not start recording. Please check your microphone connection.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval((mediaRecorderRef.current as any).timer);
    }
  };

  const handleSendVoiceMessage = async () => {
    if (!recordedAudio) return;

    const currentAudio = recordedAudio;
    const currentReplyingTo = replyingTo;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPlayingPreview(false);
    setRecordedAudio(null);
    setReplyingTo(null);

    // Convert blob to base64 for persistent storage in Firestore
    const reader = new FileReader();
    reader.readAsDataURL(currentAudio.blob);
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      
      // Firestore has 1MB limit. Check size (approx 1.37x larger in base64)
      if (base64Audio.length > 1000000) {
        alert('Voice message is too long. Please record a shorter message (under 30 seconds).');
        setRecordedAudio(currentAudio); // Restore for retry
        return;
      }

      const msg: Message = {
        senderId: currentUser.uid,
        receiverId: chat.uid,
        text: 'Voice Message',
        audioUrl: base64Audio,
        timestamp: serverTimestamp(),
        status: 'sent',
        type: 'voice',
        replyTo: currentReplyingTo?.id || null
      };

      if (!isOnline) {
        // Queue locally
        const queue = JSON.parse(localStorage.getItem('msg_queue') || '[]');
        queue.push(msg);
        localStorage.setItem('msg_queue', JSON.stringify(queue));
        setMessages(prev => [...prev, { ...msg, id: 'temp-' + Date.now(), status: 'sent', timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } } as Message]);
        return;
      }

      try {
        await addDoc(collection(db, 'messages'), msg);
      } catch (error) {
        setRecordedAudio(currentAudio);
        setReplyingTo(currentReplyingTo);
        handleFirestoreError(error, OperationType.CREATE, 'messages');
      }
    };
  };

  const cancelRecording = () => {
    if (recordedAudio) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setIsPlayingPreview(false);
      URL.revokeObjectURL(recordedAudio.url);
      setRecordedAudio(null);
    }
  };

  const togglePreviewPlayback = () => {
    if (!recordedAudio) return;
    
    if (!previewAudioRef.current || previewAudioRef.current.src !== recordedAudio.url) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      previewAudioRef.current = new Audio(recordedAudio.url);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
      previewAudioRef.current.onerror = () => {
        console.error('Preview audio load failed');
        setIsPlayingPreview(false);
      };
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      const playPromise = previewAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlayingPreview(true);
        }).catch(error => {
          if (error.name !== 'AbortError') {
            console.error("Preview playback failed:", error);
          }
        });
      }
    }
  };

  const handleDeleteForMe = async (msg: Message) => {
    if (!msg.id) return;
    const deletedFor = msg.deletedFor || [];
    if (!deletedFor.includes(currentUser.uid)) {
      deletedFor.push(currentUser.uid);
      try {
        await updateDoc(doc(db, 'messages', msg.id), { deletedFor });
        setMessageToDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'messages');
      }
    }
  };

  const handleDeleteForEveryone = async (msg: Message) => {
    if (!msg.id) return;
    try {
      await updateDoc(doc(db, 'messages', msg.id), { 
        isDeletedForEveryone: true,
        text: 'This message was deleted' 
      });
      setMessageToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'messages');
    }
  };

  const handleForward = async (targetUser: UserProfile) => {
    if (!messageToForward) return;
    
    const forwardedMsg: Message = {
      senderId: currentUser.uid,
      receiverId: targetUser.uid,
      text: messageToForward.text,
      timestamp: serverTimestamp(),
      status: 'sent',
      type: messageToForward.type,
      audioUrl: messageToForward.audioUrl || null,
      replyTo: null,
      isForwarded: true
    };

    try {
      await addDoc(collection(db, 'messages'), forwardedMsg);
      setMessageToForward(null);
      alert(`Message forwarded to ${targetUser.displayName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
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
          <button 
            onClick={() => setActiveCall(true)}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors" 
            title="Voice Call"
          >
            <Phone size={20} />
          </button>
          <button onClick={() => setIsWallpaperModalOpen(true)} className="p-2 hover:bg-gray-200 rounded-full transition-colors" title="Change Wallpaper">
            <Image size={20} />
          </button>
          <button><Search size={20} /></button>
          <button><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* Voice Call Overlay */}
      <AnimatePresence>
        {activeCall && (
          <VoiceCall 
            currentUser={currentUser}
            otherUser={chat}
            onEnd={() => setActiveCall(false)}
          />
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 z-10 custom-scrollbar"
      >
        {messages.filter(m => !m.deletedFor?.includes(currentUser.uid)).map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            currentUser={currentUser}
            chat={chat}
            messageMap={messageMap}
            onDelete={setMessageToDelete}
            onForward={setMessageToForward}
            onReply={setReplyingTo}
          />
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
        ) : recordedAudio ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={cancelRecording}
              className="p-2 text-red-500 hover:bg-red-50 rounded-full"
            >
              <XCircle size={24} />
            </button>
            <div className="flex items-center gap-2 bg-[#D9FDD3] px-3 py-1.5 rounded-full">
              <button 
                onClick={togglePreviewPlayback}
                className="p-1 text-[#00A884] hover:bg-white/50 rounded-full transition-colors"
              >
                {isPlayingPreview ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <Mic size={16} className="text-[#00A884]" />
              <span className="text-xs font-medium text-[#111B21]">Voice Ready</span>
            </div>
            <button 
              onClick={handleSendVoiceMessage}
              className="p-2 text-[#00A884] hover:bg-[#D9FDD3] rounded-full"
            >
              <Send size={24} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isRecording && (
              <div className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full text-red-600 animate-pulse">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                <span className="text-xs font-mono">{Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</span>
              </div>
            )}
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                "p-2 rounded-full transition-all flex items-center justify-center",
                isRecording ? "bg-red-500 text-white scale-110 shadow-lg" : "text-[#54656F] hover:bg-gray-200"
              )}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              {isRecording ? (
                <div className="w-4 h-4 bg-white rounded-sm" />
              ) : (
                <Mic size={24} />
              )}
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Message Deletion Modal */}
    <AnimatePresence>
      {messageToForward && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#111B21]">Forward to...</h3>
              <button onClick={() => setMessageToForward(null)} className="text-[#54656F] hover:text-[#111B21]">
                <XCircle size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {allUsers.map(user => (
                <button
                  key={user.uid}
                  onClick={() => handleForward(user)}
                  className="w-full flex items-center p-3 hover:bg-gray-50 rounded-xl transition-colors gap-3"
                >
                  <img
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                    alt={user.displayName}
                    className="w-10 h-10 rounded-full border border-gray-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-left">
                    <p className="font-medium text-[#111B21]">{user.displayName}</p>
                    <p className="text-xs text-[#667781]">{user.phoneNumber || user.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {messageToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white w-full max-w-xs rounded-2xl overflow-hidden shadow-2xl p-6"
          >
            <h3 className="text-lg font-bold text-[#111B21] mb-4">Delete message?</h3>
            <div className="space-y-3">
              <button 
                onClick={() => handleDeleteForMe(messageToDelete)}
                className="w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg text-[#111B21] font-medium transition-colors"
              >
                Delete for me
              </button>
              {messageToDelete.senderId === currentUser.uid && (
                <button 
                  onClick={() => handleDeleteForEveryone(messageToDelete)}
                  className="w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg text-[#111B21] font-medium transition-colors"
                >
                  Delete for everyone
                </button>
              )}
              <button 
                onClick={() => setMessageToDelete(null)}
                className="w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg text-[#00A884] font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

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
                    {url && <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
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
