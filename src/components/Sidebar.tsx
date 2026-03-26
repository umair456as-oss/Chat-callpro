import { motion } from 'motion/react';
import { MessageCircle, Wallet, Gamepad2, ShieldCheck, LogOut, CircleDashed, Users } from 'lucide-react';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { cn } from '../utils';

interface SidebarProps {
  activeTab: 'chats' | 'status' | 'wallet' | 'games' | 'admin' | 'contacts';
  setActiveTab: (tab: 'chats' | 'status' | 'wallet' | 'games' | 'admin' | 'contacts') => void;
  profile: UserProfile;
}

export default function Sidebar({ activeTab, setActiveTab, profile }: SidebarProps) {
  return (
    <div className="fixed-footer w-full bg-[#F0F2F5] border-t border-[#D1D7DB] flex flex-row items-center py-2 justify-around z-50">
      <div className="flex flex-row items-center justify-around w-full">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('chats')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            activeTab === 'chats' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Chats"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-[10px]">Chats</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('contacts')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            activeTab === 'contacts' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Contacts"
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px]">Contacts</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('status')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            activeTab === 'status' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Status"
        >
          <CircleDashed className="w-6 h-6" />
          <span className="text-[10px]">Status</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('wallet')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            activeTab === 'wallet' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Wallet"
        >
          <Wallet className="w-6 h-6" />
          <span className="text-[10px]">Wallet</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab('games')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
            activeTab === 'games' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
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
            onClick={() => setActiveTab('admin')}
            className={cn(
              "p-2 rounded-full transition-colors flex flex-col items-center gap-1",
              activeTab === 'admin' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
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
