import React, { useState, useEffect } from 'react';
import { 
  collection, query, where, onSnapshot, doc, runTransaction, 
  getDocs, updateDoc, setDoc, deleteDoc, serverTimestamp, 
  orderBy, limit, writeBatch, addDoc 
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Withdrawal, UserProfile, AppSettings, GameSettings, Announcement } from '../types';
import { 
  ShieldCheck, CheckCircle, XCircle, Users, Ban, BadgeCheck, 
  Search, Settings, Gamepad2, Wallet, FileText, Activity, 
  Power, Bell, Save, Trash2, Filter, Download, Plus, 
  ChevronRight, LayoutGrid, List, BarChart3, Clock, 
  AlertCircle, Info, CheckCircle2, MoreVertical,
  ShieldAlert, MessageSquare, TrendingUp, Send, Database, Shield,
  Key, Folder, LogOut, Image as ImageIcon
} from 'lucide-react';
import { formatChatDate, cn, getTime, toSafeDate } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';

import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';

type AdminTab = 'users' | 'withdrawals' | 'games' | 'announcements' | 'settings' | 'logs' | 'fraud' | 'support' | 'analytics' | 'build' | 'logo';

interface SupportTicket {
  id?: string;
  userId: string;
  subject: string;
  status: 'open' | 'closed';
  lastMessage: string;
  updatedAt: any;
}

interface ActivityLog {
  id?: string;
  type: string;
  message: string;
  userId?: string;
  timestamp: any;
}

interface RevenueStats {
  date: string;
  totalRevenue: number;
  totalPayouts: number;
}

interface AdminPanelProps {
  onExit?: () => void;
}

