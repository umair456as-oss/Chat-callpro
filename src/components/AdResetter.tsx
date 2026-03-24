import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { cn } from '../utils';

interface AdResetterProps {
  gameSessionId: number;
}

export default function AdResetter({ gameSessionId }: AdResetterProps) {
  const [isSocialAdsEnabled, setIsSocialAdsEnabled] = useState(false);
  const [isBannerAdsEnabled, setIsBannerAdsEnabled] = useState(false);
  const [adTimer, setAdTimer] = useState(1.3);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1.3);
  
  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const socialScriptRef = useRef<HTMLScriptElement | null>(null);
  const bannerScriptsRef = useRef<HTMLScriptElement[]>([]);

  // 1. Listen to Admin Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'admin_settings', 'show_game_ads'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsSocialAdsEnabled(data.isSocialAdsEnabled === true);
        setIsBannerAdsEnabled(data.isAdsEnabled === true);
        if (data.adTimer !== undefined) {
          setAdTimer(data.adTimer);
          setTimeLeft(data.adTimer);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'admin_settings/show_game_ads');
    });

    return () => unsub();
  }, []);

  // 2. Smart Refresh Logic
  useEffect(() => {
    if (gameSessionId === 0) return;

    const refreshAds = async () => {
      setIsRefreshing(true);
      setIsDismissed(false);
      setTimeLeft(adTimer);

      // Cleanup old ads
      cleanupSocialAd();
      cleanupBannerAd();

      // Wait 500ms to clear browser cache and show loading
      await new Promise(resolve => setTimeout(resolve, 500));

      setIsRefreshing(false);
      
      // Re-inject ads if enabled
      if (isSocialAdsEnabled) injectSocialAd();
      if (isBannerAdsEnabled) injectBannerAd();
    };

    refreshAds();
  }, [gameSessionId]);

  // Initial load
  useEffect(() => {
    if (isSocialAdsEnabled) injectSocialAd();
    if (isBannerAdsEnabled) injectBannerAd();
    
    return () => {
      cleanupSocialAd();
      cleanupBannerAd();
    };
  }, [isSocialAdsEnabled, isBannerAdsEnabled]);

  const injectSocialAd = () => {
    if (document.getElementById('adsterra-social-script')) return;
    
    const script = document.createElement('script');
    script.id = 'adsterra-social-script';
    script.src = 'https://pl28966635.profitablecpmratenetwork.com/b8/c3/a6/b8c3a69260978b25d65328a96e3f0dc4.js';
    script.async = true;
    document.body.appendChild(script);
    socialScriptRef.current = script;
  };

  const cleanupSocialAd = () => {
    const existing = document.getElementById('adsterra-social-script');
    if (existing) existing.remove();
    socialScriptRef.current = null;
    
    // Adsterra social bar often leaves behind a div or style
    const socialBar = document.querySelector('div[id^="at-cv-"]');
    if (socialBar) socialBar.remove();
  };

  const injectBannerAd = () => {
    if (!bannerContainerRef.current) return;
    
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

    bannerContainerRef.current.appendChild(atOptionsScript);
    bannerContainerRef.current.appendChild(invokeScript);
    bannerScriptsRef.current = [atOptionsScript, invokeScript];
  };

  const cleanupBannerAd = () => {
    if (bannerContainerRef.current) {
      bannerContainerRef.current.innerHTML = '';
    }
    bannerScriptsRef.current = [];
  };

  // 3. Timer Logic for Banner Ad
  useEffect(() => {
    if (!isBannerAdsEnabled || isDismissed || isRefreshing) return;

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
  }, [isBannerAdsEnabled, isDismissed, isRefreshing]);

  if (isRefreshing) {
    return (
      <div className="absolute inset-0 z-[1000] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00A884] border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-bold tracking-widest animate-pulse">LOADING AD...</p>
        </div>
      </div>
    );
  }

  if (!isBannerAdsEnabled || isDismissed) return null;

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
          ref={bannerContainerRef}
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
