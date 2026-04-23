import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Withdrawal, AppSettings } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { Wallet as WalletIcon, ArrowUpRight, History, CreditCard, Smartphone, AlertCircle } from 'lucide-react';
import { formatChatDate, cn, getTime, toSafeDate } from '../utils';

interface WalletProps {
  profile: UserProfile;
}

export default function Wallet({ profile }: WalletProps) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'EasyPaisa' | 'JazzCash'>('EasyPaisa');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const unsubS = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) setAppSettings(doc.data() as AppSettings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const q = query(
      collection(db, 'withdrawals'),
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Withdrawal));
      setWithdrawals(list.sort((a, b) => getTime(b.timestamp) - getTime(a.timestamp)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'withdrawals');
    });

    return () => {
      unsubscribe();
      unsubS();
    };
  }, [profile.uid]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!appSettings?.isWithdrawalsEnabled) {
      setMessage({ text: 'Withdrawals are currently disabled by admin.', type: 'error' });
      return;
    }

    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount < 500) {
      setMessage({ text: 'Minimum withdrawal is Rs. 500', type: 'error' });
      return;
    }

    if (withdrawAmount > profile.balance) {
      setMessage({ text: 'Insufficient balance', type: 'error' });
      return;
    }

    if (!phoneNumber.trim()) {
      setMessage({ text: 'Please enter a valid phone number', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      // Get IP and Device Info for Audit Log
      const userAgent = navigator.userAgent;
      const platform = navigator.platform;
      
      // Create withdrawal request
      const withdrawalData: Withdrawal = {
        userId: profile.uid,
        amount: withdrawAmount,
        paymentMethod,
        phoneNumber,
        status: 'pending',
        timestamp: serverTimestamp(),
        taxAmount: (withdrawAmount * (appSettings?.withdrawalTax || 0)) / 100,
        auditLog: {
          ip: 'Client-Side (Hidden)', // Real IP would be handled server-side if needed
          device: `${platform} | ${userAgent.slice(0, 50)}...`
        }
      };

      await addDoc(collection(db, 'withdrawals'), withdrawalData);
      
      setMessage({ text: 'Withdrawal request submitted successfully!', type: 'success' });
      setAmount('');
      setPhoneNumber('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'withdrawals');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scrollable-content bg-[#F0F2F5] p-4 md:p-8 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
        <h1 className="text-2xl font-bold text-[#111B21] flex items-center gap-3">
          <WalletIcon className="text-[#075E54]" size={32} />
          My Wallet
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Balance Card */}
          <div className="bg-[#075E54] text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-white/80 text-sm font-medium mb-2 uppercase tracking-wider">Total Balance</p>
              <h2 className="text-5xl font-bold mb-6">Rs. {profile.balance.toFixed(2)}</h2>
              <div className="flex gap-4">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
                  <p className="text-xs text-white/70">Earnings Today</p>
                  <p className="font-bold">Rs. 0.00</p>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
                  <p className="text-xs text-white/70">Total Withdrawn</p>
                  <p className="font-bold">Rs. 0.00</p>
                </div>
              </div>
            </div>
            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[#25D366]/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-black/10 rounded-full blur-3xl"></div>
          </div>

          {/* Withdrawal Form */}
          <div className="bg-white p-8 rounded-3xl shadow-md border border-gray-100">
            <h3 className="text-lg font-bold text-[#111B21] mb-6 flex items-center gap-2">
              <ArrowUpRight className="text-[#25D366]" size={20} />
              Withdraw Funds
            </h3>
            
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#667781] mb-1.5 uppercase tracking-wide">Amount (Rs.)</label>
                <input
                  type="number"
                  placeholder="Min. 500"
                  className="w-full border border-[#D1D7DB] p-3.5 rounded-xl focus:outline-none focus:border-[#25D366] bg-[#F8F9FA] transition-all"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {amount && !isNaN(parseFloat(amount)) && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-[#667781]">Withdrawal Tax ({appSettings?.withdrawalTax}%):</span>
                      <span className="text-red-500">- Rs. {(parseFloat(amount) * (appSettings?.withdrawalTax || 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-50">
                      <span className="text-[#111B21]">You will receive:</span>
                      <span className="text-[#075E54]">Rs. {(parseFloat(amount) - (parseFloat(amount) * (appSettings?.withdrawalTax || 0) / 100)).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#667781] mb-1.5 uppercase tracking-wide">Payment Method</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('EasyPaisa')}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 transition-all font-bold text-sm",
                      paymentMethod === 'EasyPaisa' ? "bg-[#D9FDD3] border-[#25D366] text-[#075E54]" : "bg-white border-gray-100 text-[#667781]"
                    )}
                  >
                    <Smartphone size={18} />
                    EasyPaisa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('JazzCash')}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 transition-all font-bold text-sm",
                      paymentMethod === 'JazzCash' ? "bg-[#D9FDD3] border-[#25D366] text-[#075E54]" : "bg-white border-gray-100 text-[#667781]"
                    )}
                  >
                    <Smartphone size={18} />
                    JazzCash
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#667781] mb-1.5 uppercase tracking-wide">Phone Number</label>
                <input
                  type="text"
                  placeholder="03xx xxxxxxx"
                  className="w-full border border-[#D1D7DB] p-3.5 rounded-xl focus:outline-none focus:border-[#25D366] bg-[#F8F9FA] transition-all"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              {message.text && (
                <p className={cn("text-sm text-center p-2 rounded-lg font-medium", 
                  message.type === 'error' ? "bg-red-50 text-red-600" : "bg-[#D9FDD3] text-[#008069]")}>
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#25D366] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#20bd5c] transition-all active:scale-95 disabled:opacity-50 mt-4 h-14 flex items-center justify-center"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Request Withdrawal'}
              </button>
            </form>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white rounded-3xl shadow-md overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-[#F0F2F5] flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#111B21] flex items-center gap-2">
              <History className="text-[#075E54]" size={20} />
              Recent Transactions
            </h3>
          </div>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left">
              <thead className="bg-[#F0F2F5] text-xs uppercase text-[#667781]">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F5]">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[#667781]">No transactions found.</td>
                  </tr>
                ) : (
                  withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-[#111B21]">
                        {w.timestamp ? formatChatDate(toSafeDate(w.timestamp)) : '...'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-[#54656F]">
                            <Smartphone size={14} />
                          </div>
                          <span className="text-sm font-medium">{w.paymentMethod}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-[#111B21]">Rs. {w.amount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                          w.status === 'pending' && "bg-yellow-100 text-yellow-700",
                          w.status === 'approved' && "bg-green-100 text-green-700",
                          w.status === 'rejected' && "bg-red-100 text-red-700"
                        )}>
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View for Wallet Transactions */}
          <div className="md:hidden divide-y divide-[#F0F2F5]">
            {withdrawals.length === 0 ? (
              <div className="px-6 py-10 text-center text-[#667781]">No transactions found.</div>
            ) : (
              withdrawals.map((w) => (
                <div key={w.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-[#54656F]">
                        <Smartphone size={14} />
                      </div>
                      <span className="text-sm font-bold">{w.paymentMethod}</span>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                      w.status === 'pending' && "bg-yellow-100 text-yellow-700",
                      w.status === 'approved' && "bg-green-100 text-green-700",
                      w.status === 'rejected' && "bg-red-100 text-red-700"
                    )}>
                      {w.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-[#667781] uppercase font-bold">Date</p>
                      <p className="text-sm text-[#111B21]">{w.timestamp ? formatChatDate(toSafeDate(w.timestamp)) : '...'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#667781] uppercase font-bold">Amount</p>
                      <p className="text-lg font-bold text-[#111B21]">Rs. {w.amount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
