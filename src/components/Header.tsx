import React, { useState, useEffect } from 'react';
import { Search, MoreVertical, User, Wallet, Shield, Settings, LogOut, X, Camera, Check, Edit2 } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';

interface HeaderProps {
  profile: UserProfile;
  onTabChange: (tab: 'chats' | 'status' | 'wallet' | 'games' | 'admin') => void;
}

export default function Header({ profile, onTabChange }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newBio, setNewBio] = useState(profile.bio || '');
  const [newName, setNewName] = useState(profile.displayName || '');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  useEffect(() => {
    setNewBio(profile.bio || '');
    setNewName(profile.displayName || '');
  }, [profile]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateBio = async () => {
    if (!profile.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        bio: newBio
      });
      setIsEditingBio(false);
    } catch (error) {
      console.error('Failed to update bio:', error);
    }
  };

  const updateName = async () => {
    if (!profile.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: newName
      });
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update name:', error);
    }
  };

  return (
    <>
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="bg-[#075E54]/85 backdrop-blur-[10px] text-white px-4 py-3 flex items-center justify-between shadow-lg sticky top-0 z-[100] border-b border-white/10"
      >
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            {!isSearchExpanded ? (
              <motion.h1 
                key="title"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-xl font-bold tracking-tight"
              >
                Alpha Chat
              </motion.h1>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end">
          <motion.div 
            initial={false}
            animate={{ width: isSearchExpanded ? '100%' : '40px' }}
            className="relative flex items-center justify-end max-w-md"
          >
            <AnimatePresence>
              {isSearchExpanded && (
                <motion.input
                  autoFocus
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  type="text"
                  placeholder="Search chats, messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-full py-1.5 pl-4 pr-10 text-sm focus:outline-none focus:bg-white/20 transition-all placeholder:text-white/50"
                />
              )}
            </AnimatePresence>
            <button 
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors absolute right-0"
            >
              {isSearchExpanded ? <X size={20} /> : <Search size={22} />}
            </button>
          </motion.div>
          
          <div className="relative ml-2">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                "p-2 rounded-full transition-colors",
                isMenuOpen ? "bg-white/20" : "hover:bg-white/10"
              )}
            >
              <MoreVertical size={22} />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10, x: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10, x: 10 }}
                    className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl py-2 z-50 text-gray-800 border border-gray-100 overflow-hidden"
                  >
                    <button 
                      onClick={() => { setIsProfileModalOpen(true); setIsMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-teal-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg group-hover:bg-teal-100 transition-colors">
                        <User size={18} />
                      </div>
                      <span className="font-medium">Profile</span>
                    </button>
                    <button 
                      onClick={() => { onTabChange('wallet'); setIsMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-teal-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg group-hover:bg-teal-100 transition-colors">
                        <Wallet size={18} />
                      </div>
                      <span className="font-medium">Wallet</span>
                    </button>
                    <button 
                      onClick={() => { setIsSecurityModalOpen(true); setIsMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-teal-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg group-hover:bg-teal-100 transition-colors">
                        <Shield size={18} />
                      </div>
                      <span className="font-medium">Security</span>
                    </button>
                    <button 
                      onClick={() => { setIsSettingsModalOpen(true); setIsMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-teal-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg group-hover:bg-teal-100 transition-colors">
                        <Settings size={18} />
                      </div>
                      <span className="font-medium">Settings</span>
                    </button>
                    <div className="h-px bg-gray-100 mx-4 my-1" />
                    <button 
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-50 text-red-600 transition-colors group relative overflow-hidden"
                    >
                      <div className="p-1.5 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-100 transition-colors">
                        <LogOut size={18} />
                      </div>
                      <span className="font-bold">Logout</span>
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute right-4 w-2 h-2 bg-red-500 rounded-full opacity-50"
                      />
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-[#075E54] p-6 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">Profile</h3>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8">
                <div className="flex flex-col items-center mb-8">
                  <div className="relative group">
                    <img 
                      src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`}
                      className="w-32 h-32 rounded-full border-4 border-[#00A884] shadow-lg object-cover"
                      alt={profile.displayName || ''}
                    />
                    <button className="absolute bottom-0 right-0 p-2 bg-[#00A884] text-white rounded-full shadow-lg hover:bg-[#008F6F] transition-colors">
                      <Camera size={20} />
                    </button>
                  </div>
                  <div className="mt-4 text-center w-full">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      {isEditingName ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="text-2xl font-bold text-gray-800 border-b-2 border-[#00A884] outline-none bg-transparent text-center"
                            autoFocus
                          />
                          <button onClick={updateName} className="text-emerald-500">
                            <Check size={20} />
                          </button>
                          <button onClick={() => setIsEditingName(false)} className="text-red-400">
                            <X size={20} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h4 className="text-2xl font-bold text-gray-800">{profile.displayName}</h4>
                          <button onClick={() => setIsEditingName(true)} className="text-gray-400 hover:text-[#00A884]">
                            <Edit2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-gray-500 font-medium">{profile.phoneNumber || 'No phone number'}</p>
                  </div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500 text-white rounded-lg">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider">Earning Balance</p>
                      <p className="text-xl font-black text-emerald-900">PKR {profile.balance?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setIsProfileModalOpen(false); onTabChange('wallet'); }}
                    className="text-emerald-600 font-bold text-sm hover:underline"
                  >
                    View Wallet
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-[#00A884] uppercase tracking-widest">About / Bio</label>
                      {!isEditingBio ? (
                        <button onClick={() => setIsEditingBio(true)} className="text-gray-400 hover:text-[#00A884]">
                          <Edit2 size={16} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setIsEditingBio(false)} className="text-red-400">
                            <X size={16} />
                          </button>
                          <button onClick={updateBio} className="text-emerald-500">
                            <Check size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditingBio ? (
                      <textarea
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00A884] focus:border-transparent outline-none transition-all resize-none"
                        rows={3}
                        placeholder="Tell us about yourself..."
                      />
                    ) : (
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                        {profile.bio || 'Hey there! I am using Alpha Chat.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-[#075E54] p-6 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">Settings</h3>
                <button onClick={() => setIsSettingsModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Settings size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">Dark Mode</p>
                      <p className="text-xs text-gray-500">Toggle dark theme</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      isDarkMode ? "bg-[#00A884]" : "bg-gray-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      isDarkMode ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Settings size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">Notification Sounds</p>
                      <p className="text-xs text-gray-500">Play sounds for new messages</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      isSoundEnabled ? "bg-[#00A884]" : "bg-gray-300"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      isSoundEnabled ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Security Modal */}
      <AnimatePresence>
        {isSecurityModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-[#075E54] p-6 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">Security</h3>
                <button onClick={() => setIsSecurityModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield size={40} />
                </div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">Account Verified</h4>
                <p className="text-gray-500 mb-6">Your account is protected with end-to-end encryption and real-time security monitoring.</p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-left">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3">Privacy Settings</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Last Seen</span>
                      <span className="text-sm font-bold text-[#00A884]">Everyone</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Profile Photo</span>
                      <span className="text-sm font-bold text-[#00A884]">My Contacts</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Read Receipts</span>
                      <span className="text-sm font-bold text-[#00A884]">Enabled</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
