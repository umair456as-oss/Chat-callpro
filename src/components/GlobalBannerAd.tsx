import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { X } from 'lucide-react';

interface GlobalBannerAdProps {
  activeTab: string;
}

export default function GlobalBannerAd({ activeTab }: GlobalBannerAdProps) {
  const [isBannerAdsEnabled, setIsBannerAdsEnabled] = useState(false);
  const [activeTime, setActiveTime] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const bannerScriptsRef = useRef<HTMLScriptElement[]>([]);

  // 1. Listen to Admin Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'admin_settings', 'show_game_ads'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsBannerAdsEnabled(data.isAdsEnabled === true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'admin_settings/show_game_ads');
    });

    return () => unsub();
  }, []);

  // 2. Track Active Time (10 minutes = 600 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 3. Ad Injection Logic
  useEffect(() => {
    const restrictedTabs = ['games', 'wallet', 'status', 'admin'];
    const isRestrictedTab = restrictedTabs.includes(activeTab);
    const tenMinutes = 600;

    if (!isBannerAdsEnabled || isRestrictedTab || activeTime < tenMinutes || isDismissed) {
      cleanupBannerAd();
      return;
    }

    injectBannerAd();

    return () => cleanupBannerAd();
  }, [isBannerAdsEnabled, activeTab, activeTime, isDismissed]);

  const injectBannerAd = () => {
    if (!bannerContainerRef.current || bannerScriptsRef.current.length > 0) return;
    
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

  const restrictedTabs = ['games', 'wallet', 'status', 'admin'];
  const isRestrictedTab = restrictedTabs.includes(activeTab);
  const tenMinutes = 600;

  if (!isBannerAdsEnabled || isRestrictedTab || activeTime < tenMinutes || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-[100] animate-in fade-in slide-in-from-right duration-500">
      <div className="relative bg-white p-2 rounded-xl shadow-2xl border-2 border-[#00A884]">
        <button 
          onClick={() => setIsDismissed(true)}
          className="absolute -top-3 -right-3 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-colors z-10"
        >
          <X size={16} />
        </button>
        <div className="text-[10px] text-[#667781] uppercase font-bold mb-1 px-1">Sponsored Ad</div>
        <div 
          ref={bannerContainerRef}
          className="w-[300px] h-[250px] bg-gray-100 rounded-lg overflow-hidden"
        >
          {/* Adsterra banner will be injected here */}
        </div>
      </div>
    </div>
  );
}
