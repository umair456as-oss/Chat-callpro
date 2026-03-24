import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, or, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Circle } from 'lucide-react';

const ChatSkeleton = () => (
  <div className="flex items-center p-3 border-b border-[#F0F2F5] animate-pulse">
    <div className="w-12 h-12 rounded-full bg-gray-200 mr-3" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  </div>
);
import { cn } from '../utils';

interface ChatListProps {
  onSelectChat: (chat: UserProfile) => void;
  selectedChat: UserProfile | null;
}

export default function ChatList({ onSelectChat, selectedChat }: ChatListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

    // Search by exact email only for privacy
    const q = query(
      collection(db, 'users'),
      where('email', '==', searchTerm.trim())
    );
    
    let snapshot;
    try {
      snapshot = await getDocs(q);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
      return;
    }
    const results = snapshot.docs
      .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
      .filter(u => u.uid !== auth.currentUser?.uid);
    
    const uniqueResults = Array.from(new Map(results.map(u => [u.uid, u])).values());
    setSearchResults(uniqueResults);
  };

  const displayedUsers = searchTerm ? searchResults : users;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 bg-[#F0F2F5] flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#111B21]">Chats</h1>
        <div className="flex gap-4">
          <button className="text-[#54656F]"><UserPlus size={20} /></button>
        </div>
      </div>

      <div className="p-2 bg-white">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Search by email or phone..."
            className="w-full bg-[#F0F2F5] py-2 pl-10 pr-4 rounded-lg text-sm focus:outline-none"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value) setSearchResults([]);
            }}
          />
          <Search className="absolute left-3 top-2.5 text-[#54656F]" size={16} />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <ChatSkeleton key={i} />)
          ) : displayedUsers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 text-center text-[#667781] text-sm"
            >
              {searchTerm ? "No users found." : "No active chats yet. Search for someone to start chatting!"}
            </motion.div>
          ) : (
            displayedUsers.map((user) => (
              <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                key={user.uid}
                onClick={() => onSelectChat(user)}
                className={cn(
                  "flex items-center p-3 cursor-pointer hover:bg-teal-50/10 border-b border-[#F0F2F5] transition-all duration-200 group relative",
                  selectedChat?.uid === user.uid && "bg-teal-50/20"
                )}
              >
                {selectedChat?.uid === user.uid && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute left-0 w-1 h-8 bg-[#00A884] rounded-r-full" 
                  />
                )}
                
                <div className="relative">
                  <div className={cn(
                    "p-[2px] rounded-full transition-all duration-500",
                    user.isOnline ? "bg-gradient-to-tr from-[#25D366] to-[#00A884]" : "bg-transparent"
                  )}>
                    <img
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                      alt={user.displayName || ''}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {user.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25D366] rounded-full border-2 border-white shadow-sm"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 ml-3">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-semibold text-[#111B21] truncate group-hover:text-[#00A884] transition-colors">
                      {user.displayName}
                    </h3>
                    <span className={cn(
                      "text-[10px] font-medium transition-colors",
                      user.isOnline ? "text-[#00A884]" : "text-[#667781]"
                    )}>
                      {user.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#667781] truncate flex-1">
                      {user.isVerified && <span className="text-[#00A884] mr-1">✓</span>}
                      {user.email}
                    </p>
                    {user.isOnline && (
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-2 h-2 bg-[#00A884] rounded-full ml-2"
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
