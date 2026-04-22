import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, or, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Circle, MoreVertical, Filter } from 'lucide-react';
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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.senderId !== auth.currentUser?.uid) activeUserIds.add(data.senderId);
        if (data.receiverId !== auth.currentUser?.uid) activeUserIds.add(data.receiverId);
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
      <div className="p-4 flex items-center justify-between bg-white sticky top-0 z-20">
        <h1 className="text-2xl font-black text-[#111B21] tracking-tight">Chats</h1>
        <div className="flex gap-1">
          <button className="p-2.5 hover:bg-[#F0F2F5] rounded-full transition-all text-[#54656F] active:scale-90"><Filter size={20} /></button>
          <button className="p-2.5 hover:bg-[#F0F2F5] rounded-full transition-all text-[#54656F] active:scale-90"><UserPlus size={20} /></button>
        </div>
      </div>

      <div className="px-4 pb-4 bg-white sticky top-[72px] z-20 shadow-sm">
        <form onSubmit={handleSearch} className="relative group">
          <input
            type="text"
            placeholder="Search or start new chat..."
            className="w-full bg-[#F0F2F5] py-2.5 pl-12 pr-12 rounded-2xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#00A884] transition-all border border-transparent shadow-inner"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value) setSearchResults([]);
            }}
          />
          <Search className="absolute left-4 top-3 text-[#54656F] group-focus-within:text-[#00A884] transition-colors" size={18} />
          {searchTerm && (
            <button 
              type="submit"
              className="absolute right-2 top-1.5 px-3 py-1 bg-[#00A884] text-white text-[10px] font-black uppercase rounded-lg hover:bg-[#008F6F] transition-colors shadow-sm"
            >
              Find
            </button>
          )}
        </form>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar mt-2">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => <ChatSkeleton key={i} />)
          ) : (
            <div key="chat-list-content">
              {searchTerm && searchResults.length > 0 && (
                <div className="px-6 py-2 text-[10px] font-black text-[#00A884] uppercase tracking-[0.2em] bg-[#F0F2F5]/50">
                  Global Search
                </div>
              )}
              
              {!searchTerm && users.length > 0 && (
                <div className="px-6 py-2 text-[10px] font-black text-[#667781] uppercase tracking-[0.2em] bg-[#F0F2F5]/50">
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
                      "flex items-center p-3.5 cursor-pointer hover:bg-[#F5F6F6] border-b border-[#F5F6F6] transition-all duration-200 group relative mx-2 rounded-2xl mb-1",
                      selectedChat?.uid === user.uid && "bg-[#F0F2F5] hover:bg-[#F0F2F5] shadow-sm"
                    )}
                  >
                    {selectedChat?.uid === user.uid && (
                      <motion.div 
                        layoutId="active-indicator"
                        className="absolute left-0 w-1.5 h-10 bg-[#00A884] rounded-r-full z-10" 
                      />
                    )}
                    
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "p-[2.5px] rounded-full transition-all duration-500",
                        user.isOnline ? "bg-gradient-to-tr from-[#25D366] to-[#00A884] shadow-md" : "bg-gray-200"
                      )}>
                        <img
                          src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                          alt={user.displayName || ''}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      {user.isOnline && (
                        <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-[#25D366] rounded-full border-2 border-white shadow-lg"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 ml-4">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="font-bold text-[#111B21] truncate group-hover:text-[#00A884] transition-colors text-base">
                          {user.displayName}
                        </h3>
                        <span className={cn(
                          "text-[10px] font-black transition-colors uppercase tracking-widest",
                          user.isOnline ? "text-[#00A884]" : "text-[#8696A0]"
                        )}>
                          {user.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-[#667781] truncate flex-1 font-medium">
                          {user.isVerified && <span className="text-[#00A884] mr-1">✓</span>}
                          {user.bio || user.email}
                        </p>
                        {user.isOnline && (
                          <motion.div 
                            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 2.5 }}
                            className="w-2.5 h-2.5 bg-[#00A884] rounded-full ml-2 shadow-[0_0_10px_rgba(0,168,132,0.5)]"
                          />
                        )}
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
