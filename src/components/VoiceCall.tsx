import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { UserProfile, Call } from '../types';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Shield, User, X, ShieldAlert, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';

interface VoiceCallProps {
  currentUser: UserProfile;
  otherUser: UserProfile;
  callId?: string;
  isIncoming?: boolean;
  onEnd: () => void;
}

export default function VoiceCall({ currentUser, otherUser, callId, isIncoming, onEnd }: VoiceCallProps) {
  const [status, setStatus] = useState<'calling' | 'ongoing' | 'ended' | 'reconnecting'>('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [timer, setTimer] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const callingSoundRef = useRef<HTMLAudioElement | null>(null);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentCallId, setCurrentCallId] = useState<string | undefined>(callId);

  const iceCandidatesBuffer = useRef<RTCIceCandidateInit[]>([]);

  const servers = {
    iceServers: [
      { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    ],
    iceCandidatePoolSize: 10,
  };

  useEffect(() => {
    // Audio feedback for calling
    if (status === 'calling' && !isIncoming) {
      if (!callingSoundRef.current) {
        callingSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
        callingSoundRef.current.loop = true;
      }
      callingSoundRef.current.play().catch(err => {
        console.warn('Audio play blocked. User must interact with document first.', err);
      });
    } else {
      if (callingSoundRef.current) {
        callingSoundRef.current.pause();
        callingSoundRef.current.currentTime = 0;
      }
    }
  }, [status, isIncoming]);

  useEffect(() => {
    let isMounted = true;

    const setupRTC = async () => {
      const pc = new RTCPeerConnection(servers);
      pcRef.current = pc;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          pc.close();
          return;
        }
        localStreamRef.current = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
          }
          remoteStreamRef.current = event.streams[0];
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'failed') {
            console.log('ICE Restarting or failing...');
            pc.restartIce();
          }
        };

        pc.onconnectionstatechange = () => {
          if (!isMounted) return;
          console.log('Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setStatus('ongoing');
          }
          if (pc.connectionState === 'disconnected') setStatus('reconnecting');
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
             if (status === 'ongoing' || pc.connectionState === 'closed') {
               onEnd();
             }
          }
        };

        if (isIncoming && callId) {
          const callDoc = doc(db, 'calls', callId);
          const offerCandidates = collection(callDoc, 'offerCandidates');
          const answerCandidates = collection(callDoc, 'answerCandidates');

          pc.onicecandidate = (e) => e.candidate && addDoc(answerCandidates, e.candidate.toJSON());

          const snap = await getDoc(callDoc);
          if (!snap.exists()) {
            onEnd();
            return;
          }

          const data = snap.data() as Call;
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await updateDoc(callDoc, { 
            answer: { type: answer.type, sdp: answer.sdp },
            status: 'ongoing'
          });

          // Sync status from DB
          const unsubStatus = onSnapshot(callDoc, (s) => {
            const data = s.data();
            if (data?.status === 'ongoing' && status === 'calling') {
              // The other side confirmed ongoing, but wait for RTC if possible
              // However for UI purposes, "ongoing" can be set if both are ready
            }
            if (data?.status === 'ended' || data?.status === 'rejected') onEnd();
          });

          // ICE Candidates from caller
          onSnapshot(offerCandidates, (s) => {
            s.docChanges().forEach(c => {
              if (c.type === 'added') {
                const candidateData = c.doc.data();
                if (pc.currentRemoteDescription) {
                  pc.addIceCandidate(new RTCIceCandidate(candidateData));
                } else {
                  console.log('Buffering offer candidate...');
                  iceCandidatesBuffer.current.push(candidateData as RTCIceCandidateInit);
                }
              }
            });
          });

          return () => {
            unsubStatus();
          };

        } else {
          // Outgoing
          const callDocRef = await addDoc(collection(db, 'calls'), {
            callerId: currentUser.uid,
            callerName: currentUser.displayName,
            callerPhoto: currentUser.photoURL,
            receiverId: otherUser.uid,
            participants: [currentUser.uid, otherUser.uid],
            status: 'calling',
            type: 'voice',
            timestamp: serverTimestamp(),
          });
          setCurrentCallId(callDocRef.id);

          const offerCandidates = collection(callDocRef, 'offerCandidates');
          const answerCandidates = collection(callDocRef, 'answerCandidates');

          pc.onicecandidate = (e) => e.candidate && addDoc(offerCandidates, e.candidate.toJSON());

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await updateDoc(callDocRef, { offer: { type: offer.type, sdp: offer.sdp } });

          // Listen for answer and status
          const unsubscribeCall = onSnapshot(callDocRef, (s) => {
            const data = s.data() as Call;
            if (data?.answer && !pc.currentRemoteDescription) {
              pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
            if (data?.status === 'ongoing' && status === 'calling') {
                setStatus('ongoing'); // Caller also moves to ongoing when receiver accepts
            }
            if (data?.status === 'ended' || data?.status === 'rejected') {
              onEnd();
            }
          });

          // ICE Candidates from receiver
          const unsubscribeICE = onSnapshot(answerCandidates, (s) => {
            s.docChanges().forEach(c => {
              if (c.type === 'added') {
                const candidateData = c.doc.data();
                if (pc.currentRemoteDescription) {
                  pc.addIceCandidate(new RTCIceCandidate(candidateData));
                } else {
                  iceCandidatesBuffer.current.push(candidateData as RTCIceCandidateInit);
                }
              }
            });
          });

          return () => {
            unsubscribeCall();
            unsubscribeICE();
          };
        }
      } catch (err: any) {
        console.error('Signaling error detailed:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('permission')) {
          setPermissionError("مائیکروفون تک رسائی ممکن نہیں ہے۔ یا فائر بیس پرمیشن کا مسئلہ ہے۔");
        } else {
          setPermissionError(`ایرر: ${err.message || 'نامعلوم غلطی'}`);
        }
      }
    };

    setupRTC();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (pcRef.current?.currentRemoteDescription && iceCandidatesBuffer.current.length > 0) {
      iceCandidatesBuffer.current.forEach(c => pcRef.current?.addIceCandidate(new RTCIceCandidate(c)));
      iceCandidatesBuffer.current = [];
    }
  }, [pcRef.current?.currentRemoteDescription]);

  useEffect(() => {
    let interval: any;
    if (status === 'ongoing') {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleEndCall = async () => {
    if (currentCallId) {
      await updateDoc(doc(db, 'calls', currentCallId), { status: 'ended' }).catch(() => {});
    }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-[#0B1014] text-white flex flex-col items-center justify-between py-16 px-6 overflow-hidden"
    >
      {/* Background Blur Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[#25D366]/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-[#00A884]/10 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        <div className="flex items-center gap-2 text-[#8696A0] mb-12 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
          <Shield size={14} className="text-[#00A884]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Private Call • Encrypted</span>
        </div>

        <div className="relative group p-4">
          <motion.div 
            animate={{ 
              scale: status === 'ongoing' ? [1, 1.05, 1] : 1,
              opacity: status === 'ongoing' ? [0.2, 0.4, 0.2] : 0
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-[#25D366] rounded-full blur-3xl"
          />
          <div className="relative w-44 h-44 rounded-full p-1.5 bg-gradient-to-tr from-[#25D366] via-[#00A884] to-[#128C7E] shadow-[0_0_50px_rgba(37,211,102,0.3)]">
            <img 
              src={otherUser.photoURL || `https://ui-avatars.com/api/?name=${otherUser.displayName}&background=random&color=fff&size=256`}
              className="w-full h-full rounded-full border-[6px] border-[#0B1014] object-cover"
              alt={otherUser.displayName || ''}
            />
          </div>
          
          <AnimatePresence>
            {status === 'ongoing' && (
              <motion.div 
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#ef4444] px-4 py-1.5 rounded-full text-[10px] font-black shadow-[0_4px_15px_rgba(239,68,68,0.4)] border border-white/20"
              >
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                REC • LIVE
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-12 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black tracking-tight text-white mb-2"
          >
            {otherUser.displayName}
          </motion.h2>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[#8696A0] font-bold text-base tracking-wide Urdu">
              {status === 'reconnecting' ? (
                <span className="text-yellow-500 flex items-center gap-2">
                   <RotateCw size={14} className="animate-spin" /> دوبارہ منسلک ہو رہا ہے...
                </span>
              ) : status === 'calling' ? (
                <span className="flex items-center gap-2">کال ہو رہی ہے...</span>
              ) : (
                <span className="text-[#25D366] tabular-nums font-mono text-2xl drop-shadow-[0_0_10px_rgba(37,211,102,0.4)]">
                  {formatTime(timer)}
                </span>
              )}
            </p>
          </div>
        </div>

        {permissionError && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-10 bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-sm text-center Urdu backdrop-blur-sm max-w-[280px]"
          >
            <ShieldAlert size={20} className="mx-auto mb-2" />
            مائیکروفون تک رسائی ممکن نہیں ہے۔ براہ کرم براؤزر کی ترتیبات دیکھیں۔
          </motion.div>
        )}
      </div>

      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <div className="relative z-10 w-full max-w-xs flex flex-col gap-12">
        <div className="flex items-center justify-around">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            className={cn(
              "w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-300 shadow-2xl relative overflow-hidden group",
              isMuted ? "bg-white text-[#0B1014]" : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
            )}
          >
            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSpeaker(!isSpeaker)}
            className={cn(
              "w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-300 shadow-2xl relative overflow-hidden group",
              !isSpeaker ? "bg-white text-[#0B1014]" : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
            )}
          >
            {isSpeaker ? <Volume2 size={28} /> : <VolumeX size={28} />}
          </motion.button>
        </div>

        <div className="flex justify-center pb-8">
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 135 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleEndCall}
            className="w-24 h-24 bg-red-500 rounded-[40px] flex items-center justify-center shadow-[0_20px_50px_rgba(239,68,68,0.5)] transition-all duration-500 group"
          >
            <PhoneOff size={40} className="text-white" />
          </motion.button>
        </div>
      </div>
      
      {/* Dynamic Waveform Visualization */}
      <div className="absolute bottom-60 left-0 w-full flex items-center justify-center gap-2 opacity-50 pointer-events-none px-12">
        {[2, 5, 8, 4, 3, 6, 9, 7, 5, 3, 6, 8, 4, 2].map((h, i) => (
          <motion.div 
            key={i}
            animate={{ 
              height: status === 'ongoing' ? [h*4, h*10, h*4] : h*4,
              opacity: status === 'ongoing' ? [0.4, 1, 0.4] : 0.4
            }}
            transition={{ 
              duration: 0.6, 
              repeat: Infinity, 
              delay: i * 0.05,
              ease: "easeInOut"
            }}
            className="flex-1 bg-gradient-to-t from-[#25D366] to-[#00A884] rounded-full"
            style={{ height: h * 4 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

