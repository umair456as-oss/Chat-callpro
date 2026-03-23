import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';

export default function GameAdWrapper() {
  const [showAds, setShowAds] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1.3);
  const [isDismissed, setIsDismissed] = useState(false);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const scriptInjectedRef = useRef(false);

  useEffect(() => {
    // Listen to admin_settings/show_game_ads for visibility control
    const unsub = onSnapshot(doc(db, 'admin_settings', 'show_game_ads'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setShowAds(data.isAdsEnabled === true);
        if (data.adTimer !== undefined) {
          setTimeLeft(data.adTimer);
        } else {
          setTimeLeft(1.3); // Default to 1.3s if not set
        }
      } else {
        setShowAds(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'admin_settings/show_game_ads');
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!showAds || isDismissed) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(interval);
          setIsDismissed(true);
          return 0;
        }
        return parseFloat((prev - 0.1).toFixed(1));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [showAds, isDismissed]);

  useEffect(() => {
    if (!showAds || isDismissed || !adContainerRef.current || scriptInjectedRef.current) return;

    const atOptionsScript = document.createElement('script');
    atOptionsScript.type = 'text/javascript';
    atOptionsScript.innerHTML = `
      atOptions = {
        'key' : '493449e79c50931bf57f847402509e1a',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };
    `;
    
    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = '//www.highperformanceformat.com/493449e79c50931bf57f847402509e1a/invoke.js';

    adContainerRef.current.appendChild(atOptionsScript);
    adContainerRef.current.appendChild(invokeScript);
    scriptInjectedRef.current = true;

    return () => {
      if (adContainerRef.current) {
        adContainerRef.current.innerHTML = '';
      }
      scriptInjectedRef.current = false;
    };
  }, [showAds, isDismissed]);

  if (!showAds || isDismissed) return null;

  return (
    <div className="absolute inset-0 z-[999] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl">
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70 uppercase tracking-widest font-medium">
            Sponsored Ad
          </span>
          <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border border-blue-400 animate-pulse">
            {timeLeft.toFixed(1)}s
          </div>
        </div>
        
        <div 
          ref={adContainerRef}
          className="w-[300px] h-[250px] bg-white rounded-xl overflow-hidden shadow-2xl border-4 border-white/10"
        >
          {/* Adsterra banner will be injected here */}
        </div>

        <p className="text-white/50 text-[10px] mt-2">
          Game will resume automatically after the ad
        </p>
      </div>
    </div>
  );
}
