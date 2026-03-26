import React, { useState, useEffect, useRef } from 'react';
import { doc, runTransaction, serverTimestamp, collection, addDoc, query, where, getDocs, limit, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, GameLog, AppSettings, GameSettings } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RotateCw, Calculator, Eraser, Calendar, Dices, 
  Type, ShieldCheck, Coins, LayoutGrid, PlayCircle,
  Trophy, Star, Zap, Clock, XCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn, toSafeDate } from '../utils';
import AdResetter from './AdResetter';

interface GamesProps {
  profile: UserProfile;
}

type GameType = 
  | 'lucky-spin' | 'math-quiz' | 'scratch-win' | 'daily-checkin' 
  | 'dice-roller' | 'word-scramble' | 'captcha-solver' | 'coin-flip' 
  | 'memory-match' | 'watch-earn';

export default function Games({ profile }: GamesProps) {
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [gameSessionId, setGameSessionId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gameResult, setGameResult] = useState<{ success: boolean; reward: number; message: string } | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [gameSettings, setGameSettings] = useState<Record<string, GameSettings>>({});

  useEffect(() => {
    const unsubS = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) setAppSettings(doc.data() as AppSettings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const unsubG = onSnapshot(collection(db, 'gameSettings'), (snapshot) => {
      const settings: Record<string, GameSettings> = {};
      snapshot.docs.forEach(doc => {
        settings[doc.id] = { id: doc.id, ...doc.data() } as GameSettings;
      });
      setGameSettings(settings);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gameSettings');
    });

    return () => {
      unsubS();
      unsubG();
    };
  }, []);

  const addReward = async (gameName: string, reward: number) => {
    if (reward <= 0) return;
    
    if (!appSettings?.isGamesEnabled) {
      setGameResult({ success: false, reward: 0, message: 'Games are currently disabled by admin.' });
      return;
    }

    const currentSetting = gameSettings[gameName];
    if (currentSetting && !currentSetting.isEnabled) {
      setGameResult({ success: false, reward: 0, message: 'This game is currently disabled.' });
      return;
    }

    // Calculate Final Reward based on Level and Jackpot Hour
    // Use earningRate from settings if available, otherwise use the passed reward
    let baseReward = currentSetting?.earningRate || reward;
    let finalReward = baseReward;
    
    // Level Multiplier
    const levelMultipliers: Record<string, number> = {
      'Bronze': 1,
      'Silver': 2,
      'Gold': 3
    };
    const multiplier = levelMultipliers[profile.level || 'Bronze'] || 1;
    finalReward *= multiplier;

    // Jackpot Hour Multiplier (2x)
    if (appSettings?.isJackpotHour) {
      finalReward *= 2;
    }

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', profile.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw "User does not exist!";

        // Check daily limit
        const today = new Date().toISOString().split('T')[0];
        const logsQuery = query(
          collection(db, 'gameLogs'),
          where('userId', '==', profile.uid),
          where('gameName', '==', gameName),
          where('timestamp', '>=', Timestamp.fromDate(new Date(today)))
        );
        let logsSnap;
        try {
          logsSnap = await getDocs(logsQuery);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'gameLogs');
          throw error;
        }
        const dailyLimit = currentSetting?.dailyLimit || 100; // Default 100 if not set
        if (logsSnap.size >= dailyLimit) {
          throw new Error(`Daily limit reached for ${gameName}. Max ${dailyLimit} plays.`);
        }

        const currentBalance = userSnap.data().balance || 0;
        const currentExp = userSnap.data().experience || 0;
        const currentLevel = userSnap.data().level || 'Bronze';

        // Update Balance and Experience
        const newBalance = currentBalance + finalReward;
        const newExp = currentExp + 10; // 10 XP per game win
        
        // Auto Level Up Logic
        let newLevel = currentLevel;
        if (newExp >= 1000 && currentLevel === 'Bronze') newLevel = 'Silver';
        if (newExp >= 5000 && currentLevel === 'Silver') newLevel = 'Gold';

        transaction.update(userRef, { 
          balance: newBalance,
          experience: newExp,
          level: newLevel
        });

        const logRef = doc(collection(db, 'gameLogs'));
        transaction.set(logRef, {
          userId: profile.uid,
          gameName,
          reward: finalReward,
          timestamp: serverTimestamp(),
          isJackpot: appSettings?.isJackpotHour || false,
          levelAtTime: currentLevel
        });
      });
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00A884', '#25D366', '#34B7F1']
      });
      
      let message = `Congratulations! You earned Rs. ${finalReward.toFixed(2)}`;
      if (appSettings?.isJackpotHour) message += " (JACKPOT 2X!)";
      if (multiplier > 1) message += ` (${profile.level} Bonus ${multiplier}X!)`;

      setGameResult({ success: true, reward: finalReward, message });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async (gameId: GameType) => {
    const setting = gameSettings[gameId];
    if (setting && !setting.isEnabled) {
      alert('This game is currently disabled.');
      return;
    }

    const price = setting?.price || 0;
    if (price > 0) {
      if (profile.balance < price) {
        alert(`Insufficient balance! This game costs Rs. ${price} to play.`);
        return;
      }

      setLoading(true);
      try {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', profile.uid);
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) throw "User does not exist!";
          
          const currentBalance = userSnap.data().balance || 0;
          if (currentBalance < price) throw "Insufficient balance!";
          
          transaction.update(userRef, { balance: currentBalance - price });
        });
      } catch (error) {
        console.error('Error paying entry fee:', error);
        alert('Failed to start game. Please try again.');
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    setActiveGame(gameId);
  };

  const games = [
    { id: 'lucky-spin', name: 'Lucky Spin', icon: RotateCw, color: 'bg-purple-500' },
    { id: 'math-quiz', name: 'Math Quiz', icon: Calculator, color: 'bg-blue-500' },
    { id: 'scratch-win', name: 'Scratch & Win', icon: Eraser, color: 'bg-orange-500' },
    { id: 'daily-checkin', name: 'Daily Check-in', icon: Calendar, color: 'bg-green-500' },
    { id: 'dice-roller', name: 'Dice Roller', icon: Dices, color: 'bg-red-500' },
    { id: 'word-scramble', name: 'Word Scramble', icon: Type, color: 'bg-indigo-500' },
    { id: 'captcha-solver', name: 'Captcha Solver', icon: ShieldCheck, color: 'bg-cyan-500' },
    { id: 'coin-flip', name: 'Coin Flip', icon: Coins, color: 'bg-yellow-500' },
    { id: 'memory-match', name: 'Memory Match', icon: LayoutGrid, color: 'bg-pink-500' },
    { id: 'watch-earn', name: 'Watch & Earn', icon: PlayCircle, color: 'bg-rose-500' },
  ];

  return (
    <div className="scrollable-content bg-[#F0F2F5] p-4 md:p-8 custom-scrollbar">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#111B21] mb-2">Game Zone</h1>
            <div className="flex items-center gap-3">
              <p className="text-[#667781]">Play games, have fun, and earn real money!</p>
              {appSettings?.isJackpotHour && (
                <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold animate-bounce shadow-sm border border-yellow-200">
                  <Zap size={14} className="fill-yellow-500" />
                  JACKPOT HOUR: 2X EARNINGS!
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                profile.level === 'Gold' ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
                profile.level === 'Silver' ? "bg-gray-100 text-gray-700 border border-gray-200" :
                "bg-orange-100 text-orange-700 border border-orange-200"
              )}>
                {profile.level || 'Bronze'} Member
              </span>
              <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-[#00A884]" 
                  style={{ width: `${(profile.experience || 0) % 1000 / 10}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-white px-6 py-3 rounded-2xl shadow-sm flex items-center gap-3 border border-[#D1D7DB]">
              <div className="w-10 h-10 bg-[#D9FDD3] rounded-full flex items-center justify-center text-[#00A884]">
                <Trophy size={24} />
              </div>
              <div>
                <p className="text-[10px] text-[#667781] uppercase font-bold tracking-wider">Current Balance</p>
                <p className="text-xl font-bold text-[#111B21]">Rs. {profile.balance.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {!activeGame ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {games.map((game) => {
              const setting = gameSettings[game.id];
              const price = setting?.price || 0;
              const reward = setting?.earningRate || 0;
              return (
                <motion.div
                  key={game.id}
                  whileHover={{ y: -5 }}
                  onClick={() => handleStartGame(game.id as GameType)}
                  className={cn(
                    "bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer border border-transparent hover:border-[#00A884] group relative overflow-hidden",
                    setting && !setting.isEnabled && "opacity-50 grayscale cursor-not-allowed"
                  )}
                >
                  {price > 0 && (
                    <div className="absolute top-0 right-0 bg-orange-500 text-white text-[8px] font-bold px-3 py-1 rounded-bl-xl shadow-sm">
                      Rs. {price}
                    </div>
                  )}
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform", game.color)}>
                    <game.icon size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-[#111B21] mb-1">{game.name}</h3>
                  <p className="text-xs text-[#00A884] font-bold mb-4">
                    {reward > 0 ? `Earn Rs. ${reward}` : 'Play & Earn'}
                  </p>
                  <div className="flex items-center gap-2 text-[#667781] text-[10px] uppercase font-bold">
                    <Zap size={12} className="text-yellow-500" />
                    {setting?.dailyLimit ? `Limit: ${setting.dailyLimit}/day` : 'Instant Reward'}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden min-h-[500px] flex flex-col">
            <div className="p-4 bg-[#F0F2F5] flex items-center justify-between border-b border-[#D1D7DB]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setActiveGame(null); setGameResult(null); }}
                  className="p-2 hover:bg-gray-200 rounded-full text-[#54656F]"
                >
                  <LayoutGrid size={20} />
                </button>
                <h2 className="font-bold text-[#111B21]">{games.find(g => g.id === activeGame)?.name}</h2>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-[#00A884]">
                <Coins size={16} />
                Rs. {profile.balance.toFixed(2)}
              </div>
            </div>

            <div className="flex-1 p-8 flex flex-col items-center justify-center relative">
              <AnimatePresence mode="wait">
                {gameResult ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-center"
                  >
                    <div className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg",
                      gameResult.success ? "bg-[#D9FDD3] text-[#00A884]" : "bg-red-100 text-red-600"
                    )}>
                      {gameResult.success ? <Trophy size={48} /> : <Star size={48} />}
                    </div>
                    <h2 className="text-3xl font-bold mb-2">{gameResult.success ? 'Winner!' : 'Oops!'}</h2>
                    <p className="text-[#667781] mb-8">{gameResult.message}</p>
                    <button
                      onClick={() => {
                        setGameResult(null);
                        setGameSessionId(prev => prev + 1);
                      }}
                      className="bg-[#00A884] text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:bg-[#008F6F] transition-all"
                    >
                      Play Again
                    </button>
                  </motion.div>
                ) : (
                  <GameContent 
                    type={activeGame} 
                    onWin={(reward) => addReward(activeGame, reward)} 
                    loading={loading}
                    profile={profile}
                    onRestart={() => setGameSessionId(prev => prev + 1)}
                  />
                )}
              </AnimatePresence>
              
              {/* Rule 3: Load the ad only when a game is active */}
              <AdResetter gameSessionId={gameSessionId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GameContent({ type, onWin, loading, profile, onRestart }: { type: GameType, onWin: (reward: number) => void, loading: boolean, profile: UserProfile, onRestart: () => void }) {
  // Implementation of specific games
  switch (type) {
    case 'lucky-spin':
      return <LuckySpin onWin={onWin} loading={loading} onRestart={onRestart} />;
    case 'math-quiz':
      return <MathQuiz onWin={onWin} loading={loading} onRestart={onRestart} />;
    case 'scratch-win':
      return <ScratchWin onWin={onWin} loading={loading} onRestart={onRestart} />;
    case 'daily-checkin':
      return <DailyCheckin onWin={onWin} loading={loading} profile={profile} onRestart={onRestart} />;
    case 'dice-roller':
      return <DiceRoller onWin={onWin} loading={loading} onRestart={onRestart} />;
    case 'word-scramble':
      return <WordScramble onWin={onWin} loading={loading} onRestart={onRestart} />;
    case 'captcha-solver':
      return <CaptchaSolver onWin={onWin} loading={loading} onRestart={onRestart} />;
    case 'coin-flip':
      return <CoinFlip onWin={onWin} loading={loading} onRestart={onRestart} />;
    case 'memory-match':
      return <MemoryMatch onWin={onWin} loading={loading} onRestart={onRestart} />;
    case 'watch-earn':
      return <WatchEarn onWin={onWin} loading={loading} onRestart={onRestart} />;
    default:
      return null;
  }
}

// --- Game Components ---

function LuckySpin({ onWin, loading, onRestart }: { onWin: (reward: number) => void, loading: boolean, onRestart: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  const spin = () => {
    if (spinning || loading) return;
    setSpinning(true);
    const newRotation = rotation + 1800 + Math.random() * 360;
    setRotation(newRotation);
    
    setTimeout(() => {
      setSpinning(false);
      const reward = Math.floor(Math.random() * 50) + 1;
      onWin(reward);
    }, 4000);
  };

  return (
    <div className="flex flex-col items-center">
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ duration: 4, ease: "circOut" }}
        className="w-64 h-64 rounded-full border-8 border-[#00A884] relative overflow-hidden shadow-2xl mb-8"
        style={{ background: 'conic-gradient(#25D366 0deg 60deg, #34B7F1 60deg 120deg, #FFD700 120deg 180deg, #FF4B2B 180deg 240deg, #8E44AD 240deg 300deg, #F39C12 300deg 360deg)' }}
      >
        {[0, 60, 120, 180, 240, 300].map((deg, i) => (
          <div key={i} className="absolute w-full h-full flex justify-center pt-4" style={{ transform: `rotate(${deg + 30}deg)` }}>
            <span className="text-white font-bold text-xl">Rs. {(i + 1) * 10}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-white rounded-full shadow-inner z-10"></div>
        </div>
      </motion.div>
      <div className="absolute top-[50%] right-[50%] translate-x-[50%] translate-y-[-140px] w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-red-600 z-20"></div>
      <button
        onClick={spin}
        disabled={spinning || loading}
        className="bg-[#00A884] text-white font-bold py-4 px-12 rounded-2xl shadow-xl hover:bg-[#008F6F] transition-all disabled:opacity-50"
      >
        {spinning ? 'Spinning...' : 'Spin Now!'}
      </button>
    </div>
  );
}

function MathQuiz({ onWin, loading, onRestart }: { onWin: (reward: number) => void, loading: boolean, onRestart: () => void }) {
  const [quiz, setQuiz] = useState({ a: 0, b: 0, op: '+', ans: 0 });
  const [userAns, setUserAns] = useState('');
  const [timeLeft, setTimeLeft] = useState(10);

  const generateQuiz = () => {
    const a = Math.floor(Math.random() * 50);
    const b = Math.floor(Math.random() * 50);
    const op = Math.random() > 0.5 ? '+' : '-';
    const ans = op === '+' ? a + b : a - b;
    setQuiz({ a, b, op, ans });
    setUserAns('');
    setTimeLeft(10);
  };

  useEffect(() => {
    generateQuiz();
  }, []);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      generateQuiz();
      onRestart(); // Refresh ad on timeout/new quiz
    }
  }, [timeLeft]);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(userAns) === quiz.ans) {
      onWin(5);
    } else {
      generateQuiz();
      onRestart(); // Refresh ad on wrong answer
    }
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="w-16 h-16 bg-[#D9FDD3] rounded-2xl flex items-center justify-center text-[#00A884] text-2xl font-bold shadow-sm">
          <Clock size={24} className="mr-2" />
          {timeLeft}s
        </div>
      </div>
      <h2 className="text-6xl font-black text-[#111B21] mb-8 tracking-tighter">
        {quiz.a} {quiz.op} {quiz.b} = ?
      </h2>
      <form onSubmit={check} className="flex flex-col gap-4">
        <input
          type="number"
          autoFocus
          className="text-4xl text-center border-b-4 border-[#00A884] p-4 focus:outline-none bg-transparent"
          value={userAns}
          onChange={(e) => setUserAns(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[#00A884] text-white font-bold py-4 px-12 rounded-2xl shadow-xl hover:bg-[#008F6F] transition-all"
        >
          Submit Answer
        </button>
      </form>
    </div>
  );
}

function ScratchWin({ onWin, loading, onRestart }: { onWin: (reward: number) => void, loading: boolean, onRestart: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScratched, setIsScratched] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(Math.floor(Math.random() * 20) + 1);

  const reset = () => {
    setIsScratched(false);
    setRewardAmount(Math.floor(Math.random() * 20) + 1);
    onRestart();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(0, 0, 300, 150);
    ctx.fillStyle = '#999';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH HERE', 150, 85);

    let isDrawing = false;

    const scratch = (e: any) => {
      if (!isDrawing || isScratched) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();

      // Check percentage
      const imageData = ctx.getImageData(0, 0, 300, 150);
      let pixels = imageData.data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] === 0) count++;
      }
      if (count > (300 * 150) * 0.6 && !isScratched) {
        setIsScratched(true);
        onWin(rewardAmount);
      }
    };

    const start = () => isDrawing = true;
    const end = () => isDrawing = false;

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', scratch);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchmove', scratch);
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', scratch);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', scratch);
      canvas.removeEventListener('touchend', end);
    };
  }, [isScratched, onWin, rewardAmount]);

  return (
    <div className="text-center">
      <div className="relative w-[300px] h-[150px] mx-auto mb-8 bg-[#D9FDD3] rounded-xl flex items-center justify-center border-4 border-dashed border-[#00A884]">
        <div className="text-center">
          <p className="text-[#00A884] font-bold text-sm uppercase">You Won</p>
          <h2 className="text-4xl font-black text-[#111B21]">Rs. {rewardAmount}</h2>
        </div>
        <canvas ref={canvasRef} width={300} height={150} className="absolute inset-0 cursor-crosshair rounded-lg" />
      </div>
      <p className="text-[#667781] text-sm">Scratch the card to reveal your reward!</p>
    </div>
  );
}

function DailyCheckin({ onWin, loading, profile, onRestart }: { onWin: (reward: number) => void, loading: boolean, profile: UserProfile, onRestart: () => void }) {
  const [canCheckin, setCanCheckin] = useState(false);

  useEffect(() => {
    const check = async () => {
      const q = query(
        collection(db, 'gameLogs'),
        where('userId', '==', profile.uid),
        where('gameName', '==', 'daily-checkin'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      let snap;
      try {
        snap = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'gameLogs');
        return;
      }
      if (snap.empty) {
        setCanCheckin(true);
      } else {
        const last = toSafeDate(snap.docs[0].data().timestamp);
        const now = new Date();
        const diff = now.getTime() - last.getTime();
        if (diff > 24 * 60 * 60 * 1000) setCanCheckin(true);
      }
    };
    check();
  }, [profile.uid]);

  return (
    <div className="text-center">
      <div className="w-32 h-32 bg-[#D9FDD3] rounded-full flex items-center justify-center text-[#00A884] mx-auto mb-8 shadow-inner">
        <Calendar size={64} />
      </div>
      <h2 className="text-3xl font-bold text-[#111B21] mb-2">Daily Reward</h2>
      <p className="text-[#667781] mb-8">Come back every 24 hours to claim Rs. 10!</p>
      <button
        onClick={() => onWin(10)}
        disabled={!canCheckin || loading}
        className="bg-[#00A884] text-white font-bold py-4 px-12 rounded-2xl shadow-xl hover:bg-[#008F6F] transition-all disabled:opacity-50"
      >
        {canCheckin ? 'Claim Rs. 10' : 'Already Claimed'}
      </button>
    </div>
  );
}

function DiceRoller({ onWin, loading, onRestart }: { onWin: (reward: number) => void, loading: boolean, onRestart: () => void }) {
  const [rolling, setRolling] = useState(false);
  const [dice, setDice] = useState(1);

  const roll = () => {
    if (rolling || loading) return;
    onRestart(); // Refresh ad on roll
    setRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setDice(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 10) {
        clearInterval(interval);
        setRolling(false);
        const final = Math.floor(Math.random() * 6) + 1;
        setDice(final);
        if (final === 6) onWin(30);
        else onWin(2); // Small reward for trying
      }
    }, 100);
  };

  return (
    <div className="text-center">
      <motion.div
        animate={rolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.5, repeat: rolling ? Infinity : 0 }}
        className="w-32 h-32 bg-white border-4 border-[#00A884] rounded-3xl mx-auto mb-12 shadow-2xl flex items-center justify-center relative"
      >
        <div className="grid grid-cols-3 gap-2 p-4">
          {[...Array(9)].map((_, i) => {
            const dots: { [key: number]: number[] } = {
              1: [4],
              2: [0, 8],
              3: [0, 4, 8],
              4: [0, 2, 6, 8],
              5: [0, 2, 4, 6, 8],
              6: [0, 2, 3, 5, 6, 8]
            };
            return (
              <div key={i} className={cn("w-4 h-4 rounded-full", dots[dice].includes(i) ? "bg-[#111B21]" : "bg-transparent")}></div>
            );
          })}
        </div>
      </motion.div>
      <p className="text-[#667781] mb-8 font-medium italic">Roll a 6 to win Rs. 30!</p>
      <button
        onClick={roll}
        disabled={rolling || loading}
        className="bg-[#00A884] text-white font-bold py-4 px-12 rounded-2xl shadow-xl hover:bg-[#008F6F] transition-all disabled:opacity-50"
      >
        {rolling ? 'Rolling...' : 'Roll Dice'}
      </button>
    </div>
  );
}

function WordScramble({ onWin, loading, onRestart }: { onWin: (reward: number) => void, loading: boolean, onRestart: () => void }) {
  const words = ['REACT', 'FIREBASE', 'WHATSAPP', 'WALLET', 'EARNING', 'GAMING', 'MOBILE', 'CHAT'];
  const [word, setWord] = useState('');
  const [scrambled, setScrambled] = useState('');
  const [input, setInput] = useState('');

  const next = () => {
    const w = words[Math.floor(Math.random() * words.length)];
    setWord(w);
    setScrambled(w.split('').sort(() => Math.random() - 0.5).join(''));
    setInput('');
    onRestart();
  };

  useEffect(() => next(), []);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toUpperCase() === word) {
      onWin(15);
    } else {
      next();
    }
  };

  return (
    <div className="text-center">
      <h2 className="text-5xl font-black text-[#00A884] mb-8 tracking-widest uppercase">{scrambled}</h2>
      <form onSubmit={check} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Unscramble the word"
          className="text-2xl text-center border-b-4 border-[#00A884] p-4 focus:outline-none bg-transparent uppercase"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[#00A884] text-white font-bold py-4 px-12 rounded-2xl shadow-xl hover:bg-[#008F6F] transition-all"
        >
          Submit
        </button>
      </form>
    </div>
  );
}

function CaptchaSolver({ onWin, loading, onRestart }: { onWin: (reward: number) => void, loading: boolean, onRestart: () => void }) {
  const [captcha, setCaptcha] = useState('');
  const [input, setInput] = useState('');

  const next = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    setCaptcha(res);
    setInput('');
    onRestart();
  };

  useEffect(() => next(), []);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toUpperCase() === captcha) {
      onWin(2);
    } else {
      next();
    }
  };

  return (
    <div className="text-center">
      <div className="bg-[#F0F2F5] p-6 rounded-2xl mb-8 border-2 border-[#D1D7DB] select-none">
        <span className="text-4xl font-black text-[#111B21] tracking-[10px] italic line-through decoration-red-500 opacity-80">
          {captcha}
        </span>
      </div>
      <form onSubmit={check} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Type the code"
          className="text-2xl text-center border-b-4 border-[#00A884] p-4 focus:outline-none bg-transparent uppercase"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[#00A884] text-white font-bold py-4 px-12 rounded-2xl shadow-xl hover:bg-[#008F6F] transition-all"
        >
          Verify
        </button>
      </form>
    </div>
  );
}

function CoinFlip({ onWin, loading, onRestart }: { onWin: (reward: number) => void, loading: boolean, onRestart: () => void }) {
  const [flipping, setFlipping] = useState(false);
  const [side, setSide] = useState<'heads' | 'tails'>('heads');
  const [bet, setBet] = useState<'heads' | 'tails'>('heads');

  const flip = () => {
    if (flipping || loading) return;
    onRestart();
    setFlipping(true);
    setTimeout(() => {
      const result = Math.random() > 0.5 ? 'heads' : 'tails';
      setSide(result);
      setFlipping(false);
      if (result === bet) onWin(20);
      else onWin(0); // Lost
    }, 2000);
  };

  return (
    <div className="text-center">
      <div className="flex gap-4 mb-12 justify-center">
        <button
          onClick={() => setBet('heads')}
          className={cn("px-6 py-2 rounded-full font-bold transition-all", bet === 'heads' ? "bg-[#00A884] text-white shadow-lg" : "bg-gray-200 text-[#54656F]")}
        >
          Heads
        </button>
        <button
          onClick={() => setBet('tails')}
          className={cn("px-6 py-2 rounded-full font-bold transition-all", bet === 'tails' ? "bg-[#00A884] text-white shadow-lg" : "bg-gray-200 text-[#54656F]")}
        >
          Tails
        </button>
      </div>

      <motion.div
        animate={flipping ? { rotateY: [0, 720], scale: [1, 1.5, 1] } : {}}
        transition={{ duration: 2, ease: "easeInOut" }}
        className="w-32 h-32 bg-yellow-400 rounded-full mx-auto mb-12 shadow-2xl flex items-center justify-center border-8 border-yellow-500"
      >
        <span className="text-4xl font-black text-yellow-800 uppercase">{side[0]}</span>
      </motion.div>

      <button
        onClick={flip}
        disabled={flipping || loading}
        className="bg-[#00A884] text-white font-bold py-4 px-12 rounded-2xl shadow-xl hover:bg-[#008F6F] transition-all disabled:opacity-50"
      >
        {flipping ? 'Flipping...' : 'Flip Coin'}
      </button>
    </div>
  );
}

function MemoryMatch({ onWin, loading, onRestart }: { onWin: (reward: number) => void, loading: boolean, onRestart: () => void }) {
  const icons = [RotateCw, Calculator, Eraser, Calendar, Dices, Type];
  const [cards, setCards] = useState<any[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);

  const reset = () => {
    const items = [...icons, ...icons]
      .sort(() => Math.random() - 0.5)
      .map((Icon, i) => ({ id: i, Icon }));
    setCards(items);
    setFlipped([]);
    setMatched([]);
    onRestart();
  };

  useEffect(() => {
    reset();
  }, []);

  const handleFlip = (id: number) => {
    if (flipped.length === 2 || flipped.includes(id) || matched.includes(id)) return;
    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped;
      if (cards[first].Icon === cards[second].Icon) {
        setMatched([...matched, first, second]);
        setFlipped([]);
        if (matched.length + 2 === cards.length) onWin(25);
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          onClick={() => handleFlip(card.id)}
          className={cn(
            "w-16 h-16 rounded-xl cursor-pointer transition-all duration-500 flex items-center justify-center shadow-md",
            flipped.includes(card.id) || matched.includes(card.id) ? "bg-[#D9FDD3] text-[#00A884] rotate-y-180" : "bg-[#00A884] text-white"
          )}
        >
          {(flipped.includes(card.id) || matched.includes(card.id)) ? <card.Icon size={32} /> : <Zap size={24} />}
        </div>
      ))}
    </div>
  );
}

function WatchEarn({ onWin, loading, onRestart }: { onWin: (reward: number) => void, loading: boolean, onRestart: () => void }) {
  const [watching, setWatching] = useState(false);
  const [adReady, setAdReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const rewardedSlotRef = useRef<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) setAppSettings(doc.data() as AppSettings);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (appSettings && !appSettings.isAdMobEnabled) {
      setError("AdMob is currently disabled by administrator.");
      return;
    }

    const googletag = (window as any).googletag;
    if (!googletag) {
      setError("Ad SDK not loaded. Please disable ad-blocker.");
      return;
    }

    googletag.cmd.push(() => {
      const adUnitPath = '/5355571256728358/6016645058';
      
      rewardedSlotRef.current = googletag.defineOutOfPageSlot(
        adUnitPath,
        googletag.enums.OutOfPageFormat.REWARDED
      );

      if (rewardedSlotRef.current) {
        rewardedSlotRef.current.addService(googletag.pubads());

        googletag.pubads().addEventListener('rewardedSlotReady', (event: any) => {
          if (event.slot === rewardedSlotRef.current) {
            setAdReady(true);
          }
        });

        googletag.pubads().addEventListener('rewardedSlotGranted', (event: any) => {
          if (event.slot === rewardedSlotRef.current) {
            const rewardAmount = appSettings?.adEarningRate || 5;
            onWin(rewardAmount);
          }
        });

        googletag.pubads().addEventListener('rewardedSlotClosed', (event: any) => {
          if (event.slot === rewardedSlotRef.current) {
            setWatching(false);
            setAdReady(false);
            googletag.destroySlots([rewardedSlotRef.current]);
            rewardedSlotRef.current = null;
            onRestart();
          }
        });

        googletag.enableServices();
        googletag.display(rewardedSlotRef.current);
      } else {
        setError("Failed to initialize ad slot.");
      }
    });

    return () => {
      googletag.cmd.push(() => {
        if (rewardedSlotRef.current) {
          googletag.destroySlots([rewardedSlotRef.current]);
        }
      });
    };
  }, [appSettings]);

  const showAd = () => {
    if (!adReady || watching || loading) return;
    const googletag = (window as any).googletag;
    googletag.cmd.push(() => {
      googletag.pubads().refresh([rewardedSlotRef.current]);
    });
    setWatching(true);
  };

  return (
    <div className="text-center w-full max-w-md">
      <div className="aspect-video bg-black rounded-3xl mb-8 flex flex-col items-center justify-center relative overflow-hidden group p-6">
        {error ? (
          <div className="text-red-500 text-sm font-bold flex flex-col items-center gap-2">
            <XCircle size={48} />
            <p>{error}</p>
          </div>
        ) : !watching ? (
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={showAd} 
              disabled={!adReady || loading}
              className={cn(
                "text-white hover:scale-110 transition-transform flex flex-col items-center gap-3",
                (!adReady || loading) && "opacity-50 cursor-not-allowed"
              )}
            >
              <PlayCircle size={80} className={cn(adReady && "text-[#00A884] animate-pulse")} />
              <span className="font-bold text-lg">{adReady ? 'Watch Ad to Earn' : 'Loading Ad...'}</span>
            </button>
          </div>
        ) : (
          <div className="text-white text-center">
            <div className="w-16 h-16 border-4 border-[#00A884] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold mb-2">Ad in Progress...</p>
          </div>
        )}
      </div>
      <div className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/20 shadow-sm">
        <div className="flex items-center justify-center gap-2 text-[#00A884] font-bold mb-1">
          <Trophy size={16} />
          <span>Reward: Rs. {(appSettings?.adEarningRate || 5).toFixed(2)}</span>
        </div>
        <p className="text-[#667781] text-[10px] uppercase tracking-tighter">Watch the full video to claim your reward</p>
      </div>
    </div>
  );
}
