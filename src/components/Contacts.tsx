import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, or, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Mail, User, Check } from 'lucide-react';
import { cn } from '../utils';

interface ContactsProps {
  onSelectChat: (chat: UserProfile) => void;
  onBack?: () => void;
}

export default function Contacts({ onSelectChat, onBack }: ContactsProps) {
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch users the current user has chatted with
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
        setContacts([]);
        setIsLoading(false);
        return;
      }

      const userQueries = Array.from(activeUserIds).map(uid => getDocs(query(collection(db, 'users'), where('__name__', '==', uid))));
      const userSnaps = await Promise.all(userQueries);
      const activeUsers = userSnaps.flatMap(snap => snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      
      // Sort alphabetically for contacts
      activeUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      
      setContacts(activeUsers);
      setIsLoading(false);
    }, (error) => {
      setIsLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, []);

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
      
      setSearchResults(results);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setIsLoading(false);
    }
  };

  const displayedUsers = searchTerm 
    ? (searchResults.length > 0 ? searchResults : contacts.filter(u => 
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
      ))
    : contacts;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 flex items-center gap-4 border-b border-[#F0F2F5] bg-[#F0F2F5]/50">
        {onBack && (
          <button onClick={onBack} className="md:hidden p-2 hover:bg-gray-200 rounded-full transition-colors">
            <Search size={20} />
          </button>
        )}
        <h1 className="text-xl font-bold text-[#111B21]">New Chat</h1>
      </div>

      <div className="p-4 bg-white sticky top-0 z-10 shadow-sm">
        <form onSubmit={handleSearch} className="relative group">
          <input
            type="text"
            placeholder="Search by email or username..."
            className="w-full bg-[#F0F2F5] py-3 pl-12 pr-12 rounded-2xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#25D366] transition-all border border-transparent shadow-inner"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!e.target.value) setSearchResults([]);
            }}
          />
          <Search className="absolute left-4 top-3.5 text-[#54656F] group-focus-within:text-[#25D366] transition-colors" size={18} />
          {searchTerm && (
            <button 
              type="submit"
              className="absolute right-3 top-2 px-3 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#20bd5c] transition-colors shadow-sm"
            >
              Search
            </button>
          )}
        </form>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <div className="w-10 h-10 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#667781] font-medium">Searching users...</p>
            </div>
          ) : (
            <div key="contacts-content">
              {searchTerm && searchResults.length > 0 && (
                <div className="px-6 py-2 bg-[#F0F2F5] text-[11px] font-bold text-[#075E54] uppercase tracking-widest border-b border-gray-100">
                  Global Search Results
                </div>
              )}
              
              {!searchTerm && contacts.length > 0 && (
                <div className="px-6 py-2 bg-[#F0F2F5] text-[11px] font-bold text-[#075E54] uppercase tracking-widest border-b border-gray-100">
                  Recent Contacts
                </div>
              )}

              {displayedUsers.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-12 text-center flex flex-col items-center"
                >
                  <div className="w-20 h-20 bg-[#F0F2F5] rounded-full flex items-center justify-center mb-4 text-[#8696A0]">
                    <UserPlus size={40} />
                  </div>
                  <p className="text-[#111B21] font-bold">
                    {searchTerm ? "User not found" : "No contacts yet"}
                  </p>
                  <p className="text-[#667781] text-sm mt-1 max-w-[200px] mx-auto">
                    {searchTerm 
                      ? "Make sure you entered the correct email or username" 
                      : "Search for users by email or username to start a conversation"}
                  </p>
                </motion.div>
              ) : (
                displayedUsers.map((user) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    key={user.uid}
                    onClick={() => onSelectChat(user)}
                    className="flex items-center p-4 cursor-pointer hover:bg-[#F5F6F6] border-b border-[#F5F6F6] transition-all group"
                  >
                    <div className="relative">
                      <img
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                        alt={user.displayName || ''}
                        className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm group-hover:border-[#25D366] transition-colors"
                        referrerPolicy="no-referrer"
                      />
                      {user.isOnline && (
                        <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-[#25D366] rounded-full border-2 border-white shadow-sm"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 ml-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-[#111B21] truncate group-hover:text-[#075E54] transition-colors">
                          {user.displayName}
                        </h3>
                        {user.isVerified && (
                          <span className="text-[#25D366] bg-[#D9FDD3] p-0.5 rounded-full">
                            <Check size={12} />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#667781] truncate flex items-center gap-1 mt-0.5 font-medium">
                        <Mail size={10} /> {user.email}
                      </p>
                      {user.bio && (
                        <p className="text-[11px] text-[#8696A0] truncate mt-1 italic">
                          "{user.bio}"
                        </p>
                      )}
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
