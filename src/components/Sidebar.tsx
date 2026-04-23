import { motion } from 'motion/react';
import { MessageCircle, Wallet, Gamepad2, ShieldCheck, LogOut, CircleDashed, Users } from 'lucide-react';
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
    <div className="fixed-footer w-full bg-[#F0F2F5] border-t border-[#D1D7DB] flex flex-row items-center py-2 justify-around z-50">
      <div className="flex flex-row items-center justify-around w-full">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            currentPath === '/' ? "bg-[#FDE2E4] text-[#700122]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Chats"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-[10px]">Chats</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/contacts')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            currentPath === '/contacts' ? "bg-[#FDE2E4] text-[#700122]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Contacts"
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px]">Contacts</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/status')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            currentPath === '/status' ? "bg-[#FDE2E4] text-[#700122]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Status"
        >
          <CircleDashed className="w-6 h-6" />
          <span className="text-[10px]">Status</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/wallet')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            currentPath === '/wallet' ? "bg-[#FDE2E4] text-[#700122]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Wallet"
        >
          <Wallet className="w-6 h-6" />
          <span className="text-[10px]">Wallet</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/games')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            currentPath === '/games' ? "bg-[#FDE2E4] text-[#700122]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Games"
        >
          <Gamepad2 className="w-6 h-6" />
          <span className="text-[10px]">Games</span>
        </motion.button>

        {(profile.role === 'admin' || profile.email === 'abdulrehmanhabib.com@gmail.com') && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/admin')}
            className={cn(
              "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
              currentPath === '/admin' ? "bg-[#FDE2E4] text-[#700122]" : "text-[#54656F] hover:bg-gray-200"
            )}
            title="Admin Panel"
          >
            <ShieldCheck className="w-6 h-6" />
            <span className="text-[10px]">Admin</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
