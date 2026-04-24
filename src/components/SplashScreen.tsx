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

  const DEFAULT_LOGO = 'https://img.icons8.com/deco/200/000000/mosque.png';

  const renderLogo = () => {
    if (logoUrl) {
      return (
        <img 
          src={logoUrl} 
          className="w-[85%] h-[85%] object-contain"
          alt="Ulfah Chat Logo"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement?.querySelector('.fallback-logo')?.classList.remove('hidden');
          }}
        />
      );
    }
    
    return (
      <div className="fallback-logo w-full h-full flex items-center justify-center bg-[#075E54]">
        <div className="text-[#D4AF37] text-5xl font-serif drop-shadow-md">الفہ</div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#111B21] flex flex-col items-center justify-center p-6 text-center overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#25D366]/10 rounded-full blur-[150px] animate-pulse" />
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="bismillah"
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="flex flex-col items-center gap-10"
          >
            <div className="w-36 h-36 rounded-full p-2 bg-gradient-to-tr from-[#25D366] via-[#D4AF37] to-[#128C7E] shadow-[0_0_60px_rgba(37,211,102,0.5)] relative">
              <div className="w-full h-full rounded-full bg-[#111B21] flex items-center justify-center overflow-hidden border-4 border-[#111B21] relative z-10">
                {renderLogo()}
              </div>
              <div className="absolute inset-0 rounded-full animate-ping bg-[#25D366]/20 -z-10" />
            </div>
            <motion.h2 
              initial={{ opacity: 0, letterSpacing: '0.5em' }}
              animate={{ opacity: 1, letterSpacing: '0.1em' }}
              transition={{ duration: 1.5 }}
              className="text-4xl md:text-5xl font-bold text-white leading-relaxed drop-shadow-lg" 
              style={{ fontFamily: 'serif' }}
            >
              بِسْمِ اللہِ الرَّحْمٰنِ الرَّحِیْمِ
            </motion.h2>
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
