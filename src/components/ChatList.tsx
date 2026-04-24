import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDocs, or, orderBy, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Circle, MoreVertical, Filter, BadgeCheck } from 'lucide-react';
import { cn } from '../utils';

const ChatSkeleton = () => (
  <div className="flex items-center p-3 border-b border-[#F5F6F6] animate-pulse">
    <div className="w-12 h-12 rounded-full bg-gray-200 mr-3" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  </div>
);

interface ChatListProps {
  onSelectChat: (chat: UserProfile) => void;
  selectedChat: UserProfile | null;
  searchQuery?: string;
}

export default function ChatList({ onSelectChat, selectedChat, searchQuery = '' }: ChatListProps) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(false);

  const filters = ['All', 'Unread', 'Favorites', 'Groups'];

  // Sync internal search with prop search from header
  useEffect(() => {
    if (searchQuery !== undefined) {
      setSearchTerm(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch active conversations
    const q = query(
      collection(db, 'messages'),
      or(
        where('senderId', '==', auth.currentUser.uid),
        where('receiverId', '==', auth.currentUser.uid)
      ),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setIsLoading(true);
      const activeUserIds = new Set<string>();
      snapshot.docs.forEach(async (d) => {
        const data = d.data();
        if (data.senderId !== auth.currentUser?.uid) activeUserIds.add(data.senderId);
        if (data.receiverId !== auth.currentUser?.uid) activeUserIds.add(data.receiverId);

        // Mark messages as delivered (Read Receipts Logic)
        if (data.receiverId === auth.currentUser?.uid && data.status === 'sent') {
          try {
            await updateDoc(d.ref, { status: 'delivered' });
          } catch (e) {
            console.error('Failed to update delivery status:', e);
          }
        }
      });

      if (activeUserIds.size === 0) {
        setUsers([]);
        return;
      }

      // Fetch user profiles for active conversations
      const userQueries = Array.from(activeUserIds).map(uid => getDocs(query(collection(db, 'users'), where('__name__', '==', uid))));
      const userSnaps = await Promise.all(userQueries);
      const activeUsers = userSnaps.flatMap(snap => snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      
      setUsers(activeUsers);
      setIsLoading(false);
    }, (error) => {
      setIsLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Search by exact email or display name
      const q = query(
        collection(db, 'users'),
        or(
          where('email', '==', searchTerm.trim()),
          where('displayName', '==', searchTerm.trim())
        )
      );
      
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== auth.currentUser?.uid);
      
      const uniqueResults = Array.from(new Map(results.map(u => [u.uid, u])).values());
      setSearchResults(uniqueResults);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setIsLoading(false);
    }
  };

  const displayedUsers = searchTerm 
    ? (searchResults.length > 0 ? searchResults : users.filter(u => 
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
      ))
    : users;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-5 py-4 bg-white flex items-center justify-between border-b border-[#F5F6F6] sticky top-0 z-30">
        <h2 className="text-2xl font-bold text-[#111B21]">Chats</h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-full shadow-lg hover:bg-[#128C7E] transition-all duration-300 font-bold text-sm tracking-wide group"
        >
          <UserPlus size={18} className="group-hover:rotate-12 transition-transform" />
          <span>New Chat</span>
        </motion.button>
      </div>

      <div className="px-4 py-2 bg-white flex gap-2 overflow-x-auto scrollbar-hide sticky top-[73px] z-20">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              activeFilter === filter 
                ? "bg-[#D9FDD3] text-[#008069]" 
                : "bg-[#F0F2F5] text-[#54656F] hover:bg-[#E9EDEF]"
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="px-4 pb-3 bg-white sticky top-[121px] z-20">
        <form onSubmit={handleSearch} className="relative group">
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-[#F0F2F5] py-2 pl-12 pr-4 rounded-full text-sm focus:outline-none focus:bg-white transition-all border border-transparent shadow-sm placeholder:text-[#8696A0] text-[#111B21]"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value) setSearchResults([]);
            }}
          />
          <Search className="absolute left-4 top-2.5 text-[#54656F]" size={18} />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => <ChatSkeleton key={i} />)
          ) : (
            <div key="chat-list-content">
              {searchTerm && searchResults.length > 0 && (
                <div className="px-6 py-2 text-[10px] font-bold text-[#008069] uppercase tracking-wider bg-[#F0F2F5]/50">
                  Global Search
                </div>
              )}
              
              {!searchTerm && users.length > 0 && (
                <div className="px-6 py-2 text-[10px] font-bold text-[#667781] uppercase tracking-wider bg-[#F0F2F5]/50">
                  Recent Chats
                </div>
              )}

              {displayedUsers.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-12 text-center flex flex-col items-center"
                >
                  <div className="w-20 h-20 bg-[#F0F2F5] rounded-full flex items-center justify-center mb-4 text-[#8696A0] shadow-inner">
                    <Search size={32} />
                  </div>
                  <p className="text-[#111B21] font-bold">
                    {searchTerm ? "No results found" : "No active chats yet"}
                  </p>
                  <p className="text-[#8696A0] text-xs mt-2 max-w-[200px] mx-auto leading-relaxed">
                    {searchTerm 
                      ? "Try searching for a full email address or exact username" 
                      : "Start a conversation by searching for friends!"}
                  </p>
                </motion.div>
              ) : (
                displayedUsers.map((user) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    key={user.uid}
                    onClick={() => onSelectChat(user)}
                    className={cn(
                      "flex items-center p-3 cursor-pointer hover:bg-[#F5F6F6] transition-all duration-200 group relative",
                      selectedChat?.uid === user.uid && "bg-[#F0F2F5]"
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                        alt={user.displayName || ''}
                        className="w-12 h-12 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {user.isOnline && (
                        <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-[#25D366] rounded-full border-2 border-white shadow-sm"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 ml-3 border-b border-[#F5F6F6] py-2 h-full">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className="font-semibold text-[#111B21] truncate text-base flex items-center gap-1">
                          {user.displayName}
                          {user.isVerified && <BadgeCheck size={14} className="text-[#3b82f6] fill-[#3b82f6]/10 flex-shrink-0" />}
                        </h3>
                        <span className="text-[11px] text-[#667781]">
                          {user.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] text-[#667781] truncate flex-1">
                          {user.bio || user.email}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
