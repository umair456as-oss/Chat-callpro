import { MessageCircle, Wallet, Gamepad2, ShieldCheck, LogOut, CircleDashed } from 'lucide-react';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { cn } from '../utils';

interface SidebarProps {
  activeTab: 'chats' | 'status' | 'wallet' | 'games' | 'admin';
  setActiveTab: (tab: 'chats' | 'status' | 'wallet' | 'games' | 'admin') => void;
  profile: UserProfile;
}

export default function Sidebar({ activeTab, setActiveTab, profile }: SidebarProps) {
  return (
    <div className="w-full md:w-[60px] bg-[#F0F2F5] border-t md:border-t-0 md:border-r border-[#D1D7DB] flex flex-row md:flex-col items-center py-2 md:py-4 justify-around md:justify-between z-50">
      <div className="flex flex-row md:flex-col items-center gap-4 md:gap-6">
        <div className="hidden md:block w-10 h-10 rounded-full overflow-hidden mb-4 border border-gray-300">
          <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} alt="Profile" referrerPolicy="no-referrer" />
        </div>

        <button
          onClick={() => setActiveTab('chats')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1 md:gap-0",
            activeTab === 'chats' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Chats"
        >
          <MessageCircle size={24} />
          <span className="text-[10px] md:hidden">Chats</span>
        </button>

        <button
          onClick={() => setActiveTab('status')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1 md:gap-0",
            activeTab === 'status' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Status"
        >
          <CircleDashed size={24} />
          <span className="text-[10px] md:hidden">Status</span>
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1 md:gap-0",
            activeTab === 'wallet' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Wallet"
        >
          <Wallet size={24} />
          <span className="text-[10px] md:hidden">Wallet</span>
        </button>

        <button
          onClick={() => setActiveTab('games')}
          className={cn(
            "p-2 rounded-full transition-colors flex flex-col items-center gap-1 md:gap-0",
            activeTab === 'games' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
          )}
          title="Games"
        >
          <Gamepad2 size={24} />
          <span className="text-[10px] md:hidden">Games</span>
        </button>

        {(profile.role === 'admin' || profile.email === 'abdulrehmanhabib.com@gmail.com') && (
          <button
            onClick={() => setActiveTab('admin')}
            className={cn(
              "p-2 rounded-full transition-colors flex flex-col items-center gap-1 md:gap-0",
              activeTab === 'admin' ? "bg-[#D9FDD3] text-[#00A884]" : "text-[#54656F] hover:bg-gray-200"
            )}
            title="Admin Panel"
          >
            <ShieldCheck size={24} />
            <span className="text-[10px] md:hidden">Admin</span>
          </button>
        )}
      </div>

      <button
        onClick={() => auth.signOut()}
        className="p-2 rounded-full text-[#54656F] hover:bg-red-100 hover:text-red-600 transition-colors flex flex-col items-center gap-1 md:gap-0"
        title="Logout"
      >
        <LogOut size={24} />
        <span className="text-[10px] md:hidden">Logout</span>
      </button>
    </div>
  );
}
