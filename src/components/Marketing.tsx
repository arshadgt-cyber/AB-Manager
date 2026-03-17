import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Share2, MessageSquare, Instagram, Facebook, 
  Globe, Sparkles, Send, Settings, CheckCircle2, AlertCircle,
  Zap, TrendingUp, Users, Target, Plus, Calendar, 
  BarChart3, Layout, MousePointer2, Languages, Loader2,
  Image as ImageIcon, Trash2, Edit2, Eye, Filter, Search, Clock, XCircle
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, 
  doc, orderBy, limit, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

const performanceData = [
  { name: 'Mon', reach: 400, engagement: 240 },
  { name: 'Tue', reach: 300, engagement: 139 },
  { name: 'Wed', reach: 200, engagement: 980 },
  { name: 'Thu', reach: 278, engagement: 390 },
  { name: 'Fri', reach: 189, engagement: 480 },
  { name: 'Sat', reach: 239, engagement: 380 },
  { name: 'Sun', reach: 349, engagement: 430 },
];

type Tab = 'dashboard' | 'campaigns' | 'automation' | 'segments';

export const Marketing = ({ user }: { user: User }) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [marketingSettings, setMarketingSettings] = useState({
    n8n_webhook_url: '',
    enable_social_proof: true,
    min_value_threshold: 1000,
    target_products: ['Pedrollo', 'Telemecanique', 'Water Pump', 'Pressure Switch'],
    daily_stock_alert_time: '09:00',
    enable_daily_alerts: true
  });
  const [recentAds, setRecentAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    type: 'promotional',
    platform: 'whatsapp',
    content: '',
    target_audience: 'all',
    language: 'english',
    status: 'draft'
  });

  useEffect(() => {
    const qLogs = query(collection(db, 'marketing_logs'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(10));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      setRecentAds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'marketing_logs'));

    const qCampaigns = query(collection(db, 'marketing_campaigns'), where('uid', '==', user.uid), orderBy('scheduled_date', 'desc'));
    const unsubCampaigns = onSnapshot(qCampaigns, (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'marketing_campaigns'));

    return () => {
      unsubLogs();
      unsubCampaigns();
    };
  }, [user]);

  const generateAICampaign = async () => {
    if (!campaignForm.title) return alert("Please enter a campaign title/goal first.");
    
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        Generate a marketing campaign for a UAE-based SME business.
        Campaign Goal/Title: ${campaignForm.title}
        Platform: ${campaignForm.platform}
        Language: ${campaignForm.language}
        Type: ${campaignForm.type}
        
        Provide a catchy title and the full message content. 
        If it's for WhatsApp, use emojis and formatting.
        If it's for Instagram, include relevant hashtags.
        The content should be professional yet engaging for the UAE market.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ["title", "content"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        setCampaignForm(prev => ({
          ...prev,
          title: data.title,
          content: data.content
        }));
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("Failed to generate campaign content.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'marketing_campaigns'), {
        ...campaignForm,
        uid: user.uid,
        scheduled_date: new Date().toISOString(),
        created_at: serverTimestamp(),
        sent_count: 0,
        opened_count: 0,
        response_count: 0
      });
      setShowAddCampaign(false);
      setCampaignForm({
        title: '',
        type: 'promotional',
        platform: 'whatsapp',
        content: '',
        target_audience: 'all',
        language: 'english',
        status: 'draft'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'marketing_campaigns');
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await deleteDoc(doc(db, 'marketing_campaigns', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'marketing_campaigns');
    }
  };

  const saveSettings = async () => {
    // In a real app, we'd save this to a 'settings' collection
    console.log('Saving settings:', marketingSettings);
    alert('Marketing settings updated successfully!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Marketing Hub</h3>
          <p className="text-slate-500">AI-powered growth tools for your business.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAddCampaign(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
          >
            <Plus size={18} />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Layout },
          { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
          { id: 'automation', label: 'Automation', icon: Zap },
          { id: 'segments', label: 'Segments', icon: Users },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard icon={TrendingUp} label="Total Reach" value="12.4k" color="blue" />
                  <StatCard icon={MousePointer2} label="Engagement" value="8.2%" color="emerald" />
                  <StatCard icon={Target} label="Conversions" value="142" color="amber" />
                </div>

                {/* Active Channels */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-6">Campaign Performance</h4>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceData}>
                        <defs>
                          <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a12328" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#a12328" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '16px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px'
                          }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="reach" 
                          stroke="#a12328" 
                          fillOpacity={1} 
                          fill="url(#colorReach)" 
                          strokeWidth={3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-6">Active Marketing Channels</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <ChannelCard icon={MessageSquare} label="WhatsApp" color="emerald" status="Active" />
                    <ChannelCard icon={Instagram} label="Instagram" color="pink" status="Active" />
                    <ChannelCard icon={Facebook} label="Facebook" color="blue" status="Active" />
                    <ChannelCard icon={Globe} label="Google My Biz" color="amber" status="Active" />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="text-amber-400" size={20} />
                    <h4 className="font-bold">AI Ad Preview</h4>
                  </div>
                  <div className="p-4 bg-white/10 rounded-2xl border border-white/10 italic text-sm">
                    "Another high-performance Pedrollo pump delivered today! Reliability you can trust at AL BERAKAH. 🚀"
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-60">
                    <span>Generated in: 1.2s</span>
                    <span>English & Arabic</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-4">Recent Ad Logs</h4>
                  <div className="space-y-4">
                    {recentAds.length > 0 ? recentAds.map((log) => (
                      <div key={log.id} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className={`p-2 rounded-lg ${log.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {log.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{log.product_name}</p>
                          <p className="text-[10px] text-slate-500">{log.channels.join(', ')}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8">
                        <Megaphone className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-xs text-slate-500">No ads triggered yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white">Active & Scheduled Campaigns</h4>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-slate-600"><Filter size={20} /></button>
                    <button className="p-2 text-slate-400 hover:text-slate-600"><Search size={20} /></button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {campaigns.length > 0 ? campaigns.map(camp => (
                    <div key={camp.id} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${
                          camp.platform === 'whatsapp' ? 'bg-emerald-100 text-emerald-600' :
                          camp.platform === 'instagram' ? 'bg-pink-100 text-pink-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {camp.platform === 'whatsapp' ? <MessageSquare size={24} /> : 
                           camp.platform === 'instagram' ? <Instagram size={24} /> : <Facebook size={24} />}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 dark:text-white">{camp.title}</h5>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar size={12} /> {format(new Date(camp.scheduled_date), 'MMM dd, yyyy')}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Target size={12} /> {camp.target_audience}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              camp.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                              camp.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {camp.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-6 text-center">
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{camp.sent_count}</p>
                            <p className="text-[10px] text-slate-500 uppercase">Sent</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{camp.opened_count}</p>
                            <p className="text-[10px] text-slate-500 uppercase">Open</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              const message = encodeURIComponent(camp.content);
                              window.open(`https://wa.me/?text=${message}`, '_blank');
                            }}
                            className="p-2 text-emerald-500 hover:text-emerald-600 transition-colors"
                            title="Send via WhatsApp"
                          >
                            <Send size={18} />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Eye size={18} /></button>
                          <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={18} /></button>
                          <button 
                            onClick={() => deleteCampaign(camp.id)}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-12 text-center">
                      <Megaphone className="mx-auto text-slate-300 mb-4" size={48} />
                      <h5 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Campaigns Yet</h5>
                      <p className="text-slate-500 max-w-xs mx-auto mb-6">Create your first AI-powered marketing campaign to reach your customers.</p>
                      <button 
                        onClick={() => setShowAddCampaign(true)}
                        className="px-6 py-3 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
                      >
                        Create Campaign
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'automation' && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Settings size={20} />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Workflow Configuration</h4>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">n8n Webhook URL</label>
                    <input 
                      type="text"
                      placeholder="https://n8n.your-domain.com/webhook/..."
                      value={marketingSettings.n8n_webhook_url}
                      onChange={(e) => setMarketingSettings({...marketingSettings, n8n_webhook_url: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border-none outline-none focus:ring-2 ring-indigo-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Min. Value Threshold (AED)</label>
                      <input 
                        type="number"
                        value={marketingSettings.min_value_threshold}
                        onChange={(e) => setMarketingSettings({...marketingSettings, min_value_threshold: parseInt(e.target.value)})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border-none outline-none focus:ring-2 ring-indigo-500/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Daily Alert Time</label>
                      <input 
                        type="time"
                        value={marketingSettings.daily_stock_alert_time}
                        onChange={(e) => setMarketingSettings({...marketingSettings, daily_stock_alert_time: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border-none outline-none focus:ring-2 ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Target Brands/Products</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl min-h-[40px]">
                      {marketingSettings.target_products.map((p, i) => (
                        <span key={i} className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700">
                          {p}
                        </span>
                      ))}
                      <button className="text-xs text-indigo-600 font-bold px-2">+ Add</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                    <div>
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-400">Enable Social Proof Ads</p>
                      <p className="text-xs text-indigo-700 dark:text-indigo-500">Automatically trigger ads on high-value sales.</p>
                    </div>
                    <button 
                      onClick={() => setMarketingSettings({...marketingSettings, enable_social_proof: !marketingSettings.enable_social_proof})}
                      className={`w-12 h-6 rounded-full transition-colors relative ${marketingSettings.enable_social_proof ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${marketingSettings.enable_social_proof ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <button 
                    onClick={saveSettings}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all"
                  >
                    Save Marketing Configuration
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'segments' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <SegmentCard 
                title="Top Spenders" 
                count={124} 
                criteria="Spent > 5000 AED" 
                icon={TrendingUp} 
                color="blue"
              />
              <SegmentCard 
                title="Inactive Customers" 
                count={452} 
                criteria="No purchase in 90 days" 
                icon={Clock} 
                color="amber"
              />
              <SegmentCard 
                title="New Leads" 
                count={89} 
                criteria="Joined last 30 days" 
                icon={Plus} 
                color="emerald"
              />
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-500 transition-all">
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors mb-4">
                  <Plus size={24} />
                </div>
                <h5 className="font-bold text-slate-900 dark:text-white">Create Segment</h5>
                <p className="text-xs text-slate-500">Define custom audience rules.</p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Add Campaign Modal */}
      {showAddCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#a12328] text-white rounded-lg">
                  <Megaphone size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create Campaign</h3>
              </div>
              <button onClick={() => setShowAddCampaign(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveCampaign} className="p-6 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Campaign Title / Goal</label>
                    <div className="relative">
                      <input 
                        type="text" required
                        placeholder="e.g. Ramadan Special Offer"
                        value={campaignForm.title}
                        onChange={(e) => setCampaignForm({...campaignForm, title: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                      />
                      <button 
                        type="button"
                        onClick={generateAICampaign}
                        disabled={isGenerating}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-all disabled:opacity-50"
                        title="Generate with AI"
                      >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Platform</label>
                      <select 
                        value={campaignForm.platform}
                        onChange={(e) => setCampaignForm({...campaignForm, platform: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Facebook</option>
                        <option value="all">All Channels</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                      <select 
                        value={campaignForm.type}
                        onChange={(e) => setCampaignForm({...campaignForm, type: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                      >
                        <option value="promotional">Promotional</option>
                        <option value="thank_you">Thank You</option>
                        <option value="review_request">Review Request</option>
                        <option value="festival">Festival Greeting</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Language</label>
                      <select 
                        value={campaignForm.language}
                        onChange={(e) => setCampaignForm({...campaignForm, language: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                      >
                        <option value="english">English</option>
                        <option value="arabic">Arabic</option>
                        <option value="hindi">Hindi</option>
                        <option value="urdu">Urdu</option>
                        <option value="malayalam">Malayalam</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Audience</label>
                      <select 
                        value={campaignForm.target_audience}
                        onChange={(e) => setCampaignForm({...campaignForm, target_audience: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                      >
                        <option value="all">All Customers</option>
                        <option value="top_spenders">Top Spenders</option>
                        <option value="inactive">Inactive (90 days)</option>
                        <option value="new">New Leads</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Message Content</label>
                    <textarea 
                      required
                      rows={8}
                      value={campaignForm.content}
                      onChange={(e) => setCampaignForm({...campaignForm, content: e.target.value})}
                      placeholder="Write your message here or use AI to generate..."
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20 resize-none text-sm"
                    />
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                    <p className="text-xs text-amber-800 dark:text-amber-400 flex gap-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>AI generated content should be reviewed before sending to ensure accuracy.</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button 
                  type="button"
                  onClick={() => setShowAddCampaign(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
                >
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800',
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${colors[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        <Icon size={18} />
        <p className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</p>
      </div>
      <h4 className="text-2xl font-black">{value}</h4>
    </div>
  );
};

const SegmentCard = ({ title, count, criteria, icon: Icon, color }: any) => {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colors[color]}`}>
          <Icon size={24} />
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-slate-900 dark:text-white">{count}</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold">Customers</p>
        </div>
      </div>
      <h5 className="font-bold text-slate-900 dark:text-white mb-1">{title}</h5>
      <p className="text-xs text-slate-500">{criteria}</p>
      <button className="w-full mt-4 py-2 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all">
        View List
      </button>
    </div>
  );
};

const ChannelCard = ({ icon: Icon, label, color, status }: any) => {
  const colors: any = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800',
    pink: 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/20 dark:border-pink-800',
    blue: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800',
  };

  return (
    <div className={`flex flex-col items-center p-4 rounded-2xl border ${colors[color]}`}>
      <Icon size={24} className="mb-2" />
      <p className="text-[10px] font-bold uppercase">{label}</p>
      <span className="text-[8px] font-black mt-1 opacity-60">{status}</span>
    </div>
  );
};
