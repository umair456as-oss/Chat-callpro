import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Search, User, Key, Lock, List as ListIcon, 
  MessageSquare, Radio, Bell, Accessibility, ChevronRight, 
  Shield, UserPlus, Mail, Smartphone, FileText, Share2, 
  Trash2, Eye, Image as ImageIcon, Info, Link as LinkIcon,
  CircleDashed, ToggleLeft as Toggle, Clock, Sun, 
  Palette, Send, EyeOff, Languages, Volume2, History,
  Database, HelpCircle, Users, Smile, BadgePlus, QrCode, PlusCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { cn } from '../utils';
import { auth, db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';

interface SettingsProps {
  profile: UserProfile;
}

type SettingsTab = 'main' | 'account' | 'privacy' | 'lists' | 'chats' | 'notifications' | 'accessibility';

export default function Settings({ profile }: SettingsProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('main');
  
  // Settings States initialized from profile or defaults
  const settings = profile.userSettings || {
    readReceipts: true,
    enterIsSend: false,
    mediaVisibility: true,
    keepArchived: true,
    conversationTones: true,
    reminders: true,
    highPriority: true,
    increaseContrast: false,
    theme: 'system',
    fontSize: 'medium'
  };

  const updateSetting = async (key: string, value: any) => {
    if (!profile.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        [`userSettings.${key}`]: value
      });
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  };

  const handleBack = () => {
    if (activeTab === 'main') {
      navigate(-1);
    } else {
      setActiveTab('main');
    }
  };

  const renderHeader = (title: string) => (
    <div className="bg-white px-4 h-[60px] flex items-center justify-between sticky top-0 z-30 border-b border-gray-100">
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="p-2 -ml-2 text-[#54656F] hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-[#111B21]">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        <button className="p-2 text-[#54656F] hover:bg-gray-100 rounded-full transition-colors">
          <Search size={22} />
        </button>
      </div>
    </div>
  );

  const SettingItem = ({ 
    icon: Icon, 
    title, 
    subtitle, 
    onClick, 
    toggle, 
    toggleValue 
  }: { 
    icon: any, 
    title: string, 
    subtitle?: string, 
    onClick?: () => void,
    toggle?: boolean,
    toggleValue?: boolean 
  }) => (
    <button 
      onClick={onClick}
      className="w-full flex items-center px-4 py-3.5 hover:bg-gray-50 transition-colors group text-left"
    >
      <div className="p-2 text-[#54656F] group-hover:text-[#008069] transition-colors">
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <div className="flex-1 ml-4 border-b border-gray-50 pb-3 group-last:border-none">
        <div className="flex justify-between items-center">
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] text-[#111B21] leading-tight font-medium">{title}</h3>
            {subtitle && <p className="text-[14px] text-[#667781] mt-0.5 leading-tight truncate">{subtitle}</p>}
          </div>
          {toggle ? (
            <div className={cn(
              "w-9 h-5 rounded-full transition-colors relative flex-shrink-0",
              toggleValue ? "bg-[#25D366]" : "bg-gray-300"
            )}>
              <div className={cn(
                "absolute top-[2px] w-4 h-4 bg-white rounded-full transition-all",
                toggleValue ? "left-4.5" : "left-0.5"
              )} />
            </div>
          ) : onClick && <ChevronRight size={20} className="text-[#8696A0] ml-2" />}
        </div>
      </div>
    </button>
  );

  const renderMain = () => (
    <div className="flex flex-col bg-white h-screen overflow-y-auto pb-20">
      {renderHeader("Settings")}
      
      {/* Profile Section */}
      <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors group mb-4 border-b border-gray-100">
        <div className="relative">
          <img 
            src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`}
            className="w-20 h-20 rounded-full object-cover border border-gray-100 shadow-sm"
            alt="Profile"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-medium text-[#111B21] truncate">{profile.displayName}</h2>
          <div className="inline-flex items-center gap-2 mt-1 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
            <Smile size={14} className="text-[#25D366]" />
            <span className="text-xs text-[#54656F] font-medium">{profile.bio || "Available"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <QrCode className="text-[#008069] cursor-pointer" size={24} />
           <PlusCircle className="text-[#008069] cursor-pointer" size={24} />
        </div>
      </div>

      <div className="flex flex-col">
        <SettingItem 
          icon={Key} 
          title="Account" 
          subtitle="Security notifications, change number" 
          onClick={() => setActiveTab('account')} 
        />
        <SettingItem 
          icon={Lock} 
          title="Privacy" 
          subtitle="Blocked accounts, disappearing messages" 
          onClick={() => setActiveTab('privacy')} 
        />
        <SettingItem 
          icon={ListIcon} 
          title="Lists" 
          subtitle="Manage people and groups" 
          onClick={() => setActiveTab('lists')} 
        />
        <SettingItem 
          icon={MessageSquare} 
          title="Chats" 
          subtitle="Theme, wallpapers, chat history" 
          onClick={() => setActiveTab('chats')} 
        />
        <SettingItem 
          icon={Radio} 
          title="Broadcasts" 
          subtitle="Manage lists and send broadcasts" 
        />
        <SettingItem 
          icon={Bell} 
          title="Notifications" 
          subtitle="Message, group & call tones" 
          onClick={() => setActiveTab('notifications')} 
        />
        <SettingItem 
          icon={Accessibility} 
          title="Accessibility" 
          onClick={() => setActiveTab('accessibility')} 
        />
      </div>
    </div>
  );

  const renderAccount = () => (
    <div className="flex flex-col bg-white h-screen overflow-y-auto pb-20">
      {renderHeader("Account")}
      <SettingItem icon={Shield} title="Security notifications" />
      <SettingItem icon={BadgePlus} title="Passkeys" />
      <SettingItem icon={Mail} title="Email address" subtitle={profile.email} />
      <SettingItem icon={Smartphone} title="Two-step verification" />
      <SettingItem icon={Smartphone} title="Change phone number" />
      <SettingItem icon={FileText} title="Request account info" />
      <SettingItem icon={ListIcon} title="Ad preferences in Accounts Center" />
      <div className="h-px bg-gray-100 my-2" />
      <SettingItem icon={UserPlus} title="Add account" />
      <SettingItem icon={Trash2} title="Delete account" onClick={() => {}} />
    </div>
  );

  const renderPrivacy = () => (
    <div className="flex flex-col bg-white h-screen overflow-y-auto pb-20">
      {renderHeader("Privacy")}
      <div className="px-4 py-3 text-[14px] font-bold text-[#667781] uppercase tracking-wide">Who can see my personal info</div>
      <SettingItem icon={Eye} title="Last seen and online" subtitle="Nobody" />
      <SettingItem icon={ImageIcon} title="Profile picture" subtitle="My contacts" />
      <SettingItem icon={Info} title="About" subtitle="Everyone" />
      <SettingItem icon={LinkIcon} title="Links" subtitle="Everyone" />
      <SettingItem icon={CircleDashed} title="Status" subtitle="My contacts" />
      
      <div className="h-px bg-gray-100 my-2" />
      
      <div className="p-4 flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-[17px] text-[#111B21] font-medium leading-tight">Read receipts</h3>
            <p className="text-[14px] text-[#667781] mt-1 leading-snug">
              If turned off, you won't send or receive Read receipts. Read receipts are always sent for group chats.
            </p>
          </div>
          <button 
            onClick={() => updateSetting('readReceipts', !settings.readReceipts)}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative flex-shrink-0 mt-1",
              settings.readReceipts ? "bg-[#25D366]" : "bg-gray-300"
            )}
          >
            <div className={cn(
              "absolute top-[2px] w-4 h-4 bg-white rounded-full transition-all",
              settings.readReceipts ? "left-5.5" : "left-0.5"
            )} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 text-[14px] font-bold text-[#667781] uppercase tracking-wide">Disappearing messages</div>
      <SettingItem icon={Clock} title="Default message timer" subtitle="Off" />
    </div>
  );

  const renderLists = () => (
    <div className="flex flex-col bg-white h-screen overflow-y-auto pb-20">
      {renderHeader("Lists")}
      <div className="p-8 flex flex-col items-center text-center">
        <div className="flex gap-[-10px] mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center border-2 border-white shadow-sm -mr-4 overflow-hidden p-3">
             <Smile className="text-[#008069] w-full h-full" />
          </div>
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm -mr-4 overflow-hidden p-3">
             <Users className="text-blue-600 w-full h-full" />
          </div>
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden p-3">
             <PlusCircle className="text-gray-400 w-full h-full" />
          </div>
        </div>
        <p className="text-[#54656F] text-sm mb-8 leading-relaxed max-w-xs">
          Any list you create becomes a filter at the top of your Chats tab.
        </p>
        <button className="w-full py-3.5 bg-[#D9FDD3] text-[#008069] font-bold rounded-full flex items-center justify-center gap-2 hover:bg-[#c6fcc0] transition-colors">
          <PlusCircle size={20} />
          Create a custom list
        </button>
      </div>

      <div className="px-6 py-4">
        <h3 className="text-sm font-bold text-[#667781] uppercase tracking-wide mb-4">Your lists</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-[17px] text-[#111B21] font-medium">Unread</h4>
            <p className="text-xs text-[#667781]">Preset</p>
          </div>
          <div>
            <h4 className="text-[17px] text-[#111B21] font-medium">Favorites</h4>
            <p className="text-xs text-[#667781]">Add people or groups</p>
          </div>
          <div>
            <h4 className="text-[17px] text-[#111B21] font-medium">Groups</h4>
            <p className="text-xs text-[#667781]">Preset</p>
          </div>
        </div>
      </div>

       <div className="px-6 py-4 mt-4">
        <h3 className="text-sm font-bold text-[#667781] uppercase tracking-wide mb-4">Available presets</h3>
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-[17px] text-[#111B21] font-medium">Communities</h4>
            <p className="text-xs text-[#667781]">Preset</p>
          </div>
          <button className="bg-[#D9FDD3] text-[#008069] px-6 py-2 rounded-full font-bold text-sm">Add</button>
        </div>
      </div>
    </div>
  );

  const renderChats = () => (
    <div className="flex flex-col bg-white h-screen overflow-y-auto pb-20">
      {renderHeader("Chats")}
      <SettingItem icon={Sun} title="Theme" subtitle={settings.theme === 'system' ? 'System default' : settings.theme === 'dark' ? 'Dark' : 'Light'} />
      <SettingItem icon={Palette} title="Default chat theme" />
      
      <div className="px-4 py-3 text-[14px] font-bold text-[#667781] uppercase tracking-wide">Chat settings</div>
      <SettingItem 
        icon={Send} 
        title="Enter is send" 
        subtitle="Enter key will send your message" 
        toggle 
        toggleValue={settings.enterIsSend}
        onClick={() => updateSetting('enterIsSend', !settings.enterIsSend)} 
      />
      <SettingItem 
        icon={ImageIcon} 
        title="Media visibility" 
        subtitle="Show newly downloaded media in your device's gallery" 
        toggle 
        toggleValue={settings.mediaVisibility}
        onClick={() => updateSetting('mediaVisibility', !settings.mediaVisibility)} 
      />
      <SettingItem icon={Languages} title="Font size" subtitle="Medium" />
      <SettingItem icon={Volume2} title="Voice message transcripts" subtitle="Read new voice messages" />
      
      <div className="px-4 py-3 text-[14px] font-bold text-[#667781] uppercase tracking-wide">Archived chats</div>
      <SettingItem 
        icon={History} 
        title="Keep chats archived" 
        subtitle="Archived chats will remain archived when you receive a message" 
        toggle 
        toggleValue={settings.keepArchived}
        onClick={() => updateSetting('keepArchived', !settings.keepArchived)} 
      />
    </div>
  );

  const renderNotifications = () => (
    <div className="flex flex-col bg-white h-screen overflow-y-auto pb-20">
      {renderHeader("Notifications")}
      <SettingItem 
        icon={Volume2} 
        title="Conversation tones" 
        subtitle="Play sounds for incoming and outgoing messages." 
        toggle 
        toggleValue={settings.conversationTones}
        onClick={() => updateSetting('conversationTones', !settings.conversationTones)} 
      />
       <SettingItem 
        icon={Clock} 
        title="Reminders" 
        subtitle="Get occasional reminders about messages, calls or status updates you haven't seen" 
        toggle 
        toggleValue={settings.reminders}
        onClick={() => updateSetting('reminders', !settings.reminders)} 
      />
      
      <div className="px-4 py-3 text-[14px] font-bold text-[#667781] uppercase tracking-wide">Messages</div>
      <SettingItem icon={Volume2} title="Notification tone" subtitle="Default (Elastic Ball)" />
      <SettingItem icon={Smartphone} title="Vibrate" subtitle="Default" />
      <SettingItem icon={MessageSquare} title="Popup notification" subtitle="Not available" />
      <SettingItem icon={Sun} title="Light" subtitle="White" />
      <SettingItem 
        icon={Shield} 
        title="Use high priority notifications" 
        subtitle="Show previews of notifications at the top of the screen" 
        toggle 
        toggleValue={settings.highPriority}
        onClick={() => updateSetting('highPriority', !settings.highPriority)} 
      />
    </div>
  );

  const renderAccessibility = () => (
    <div className="flex flex-col bg-white h-screen overflow-y-auto pb-20">
      {renderHeader("Accessibility")}
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-[17px] text-[#111B21] font-medium leading-tight">Increase contrast</h3>
            <p className="text-[14px] text-[#667781] mt-1 leading-snug">
              Darken key colors to make things easier to see while in light mode.
            </p>
          </div>
          <button 
            onClick={() => updateSetting('increaseContrast', !settings.increaseContrast)}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative flex-shrink-0 mt-1",
              settings.increaseContrast ? "bg-[#25D366]" : "bg-gray-300"
            )}
          >
            <div className={cn(
              "absolute top-[2px] w-4 h-4 bg-white rounded-full transition-all",
              settings.increaseContrast ? "left-5.5" : "left-0.5"
            )} />
          </button>
        </div>
      </div>
       <div className="px-4 py-3">
        <h4 className="text-[17px] text-[#111B21] font-medium">Animation</h4>
        <p className="text-[14px] text-[#667781] mt-1 leading-snug">
          Choose whether stickers and GIFs move automatically.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] relative z-40 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          {activeTab === 'main' && renderMain()}
          {activeTab === 'account' && renderAccount()}
          {activeTab === 'privacy' && renderPrivacy()}
          {activeTab === 'lists' && renderLists()}
          {activeTab === 'chats' && renderChats()}
          {activeTab === 'notifications' && renderNotifications()}
          {activeTab === 'accessibility' && renderAccessibility()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
