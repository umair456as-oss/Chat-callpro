export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  balance: number;
  role: 'user' | 'admin';
  isOnline: boolean;
  lastSeen: string;
  isVerified: boolean;
  isBanned: boolean;
  bio?: string;
  isShadowBanned?: boolean;
  level: 'Bronze' | 'Silver' | 'Gold';
  experience: number;
  currentGame?: string;
  blockedUntil?: string;
  wallpaper?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  clickCount?: number;
  lastClickTime?: number;
  lastChatRewardTime?: number;
  badges?: string[];
  fcmToken?: string;
  userSettings?: {
    readReceipts: boolean;
    enterIsSend: boolean;
    mediaVisibility: boolean;
    keepArchived: boolean;
    conversationTones: boolean;
    reminders: boolean;
    highPriority: boolean;
    increaseContrast: boolean;
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    lastSeenVisibility: 'everyone' | 'myContacts' | 'nobody';
    profilePhotoVisibility: 'everyone' | 'myContacts' | 'nobody';
    aboutVisibility: 'everyone' | 'myContacts' | 'nobody';
    statusVisibility: 'everyone' | 'myContacts' | 'nobody';
    linksVisibility: 'everyone' | 'myContacts' | 'nobody';
    disappearingMessagesTimer: 'off' | '24h' | '7d' | '90d';
    securityNotifications: boolean;
    customLists?: string[];
  };
}

export interface Message {
  id?: string;
  senderId: string;
  senderName?: string;
  receiverId: string;
  text: string;
  timestamp: any;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'voice' | 'image' | 'support';
  audioUrl?: string;
  replyTo?: string;
  isForwarded?: boolean;
  deletedFor?: string[];
  isDeletedForEveryone?: boolean;
}

export interface Withdrawal {
  id?: string;
  userId: string;
  amount: number;
  taxAmount?: number;
  netAmount?: number;
  paymentMethod: 'EasyPaisa' | 'JazzCash';
  phoneNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: any;
  auditLog?: {
    ip: string;
    device: string;
  };
}

export interface GameLog {
  id?: string;
  userId: string;
  gameName: string;
  reward: number;
  timestamp: any;
}

export interface AppSettings {
  isMaintenanceMode: boolean;
  adFrequency: number;
  globalAnnouncement: string;
  isWithdrawalsEnabled: boolean;
  isGamesEnabled: boolean;
  withdrawalTax: number;
  isJackpotHour: boolean;
  jackpotEndTime?: string;
  tickerMessages: string[];
  rewardMultiplier: number;
  minWithdrawal: number;
  adEarningRate: number;
  chatRewardAmount: number;
  tickerText: string;
  botName: string;
  botAutoReplyEnabled: boolean;
  botWelcomeMessage: string;
  isAdMobEnabled: boolean;
  isAdMobBannerEnabled: boolean;
  vapidKey?: string;
  appLogoUrl?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  status: 'open' | 'closed';
  lastMessage: string;
  updatedAt: any;
  createdAt: any;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: any;
}

export interface RevenueStats {
  date: string;
  adRevenue: number;
  userPayouts: number;
  profit: number;
}

export interface GameSettings {
  id: string;
  name: string;
  earningRate: number;
  isEnabled: boolean;
  dailyLimit: number;
  price: number;
}

export interface Announcement {
  id?: string;
  text: string;
  type: 'info' | 'warning' | 'success';
  isActive: boolean;
  createdAt: any;
}

export interface Status {
  id: string;
  userId: string;
  displayName: string;
  photoURL: string;
  imageUrl: string;
  caption: string;
  timestamp: any;
  views: string[];
}

export interface Call {
  id?: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  callerPhoto: string;
  status: 'calling' | 'ongoing' | 'ended' | 'missed' | 'rejected';
  type: 'voice' | 'video';
  timestamp: any;
  offer?: any;
  answer?: any;
}
