import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { cn } from '../utils';

interface AdResetterProps {
  gameSessionId: number;
}

export default function AdResetter({ gameSessionId }: AdResetterProps) {
  const [isBannerAdsEnabled, setIsBannerAdsEnabled] = useState(false);
  const [isAdMobBannerEnabled, setIsAdMobBannerEnabled] = useState(false);
  const [adTimer, setAdTimer] = useState(1.3);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1.3);
  const [adType, setAdType] = useState<'adsterra' | 'admob'>('adsterra');
  
  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const bannerScriptsRef = useRef<HTMLScriptElement[]>([]);
  const admobSlotRef = useRef<any>(null);

  // 1. Listen to Admin Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'admin_settings', 'show_game_ads'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsBannerAdsEnabled(data.isAdsEnabled === true);
        setIsAdMobBannerEnabled(data.isAdMobBannerEnabled === true);
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
      cleanupBannerAd();
      cleanupAdMobBanner();

      // Decide which ad to show if both are enabled
      if (isBannerAdsEnabled && isAdMobBannerEnabled) {
        setAdType(Math.random() > 0.5 ? 'admob' : 'adsterra');
      } else if (isAdMobBannerEnabled) {
        setAdType('admob');
      } else {
        setAdType('adsterra');
      }

      // Wait 500ms to clear browser cache and show loading
      await new Promise(resolve => setTimeout(resolve, 500));

      setIsRefreshing(false);
      
      if (isBannerAdsEnabled && isAdMobBannerEnabled) {
        // Already set adType randomly
      } else if (isAdMobBannerEnabled) {
        setAdType('admob');
      } else if (isBannerAdsEnabled) {
        setAdType('adsterra');
      }
    };

    refreshAds();
  }, [gameSessionId, isBannerAdsEnabled, isAdMobBannerEnabled]);

  // Initial load and adType change
  useEffect(() => {
    if (isRefreshing) return;

    if (adType === 'admob' && isAdMobBannerEnabled) {
      injectAdMobBanner();
    } else if (adType === 'adsterra' && isBannerAdsEnabled) {
      injectBannerAd();
    }
    
    return () => {
      cleanupBannerAd();
      cleanupAdMobBanner();
    };
  }, [isBannerAdsEnabled, isAdMobBannerEnabled, adType, isRefreshing]);

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

  const injectAdMobBanner = () => {
    if (!bannerContainerRef.current) return;
    const googletag = (window as any).googletag;
    if (!googletag) return;

    googletag.cmd.push(() => {
      const adUnitPath = '/5355571256728358/2975548740';
      const slotId = 'admob-banner-slot';
      
      const adDiv = document.createElement('div');
      adDiv.id = slotId;
      adDiv.style.width = '300px';
      adDiv.style.height = '250px';
      bannerContainerRef.current?.appendChild(adDiv);

      admobSlotRef.current = googletag.defineSlot(adUnitPath, [300, 250], slotId)
        .addService(googletag.pubads());
      
      googletag.enableServices();
      googletag.display(slotId);
    });
  };

  const cleanupAdMobBanner = () => {
    const googletag = (window as any).googletag;
    if (googletag && admobSlotRef.current) {
      googletag.cmd.push(() => {
        googletag.destroySlots([admobSlotRef.current]);
        admobSlotRef.current = null;
      });
    }
    if (bannerContainerRef.current) {
      bannerContainerRef.current.innerHTML = '';
    }
  };

  // 3. Timer Logic for Banner Ad
  useEffect(() => {
    const isAnyBannerEnabled = isBannerAdsEnabled || isAdMobBannerEnabled;
    if (!isAnyBannerEnabled || isDismissed || isRefreshing) return;

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
  }, [isBannerAdsEnabled, isAdMobBannerEnabled, isDismissed, isRefreshing]);

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

  const isAnyBannerEnabled = isBannerAdsEnabled || isAdMobBannerEnabled;
  if (!isAnyBannerEnabled || isDismissed) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[999] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 rounded-b-2xl border-t border-white/10">
      <div className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-white/70 uppercase tracking-widest font-medium">
            Sponsored Ad
          </span>
          <div className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-blue-400">
            {timeLeft.toFixed(1)}s
          </div>
        </div>
        
        <div 
          ref={bannerContainerRef}
          className="w-[300px] h-[250px] bg-white rounded-lg overflow-hidden shadow-2xl border-2 border-white/10"
        >
          {/* Adsterra banner will be injected here */}
        </div>
      </div>
    </div>
  );
}
