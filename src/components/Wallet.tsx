import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Withdrawal, AppSettings } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseError';
import { Wallet as WalletIcon, ArrowUpRight, History, CreditCard, Smartphone, AlertCircle } from 'lucide-react';
import { formatChatDate, cn, getTime } from '../utils';

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
    });

    const q = query(
      collection(db, 'withdrawals'),
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Withdrawal));
      setWithdrawals(list.sort((a, b) => getTime(b.timestamp) - getTime(a.timestamp)));
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
    <div className="flex-1 bg-[#F0F2F5] p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
        <h1 className="text-2xl font-bold text-[#111B21] flex items-center gap-3">
          <WalletIcon className="text-[#00A884]" size={32} />
          My Wallet
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Balance Card */}
          <div className="bg-[#00A884] text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-white/80 text-sm font-medium mb-2 uppercase tracking-wider">Total Balance</p>
              <h2 className="text-5xl font-bold mb-6">Rs. {profile.balance.toFixed(2)}</h2>
              <div className="flex gap-4">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                  <p className="text-xs text-white/70">Earnings Today</p>
                  <p className="font-bold">Rs. 0.00</p>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                  <p className="text-xs text-white/70">Total Withdrawn</p>
                  <p className="font-bold">Rs. 0.00</p>
                </div>
              </div>
            </div>
            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-black/10 rounded-full blur-3xl"></div>
          </div>

          {/* Withdrawal Form */}
          <div className="bg-white p-8 rounded-3xl shadow-md">
            <h3 className="text-lg font-bold text-[#111B21] mb-6 flex items-center gap-2">
              <ArrowUpRight className="text-[#00A884]" size={20} />
              Withdraw Funds
            </h3>
            
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#667781] mb-1 uppercase">Amount (Rs.)</label>
                <input
                  type="number"
                  placeholder="Min. 500"
                  className="w-full border border-[#D1D7DB] p-3 rounded-xl focus:outline-none focus:border-[#00A884]"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {amount && !isNaN(parseFloat(amount)) && (
                  <div className="mt-2 flex justify-between text-[10px] font-bold">
                    <span className="text-[#667781]">Withdrawal Tax ({appSettings?.withdrawalTax}%):</span>
                    <span className="text-red-500">- Rs. {(parseFloat(amount) * (appSettings?.withdrawalTax || 0) / 100).toFixed(2)}</span>
                  </div>
                )}
                {amount && !isNaN(parseFloat(amount)) && (
                  <div className="mt-1 flex justify-between text-xs font-bold">
                    <span className="text-[#111B21]">You will receive:</span>
                    <span className="text-[#00A884]">Rs. {(parseFloat(amount) - (parseFloat(amount) * (appSettings?.withdrawalTax || 0) / 100)).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#667781] mb-1 uppercase">Payment Method</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('EasyPaisa')}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                      paymentMethod === 'EasyPaisa' ? "bg-[#D9FDD3] border-[#00A884] text-[#00A884]" : "border-[#D1D7DB] text-[#54656F]"
                    )}
                  >
                    <Smartphone size={18} />
                    EasyPaisa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('JazzCash')}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                      paymentMethod === 'JazzCash' ? "bg-[#D9FDD3] border-[#00A884] text-[#00A884]" : "border-[#D1D7DB] text-[#54656F]"
                    )}
                  >
                    <Smartphone size={18} />
                    JazzCash
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#667781] mb-1 uppercase">Phone Number</label>
                <input
                  type="text"
                  placeholder="03xx xxxxxxx"
                  className="w-full border border-[#D1D7DB] p-3 rounded-xl focus:outline-none focus:border-[#00A884]"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              {message.text && (
                <p className={cn("text-sm text-center", message.type === 'error' ? "text-red-500" : "text-[#00A884]")}>
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00A884] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#008F6F] transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Request Withdrawal'}
              </button>
            </form>
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white rounded-3xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-[#F0F2F5] flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#111B21] flex items-center gap-2">
              <History className="text-[#00A884]" size={20} />
              Recent Transactions
            </h3>
          </div>
          <div className="overflow-x-auto">
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
                        {w.timestamp ? formatChatDate(w.timestamp.toDate()) : '...'}
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
        </div>
      </div>
    </div>
  );
}
