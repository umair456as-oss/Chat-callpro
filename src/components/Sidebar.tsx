import { motion } from 'motion/react';
import { MessageCircle, ShieldCheck, CircleDashed, Users, Phone, Compass } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { cn } from '../utils';

interface SidebarProps {
  profile: UserProfile;
}

export default function Sidebar({ profile }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="fixed-footer w-full bg-white border-t border-gray-100 flex flex-row items-center py-1 justify-around z-50 h-[65px] safe-area-bottom shadow-[0_-1px_10px_rgba(0,0,0,0.02)]">
      <div className="flex flex-row items-center justify-around w-full">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/')}
          className="flex flex-col items-center gap-1 min-w-[70px] relative px-2 py-1"
          title="Chats"
        >
          <div className={cn(
            "px-5 py-1 rounded-full transition-all duration-200",
            currentPath === '/' ? "bg-[#D9FDD3] text-[#075E54]" : "text-[#54656F]"
          )}>
            <MessageCircle className={cn("w-6 h-6", currentPath === '/' ? "stroke-[2.5px]" : "stroke-2")} />
            {/* badge for unread could go here */}
          </div>
          <span className={cn("text-[11px] font-medium", currentPath === '/' ? "text-[#075E54]" : "text-[#54656F]")}>Chats</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/status')}
          className="flex flex-col items-center gap-1 min-w-[70px] relative px-2 py-1"
          title="Updates"
        >
          <div className={cn(
            "px-5 py-1 rounded-full transition-all duration-200",
            currentPath === '/status' ? "bg-[#D9FDD3] text-[#075E54]" : "text-[#54656F]"
          )}>
            <CircleDashed className={cn("w-6 h-6", currentPath === '/status' ? "stroke-[2.5px]" : "stroke-2")} />
          </div>
          <span className={cn("text-[11px] font-medium", currentPath === '/status' ? "text-[#075E54]" : "text-[#54656F]")}>Updates</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/contacts')}
          className="flex flex-col items-center gap-1 min-w-[70px] relative px-2 py-1"
          title="Communities"
        >
          <div className={cn(
            "px-5 py-1 rounded-full transition-all duration-200",
            currentPath === '/contacts' ? "bg-[#D9FDD3] text-[#075E54]" : "text-[#54656F]"
          )}>
            <Users className={cn("w-6 h-6", currentPath === '/contacts' ? "stroke-[2.5px]" : "stroke-2")} />
          </div>
          <span className={cn("text-[11px] font-medium", currentPath === '/contacts' ? "text-[#075E54]" : "text-[#54656F]")}>Communities</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/calls')}
          className="flex flex-col items-center gap-1 min-w-[70px] relative px-2 py-1"
          title="Calls"
        >
          <div className={cn(
            "px-5 py-1 rounded-full transition-all duration-200",
            currentPath === '/calls' ? "bg-[#D9FDD3] text-[#075E54]" : "text-[#54656F]"
          )}>
            <Phone className={cn("w-6 h-6", currentPath === '/calls' ? "stroke-[2.5px]" : "stroke-2")} />
          </div>
          <span className={cn("text-[11px] font-medium", currentPath === '/calls' ? "text-[#075E54]" : "text-[#54656F]")}>Calls</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/explore')}
          className="flex flex-col items-center gap-1 min-w-[70px] relative px-2 py-1"
          title="Explore"
        >
          <div className={cn(
            "px-5 py-1 rounded-full transition-all duration-200",
            currentPath === '/explore' ? "bg-[#D9FDD3] text-[#075E54]" : "text-[#54656F]"
          )}>
            <Compass className="w-6 h-6" />
          </div>
          <span className={cn("text-[11px] font-medium", currentPath === '/explore' ? "text-[#075E54]" : "text-[#54656F]")}>Explore</span>
        </motion.button>

        {(profile.role === 'admin' || profile.email === 'abdulrehmanhabib.com@gmail.com') && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/admin')}
            className="flex flex-col items-center gap-1 min-w-[70px] relative px-2 py-1"
            title="Admin"
          >
            <div className={cn(
              "px-5 py-1 rounded-full transition-all duration-200",
              currentPath === '/admin' ? "bg-[#D9FDD3] text-[#075E54]" : "text-[#54656F]"
            )}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className={cn("text-[11px] font-medium", currentPath === '/admin' ? "text-[#075E54]" : "text-[#54656F]")}>Admin</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
