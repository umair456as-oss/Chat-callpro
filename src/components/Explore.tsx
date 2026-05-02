import React from 'react';
import { motion } from 'motion/react';
import { 
  Book, 
  Heart, 
  Moon, 
  Compass, 
  Music, 
  PlayCircle, 
  Calendar, 
  MapPin, 
  Award,
  BookOpen
} from 'lucide-react';
import { cn } from '../utils';

interface ExploreItem {
  id: string;
  title: string;
  urduTitle: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

export default function Explore() {
  const categories: ExploreItem[] = [
    {
      id: 'quran',
      title: 'Holy Quran',
      urduTitle: 'قرآن پاک',
      icon: <Book size={32} />,
      color: 'bg-emerald-500',
      onClick: () => window.open('https://quran.com', '_blank')
    },
    {
      id: 'hadith',
      title: 'Hadith',
      urduTitle: 'حدیث مبارکہ',
      icon: <BookOpen size={32} />,
      color: 'bg-blue-500',
      onClick: () => window.open('https://sunnah.com', '_blank')
    },
    {
      id: 'prayer',
      title: 'Prayer Times',
      urduTitle: 'نماز کے اوقات',
      icon: <Moon size={32} />,
      color: 'bg-purple-500',
      onClick: () => alert('Prayer times feature coming soon!')
    },
    {
      id: 'qibla',
      title: 'Qibla Finder',
      urduTitle: 'قبلہ رخ',
      icon: <Compass size={32} />,
      color: 'bg-amber-500',
      onClick: () => window.open('https://qiblafinder.withgoogle.com/', '_blank')
    },
    {
      id: 'duas',
      title: 'Duas',
      urduTitle: 'دعائیں',
      icon: <Heart size={32} />,
      color: 'bg-rose-500',
      onClick: () => alert('Duas collection coming soon!')
    },
    {
      id: 'nasheeds',
      title: 'Nasheeds',
      urduTitle: 'نعتیں',
      icon: <Music size={32} />,
      color: 'bg-indigo-500',
      onClick: () => alert('Nasheeds player coming soon!')
    },
    {
      id: 'bayanat',
      title: 'Bayanat',
      urduTitle: 'بیانات',
      icon: <PlayCircle size={32} />,
      color: 'bg-cyan-500',
      onClick: () => alert('Bayanat repository coming soon!')
    },
    {
      id: 'calendar',
      title: 'Islamic Calendar',
      urduTitle: 'اسلامی کیلنڈر',
      icon: <Calendar size={32} />,
      color: 'bg-teal-500',
      onClick: () => window.open('https://www.islamicfinder.org/islamic-calendar/', '_blank')
    },
    {
      id: 'mosques',
      title: 'Nearby Mosques',
      urduTitle: 'قریبی مساجد',
      icon: <MapPin size={32} />,
      color: 'bg-orange-500',
      onClick: () => window.open('https://www.google.com/maps/search/mosques+near+me', '_blank')
    },
    {
      id: 'tasbeeh',
      title: 'Tasbeeh Counter',
      urduTitle: 'تسبیح کاؤنٹر',
      icon: <Award size={32} />,
      color: 'bg-lime-500',
      onClick: () => alert('Tasbeeh counter coming soon!')
    }
  ];

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-[#111b21] overflow-hidden">
      {/* Header */}
      <div className="bg-[#00a884] dark:bg-[#202c33] p-6 pt-12 pb-8 shadow-lg z-10">
        <h1 className="text-3xl font-black text-white Urdu text-center">ایکسپلور (Explore)</h1>
        <p className="text-white/80 text-center Urdu mt-2 text-sm">اسلامی معلومات اور خدمات تک رسائی</p>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {categories.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={item.onClick}
              className="group relative flex flex-col items-center justify-center p-6 bg-white dark:bg-[#202c33] rounded-[32px] shadow-sm hover:shadow-xl transition-all active:scale-95 border border-gray-100 dark:border-white/5"
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform",
                item.color
              )}>
                {item.icon}
              </div>
              <span className="text-[#111b21] dark:text-[#e9edef] font-bold text-sm text-center Urdu block mb-1">
                {item.urduTitle}
              </span>
              <span className="text-[#667781] dark:text-[#8696a0] text-[10px] font-bold uppercase tracking-widest text-center">
                {item.title}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Card of the Day */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 bg-gradient-to-br from-[#00a884] to-[#128c7e] rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Moon size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-black Urdu mb-4 italic">آج کی آیت (Verse of the Day)</h3>
            <p className="text-xl Urdu leading-relaxed mb-6 italic opacity-90">
              "بے شک اللہ صبر کرنے والوں کے ساتھ ہے۔"
            </p>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold uppercase tracking-widest opacity-70">Al-Baqarah 2:153</span>
              <button className="bg-white/20 hover:bg-white/30 p-3 rounded-full transition-colors">
                <Heart size={20} />
              </button>
            </div>
          </div>
        </motion.div>

        <div className="p-10 text-center text-[11px] text-[#8696a0] Urdu opacity-40 uppercase tracking-[0.3em] font-medium">
          Digital Islamic Companion • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
