import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
  logoUrl?: string;
}

export default function SplashScreen({ onComplete, logoUrl }: SplashScreenProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(1), 2000);
    const timer2 = setTimeout(() => setStep(2), 4000);
    const timer3 = setTimeout(() => onComplete(), 5500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  const DEFAULT_LOGO = 'https://avatar.vercel.sh/ulfah-chat?size=128&text=UC&bg=0f4c5c&color=ffd700';

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#111B21] flex flex-col items-center justify-center p-6 text-center overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#25D366]/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="bismillah"
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center gap-8"
          >
            <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-[#25D366] to-[#128C7E] shadow-[0_0_40px_rgba(37,211,102,0.3)]">
              <div className="w-full h-full rounded-full bg-[#111B21] flex items-center justify-center overflow-hidden">
                <img 
                  src={logoUrl || DEFAULT_LOGO} 
                  className="w-full h-full object-cover p-2"
                  alt="Ulfah Chat"
                />
              </div>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-widest leading-relaxed drop-shadow-lg" style={{ fontFamily: 'serif' }}>
              بِسْمِ اللہِ الرَّحْمٰنِ الرَّحِیْمِ
            </h2>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="salam"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center gap-6"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="px-8 py-3 bg-[#25D366]/10 border border-[#25D366]/30 rounded-full"
            >
              <span className="text-[#25D366] font-medium tracking-[0.2em] uppercase text-sm">Welcome back</span>
            </motion.div>
            <h1 className="text-5xl md:text-6xl font-bold text-white tracking-wide" style={{ fontFamily: 'serif' }}>
              السلام علیکم
            </h1>
            <p className="text-[#8696a0] text-lg max-w-xs leading-relaxed">
              Ulfah Chat is preparing the best experience for you.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Bar at Bottom */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 h-1 bg-[#233138] rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 5, ease: "linear" }}
          className="h-full bg-[#25D366]"
        />
      </div>
    </motion.div>
  );
}
