import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { UserProfile, Call } from '../types';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';

interface VoiceCallProps {
  currentUser: UserProfile;
  otherUser: UserProfile;
  callId?: string;
  isIncoming?: boolean;
  onEnd: () => void;
}

export default function VoiceCall({ currentUser, otherUser, callId, isIncoming, onEnd }: VoiceCallProps) {
  const [status, setStatus] = useState<'calling' | 'ongoing' | 'ended'>('calling');
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

  const servers = {
    iceServers: [
      { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    ],
    iceCandidatePoolSize: 10,
  };

  useEffect(() => {
    let playPromise: Promise<void> | null = null;

    if (status === 'calling' && !isIncoming) {
      if (!callingSoundRef.current) {
        callingSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
        callingSoundRef.current.loop = true;
      }
      playPromise = callingSoundRef.current.play();
      playPromise.catch(e => {
        if (e.name !== 'AbortError') {
          console.error('Calling sound failed:', e);
        }
      });
    } else {
      if (callingSoundRef.current) {
        if (playPromise) {
          playPromise.then(() => {
            callingSoundRef.current?.pause();
            if (callingSoundRef.current) callingSoundRef.current.currentTime = 0;
          }).catch(() => {});
        } else {
          callingSoundRef.current.pause();
          callingSoundRef.current.currentTime = 0;
        }
      }
    }
  }, [status, isIncoming]);

  useEffect(() => {
    let isMounted = true;

    const startCall = async () => {
      const pc = new RTCPeerConnection(servers);
      pcRef.current = pc;

      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          localStream.getTracks().forEach(track => track.stop());
          pc.close();
          return;
        }
        localStreamRef.current = localStream;
        
        if (pc.signalingState !== 'closed') {
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
        }

        pc.ontrack = (event) => {
          if (!isMounted) return;
          remoteStreamRef.current = event.streams[0];
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
          }
        };

        if (isIncoming && callId) {
          // Handle incoming call
          const callDoc = doc(db, 'calls', callId);
          const offerCandidates = collection(callDoc, 'offerCandidates');
          const answerCandidates = collection(callDoc, 'answerCandidates');

          pc.onicecandidate = (event) => {
            if (event.candidate && pc.signalingState !== 'closed') {
              addDoc(answerCandidates, event.candidate.toJSON());
            }
          };

          const callSnap = await getDoc(callDoc);
          if (!isMounted || !callSnap.exists()) return;
          
          const callData = callSnap.data() as Call;
          const offerDescription = callData.offer;
          
          if (pc.signalingState !== 'closed') {
            await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);

            const answer = {
              type: answerDescription.type,
              sdp: answerDescription.sdp,
            };

            await updateDoc(callDoc, { answer, status: 'ongoing' });
          }

          onSnapshot(offerCandidates, (snapshot) => {
            if (!isMounted || pc.signalingState === 'closed') return;
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                let data = change.doc.data();
                pc.addIceCandidate(new RTCIceCandidate(data));
              }
            });
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `calls/${callId}/offerCandidates`);
          });
        } else {
          // Handle outgoing call
          const callDoc = await addDoc(collection(db, 'calls'), {
            callerId: currentUser.uid,
            callerName: currentUser.displayName,
            callerPhoto: currentUser.photoURL,
            receiverId: otherUser.uid,
            status: 'calling',
            type: 'voice',
            timestamp: serverTimestamp(),
          });
          if (!isMounted) {
            await updateDoc(callDoc, { status: 'ended' });
            return;
          }
          setCurrentCallId(callDoc.id);

          const offerCandidates = collection(callDoc, 'offerCandidates');
          const answerCandidates = collection(callDoc, 'answerCandidates');

          pc.onicecandidate = (event) => {
            if (event.candidate && pc.signalingState !== 'closed') {
              addDoc(offerCandidates, event.candidate.toJSON());
            }
          };

          const offerDescription = await pc.createOffer();
          if (pc.signalingState !== 'closed') {
            await pc.setLocalDescription(offerDescription);

            const offer = {
              sdp: offerDescription.sdp,
              type: offerDescription.type,
            };

            await updateDoc(callDoc, { offer });
          }

          onSnapshot(callDoc, (snapshot) => {
            if (!isMounted || pc.signalingState === 'closed') return;
            const data = snapshot.data() as Call;
            if (!pc.currentRemoteDescription && data?.answer) {
              const answerDescription = new RTCSessionDescription(data.answer);
              pc.setRemoteDescription(answerDescription);
              setStatus('ongoing');
            }
            if (data?.status === 'ended' || data?.status === 'rejected') {
              handleEndCall();
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `calls/${callDoc.id}`);
          });

          onSnapshot(answerCandidates, (snapshot) => {
            if (!isMounted || pc.signalingState === 'closed') return;
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
              }
            });
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `calls/${callDoc.id}/answerCandidates`);
          });
        }
      } catch (err: any) {
        console.error('Call initialization failed:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionError('Microphone permission denied. Please enable microphone access in your browser settings and ensure the site is served over HTTPS.');
        } else {
          console.error('Call initialization failed:', err);
          if (isMounted) onEnd();
        }
      }
    };

    startCall();

    return () => {
      isMounted = false;
      if (callingSoundRef.current) {
        callingSoundRef.current.pause();
        callingSoundRef.current.currentTime = 0;
      }
      handleEndCall();
    };
  }, []);

  useEffect(() => {
    let interval: any;
    if (status === 'ongoing') {
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleEndCall = async () => {
    if (currentCallId) {
      try {
        await updateDoc(doc(db, 'calls', currentCallId), { status: 'ended' });
      } catch (e) {
        console.error('Failed to update call status:', e);
      }
    }
    
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    if (pcRef.current) {
      if (pcRef.current.signalingState !== 'closed') {
        pcRef.current.close();
      }
      pcRef.current = null;
    }
    onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 z-[200] bg-[#111B21] flex flex-col items-center justify-between p-12 text-white"
    >
      <div className="flex flex-col items-center gap-4 mt-20">
        <div className="relative">
          <img 
            src={otherUser.photoURL || `https://ui-avatars.com/api/?name=${otherUser.displayName}`}
            className="w-32 h-32 rounded-full border-4 border-[#00A884] shadow-2xl"
            alt={otherUser.displayName || ''}
          />
          {status === 'ongoing' && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#00A884] px-3 py-1 rounded-full text-xs font-bold animate-pulse">
              LIVE
            </div>
          )}
        </div>
        <h2 className="text-2xl font-bold">{otherUser.displayName}</h2>
        {permissionError ? (
          <p className="text-red-400 text-center max-w-xs mt-2">{permissionError}</p>
        ) : (
          <p className="text-[#8696A0]">
            {status === 'calling' ? 'Calling...' : formatTime(timer)}
          </p>
        )}
      </div>

      <audio ref={audioRef} autoPlay playsInline />

      <div className="flex items-center gap-8 mb-20">
        <button 
          onClick={toggleMute}
          className={cn(
            "p-4 rounded-full transition-all",
            isMuted ? "bg-white text-black" : "bg-gray-700 text-white hover:bg-gray-600"
          )}
        >
          {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
        </button>

        <button 
          onClick={handleEndCall}
          className="p-6 bg-red-500 rounded-full hover:bg-red-600 transition-all shadow-xl"
        >
          <PhoneOff size={32} />
        </button>

        <button 
          onClick={() => setIsSpeaker(!isSpeaker)}
          className={cn(
            "p-4 rounded-full transition-all",
            !isSpeaker ? "bg-white text-black" : "bg-gray-700 text-white hover:bg-gray-600"
          )}
        >
          {isSpeaker ? <Volume2 size={28} /> : <VolumeX size={28} />}
        </button>
      </div>
    </motion.div>
  );
}
