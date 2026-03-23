import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';

/**
 * GameAdController - A highly encapsulated 'Ad-Injector' component
 * Handles external monetization scripts for game modals.
 */
export default function GameAdController() {
  const [isAdsEnabled, setIsAdsEnabled] = useState(false);

  useEffect(() => {
    // Connect the component to the Admin Panel's isAdsEnabled state from Firestore
    const unsub = onSnapshot(doc(db, 'admin_settings', 'show_game_ads'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Check for isSocialAdsEnabled specifically for this controller
        setIsAdsEnabled(data.isSocialAdsEnabled === true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'admin_settings/show_game_ads');
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    // If ads are disabled by Admin, do not inject the script
    if (!isAdsEnabled) return;

    // Create the 'Ghost' script element
    const script = document.createElement('script');
    script.id = 'adsterra-social-script';
    script.src = 'https://pl28966635.profitablecpmratenetwork.com/b8/c3/a6/b8c3a69260978b25d65328a96e3f0dc4.js';
    
    // Performance: Use async or defer as requested
    script.async = true;

    // Execution Logic: Append this script to document.body ONLY when mounted
    document.body.appendChild(script);

    // Anti-Pollution Cleanup: Remove the script on unmount
    return () => {
      const existingScript = document.getElementById('adsterra-social-script');
      if (existingScript) {
        existingScript.remove();
      }
      
      // Note: Some scripts might inject other DOM elements (like social bars).
      // Adsterra's social bar script usually handles its own cleanup if the script is removed,
      // but we ensure the primary script tag is gone.
    };
  }, [isAdsEnabled]);

  // This is a ghost component, it renders nothing to the DOM directly
  return null;
}
