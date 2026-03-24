import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, or, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { UserProfile } from '../types';
import { Search, UserPlus } from 'lucide-react';
import { cn } from '../utils';

interface ChatListProps {
  onSelectChat: (chat: UserProfile) => void;
  selectedChat: UserProfile | null;
}

export default function ChatList({ onSelectChat, selectedChat }: ChatListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);

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
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));

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

      <div className="flex-1 overflow-y-auto">
        {displayedUsers.length === 0 ? (
          <div className="p-10 text-center text-[#667781] text-sm">
            {searchTerm ? "No users found." : "No active chats yet. Search for someone to start chatting!"}
          </div>
        ) : (
          displayedUsers.map((user) => (
            <div
              key={user.uid}
              onClick={() => onSelectChat(user)}
              className={cn(
                "flex items-center p-3 cursor-pointer hover:bg-[#F5F6F6] border-b border-[#F0F2F5] transition-colors",
                selectedChat?.uid === user.uid && "bg-[#F0F2F5]"
              )}
            >
              <div className="relative">
                <img
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                  alt={user.displayName || ''}
                  className="w-12 h-12 rounded-full mr-3"
                  referrerPolicy="no-referrer"
                />
                {user.isOnline && (
                  <div className="absolute bottom-0 right-3 w-3 h-3 bg-[#25D366] rounded-full border-2 border-white"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-medium text-[#111B21] truncate">{user.displayName}</h3>
                  <span className="text-[10px] text-[#667781]">
                    {user.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-sm text-[#667781] truncate">
                  {user.isVerified && <span className="text-[#00A884] mr-1">✓</span>}
                  {user.email}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