export default function AdminPanel({ onExit }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [gameSettings, setGameSettings] = useState<GameSettings[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStats[]>([]);
  const [showGameAds, setShowGameAds] = useState(false);
  const [showAdMobBanner, setShowAdMobBanner] = useState(false);
  const [showSocialAds, setShowSocialAds] = useState(false);
  const [adTimer, setAdTimer] = useState(1.3);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [newSupportMsg, setNewSupportMsg] = useState('');
  const [isBuildModalOpen, setIsBuildModalOpen] = useState(false);
  const [buildFiles, setBuildFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleResetPassword = async (email: string) => {
    const newPassword = prompt(`Enter new password for ${email}:`);
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    
    try {
      // Since we can't directly change another user's password from client SDK,
      // we'll set a flag in their profile that forces them to change it or 
      // we can store it temporarily (less secure but requested "direct adjustment").
      // A better way is to use a "pendingPassword" field that the app checks.
      
      const userToReset = users.find(u => u.email === email);
      if (userToReset) {
        await updateDoc(doc(db, 'users', userToReset.uid), {
          pendingPassword: newPassword,
          mustChangePassword: true
        });
        alert('Password reset request sent. User will be prompted to update on next interaction.');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      alert('Failed to set new password.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user\'s data? This will NOT delete their Auth account but will clear their profile and balance.')) return;
    
    try {
      await deleteDoc(doc(db, 'users', userId));
      alert('User data deleted successfully.');
    } catch (error) {
      console.error('Delete user error:', error);
      alert('Failed to delete user data.');
    }
  };

  const updateGameConfig = async (gameId: string, updates: Partial<GameSettings>) => {
    try {
      await setDoc(doc(db, 'gameSettings', gameId), updates, { merge: true });
    } catch (error) {
      console.error('Game config update error:', error);
    }
  };

  const handleSaveCode = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      // Create backup
      const backupId = `${selectedFile.id}_backup_${Date.now()}`;
      await setDoc(doc(db, 'system_configs_backups', backupId), {
        originalId: selectedFile.id,
        content: selectedFile.content,
        timestamp: serverTimestamp()
      });

      // Update live code
      await updateDoc(doc(db, 'system_configs', selectedFile.id), {
        content: fileContent,
        updatedAt: serverTimestamp()
      });
      alert('Code saved and live!');
    } catch (error) {
      console.error('Save code error:', error);
      alert('Failed to save code.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    // Fetch system configs for Build tab
    const q = query(collection(db, 'system_configs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBuildFiles(files);
      
      // Initialize if empty
      if (snapshot.empty) {
        const initialFiles = [
          { id: 'login_page', name: 'login.json', content: JSON.stringify({ title: 'Welcome to Alpha Chat', subtitle: 'Secure Messaging & Earning', theme: 'dark' }, null, 2), path: 'src/pages/login' },
          { id: 'accounts', name: 'accounts.json', content: JSON.stringify({ allowRegistration: true, requireVerification: false, defaultBalance: 0 }, null, 2), path: 'src/config/accounts' },
          { id: 'ui_theme', name: 'theme.json', content: JSON.stringify({ primaryColor: '#00A884', secondaryColor: '#F0F2F5', darkMode: true }, null, 2), path: 'src/styles/theme' }
        ];
        initialFiles.forEach(f => setDoc(doc(db, 'system_configs', f.id), f));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'system_configs'));
    return () => unsubscribe();
  }, []);

  const tabs: AdminTab[] = ['users', 'analytics', 'withdrawals', 'games', 'announcements', 'support', 'fraud', 'settings', 'logo', 'logs', 'build'];

  const cycleTab = (direction: 'up' | 'down') => {
    const currentIndex = tabs.indexOf(activeTab);
    if (direction === 'down') {
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]);
    } else {
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex]);
    }
  };

  const handleSidebarWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 50) {
      cycleTab(e.deltaY > 0 ? 'down' : 'up');
    }
  };

  useEffect(() => {
    // Initialize Settings if not exists
    const initSettings = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'global');
        let settingsSnap;
        try {
          settingsSnap = await getDocs(query(collection(db, 'settings'), where('__name__', '==', 'global')));
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'settings/global');
          return;
        }
        if (settingsSnap.empty) {
          await setDoc(settingsRef, {
            isMaintenanceMode: false,
            adFrequency: 5,
            globalAnnouncement: "Welcome to Alpha Chat!",
            isWithdrawalsEnabled: true,
            isGamesEnabled: true,
            withdrawalTax: 5,
            rewardMultiplier: 1.0,
            minWithdrawal: 500,
            adEarningRate: 0.5,
            tickerText: "Welcome to Alpha Chat! Earn money while chatting."
          });
        }
      } catch (error) {
        console.error("Error initializing settings:", error);
      }
    };
    initSettings();

    // Real-time listeners
    const unsubW = onSnapshot(query(collection(db, 'withdrawals'), orderBy('timestamp', 'desc')), (snapshot) => {
      setWithdrawals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Withdrawal)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'withdrawals'));

    const unsubU = onSnapshot(query(collection(db, 'users'), orderBy('lastSeen', 'desc')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubS = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) setAppSettings(doc.data() as AppSettings);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/global'));

    const unsubG = onSnapshot(collection(db, 'gameSettings'), (snapshot) => {
      setGameSettings(snapshot.docs.map(doc => ({ ...doc.data() } as GameSettings)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'gameSettings'));

    const unsubA = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')), (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'announcements'));

    const unsubT = onSnapshot(query(collection(db, 'supportTickets'), orderBy('updatedAt', 'desc')), (snapshot) => {
      setSupportTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'supportTickets'));

    const unsubL = onSnapshot(query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(50)), (snapshot) => {
      setActivityLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'activityLogs'));

    const unsubStats = onSnapshot(query(collection(db, 'revenueStats'), orderBy('date', 'desc'), limit(30)), (snapshot) => {
      setRevenueStats(snapshot.docs.map(doc => ({ ...doc.data() } as RevenueStats)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'revenueStats'));

    const unsubAds = onSnapshot(doc(db, 'admin_settings', 'show_game_ads'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setShowGameAds(data.isAdsEnabled === true);
        setShowAdMobBanner(data.isAdMobBannerEnabled === true);
        setShowSocialAds(data.isSocialAdsEnabled === true);
        if (data.adTimer !== undefined) setAdTimer(data.adTimer);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'admin_settings/show_game_ads'));

    return () => {
      unsubW();
      unsubU();
      unsubS();
      unsubG();
      unsubA();
      unsubT();
      unsubL();
      unsubStats();
      unsubAds();
    };
  }, []);

  useEffect(() => {
    if (activeTicket) {
      const q = query(
        collection(db, 'messages'),
        where('receiverId', 'in', [activeTicket.userId, 'admin-support']),
        where('senderId', 'in', [activeTicket.userId, 'admin-support']),
        orderBy('timestamp', 'asc')
      );
      return onSnapshot(q, (snapshot) => {
        setSupportMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'support_messages'));
    }
  }, [activeTicket]);

  const handleSendSupportMessage = async () => {
    if (!newSupportMsg.trim() || !activeTicket) return;
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: 'admin-support',
        receiverId: activeTicket.userId,
        text: newSupportMsg,
        timestamp: serverTimestamp(),
        type: 'support',
        replyTo: null
      });
      await updateDoc(doc(db, 'supportTickets', activeTicket.id!), {
        updatedAt: serverTimestamp(),
        status: 'open'
      });
      setNewSupportMsg('');
    } catch (error) {
      console.error("Error sending support message:", error);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: 'closed',
        updatedAt: serverTimestamp()
      });
      if (activeTicket?.id === ticketId) setActiveTicket(null);
    } catch (error) {
      console.error("Error closing ticket:", error);
    }
  };

  const handleShadowBan = async (userId: string, status: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isShadowBanned: status
      });
    } catch (error) {
      console.error("Error toggling shadow ban:", error);
    }
  };

  const handleApprove = async (withdrawal: Withdrawal) => {
    if (!withdrawal.id) return;
    setLoading(withdrawal.id);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', withdrawal.userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw "User does not exist!";

        const currentBalance = userSnap.data().balance || 0;
        if (currentBalance < withdrawal.amount) throw "Insufficient user balance!";

        // Calculate Tax (Elite Feature)
        const taxRate = appSettings?.withdrawalTax || 0;
        const taxAmount = (withdrawal.amount * taxRate) / 100;
        const netAmount = withdrawal.amount - taxAmount;

        transaction.update(userRef, { balance: currentBalance - withdrawal.amount });
        transaction.update(doc(db, 'withdrawals', withdrawal.id!), { 
          status: 'approved',
          taxAmount,
          netAmount,
          auditLog: {
            ip: '127.0.0.1', // In a real app, get from server
            device: navigator.userAgent
          }
        });
      });
    } catch (error) {
      console.error('Approval error:', error);
      alert(error);
    } finally {
      setLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    if (bulkSelection.length === 0) return;
    setLoading('bulk');
    try {
      for (const id of bulkSelection) {
        const w = withdrawals.find(w => w.id === id);
        if (w && w.status === 'pending') {
          await handleApprove(w);
        }
      }
      setBulkSelection([]);
    } catch (error) {
      console.error('Bulk approval error:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async (withdrawalId: string) => {
    setLoading(withdrawalId);
    try {
      await updateDoc(doc(db, 'withdrawals', withdrawalId), { status: 'rejected' });
    } catch (error) {
      console.error('Rejection error:', error);
    } finally {
      setLoading(null);
    }
  };

  const updateGlobalSetting = async (key: keyof AppSettings, value: any) => {
    try {
      await updateDoc(doc(db, 'settings', 'global'), { [key]: value });
    } catch (error) {
      console.error('Settings update error:', error);
    }
  };

  const toggleGame = async (gameId: string, isEnabled: boolean) => {
    try {
      await setDoc(doc(db, 'gameSettings', gameId), { isEnabled }, { merge: true });
    } catch (error) {
      console.error('Game toggle error:', error);
    }
  };

  const updateGameRate = async (gameId: string, earningRate: number) => {
    try {
      await setDoc(doc(db, 'gameSettings', gameId), { earningRate }, { merge: true });
    } catch (error) {
      console.error('Game rate update error:', error);
    }
  };

  const toggleGameAds = async () => {
    try {
      await setDoc(doc(db, 'admin_settings', 'show_game_ads'), { isAdsEnabled: !showGameAds }, { merge: true });
    } catch (error) {
      console.error('Error toggling game ads:', error);
    }
  };

  const toggleAdMobBanner = async () => {
    try {
      await setDoc(doc(db, 'admin_settings', 'show_game_ads'), { isAdMobBannerEnabled: !showAdMobBanner }, { merge: true });
    } catch (error) {
      console.error('Error toggling admob banner:', error);
    }
  };

  const toggleSocialAds = async () => {
    try {
      await setDoc(doc(db, 'admin_settings', 'show_game_ads'), { isSocialAdsEnabled: !showSocialAds }, { merge: true });
    } catch (error) {
      console.error('Error toggling social ads:', error);
    }
  };

  const updateAdTimer = async (val: number) => {
    try {
      await setDoc(doc(db, 'admin_settings', 'show_game_ads'), { adTimer: val }, { merge: true });
    } catch (error) {
      console.error('Error updating ad timer:', error);
    }
  };

  const addAnnouncement = async (text: string, type: 'info' | 'warning' | 'success') => {
    try {
      await addDoc(collection(db, 'announcements'), {
        text,
        type,
        isActive: true,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Announcement add error:', error);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (error) {
      console.error('Announcement delete error:', error);
    }
  };

  const updateUserBalance = async (uid: string, newBalance: number) => {
    try {
      await updateDoc(doc(db, 'users', uid), { balance: newBalance });
    } catch (error) {
      console.error('Balance update error:', error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phoneNumber?.includes(searchTerm)
  );

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const totalPendingAmount = pendingWithdrawals.reduce((acc, w) => acc + w.amount, 0);
  const totalApprovedToday = withdrawals
    .filter(w => w.status === 'approved' && isToday(toSafeDate(w.timestamp)))
    .reduce((acc, w) => acc + w.amount, 0);

  function isToday(date: Date) {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  return (
    <div className="flex flex-row h-full bg-[#1e1e1e] text-[#cccccc] font-mono overflow-hidden w-full">
      {/* VS Code Style Sidebar */}
      <div 
        onWheel={handleSidebarWheel}
        className="w-14 bg-[#333333] flex flex-col items-center py-4 justify-start space-y-6 border-r border-[#2b2b2b] z-20 touch-none"
      >
        <button 
          onClick={() => setActiveTab('users')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'users' ? "text-white border-l-2 border-[#700122]" : "text-[#858585] hover:text-white")}
          title="Users Explorer"
        >
          <Users size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('withdrawals')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'withdrawals' ? "text-white border-l-2 border-[#700122]" : "text-[#858585] hover:text-white")}
          title="Finance Grid"
        >
          <Wallet size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('games')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'games' ? "text-white border-l-2 border-[#700122]" : "text-[#858585] hover:text-white")}
          title="Game Management"
        >
          <Gamepad2 size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('fraud')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'fraud' ? "text-white border-l-2 border-red-500" : "text-[#858585] hover:text-white")}
          title="Fraud Monitor"
        >
          <ShieldAlert size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('support')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'support' ? "text-white border-l-2 border-emerald-500" : "text-[#858585] hover:text-white")}
          title="Live Support"
        >
          <MessageSquare size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'analytics' ? "text-white border-l-2 border-[#700122]" : "text-[#858585] hover:text-white")}
          title="Analytics"
        >
          <TrendingUp size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('announcements')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'announcements' ? "text-white border-l-2 border-[#700122]" : "text-[#858585] hover:text-white")}
          title="Announcements"
        >
          <Bell size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'settings' ? "text-white border-l-2 border-[#700122]" : "text-[#858585] hover:text-white")}
          title="Global Settings"
        >
          <Settings size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('logo')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'logo' ? "text-white border-l-2 border-[#700122]" : "text-[#858585] hover:text-white")}
          title="App Logo"
        >
          <ImageIcon size={20} />
        </button>
        <button 
          onClick={() => setActiveTab('build')}
          className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'build' ? "text-white border-l-2 border-purple-500" : "text-[#858585] hover:text-white")}
          title="Build System"
        >
          <Folder size={20} />
        </button>
        <div className="mt-auto pb-4 flex flex-col gap-4">
          <button 
            onClick={() => setActiveTab('logs')}
            className={cn("p-2 transition-colors flex flex-col items-center gap-1", activeTab === 'logs' ? "text-white border-l-2 border-[#700122]" : "text-[#858585] hover:text-white")}
            title="System Logs"
          >
            <Activity size={20} />
          </button>
          {onExit && (
            <button 
              onClick={onExit}
              className="p-2 text-red-500 hover:text-red-400 transition-colors flex flex-col items-center gap-1"
              title="Exit Terminal"
            >
              <LogOut size={20} />
              <span className="text-[10px] uppercase font-bold">Exit</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        {/* Header / Terminal Bar */}
        <header className="h-10 bg-[#252526] border-b border-[#2b2b2b] flex items-center justify-between px-4 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#A01249]" />
              alpha_admin_terminal.exe
            </span>
            <div className="h-4 w-px bg-[#333333]"></div>
            <span className="text-[#858585]">Tab: {activeTab.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", appSettings?.isMaintenanceMode ? "bg-red-500 animate-pulse" : "bg-green-500")}></div>
              <span className={appSettings?.isMaintenanceMode ? "text-red-400" : "text-green-400"}>
                {appSettings?.isMaintenanceMode ? "Maintenance Mode" : "System: Online"}
              </span>
            </div>
            <span className="text-[#858585]">{new Date().toLocaleTimeString()}</span>
          </div>
        </header>

        {/* Content Body */}
        <div className="scrollable-content p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'users' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-row justify-between items-center gap-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users size={20} className="text-[#A01249]" />
                    User Command Center
                  </h2>
                  <div className="relative w-72">
                    <input
                      type="text"
                      placeholder="Search by email, name, or phone..."
                      className="w-full bg-[#3c3c3c] border border-[#3c3c3c] focus:border-[#700122] py-1.5 pl-10 pr-4 rounded text-sm text-white outline-none transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2 text-[#858585]" size={16} />
                  </div>
                </div>

                {/* Responsive Grid / Excel Style Table */}
                <div className="bg-[#252526] rounded border border-[#333333] overflow-hidden shadow-2xl">
                  {/* Desktop Table View */}
                  <div className="block overflow-x-auto">
                    <table className="w-full text-xs text-left min-w-[800px]">
                        <thead className="bg-[#37373d] text-[#858585] uppercase tracking-wider border-b border-[#333333]">
                          <tr>
                            <th className="px-4 py-3 font-medium">User Profile</th>
                            <th className="px-4 py-3 font-medium">Level</th>
                            <th className="px-4 py-3 font-medium">Balance (PKR)</th>
                            <th className="px-4 py-3 font-medium">Current Activity</th>
                            <th className="px-4 py-3 font-medium">IP / Device</th>
                            <th className="px-4 py-3 font-medium">Click Speed</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Last Seen</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#333333]">
                          {filteredUsers.map((u) => (
                            <tr key={u.uid} className="hover:bg-[#2a2d2e] transition-colors group">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-8 h-8 rounded border border-[#333333]" />
                                    {u.isOnline && <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#252526]"></div>}
                                  </div>
                                  <div>
                                    <div className="text-white font-medium flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={u.displayName || ''}
                                        onChange={(e) => updateDoc(doc(db, 'users', u.uid), { displayName: e.target.value })}
                                        className="bg-transparent border-b border-transparent hover:border-[#333333] focus:border-[#700122] outline-none text-xs font-bold text-white w-32"
                                      />
                                      {u.isVerified && <BadgeCheck size={14} className="text-[#A01249]" />}
                                    </div>
                                    <div className="text-[#858585] text-[10px]">{u.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                  u.level === 'Gold' ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800/50" :
                                  u.level === 'Silver' ? "bg-gray-400/30 text-gray-300 border border-gray-400/50" :
                                  "bg-orange-900/30 text-orange-400 border border-orange-800/50"
                                )}>
                                  {u.level || 'Bronze'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-green-400">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-[#858585]">Rs.</span>
                                  <input
                                    type="number"
                                    value={u.balance}
                                    onChange={(e) => updateUserBalance(u.uid, parseFloat(e.target.value))}
                                    className="bg-transparent border-b border-transparent hover:border-[#333333] focus:border-blue-500 outline-none text-xs font-bold text-green-400 w-20"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {u.isOnline ? (
                                  <div className="flex items-center gap-2 text-blue-400">
                                    <Activity size={12} className="animate-pulse" />
                                    <span className="text-[10px]">{u.currentGame || 'Browsing Chat'}</span>
                                  </div>
                                ) : (
                                  <span className="text-[#858585] text-[10px]">Idle</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-[10px] text-white font-mono">{u.ipAddress || '0.0.0.0'}</div>
                                <div className="text-[8px] text-[#858585] font-mono truncate w-20">{u.deviceId || 'Unknown'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="w-16 h-1.5 bg-[#333333] rounded-full overflow-hidden">
                                  <div 
                                    className={cn("h-full transition-all", (u.clickSpeed || 0) > 8 ? "bg-red-500" : "bg-[#700122]")}
                                    style={{ width: `${Math.min((u.clickSpeed || 0) * 10, 100)}%` }}
                                  />
                                </div>
                                <div className="text-[8px] text-[#858585] mt-1">{u.clickSpeed || 0} clicks/sec</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                  u.isBanned ? "bg-red-900/30 text-red-400 border border-red-800/50" : "bg-green-900/30 text-green-400 border border-green-800/50"
                                )}>
                                  {u.isBanned ? 'Banned' : 'Active'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[#858585]">{formatChatDate(u.lastSeen)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => handleResetPassword(u.email)}
                                    className="p-1.5 bg-[#3c3c3c] hover:bg-blue-600 text-white rounded transition-colors"
                                    title="Reset Password"
                                  >
                                    <Key size={14} />
                                  </button>
                                  <button 
                                    onClick={() => { setSelectedUser(u); setIsEditModalOpen(true); }}
                                    className="p-1.5 bg-[#3c3c3c] hover:bg-blue-600 text-white rounded transition-colors"
                                    title="Edit Profile"
                                  >
                                    <FileText size={14} />
                                  </button>
                                  <button 
                                    onClick={() => updateDoc(doc(db, 'users', u.uid), { isVerified: !u.isVerified })}
                                    className={cn("p-1.5 rounded transition-colors", u.isVerified ? "bg-blue-600 text-white" : "bg-[#3c3c3c] hover:bg-blue-600 text-white")}
                                    title="Toggle Verification"
                                  >
                                    <BadgeCheck size={14} />
                                  </button>
                                  <button 
                                    onClick={() => updateDoc(doc(db, 'users', u.uid), { isBanned: !u.isBanned })}
                                    className={cn("p-1.5 rounded transition-colors", u.isBanned ? "bg-red-600 text-white" : "bg-[#3c3c3c] hover:bg-red-600 text-white")}
                                    title={u.isBanned ? "Unban User" : "Ban User"}
                                  >
                                    <Ban size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleShadowBan(u.uid, !u.isShadowBanned)}
                                    className={cn("p-1.5 rounded transition-colors", u.isShadowBanned ? "bg-orange-600 text-white" : "bg-[#3c3c3c] hover:bg-orange-600 text-white")}
                                    title={u.isShadowBanned ? "Unshadow User" : "Shadow Ban User"}
                                  >
                                    <ShieldAlert size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(u.uid)}
                                    className="p-1.5 bg-[#3c3c3c] hover:bg-red-600 text-white rounded transition-colors"
                                    title="Delete User Data"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View (Hidden for Desktop View) */}
                  <div className="hidden grid grid-cols-1 gap-4 p-4">
                    {filteredUsers.map((u) => (
                      <div key={u.uid} className="bg-[#333333] p-4 rounded-lg border border-[#444444] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-10 h-10 rounded border border-[#444444]" />
                              {u.isOnline && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#333333]"></div>}
                            </div>
                            <div>
                              <div className="text-white font-bold flex items-center gap-1">
                                {u.displayName}
                                {u.isVerified && <BadgeCheck size={14} className="text-blue-400" />}
                              </div>
                              <div className="text-[#858585] text-[10px]">{u.email}</div>
                            </div>
                          </div>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            u.level === 'Gold' ? "bg-yellow-900/30 text-yellow-400" :
                            u.level === 'Silver' ? "bg-gray-400/30 text-gray-300" :
                            "bg-orange-900/30 text-orange-400"
                          )}>
                            {u.level || 'Bronze'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="bg-[#252526] p-2 rounded">
                            <p className="text-[#858585] uppercase mb-1">Balance</p>
                            <p className="text-green-400 font-bold">Rs. {u.balance}</p>
                          </div>
                          <div className="bg-[#252526] p-2 rounded">
                            <p className="text-[#858585] uppercase mb-1">Status</p>
                            <p className={cn("font-bold", u.isBanned ? "text-red-400" : "text-green-400")}>
                              {u.isBanned ? 'Banned' : 'Active'}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-[#444444]">
                          <div className="text-[10px] text-[#858585]">
                            Last seen: {formatChatDate(u.lastSeen)}
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => { setSelectedUser(u); setIsEditModalOpen(true); }}
                              className="p-2 bg-[#3c3c3c] hover:bg-blue-600 text-white rounded transition-colors"
                            >
                              <FileText size={14} />
                            </button>
                            <button 
                              onClick={() => updateDoc(doc(db, 'users', u.uid), { isBanned: !u.isBanned })}
                              className={cn("p-2 rounded transition-colors", u.isBanned ? "bg-red-600 text-white" : "bg-[#3c3c3c] text-white")}
                            >
                              <Ban size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

          {activeTab === 'fraud' && (
            <motion.div 
              key="fraud"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldAlert size={20} className="text-red-400" />
                Fraud Detection Monitor
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#252526] p-4 rounded border border-[#333333]">
                  <div className="text-[#858585] text-xs mb-1">High Risk (Clicks &gt; 50/s)</div>
                  <div className="text-2xl font-bold text-red-400">{users.filter(u => (u.clickCount || 0) > 50).length}</div>
                </div>
                <div className="bg-[#252526] p-4 rounded border border-[#333333]">
                  <div className="text-[#858585] text-xs mb-1">Shadow Banned</div>
                  <div className="text-2xl font-bold text-orange-400">{users.filter(u => u.isShadowBanned).length}</div>
                </div>
                <div className="bg-[#252526] p-4 rounded border border-[#333333]">
                  <div className="text-[#858585] text-xs mb-1">Potential Multi-Accounts</div>
                  <div className="text-2xl font-bold text-blue-400">0</div>
                </div>
              </div>

              <div className="bg-[#252526] rounded border border-[#333333] overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#37373d] text-[#858585] uppercase tracking-wider border-b border-[#333333]">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">IP Address</th>
                      <th className="px-4 py-3">Device ID</th>
                      <th className="px-4 py-3">Click Speed</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333333]">
                    {users.filter(u => (u.clickCount || 0) > 0 || u.ipAddress).map(u => (
                      <tr key={u.uid} className="hover:bg-[#2a2d2e]">
                        <td className="px-4 py-3 text-white">{u.displayName}</td>
                        <td className="px-4 py-3 font-mono text-[#858585]">{u.ipAddress || 'N/A'}</td>
                        <td className="px-4 py-3 font-mono text-[#858585]">{u.deviceFingerprint?.slice(0, 12)}...</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[#333333] rounded-full overflow-hidden w-24">
                              <div 
                                className={cn("h-full", (u.clickCount || 0) > 50 ? "bg-red-500" : "bg-green-500")}
                                style={{ width: `${Math.min((u.clickCount || 0) * 2, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono">{u.clickCount || 0}/s</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleShadowBan(u.uid, !u.isShadowBanned)}
                            className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase", u.isShadowBanned ? "bg-green-600 text-white" : "bg-orange-600 text-white")}
                          >
                            {u.isShadowBanned ? 'Unshadow' : 'Shadow Ban'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'support' && (
            <motion.div 
              key="support"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-3 gap-6 h-[600px]"
            >
              <div className="bg-[#252526] rounded border border-[#333333] flex flex-col overflow-hidden">
                <div className="p-3 bg-[#37373d] text-[#858585] text-[10px] font-bold uppercase tracking-wider border-b border-[#333333]">
                  Active Tickets
                </div>
                <div className="flex-1 overflow-y-auto">
                  {supportTickets.map(ticket => (
                    <button
                      key={ticket.id}
                      onClick={() => setActiveTicket(ticket)}
                      className={cn(
                        "w-full p-4 text-left border-b border-[#333333] hover:bg-[#2a2d2e] transition-colors",
                        activeTicket?.id === ticket.id ? "bg-[#37373d]" : ""
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-white text-sm font-medium">{ticket.subject}</span>
                        <span className={cn(
                          "text-[8px] px-1.5 py-0.5 rounded font-bold uppercase",
                          ticket.status === 'open' ? "bg-green-900/30 text-green-400 border border-green-800/50" : "bg-[#333333] text-[#858585]"
                        )}>
                          {ticket.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#858585] truncate">{ticket.lastMessage}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2 bg-[#252526] rounded border border-[#333333] flex flex-col overflow-hidden">
                {activeTicket ? (
                  <>
                    <div className="p-4 bg-[#37373d] border-b border-[#333333] flex justify-between items-center">
                      <div>
                        <div className="text-white font-bold">{activeTicket.subject}</div>
                        <div className="text-[10px] text-[#858585]">User: {activeTicket.userId}</div>
                      </div>
                      <button 
                        onClick={() => handleCloseTicket(activeTicket.id!)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold"
                      >
                        Close Ticket
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {supportMessages.map((msg, idx) => (
                        <div key={idx} className={cn("flex", msg.senderId === 'admin-support' ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[80%] p-3 rounded text-xs",
                            msg.senderId === 'admin-support' ? "bg-blue-600 text-white" : "bg-[#3c3c3c] text-[#cccccc]"
                          )}>
                            {msg.text}
                            <div className="text-[8px] opacity-50 mt-1">
                              {toSafeDate(msg.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-[#252526] border-t border-[#333333] flex gap-2">
                      <input
                        type="text"
                        placeholder="Type a reply..."
                        value={newSupportMsg}
                        onChange={(e) => setNewSupportMsg(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendSupportMessage()}
                        className="flex-1 bg-[#3c3c3c] border border-[#3c3c3c] focus:border-blue-500 rounded px-4 py-2 text-xs text-white outline-none"
                      />
                      <button 
                        onClick={handleSendSupportMessage}
                        className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#333333]">
                    <MessageSquare size={48} className="mb-4" />
                    <p className="text-sm">Select a ticket to begin support session</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'build' && (
            <motion.div 
              key="build"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col gap-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database size={20} className="text-purple-400" />
                  Build & System Explorer
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const name = prompt("Enter file name (e.g. config.json):");
                      if (name) {
                        const id = name.replace('.', '_');
                        setDoc(doc(db, 'system_configs', id), { id, name, content: '{}', path: 'src/custom' });
                      }
                    }}
                    className="bg-[#333333] hover:bg-[#444444] text-white px-3 py-1.5 rounded text-xs flex items-center gap-2"
                  >
                    <Plus size={14} /> New File
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-row gap-6 min-h-0">
                {/* File Explorer */}
                <div className="w-64 bg-[#252526] rounded-xl border border-[#333333] overflow-hidden flex flex-col shrink-0">
                  <div className="p-3 bg-[#37373d] border-b border-[#333333] flex items-center gap-2">
                    <FileText size={14} className="text-blue-400" />
                    <span className="text-[10px] uppercase font-bold text-[#858585]">Project Files</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {/* Folder Structure Simulation */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 px-2 py-1 text-[#858585] text-[10px] uppercase font-bold">
                        <ChevronRight size={12} /> Login
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 text-[#858585] text-[10px] uppercase font-bold">
                        <ChevronRight size={12} /> Account
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 text-[#858585] text-[10px] uppercase font-bold">
                        <ChevronRight size={12} /> Games
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 text-[#858585] text-[10px] uppercase font-bold">
                        <ChevronRight size={12} /> Assets
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#333333]">
                      {buildFiles.map(file => (
                        <button
                          key={file.id}
                          onClick={() => {
                            setSelectedFile(file);
                            setFileContent(file.content);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded text-xs flex items-center gap-2 transition-colors",
                            selectedFile?.id === file.id ? "bg-[#37373d] text-white" : "text-[#858585] hover:bg-[#2a2d2e] hover:text-white"
                          )}
                        >
                          <FileText size={14} className={cn(selectedFile?.id === file.id ? "text-blue-400" : "text-[#858585]")} />
                          {file.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Code Editor */}
                <div className="flex-1 bg-[#252526] rounded-xl border border-[#333333] overflow-hidden flex flex-col shadow-2xl">
                  {selectedFile ? (
                    <>
                      <div className="p-3 bg-[#37373d] border-b border-[#333333] flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#858585] font-mono">{selectedFile.path}/</span>
                          <span className="text-xs text-white font-bold">{selectedFile.name}</span>
                        </div>
                        <button 
                          onClick={handleSaveCode}
                          disabled={isSaving}
                          className="bg-[#700122] hover:bg-[#8E0E3D] disabled:opacity-50 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all"
                        >
                          {isSaving ? <Clock size={14} className="animate-spin" /> : <Save size={14} />} 
                          Save & Go Live
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto bg-[#1e1e1e]">
                        <Editor
                          value={fileContent}
                          onValueChange={code => setFileContent(code)}
                          highlight={code => highlight(code, languages.json, 'json')}
                          padding={20}
                          style={{
                            fontFamily: '"Fira code", "Fira Mono", monospace',
                            fontSize: 14,
                            minHeight: '100%',
                            backgroundColor: '#1e1e1e',
                            color: '#d4d4d4'
                          }}
                          className="outline-none"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#858585] space-y-4">
                      <Database size={48} className="opacity-20" />
                      <p className="text-sm">Select a file from the explorer to edit system code</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp size={20} className="text-[#A01249]" />
                Revenue & Performance Analytics
              </h2>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#252526] p-4 rounded border border-[#333333]">
                  <div className="text-[#858585] text-[10px] uppercase font-bold mb-1">Total Revenue</div>
                  <div className="text-xl font-bold text-green-400">Rs. {revenueStats.reduce((acc, curr) => acc + curr.totalRevenue, 0).toFixed(2)}</div>
                </div>
                <div className="bg-[#252526] p-4 rounded border border-[#333333]">
                  <div className="text-[#858585] text-[10px] uppercase font-bold mb-1">Total Payouts</div>
                  <div className="text-xl font-bold text-red-400">Rs. {revenueStats.reduce((acc, curr) => acc + curr.totalPayouts, 0).toFixed(2)}</div>
                </div>
                <div className="bg-[#252526] p-4 rounded border border-[#333333]">
                  <div className="text-[#858585] text-[10px] uppercase font-bold mb-1">Active Users (5m)</div>
                  <div className="text-xl font-bold text-[#A01249]">{users.filter(u => u.lastSeen && (Date.now() - getTime(u.lastSeen) < 300000)).length}</div>
                </div>
                <div className="bg-[#252526] p-4 rounded border border-[#333333]">
                  <div className="text-[#858585] text-[10px] uppercase font-bold mb-1">Net Profit</div>
                  <div className="text-xl font-bold text-yellow-400">Rs. {(revenueStats.reduce((acc, curr) => acc + curr.totalRevenue, 0) - revenueStats.reduce((acc, curr) => acc + curr.totalPayouts, 0)).toFixed(2)}</div>
                </div>
              </div>

              <div className="bg-[#252526] rounded border border-[#333333] p-6 h-[400px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-white">Revenue vs Payouts (Last 30 Days)</h3>
                  <div className="flex gap-4 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
                      <span>Revenue</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-red-500 rounded-sm"></div>
                      <span>Payouts</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex items-end gap-2 pb-8 border-b border-[#333333]">
                  {revenueStats.slice().reverse().map((stat, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative h-full">
                      <div className="flex gap-1 items-end h-full w-full">
                        <div 
                          className="flex-1 bg-green-500/40 hover:bg-green-500 transition-all rounded-t-sm"
                          style={{ height: `${Math.min((stat.totalRevenue / 2000) * 100, 100)}%` }}
                        />
                        <div 
                          className="flex-1 bg-red-500/40 hover:bg-red-500 transition-all rounded-t-sm"
                          style={{ height: `${Math.min((stat.totalPayouts / 2000) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#252526] border border-[#333333] p-2 rounded text-[8px] z-10 whitespace-nowrap shadow-xl">
                        <div className="text-[#858585] mb-1">{stat.date}</div>
                        <div className="text-green-400">Rev: {stat.totalRevenue}</div>
                        <div className="text-red-400">Pay: {stat.totalPayouts}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-[8px] text-[#858585]">
                  <span>30 Days Ago</span>
                  <span>Today</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#252526] rounded border border-[#333333] p-6">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-green-400" />
                    System Health Monitor
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#858585]">Database Latency</span>
                      <span className="text-green-400 font-mono">24ms</span>
                    </div>
                    <div className="w-full bg-[#333333] h-1 rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full w-[15%]"></div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#858585]">Server CPU Load</span>
                      <span className="text-yellow-400 font-mono">32%</span>
                    </div>
                    <div className="w-full bg-[#333333] h-1 rounded-full overflow-hidden">
                      <div className="bg-yellow-500 h-full w-[32%]"></div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#858585]">Memory Usage</span>
                      <span className="text-[#A01249] font-mono">1.2GB / 4GB</span>
                    </div>
                    <div className="w-full bg-[#333333] h-1 rounded-full overflow-hidden">
                      <div className="bg-[#700122] h-full w-[30%]"></div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#858585]">Uptime</span>
                      <span className="text-green-400 font-mono">99.98%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#252526] rounded border border-[#333333] p-6">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Users size={16} className="text-[#A01249]" />
                    User Engagement Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-[#1e1e1e] rounded border border-[#333333]">
                      <div className="text-[10px] text-[#858585] uppercase font-bold mb-1">Total Users</div>
                      <div className="text-lg font-bold text-white">{users.length}</div>
                    </div>
                    <div className="p-3 bg-[#1e1e1e] rounded border border-[#333333]">
                      <div className="text-[10px] text-[#858585] uppercase font-bold mb-1">New Today</div>
                      <div className="text-lg font-bold text-[#A01249]">
                        {users.filter(u => u.createdAt && (Date.now() - getTime(u.createdAt) < 86400000)).length}
                      </div>
                    </div>
                    <div className="p-3 bg-[#1e1e1e] rounded border border-[#333333]">
                      <div className="text-[10px] text-[#858585] uppercase font-bold mb-1">Total Games Played</div>
                      <div className="text-lg font-bold text-purple-400">
                        {users.reduce((acc, u) => acc + (u.totalGamesPlayed || 0), 0)}
                      </div>
                    </div>
                    <div className="p-3 bg-[#1e1e1e] rounded border border-[#333333]">
                      <div className="text-[10px] text-[#858585] uppercase font-bold mb-1">Total Messages</div>
                      <div className="text-lg font-bold text-green-400">
                        {users.reduce((acc, u) => acc + (u.totalMessagesSent || 0), 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

            {activeTab === 'withdrawals' && (
              <motion.div 
                key="withdrawals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-row justify-between items-center gap-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Wallet size={20} className="text-green-400" />
                    Finance Grid
                  </h2>
                  <div className="flex flex-row gap-4 w-auto">
                    {bulkSelection.length > 0 && (
                      <button 
                        onClick={handleBulkApprove}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      >
                        <CheckCircle size={16} />
                        Approve Selected ({bulkSelection.length})
                      </button>
                    )}
                    <div className="bg-[#252526] border border-[#333333] px-4 py-1.5 rounded flex items-center justify-start gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[#858585]">Pending:</span>
                        <span className="text-yellow-400 font-bold">Rs. {totalPendingAmount.toFixed(2)}</span>
                      </div>
                      <div className="w-px h-4 bg-[#333333]"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#858585]">Paid Today:</span>
                        <span className="text-green-400 font-bold">Rs. {totalApprovedToday.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#252526] rounded border border-[#333333] overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto block">
                    <table className="w-full text-xs text-left min-w-[800px]">
                      <thead className="bg-[#37373d] text-[#858585] uppercase tracking-wider border-b border-[#333333]">
                        <tr>
                          <th className="px-4 py-3 w-10">
                            <input 
                              type="checkbox" 
                              onChange={(e) => {
                                if (e.target.checked) setBulkSelection(pendingWithdrawals.map(w => w.id!));
                                else setBulkSelection([]);
                              }}
                              checked={bulkSelection.length === pendingWithdrawals.length && pendingWithdrawals.length > 0}
                            />
                          </th>
                          <th className="px-4 py-3 font-medium">User ID</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Method</th>
                          <th className="px-4 py-3 font-medium">Phone</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#333333]">
                        {withdrawals.map((w) => (
                          <tr key={w.id} className="hover:bg-[#2a2d2e] transition-colors group">
                            <td className="px-4 py-3">
                              {w.status === 'pending' && (
                                <input 
                                  type="checkbox" 
                                  checked={bulkSelection.includes(w.id!)}
                                  onChange={(e) => {
                                    if (e.target.checked) setBulkSelection([...bulkSelection, w.id!]);
                                    else setBulkSelection(bulkSelection.filter(id => id !== w.id));
                                  }}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 text-white font-mono">{w.userId}</td>
                            <td className="px-4 py-3 font-bold text-green-400">Rs. {w.amount.toFixed(2)}</td>
                            <td className="px-4 py-3">{w.paymentMethod}</td>
                            <td className="px-4 py-3 font-mono">{w.phoneNumber}</td>
                            <td className="px-4 py-3 text-[#858585]">{formatChatDate(toSafeDate(w.timestamp))}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                w.status === 'pending' ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800/50" :
                                w.status === 'approved' ? "bg-green-900/30 text-green-400 border border-green-800/50" :
                                "bg-red-900/30 text-red-400 border border-red-800/50"
                              )}>
                                {w.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {w.status === 'pending' && (
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => handleApprove(w)}
                                    disabled={!!loading}
                                    className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleReject(w.id!)}
                                    disabled={!!loading}
                                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View for Withdrawals (Hidden for Desktop View) */}
                  <div className="hidden grid grid-cols-1 gap-4 p-4">
                    {withdrawals.map((w) => (
                      <div key={w.id} className="bg-[#333333] p-4 rounded-lg border border-[#444444] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {w.status === 'pending' && (
                              <input 
                                type="checkbox" 
                                checked={bulkSelection.includes(w.id!)}
                                onChange={(e) => {
                                  if (e.target.checked) setBulkSelection([...bulkSelection, w.id!]);
                                  else setBulkSelection(bulkSelection.filter(id => id !== w.id));
                                }}
                              />
                            )}
                            <span className="text-white font-mono text-xs truncate max-w-[150px]">{w.userId}</span>
                          </div>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            w.status === 'pending' ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800/50" :
                            w.status === 'approved' ? "bg-green-900/30 text-green-400 border border-green-800/50" :
                            "bg-red-900/30 text-red-400 border border-red-800/50"
                          )}>
                            {w.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-[#858585] uppercase text-[10px] font-bold">Amount</p>
                            <p className="text-green-400 font-bold">Rs. {w.amount.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[#858585] uppercase text-[10px] font-bold">Method</p>
                            <p className="text-white">{w.paymentMethod}</p>
                          </div>
                          <div>
                            <p className="text-[#858585] uppercase text-[10px] font-bold">Phone</p>
                            <p className="text-white font-mono">{w.phoneNumber}</p>
                          </div>
                          <div>
                            <p className="text-[#858585] uppercase text-[10px] font-bold">Date</p>
                            <p className="text-[#858585]">{formatChatDate(toSafeDate(w.timestamp))}</p>
                          </div>
                        </div>
                        {w.status === 'pending' && (
                          <div className="flex gap-2 pt-2">
                            <button 
                              onClick={() => handleApprove(w)}
                              disabled={!!loading}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                              <CheckCircle size={14} /> Approve
                            </button>
                            <button 
                              onClick={() => handleReject(w.id!)}
                              disabled={!!loading}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'games' && (
              <motion.div 
                key="games"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Gamepad2 size={20} className="text-orange-400" />
                    Game Management
                  </h2>
                  <div className="flex gap-2">
                    <div className="bg-[#252526] border border-[#333333] rounded-lg p-1 flex items-center gap-2">
                      <span className="text-[10px] text-[#858585] uppercase font-bold px-2">Bulk Reward:</span>
                      <input 
                        type="number" 
                        id="bulk-reward-input"
                        placeholder="Rate"
                        className="w-16 bg-[#1e1e1e] border border-[#333333] rounded px-2 py-1 text-xs text-white outline-none"
                      />
                      <button 
                        onClick={async () => {
                          const input = document.getElementById('bulk-reward-input') as HTMLInputElement;
                          const rate = parseFloat(input.value);
                          if (!isNaN(rate)) {
                            setLoading('bulk-games');
                            try {
                              const batch = writeBatch(db);
                              gameSettings.forEach(game => {
                                batch.update(doc(db, 'gameSettings', game.id), { earningRate: rate });
                              });
                              await batch.commit();
                              input.value = '';
                            } catch (error) {
                              console.error("Bulk update error:", error);
                            } finally {
                              setLoading(null);
                            }
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-[10px] font-bold transition-all"
                      >
                        Apply All
                      </button>
                    </div>
                    <button 
                      onClick={() => updateGlobalSetting('isGamesEnabled', !appSettings?.isGamesEnabled)}
                      className={cn(
                        "px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2 transition-all",
                        appSettings?.isGamesEnabled ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
                      )}
                    >
                      <Power size={16} />
                      {appSettings?.isGamesEnabled ? "Games: Enabled" : "Games: Disabled"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {gameSettings.map((game) => (
                    <div key={game.id} className="bg-[#252526] rounded-xl border border-[#333333] p-6 space-y-4 shadow-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-white">{game.name}</h3>
                          <p className="text-[10px] text-[#858585] uppercase font-bold">ID: {game.id}</p>
                        </div>
                        <button 
                          onClick={() => toggleGame(game.id, !game.isEnabled)}
                          className={cn(
                            "p-2 rounded-full transition-all",
                            game.isEnabled ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
                          )}
                        >
                          <Power size={18} />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] text-[#858585] uppercase font-bold mb-1">Reward Price (Pts)</label>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => updateGameRate(game.id, Math.max(0, game.earningRate - 0.1))}
                              className="w-8 h-8 rounded bg-[#333333] text-white flex items-center justify-center hover:bg-[#444444]"
                            >
                              -
                            </button>
                            <input 
                              type="number" 
                              className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none text-center"
                              value={game.earningRate}
                              onChange={(e) => updateGameRate(game.id, parseFloat(e.target.value))}
                            />
                            <button 
                              onClick={() => updateGameRate(game.id, game.earningRate + 0.1)}
                              className="w-8 h-8 rounded bg-[#333333] text-white flex items-center justify-center hover:bg-[#444444]"
                            >
                              +
                            </button>
                            <span className="text-xs text-[#858585]">/win</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#858585] uppercase font-bold mb-1">Daily Play Limit</label>
                          <input 
                            type="number" 
                            className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                            value={game.dailyLimit}
                            onChange={(e) => setDoc(doc(db, 'gameSettings', game.id), { dailyLimit: parseInt(e.target.value) }, { merge: true })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#858585] uppercase font-bold mb-1">Entry Fee (PKR)</label>
                          <input 
                            type="number" 
                            className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                            value={game.price || 0}
                            onChange={(e) => setDoc(doc(db, 'gameSettings', game.id), { price: parseFloat(e.target.value) }, { merge: true })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'announcements' && (
              <motion.div 
                key="announcements"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Bell size={20} className="text-yellow-400" />
                    Global Announcements
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Word Style Editor */}
                  <div className="bg-[#252526] rounded-xl border border-[#333333] overflow-hidden shadow-2xl flex flex-col h-[400px]">
                    <div className="bg-[#37373d] p-3 border-b border-[#333333] flex items-center gap-4">
                      <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-[10px] text-[#858585] uppercase font-bold">New Announcement Editor</span>
                    </div>
                    <div className="flex-1 p-6 flex flex-col">
                      <textarea 
                        id="announcement-text"
                        placeholder="Type your announcement here..."
                        className="flex-1 bg-transparent text-white text-lg font-serif resize-none outline-none leading-relaxed"
                      ></textarea>
                      <div className="mt-6 flex justify-between items-center">
                        <div className="flex gap-2">
                          <select id="announcement-type" className="bg-[#3c3c3c] border border-[#333333] text-xs text-white rounded px-3 py-1.5 outline-none">
                            <option value="info">Info (Blue)</option>
                            <option value="warning">Warning (Yellow)</option>
                            <option value="success">Success (Green)</option>
                          </select>
                        </div>
                        <button 
                          onClick={() => {
                            const text = (document.getElementById('announcement-text') as HTMLTextAreaElement).value;
                            const type = (document.getElementById('announcement-type') as HTMLSelectElement).value as any;
                            if (text) {
                              addAnnouncement(text, type);
                              (document.getElementById('announcement-text') as HTMLTextAreaElement).value = '';
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"
                        >
                          <Plus size={18} />
                          Publish
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active Announcements List */}
                  <div className="space-y-6">
                    <div className="bg-[#252526] rounded-xl border border-[#333333] p-6 space-y-4 shadow-lg">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Send size={16} className="text-blue-400" />
                        Direct User Notification
                      </h3>
                      <div className="space-y-3">
                        <input 
                          id="notif-user-id"
                          type="text" 
                          placeholder="User ID (UID)"
                          className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-xs text-white outline-none"
                        />
                        <textarea 
                          id="notif-message"
                          placeholder="Type your private message..."
                          className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-xs text-white outline-none h-20 resize-none"
                        ></textarea>
                        <button 
                          onClick={async () => {
                            const uid = (document.getElementById('notif-user-id') as HTMLInputElement).value;
                            const msg = (document.getElementById('notif-message') as HTMLTextAreaElement).value;
                            if (uid && msg) {
                              await addDoc(collection(db, 'notifications'), {
                                userId: uid,
                                message: msg,
                                type: 'admin_direct',
                                read: false,
                                timestamp: serverTimestamp()
                              });
                              alert('Notification sent!');
                              (document.getElementById('notif-user-id') as HTMLInputElement).value = '';
                              (document.getElementById('notif-message') as HTMLTextAreaElement).value = '';
                            }
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-xs transition-all"
                        >
                          Send Private Notification
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xs text-[#858585] uppercase font-bold tracking-widest">Active Tickers</h3>
                      <div className="space-y-3">
                        {announcements.map((a) => (
                          <div key={a.id} className={cn(
                            "p-4 rounded-xl border flex justify-between items-start group relative overflow-hidden",
                            a.type === 'info' ? "bg-blue-900/20 border-blue-800/50 text-blue-400" :
                            a.type === 'warning' ? "bg-yellow-900/20 border-yellow-800/50 text-yellow-400" :
                            "bg-green-900/20 border-green-800/50 text-green-400"
                          )}>
                            <div className="flex gap-3">
                              {a.type === 'info' ? <Info size={18} /> :
                               a.type === 'warning' ? <AlertCircle size={18} /> :
                               <CheckCircle2 size={18} />}
                              <p className="text-sm">{a.text}</p>
                            </div>
                            <button 
                              onClick={() => deleteAnnouncement(a.id!)}
                              className="text-[#858585] hover:text-red-500 transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl space-y-8 relative"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings size={20} className="text-gray-400" />
                    Global Configuration
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="p-2 bg-[#333333] text-white rounded-full hover:bg-[#444444] transition-all"
                      title="Scroll to Top"
                    >
                      <Clock size={16} className="rotate-180" />
                    </button>
                    <button 
                      onClick={() => {
                        const el = document.getElementById('bottom-settings');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="p-2 bg-[#333333] text-white rounded-full hover:bg-[#444444] transition-all"
                      title="Scroll to Bottom"
                    >
                      <Clock size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6 bg-[#252526] p-8 rounded-2xl border border-[#333333] shadow-2xl">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium">AdMob Rewarded Ads</h4>
                        <p className="text-xs text-[#858585]">Enable/Disable Google AdMob rewarded video ads</p>
                      </div>
                      <button 
                        onClick={() => updateGlobalSetting('isAdMobEnabled', !appSettings?.isAdMobEnabled)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          appSettings?.isAdMobEnabled ? "bg-yellow-600" : "bg-[#3c3c3c]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          appSettings?.isAdMobEnabled ? "right-1" : "left-1"
                        )}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium">AdMob Banner Ads</h4>
                        <p className="text-xs text-[#858585]">Show 300x250 AdMob banner ads in game modals</p>
                      </div>
                      <button 
                        onClick={toggleAdMobBanner}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          showAdMobBanner ? "bg-orange-600" : "bg-[#3c3c3c]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          showAdMobBanner ? "right-1" : "left-1"
                        )}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium">Game Modal Ads (Adsterra)</h4>
                        <p className="text-xs text-[#858585]">Show 300x250 banner ads in game modals</p>
                      </div>
                      <button 
                        onClick={toggleGameAds}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          showGameAds ? "bg-blue-600" : "bg-[#3c3c3c]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          showGameAds ? "right-1" : "left-1"
                        )}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium">Game Social Ads (Ghost Script)</h4>
                        <p className="text-xs text-[#858585]">Enable/Disable GameAdController's social script</p>
                      </div>
                      <button 
                        onClick={toggleSocialAds}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          showSocialAds ? "bg-purple-600" : "bg-[#3c3c3c]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          showSocialAds ? "right-1" : "left-1"
                        )}></div>
                      </button>
                    </div>

                    <div className="pt-6 border-t border-[#333333]">
                      <h4 className="text-white font-medium mb-4">Push Notifications</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-[#858585] block mb-2 uppercase tracking-widest font-bold">FCM VAPID Key</label>
                          <input 
                            type="text"
                            value={appSettings?.vapidKey || ''}
                            onChange={(e) => updateGlobalSetting('vapidKey', e.target.value)}
                            placeholder="Enter your VAPID key from Firebase Console"
                            className="w-full bg-[#111B21] border border-[#333333] focus:border-blue-500 rounded-xl py-3 px-4 text-white text-sm outline-none transition-all"
                          />
                          <p className="text-[10px] text-[#858585] mt-2 leading-relaxed">
                            Required for push notifications. Get this from: <br />
                            <span className="text-blue-400">Firebase Console &gt; Project Settings &gt; Cloud Messaging &gt; Web configuration</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {showGameAds && (
                      <div className="flex flex-col gap-4 bg-[#1e1e1e] p-6 rounded-xl border border-[#333333]">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-white text-sm font-medium">Ad Timer (Seconds)</h5>
                            <p className="text-[10px] text-[#858585]">How long the ad stays visible (0-30s)</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => updateAdTimer(Math.max(0.1, adTimer - 0.1))}
                              className="w-8 h-8 rounded-lg bg-[#333333] text-white flex items-center justify-center hover:bg-[#444444] transition-colors"
                            >
                              -
                            </button>
                            <span className="text-blue-500 font-bold min-w-[50px] text-center text-lg">
                              {adTimer.toFixed(1)}s
                            </span>
                            <button 
                              onClick={() => updateAdTimer(Math.min(30, adTimer + 0.1))}
                              className="w-8 h-8 rounded-lg bg-[#333333] text-white flex items-center justify-center hover:bg-[#444444] transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {[1.3, 5, 10, 15].map((val) => (
                            <button
                              key={val}
                              onClick={() => updateAdTimer(val)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                adTimer === val 
                                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                                  : "bg-[#333333] text-[#858585] hover:bg-[#444444] hover:text-white"
                              )}
                            >
                              {val}s {val === 1.3 && "(Recommended)"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Maintenance Mode</h4>
                      <p className="text-xs text-[#858585]">Disable all app features for users</p>
                    </div>
                    <button 
                      onClick={() => updateGlobalSetting('isMaintenanceMode', !appSettings?.isMaintenanceMode)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        appSettings?.isMaintenanceMode ? "bg-red-600" : "bg-[#3c3c3c]"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        appSettings?.isMaintenanceMode ? "right-1" : "left-1"
                      )}></div>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Withdrawals Global Switch</h4>
                      <p className="text-xs text-[#858585]">Enable or disable withdrawal requests</p>
                    </div>
                    <button 
                      onClick={() => updateGlobalSetting('isWithdrawalsEnabled', !appSettings?.isWithdrawalsEnabled)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        appSettings?.isWithdrawalsEnabled ? "bg-green-600" : "bg-[#3c3c3c]"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        appSettings?.isWithdrawalsEnabled ? "right-1" : "left-1"
                      )}></div>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h4 className="text-white font-medium">Global Reward Multiplier</h4>
                      <p className="text-xs text-[#858585]">Multiply all earnings (0.1x to 5.0x)</p>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="5" 
                        step="0.1"
                        className="w-full h-1.5 bg-[#3c3c3c] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        value={appSettings?.rewardMultiplier || 1}
                        onChange={(e) => updateGlobalSetting('rewardMultiplier', parseFloat(e.target.value))}
                      />
                      <div className="flex justify-between text-[10px] text-[#858585] font-bold">
                        <span>0.1x</span>
                        <span className="text-blue-400">{appSettings?.rewardMultiplier || 1}x</span>
                        <span>5.0x</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-white font-medium">Min Withdrawal (PKR)</h4>
                      <p className="text-xs text-[#858585]">Minimum balance required to withdraw</p>
                      <input 
                        type="number" 
                        className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                        value={appSettings?.minWithdrawal || 500}
                        onChange={(e) => updateGlobalSetting('minWithdrawal', parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-white font-medium">Ad Earning Rate (PKR)</h4>
                    <p className="text-xs text-[#858585]">Amount earned per video ad watched</p>
                    <input 
                      type="number" 
                      step="0.1"
                      className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                      value={appSettings?.adEarningRate || 1.5}
                      onChange={(e) => updateGlobalSetting('adEarningRate', parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-white font-medium">Chat Reward Amount (PKR)</h4>
                    <p className="text-xs text-[#858585]">Amount earned per message sent (10s cooldown)</p>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                      value={appSettings?.chatRewardAmount || 0.1}
                      onChange={(e) => updateGlobalSetting('chatRewardAmount', parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-white font-medium">Withdrawal Tax (%)</h4>
                    <p className="text-xs text-[#858585]">Service fee automatically deducted from withdrawals</p>
                    <input 
                      type="number" 
                      className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                      value={appSettings?.withdrawalTax || 0}
                      onChange={(e) => updateGlobalSetting('withdrawalTax', parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="pt-6 border-t border-[#333333] space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Shield size={20} className="text-purple-400" />
                      Alpha AI Bot Configuration
                    </h3>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium">Auto-Reply Bot</h4>
                        <p className="text-xs text-[#858585]">Enable/Disable automated chat responses</p>
                      </div>
                      <button 
                        onClick={() => updateGlobalSetting('botAutoReplyEnabled', !appSettings?.botAutoReplyEnabled)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          appSettings?.botAutoReplyEnabled ? "bg-purple-600" : "bg-[#3c3c3c]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          appSettings?.botAutoReplyEnabled ? "right-1" : "left-1"
                        )}></div>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h4 className="text-white font-medium">Bot Display Name</h4>
                        <input 
                          type="text" 
                          className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                          value={appSettings?.botName || 'Alpha Bot'}
                          onChange={(e) => updateGlobalSetting('botName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-white font-medium">Welcome Message</h4>
                        <input 
                          type="text" 
                          className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                          value={appSettings?.botWelcomeMessage || 'Hello! How can I help you today?'}
                          onChange={(e) => updateGlobalSetting('botWelcomeMessage', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-900/20 border border-blue-800/50 rounded-xl">
                    <div>
                      <h4 className="text-blue-400 font-bold">Database Backup</h4>
                      <p className="text-[10px] text-blue-400/70">Create a full snapshot of all collections</p>
                    </div>
                    <button 
                      onClick={() => alert('Backup started... Check logs for progress.')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2"
                    >
                      <Database size={14} />
                      One-Click Backup
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Jackpot Hour (Double Earnings)</h4>
                      <p className="text-xs text-[#858585]">Double all game rewards for 1 hour</p>
                    </div>
                    <button 
                      onClick={() => {
                        const isJackpot = !appSettings?.isJackpotHour;
                        const endTime = isJackpot ? new Date(Date.now() + 3600000).toISOString() : null;
                        updateDoc(doc(db, 'settings', 'global'), { 
                          isJackpotHour: isJackpot,
                          jackpotEndTime: endTime
                        });
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        appSettings?.isJackpotHour ? "bg-orange-600" : "bg-[#3c3c3c]"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        appSettings?.isJackpotHour ? "right-1" : "left-1"
                      )}></div>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-white font-medium">System Ticker Messages</h4>
                    <p className="text-xs text-[#858585]">Messages that scroll at the very top of the app</p>
                    <div className="flex gap-2">
                      <input 
                        id="ticker-input"
                        type="text" 
                        placeholder="Add new ticker message..."
                        className="flex-1 bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                      />
                      <button 
                        onClick={() => {
                          const input = document.getElementById('ticker-input') as HTMLInputElement;
                          if (input.value) {
                            const newMessages = [...(appSettings?.tickerMessages || []), input.value];
                            updateGlobalSetting('tickerMessages', newMessages);
                            input.value = '';
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-xs font-bold"
                      >
                        Add
                      </button>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {(appSettings?.tickerMessages || []).map((msg, i) => (
                        <div key={i} className="flex justify-between items-center bg-[#1e1e1e] p-2 rounded border border-[#333333] text-xs">
                          <span>{msg}</span>
                          <button 
                            onClick={() => {
                              const newMessages = appSettings?.tickerMessages.filter((_, index) => index !== i);
                              updateGlobalSetting('tickerMessages', newMessages);
                            }}
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-white font-medium">Ad Frequency</h4>
                    <p className="text-xs text-[#858585] mb-2">Number of ads shown to users per day</p>
                    <input 
                      type="range" 
                      min="0" 
                      max="50" 
                      className="w-full h-1.5 bg-[#3c3c3c] rounded-lg appearance-none cursor-pointer accent-blue-500"
                      value={appSettings?.adFrequency || 0}
                      onChange={(e) => updateGlobalSetting('adFrequency', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] text-[#858585] font-bold">
                      <span>0 (Disabled)</span>
                      <span>Current: {appSettings?.adFrequency}</span>
                      <span>50 (Max)</span>
                    </div>
                  </div>

                  <div id="bottom-settings" className="pt-4 border-t border-[#333333]">
                    <p className="text-[10px] text-[#858585] text-center italic">
                      Swipe up/down on the sidebar to quickly switch between admin tabs.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'logo' && (
              <motion.div 
                key="logo"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex flex-row justify-between items-center bg-[#252526] p-6 rounded-xl border border-[#333333]">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <ImageIcon size={20} className="text-blue-400" />
                      App Logo Management
                    </h2>
                    <p className="text-sm text-[#858585] mt-1">This logo will be displayed on the loading screen, header, and login page.</p>
                  </div>
                </div>

                <div className="bg-[#252526] p-8 rounded-xl border border-[#333333] flex flex-col items-center gap-8">
                  <div className="relative group">
                    <div className="w-48 h-48 rounded-full bg-[#1e1e1e] border-4 border-[#333333] overflow-hidden flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105">
                      <img 
                        src={appSettings?.appLogoUrl || 'https://storage.googleapis.com/test-media-objects/643ljz7fuma5cdqt7xpc5p/75971609428/7f8a7065-27a3-4903-8898-d142b655da03.png'} 
                        className="w-full h-full object-cover"
                        alt="Current Logo"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                       <ImageIcon size={48} className="text-white animate-pulse" />
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                    <label className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#700122] hover:bg-[#8b012b] text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer group active:scale-95">
                      <Plus size={24} />
                      <span className="text-lg">Upload New Logo</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 800000) {
                              alert('File is too large. Please select an image under 800KB.');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              const base64 = event.target?.result as string;
                              try {
                                await updateDoc(doc(db, 'settings', 'global'), { appLogoUrl: base64 });
                                alert('Logo updated successfully across all systems!');
                              } catch (err) {
                                console.error('Logo update failed:', err);
                                alert('Failed to update logo. Please try again.');
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    <p className="text-[10px] text-[#858585] text-center italic">
                      Recommended size: 512x512px. Transparent PNG or High-res JPG.<br />
                      Max file size: 800KB.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-900/10 border border-blue-800/30 p-6 rounded-xl space-y-3">
                  <h4 className="text-blue-400 font-bold flex items-center gap-2">
                    <Info size={16} />
                    Dynamic Update System
                  </h4>
                  <p className="text-xs text-[#858585] leading-relaxed">
                    Once you upload a new logo, our <strong>Real-time State Sync</strong> system automatically pushes the change to all connected users. No page refresh is required for the changes to take effect in the header and home screen empty states.
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'logs' && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Activity size={20} className="text-purple-400" />
                    System Logs
                  </h2>
                  <button 
                    onClick={async () => {
                      if (confirm('Are you sure you want to clear all system logs?')) {
                        const batch = writeBatch(db);
                        activityLogs.forEach(log => batch.delete(doc(db, 'activityLogs', log.id!)));
                        await batch.commit();
                      }
                    }}
                    className="text-red-500 hover:text-red-400 text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Clear Logs
                  </button>
                </div>
                <div className="bg-[#1e1e1e] border border-[#333333] rounded p-4 font-mono text-xs h-[500px] overflow-auto space-y-1 custom-scrollbar">
                  <div className="text-green-400">[SYSTEM] Initializing Alpha Admin Terminal...</div>
                  <div className="text-green-400">[SYSTEM] Connection established with Firestore.</div>
                  <div className="text-blue-400">[AUTH] Admin user authenticated: {new Date().toISOString()}</div>
                  {activityLogs.map((log) => (
                    <div key={log.id} className="group hover:bg-[#2a2d2e] py-0.5 px-1 rounded transition-colors">
                      <span className="text-[#858585]">[{formatChatDate(log.timestamp)}]</span>{' '}
                      <span className="text-blue-400">[{log.userName || 'System'}]</span>{' '}
                      <span className="text-white">{log.action || log.message}</span>
                    </div>
                  ))}
                  {activityLogs.length === 0 && (
                    <div className="text-[#858585] italic py-4 text-center">No activity logs found.</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Activity Terminal Footer */}
        <div className="bg-[#007acc] h-6 flex flex-row items-center px-4 justify-between text-[10px] text-white shrink-0 overflow-x-auto custom-scrollbar scrollbar-hide whitespace-nowrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Activity size={12} />
              <span>Live Activity Terminal</span>
            </div>
            <div className="flex items-center gap-1 text-blue-100">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span>System Online</span>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="flex items-center gap-1">
              <Shield size={12} />
              <span>Fraud Protection: Active</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp size={12} />
              <span>Revenue: Rs. {revenueStats[0]?.totalRevenue || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* User Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#252526] w-full max-w-md rounded-2xl border border-[#333333] shadow-2xl overflow-hidden"
            >
              <div className="bg-[#37373d] p-4 border-b border-[#333333] flex justify-between items-center">
                <h3 className="text-white font-bold">Edit User: {selectedUser.displayName}</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-[#858585] hover:text-white">
                  <XCircle size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <img src={selectedUser.photoURL || `https://ui-avatars.com/api/?name=${selectedUser.displayName}`} className="w-16 h-16 rounded-xl border border-[#333333]" referrerPolicy="no-referrer" />
                  <div>
                    <div className="text-white font-bold">{selectedUser.displayName}</div>
                    <div className="text-xs text-[#858585]">{selectedUser.email}</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-[#858585] uppercase font-bold mb-1">Display Name</label>
                    <input 
                      type="text" 
                      id="edit-name"
                      className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-2 text-white outline-none"
                      defaultValue={selectedUser.displayName}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#858585] uppercase font-bold mb-1">Manual Balance Adjustment</label>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-bold">Rs.</span>
                      <input 
                        type="number" 
                        className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-2 text-white outline-none"
                        defaultValue={selectedUser.balance}
                        id="edit-balance"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#858585] uppercase font-bold mb-1">User Level</label>
                    <select 
                      id="edit-level"
                      className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-2 text-white outline-none"
                      defaultValue={selectedUser.level || 'Bronze'}
                    >
                      <option value="Bronze">Bronze (Standard)</option>
                      <option value="Silver">Silver (2x Earning)</option>
                      <option value="Gold">Gold (3x Earning)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#858585] uppercase font-bold mb-1">Badges (Comma separated)</label>
                    <input 
                      type="text" 
                      id="edit-badges"
                      className="w-full bg-[#1e1e1e] border border-[#333333] focus:border-blue-500 rounded px-3 py-2 text-white outline-none"
                      defaultValue={(selectedUser.badges || []).join(', ')}
                      placeholder="VIP, Pro, OG"
                    />
                  </div>
                  <div>
                    <button 
                      onClick={async () => {
                        try {
                          await sendPasswordResetEmail(auth, selectedUser.email);
                          alert('Password reset email sent to ' + selectedUser.email);
                        } catch (error) {
                          console.error('Error sending reset email:', error);
                          alert('Failed to send reset email');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-800/50 font-bold py-2 rounded-lg transition-all"
                    >
                      <Key size={14} />
                      Send Password Reset Email
                    </button>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        const newName = (document.getElementById('edit-name') as HTMLInputElement).value;
                        const newBalance = parseFloat((document.getElementById('edit-balance') as HTMLInputElement).value);
                        const newLevel = (document.getElementById('edit-level') as HTMLSelectElement).value;
                        const newBadges = (document.getElementById('edit-badges') as HTMLInputElement).value.split(',').map(b => b.trim()).filter(b => b);
                        updateDoc(doc(db, 'users', selectedUser.uid), { 
                          displayName: newName,
                          balance: newBalance,
                          level: newLevel,
                          badges: newBadges
                        });
                        setIsEditModalOpen(false);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-all"
                    >
                      Save Changes
                    </button>
                    <button 
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white font-bold py-2 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
