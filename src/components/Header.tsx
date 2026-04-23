import React, { useState, useEffect } from 'react';
import { Search, MoreVertical, User, Wallet, Shield, Settings, LogOut, X, Camera, Check, Edit2, Key, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { updatePassword, deleteUser } from 'firebase/auth';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';

interface HeaderProps {
  profile: UserProfile;
  onSearch: (query: string) => void;
}

export default function Header({ profile, onSearch }: HeaderProps) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    onSearch(searchQuery);
  }, [searchQuery, onSearch]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newBio, setNewBio] = useState(profile.bio || '');
  const [newName, setNewName] = useState(profile.displayName || '');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleChangePassword = async () => {
    if (!auth.currentUser || !newPassword) return;
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    setIsChangingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      alert('Password updated successfully!');
      setNewPassword('');
    } catch (error: any) {
      console.error('Password update failed:', error);
      if (error.code === 'auth/requires-recent-login') {
        alert('Please log out and log back in to change your password for security reasons.');
      } else {
        alert('Failed to update password: ' + error.message);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    if (!confirm('Are you sure you want to delete your account? This action is permanent and cannot be undone.')) return;
    
    setIsDeletingAccount(true);
    try {
      const uid = auth.currentUser.uid;
      // Delete Firestore data first
      await deleteDoc(doc(db, 'users', uid));
      // Delete Auth account
      await deleteUser(auth.currentUser);
      alert('Account deleted successfully.');
      window.location.href = '/';
    } catch (error: any) {
      console.error('Account deletion failed:', error);
      if (error.code === 'auth/requires-recent-login') {
        alert('Please log out and log back in to delete your account for security reasons.');
      } else {
        alert('Failed to delete account: ' + error.message);
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

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
        className="fixed-header bg-[#700122]/85 backdrop-blur-[10px] text-white px-4 py-3 flex items-center justify-between shadow-lg z-[100] border-b border-white/10"
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
              {isSearchExpanded ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
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
              <MoreVertical className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <div key="menu-wrapper">
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
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-maroon-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-maroon-50 text-[#700122] rounded-lg group-hover:bg-maroon-100 transition-colors">
                        <User size={18} />
                      </div>
                      <span className="font-medium">Profile</span>
                    </button>
                    <button 
                      onClick={() => { navigate('/wallet'); setIsMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-maroon-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-maroon-50 text-[#700122] rounded-lg group-hover:bg-maroon-100 transition-colors">
                        <Wallet size={18} />
                      </div>
                      <span className="font-medium">Wallet</span>
                    </button>
                    <button 
                      onClick={() => { setIsSecurityModalOpen(true); setIsMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-maroon-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-maroon-50 text-[#700122] rounded-lg group-hover:bg-maroon-100 transition-colors">
                        <Shield size={18} />
                      </div>
                      <span className="font-medium">Security</span>
                    </button>
                    <button 
                      onClick={() => { setIsSettingsModalOpen(true); setIsMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-maroon-50 transition-colors group"
                    >
                      <div className="p-1.5 bg-maroon-50 text-[#700122] rounded-lg group-hover:bg-maroon-100 transition-colors">
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
                </div>
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
              <div className="bg-[#700122] p-6 text-white flex items-center justify-between">
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
                      className="w-32 h-32 rounded-full border-4 border-[#A01249] shadow-lg object-cover"
                      alt={profile.displayName || ''}
                    />
                    <button className="absolute bottom-0 right-0 p-2 bg-[#A01249] text-white rounded-full shadow-lg hover:bg-[#8E0E3D] transition-colors">
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
                            className="text-2xl font-bold text-gray-800 border-b-2 border-[#A01249] outline-none bg-transparent text-center"
                            autoFocus
                          />
                          <button onClick={updateName} className="text-[#A01249]">
                            <Check size={20} />
                          </button>
                          <button onClick={() => setIsEditingName(false)} className="text-red-400">
                            <X size={20} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h4 className="text-2xl font-bold text-gray-800">{profile.displayName}</h4>
                          <button onClick={() => setIsEditingName(true)} className="text-gray-400 hover:text-[#A01249]">
                            <Edit2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-gray-500 font-medium">{profile.phoneNumber || 'No phone number'}</p>
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#A01249] text-white rounded-lg">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-red-700 font-bold uppercase tracking-wider">Earning Balance</p>
                      <p className="text-xl font-black text-red-900">PKR {profile.balance?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setIsProfileModalOpen(false); navigate('/wallet'); }}
                    className="text-red-600 font-bold text-sm hover:underline"
                  >
                    View Wallet
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-[#A01249] uppercase tracking-widest">About / Bio</label>
                      {!isEditingBio ? (
                        <button onClick={() => setIsEditingBio(true)} className="text-gray-400 hover:text-[#A01249]">
                          <Edit2 size={16} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setIsEditingBio(false)} className="text-red-400">
                            <X size={16} />
                          </button>
                          <button onClick={updateBio} className="text-[#A01249]">
                            <Check size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditingBio ? (
                      <textarea
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A01249] focus:border-transparent outline-none transition-all resize-none"
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
              <div className="bg-[#700122] p-6 text-white flex items-center justify-between">
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
                      isDarkMode ? "bg-[#A01249]" : "bg-gray-300"
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
                      isSoundEnabled ? "bg-[#A01249]" : "bg-gray-300"
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
              <div className="bg-[#700122] p-6 text-white flex items-center justify-between">
                <h3 className="text-xl font-bold">Security</h3>
                <button onClick={() => setIsSecurityModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-red-100 text-[#700122] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield size={40} />
                </div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">Account Verified</h4>
                <p className="text-gray-500 mb-6">Your account is protected with end-to-end encryption and real-time security monitoring.</p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-left mb-6">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3">Privacy Settings</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Last Seen</span>
                      <span className="text-sm font-bold text-[#A01249]">Everyone</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Profile Photo</span>
                      <span className="text-sm font-bold text-[#A01249]">My Contacts</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Read Receipts</span>
                      <span className="text-sm font-bold text-[#A01249]">Enabled</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Change Password</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#A01249]"
                      />
                      <button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword || !newPassword}
                        className="bg-[#A01249] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#8E0E3D] disabled:opacity-50"
                      >
                        {isChangingPassword ? 'Updating...' : 'Update'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={18} />
                      {isDeletingAccount ? 'Deleting...' : 'Delete Account Permanently'}
                    </button>
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
