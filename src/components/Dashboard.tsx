import React, { useState, useEffect } from 'react';
import { 
  Plus, ArrowDownRight, ArrowUpRight, Bell, FileCheck, 
  AlertCircle, Clock, XCircle
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, orderBy, limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { analyzeFinancialData } from '../services/aiService';
import { format, addDays } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Sparkles } from 'lucide-react';

export const Dashboard = ({ user }: { user: User }) => {
  const [stats, setStats] = useState({
    income: 0,
    expenses: 0,
    reminders: 0,
    pendingCheques: 0,
    bankBalance: 0,
    cashInHand: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);

  const fetchAiSummary = async () => {
    setAnalyzing(true);
    try {
      const summary = await analyzeFinancialData(stats);
      setAiSummary(summary);
    } catch (error) {
      console.error("Dashboard AI analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (stats.income > 0 || stats.expenses > 0) {
      fetchAiSummary();
    }
  }, [stats.income, stats.expenses]);

  useEffect(() => {
    // Fetch Transactions for stats
    const qAll = query(collection(db, 'petty_cash'), where('uid', '==', user.uid));
    const unsubscribeTransactions = onSnapshot(qAll, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Recent 5 for display
      setRecentTransactions(docs.sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 5));
      
      let inc = 0;
      let exp = 0;
      let cash = 0;
      let bankFromPetty = 0;

      docs.forEach((d: any) => {
        const amount = d.amount || 0;
        if (d.type === 'income') inc += amount;
        else exp += amount;

        if (d.payment_method === 'cash') {
          cash += (d.type === 'income' ? amount : -amount);
        } else if (d.payment_method === 'card' || d.payment_method === 'online') {
          bankFromPetty += (d.type === 'income' ? amount : -amount);
        }
      });
      setStats(prev => ({ 
        ...prev, 
        income: inc, 
        expenses: exp, 
        cashInHand: cash,
        bankBalance: prev.bankBalance + bankFromPetty // This will be refined below
      }));
    });

    // Fetch Cheques for bank balance and pending
    const qChequesAll = query(collection(db, 'cheques'), where('uid', '==', user.uid));
    const unsubscribeChequesAll = onSnapshot(qChequesAll, (snapshot) => {
      let bankFromCheques = 0;
      let pending = 0;
      let upcoming = 0;
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const amount = data.amount || 0;
        
        if (data.status === 'cleared') {
          bankFromCheques += (data.cheque_type === 'incoming' ? amount : -amount);
        } else if (data.status === 'pending') {
          pending++;
          if (data.due_date === tomorrow) upcoming++;
        }
      });

      setStats(prev => ({ 
        ...prev, 
        bankBalance: bankFromCheques, // We'll recalculate total bank balance in a combined effect or just here
        pendingCheques: pending,
        reminders: upcoming
      }));
    });

    // Mock Cash Flow Data for Chart
    setCashFlowData([
      { name: 'Mon', income: 4000, expense: 2400 },
      { name: 'Tue', income: 3000, expense: 1398 },
      { name: 'Wed', income: 2000, expense: 9800 },
      { name: 'Thu', income: 2780, expense: 3908 },
      { name: 'Fri', income: 1890, expense: 4800 },
      { name: 'Sat', income: 2390, expense: 3800 },
      { name: 'Sun', income: 3490, expense: 4300 },
    ]);

    return () => {
      unsubscribeTransactions();
      unsubscribeChequesAll();
    };
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Marhaba, {user.displayName?.split(' ')[0]}!</h3>
          <p className="text-slate-500">Here's what's happening with your business today.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#a12328] text-white rounded-xl hover:bg-[#8a1e22] transition-all shadow-md">
            <Plus size={18} />
            <span>New Transaction</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <StatCard 
          label="Cash in Hand" 
          value={stats.cashInHand} 
          icon={ArrowDownRight} 
          color="emerald" 
        />
        <StatCard 
          label="Bank Balance" 
          value={stats.bankBalance} 
          icon={ArrowUpRight} 
          color="blue" 
        />
        <StatCard 
          label="Pending Cheques" 
          value={stats.pendingCheques} 
          icon={FileCheck} 
          color="amber" 
          isCount
        />
        <StatCard 
          label="Smart Reminders" 
          value={stats.reminders} 
          icon={Bell} 
          color="red" 
          isCount
        />
      </div>

      {/* AI Smart Summary */}
      <div className="bg-gradient-to-r from-[#a12328]/5 to-[#a12328]/10 p-6 rounded-3xl border border-[#a12328]/20 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-[#a12328] rounded-lg text-white">
            <Sparkles size={18} />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white">AI Smart Summary</h4>
          {analyzing && <div className="w-4 h-4 border-2 border-[#a12328]/30 border-t-[#a12328] rounded-full animate-spin ml-auto" />}
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {aiSummary || (analyzing ? "Analyzing your business data..." : "Add some transactions to see your AI-powered business summary.")}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-slate-900 dark:text-white">7-Day Cash Flow</h4>
            <select className="bg-slate-50 dark:bg-slate-700 border-none text-sm rounded-lg px-2 py-1 outline-none">
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: '#f1f5f9'}}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Alerts */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h4 className="font-bold text-slate-900 dark:text-white mb-4">Business Alerts</h4>
          <div className="space-y-4">
            <AlertItem 
              type="warning" 
              title="Low Stock Alert" 
              message="5 items are below reorder level." 
              icon={AlertCircle}
            />
            <AlertItem 
              type="info" 
              title="Cheque Due Soon" 
              message="3 cheques are due within 48 hours." 
              icon={Clock}
            />
            <AlertItem 
              type="error" 
              title="Credit Overdue" 
              message="Al Futtaim Group has exceeded credit limit." 
              icon={XCircle}
            />
          </div>
          <button className="w-full mt-6 py-2 text-sm font-semibold text-[#a12328] hover:bg-[#a12328]/5 rounded-xl transition-colors">
            View All Notifications
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 dark:text-white">Recent Transactions</h4>
          <button className="text-sm text-[#a12328] font-semibold">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold">Category</th>
                <th className="px-6 py-3 font-semibold">Description</th>
                <th className="px-6 py-3 font-semibold">Method</th>
                <th className="px-6 py-3 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentTransactions.length > 0 ? recentTransactions.map((tx: any) => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{tx.date}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {tx.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white font-medium">{tx.description}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 capitalize">{tx.payment_method}</td>
                  <td className={`px-6 py-4 text-sm font-bold text-right ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()} AED
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No recent transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color, trend, isCount }: any) => {
  const colors: any = {
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-200 dark:shadow-none',
    red: 'from-red-500 to-red-600 shadow-red-200 dark:shadow-none',
    blue: 'from-blue-500 to-blue-600 shadow-blue-200 dark:shadow-none',
    amber: 'from-amber-500 to-amber-600 shadow-amber-200 dark:shadow-none',
  };

  return (
    <div className={`p-6 rounded-2xl bg-gradient-to-br ${colors[color]} text-white shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
          <Icon size={20} />
        </div>
        {trend && <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">{trend}</span>}
      </div>
      <p className="text-white/80 text-sm font-medium">{label}</p>
      <h4 className="text-2xl font-bold mt-1">
        {isCount ? value : `${value.toLocaleString()} AED`}
      </h4>
    </div>
  );
};

const AlertItem = ({ type, title, message, icon: Icon }: any) => {
  const styles: any = {
    warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
    error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30',
  };

  return (
    <div className={`flex gap-3 p-3 rounded-xl border ${styles[type]}`}>
      <div className="mt-0.5">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-sm font-bold leading-tight">{title}</p>
        <p className="text-xs opacity-80">{message}</p>
      </div>
    </div>
  );
};
