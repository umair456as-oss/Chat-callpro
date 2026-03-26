import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';

interface SocialAdProps {
  activeTab: string;
}

export default function SocialAd({ activeTab }: SocialAdProps) {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'admin_settings', 'show_game_ads'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsEnabled(data.isSocialAdsEnabled === true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'admin_settings/show_game_ads');
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isEnabled || activeTab === 'games') {
      const existing = document.getElementById('adsterra-social-script-global');
      if (existing) existing.remove();
      const socialBar = document.querySelector('div[id^="at-cv-"]');
      if (socialBar) socialBar.remove();
      return;
    }

    const script = document.createElement('script');
    script.id = 'adsterra-social-script-global';
    script.src = 'https://pl28966635.profitablecpmratenetwork.com/b8/c3/a6/b8c3a69260978b25d65328a96e3f0dc4.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
      const socialBar = document.querySelector('div[id^="at-cv-"]');
      if (socialBar) socialBar.remove();
    };
  }, [isEnabled, activeTab]);

  return null;
}
