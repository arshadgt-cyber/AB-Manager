import React, { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart as PieChartIcon, TrendingUp, 
  ArrowDownRight, ArrowUpRight, Calendar, Download, Share2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { analyzeFinancialData } from '../services/aiService';
import { Sparkles } from 'lucide-react';

export const Reports = ({ user }: { user: User }) => {
  const [insights, setInsights] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      // In a real app, we'd pass actual aggregated data here
      const mockData = {
        totalRevenue: 124500,
        totalExpenses: 82300,
        topExpenseCategory: 'Rent',
        receivables: 45000
      };
      const result = await analyzeFinancialData(mockData);
      setInsights(result);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now, in real app we would aggregate Firestore data
    setData([
      { name: 'Jan', income: 45000, expense: 32000 },
      { name: 'Feb', income: 52000, expense: 38000 },
      { name: 'Mar', income: 48000, expense: 41000 },
      { name: 'Apr', income: 61000, expense: 45000 },
      { name: 'May', income: 55000, expense: 42000 },
      { name: 'Jun', income: 67000, expense: 48000 },
    ]);
    setLoading(false);
  }, [user]);

  const pieData = [
    { name: 'Sales', value: 65, color: '#10b981' },
    { name: 'Services', value: 25, color: '#3b82f6' },
    { name: 'Other', value: 10, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Business Reports</h3>
          <p className="text-slate-500">Detailed analytics and financial summaries.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-50 transition-all">
            <Download size={18} />
            <span>Export PDF</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#a12328] text-white rounded-xl text-sm font-bold shadow-lg hover:bg-[#8a1e22] transition-all">
            <Share2 size={18} />
            <span>Share Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-[#a12328]" />
              Income vs Expense Trend
            </h4>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Income
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span> Expense
              </span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                />
                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={4} dot={{r: 4, fill: '#10b981'}} activeDot={{r: 8}} />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={4} dot={{r: 4, fill: '#ef4444'}} activeDot={{r: 8}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <h4 className="font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
            <PieChartIcon size={20} className="text-[#a12328]" />
            Income Breakdown
          </h4>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportSummaryCard title="Net Profit" value="124,500" trend="+15%" color="emerald" />
        <ReportSummaryCard title="Avg. Monthly Income" value="54,200" trend="+8%" color="blue" />
        <ReportSummaryCard title="Top Expense Category" value="Rent" subValue="15,000 AED" color="red" />
        <ReportSummaryCard title="Customer Growth" value="12" subValue="New this month" color="purple" />
      </div>

      {/* AI Insights Section */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#a12328]/10 rounded-lg">
              <Sparkles size={24} className="text-[#a12328]" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">AI Financial Advisor</h4>
              <p className="text-sm text-slate-500">Actionable insights based on your business performance.</p>
            </div>
          </div>
          <button 
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 px-6 py-3 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Generate Insights</span>
              </>
            )}
          </button>
        </div>

        {insights ? (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {insights}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 max-w-xs mx-auto">Click "Generate Insights" to get a detailed AI analysis of your financial health.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ReportSummaryCard = ({ title, value, trend, subValue, color }: any) => {
  const colors: any = {
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <p className="text-xs text-slate-500 uppercase font-bold mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <div>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h4>
          {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
        </div>
        {trend && <span className={`text-xs font-bold px-2 py-1 rounded-full ${colors[color]}`}>{trend}</span>}
      </div>
    </div>
  );
};
