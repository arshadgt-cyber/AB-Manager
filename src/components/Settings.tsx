import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, User, Bell, Shield, 
  Globe, Database, CreditCard, Save, LogOut,
  Moon, Sun, Laptop, Smartphone, Sliders, Plus, Trash2,
  Volume2, BellRing
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { User as FirebaseUser } from 'firebase/auth';

export const Settings = ({ user }: { user: FirebaseUser }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    business_name: 'AB Manager',
    currency: 'AED',
    timezone: 'Asia/Dubai',
    notifications: {
      email: true,
      push: true,
      whatsapp: false
    },
    theme: 'system',
    petty_cash_categories: ['Office Supplies', 'Fuel', 'Maintenance', 'Staff Tea', 'Misc'],
    payment_methods: ['Cash', 'Bank Transfer', 'Cheque', 'Credit Card'],
    banks: [
      { name: 'Emirates NBD', alias: 'ENBD Main' },
      { name: 'ADCB', alias: 'ADCB Business' }
    ],
    reminder_intervals: [1, 3, 7],
    alert_sound: 'default',
    daily_report_time: '18:00',
    task_categories: ['General', 'Financial', 'Urgent', 'Follow-up'],
    cheque_alerts_enabled: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'app_settings', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings(docSnap.data() as any);
      }
    };
    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'app_settings', user.uid), settings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h3>
          <p className="text-slate-500">Manage your account and application preferences.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all disabled:opacity-50"
        >
          <Save size={18} />
          <span>{loading ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Tabs Sidebar */}
        <div className="w-full md:w-64 space-y-1">
          <SettingsTab icon={User} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          <SettingsTab icon={Globe} label="Business Info" active={activeTab === 'business'} onClick={() => setActiveTab('business')} />
          <SettingsTab icon={Sliders} label="Customization" active={activeTab === 'customization'} onClick={() => setActiveTab('customization')} />
          <SettingsTab icon={Bell} label="Notifications" active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} />
          <SettingsTab icon={Shield} label="Security" active={activeTab === 'security'} onClick={() => setActiveTab('security')} />
          <SettingsTab icon={Database} label="Data & Backup" active={activeTab === 'data'} onClick={() => setActiveTab('data')} />
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-8">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <img src={user.photoURL || ''} alt="" className="w-20 h-20 rounded-full border-4 border-slate-100 dark:border-slate-700" />
                <div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">{user.displayName}</h4>
                  <p className="text-sm text-slate-500">{user.email}</p>
                  <button className="mt-2 text-xs font-bold text-[#a12328] hover:underline">Change Photo</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SettingsInput label="Full Name" value={user.displayName || ''} disabled />
                <SettingsInput label="Email Address" value={user.email || ''} disabled />
                <SettingsInput label="Phone Number" placeholder="+971 50 000 0000" />
                <SettingsInput label="Job Title" placeholder="Owner / Manager" />
              </div>
            </div>
          )}

          {activeTab === 'business' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SettingsInput 
                  label="Business Name" 
                  value={settings.business_name} 
                  onChange={(val: string) => setSettings({...settings, business_name: val})}
                />
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Currency</label>
                  <select 
                    value={settings.currency}
                    onChange={(e) => setSettings({...settings, currency: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  >
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="SAR">SAR - Saudi Riyal</option>
                  </select>
                </div>
              </div>
              <SettingsInput label="Business Address" placeholder="Dubai, UAE" />
              <SettingsInput label="VAT Number" placeholder="100xxxxxxxxxxxx" />
            </div>
          )}

          {activeTab === 'customization' && (
            <div className="space-y-8">
              {/* Petty Cash Categories */}
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Petty Cash Categories</h4>
                  <button 
                    onClick={() => {
                      const cat = prompt('Enter new category:');
                      if (cat) setSettings({...settings, petty_cash_categories: [...settings.petty_cash_categories, cat]});
                    }}
                    className="p-1 text-[#a12328] hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.petty_cash_categories.map((cat, i) => (
                    <span key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold">
                      {cat}
                      <button 
                        onClick={() => setSettings({...settings, petty_cash_categories: settings.petty_cash_categories.filter((_, idx) => idx !== i)})}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </section>

              {/* Payment Methods */}
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Payment Methods</h4>
                  <button 
                    onClick={() => {
                      const method = prompt('Enter new payment method:');
                      if (method) setSettings({...settings, payment_methods: [...settings.payment_methods, method]});
                    }}
                    className="p-1 text-[#a12328] hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.payment_methods.map((method, i) => (
                    <span key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold">
                      {method}
                      <button 
                        onClick={() => setSettings({...settings, payment_methods: settings.payment_methods.filter((_, idx) => idx !== i)})}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </section>

              {/* Banks */}
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Bank Accounts</h4>
                  <button 
                    onClick={() => {
                      const name = prompt('Bank Name:');
                      const alias = prompt('Account Alias (e.g. Main Account):');
                      if (name && alias) setSettings({...settings, banks: [...settings.banks, { name, alias }]});
                    }}
                    className="p-1 text-[#a12328] hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {settings.banks.map((bank, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{bank.name}</p>
                        <p className="text-xs text-slate-500">{bank.alias}</p>
                      </div>
                      <button 
                        onClick={() => setSettings({...settings, banks: settings.banks.filter((_, idx) => idx !== i)})}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Reminder Settings */}
              <section className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Reminder & Alerts</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <BellRing size={14} /> Reminder Intervals (Days)
                    </label>
                    <div className="flex gap-2">
                      {[1, 3, 7, 15, 30].map(days => (
                        <button
                          key={days}
                          onClick={() => {
                            const exists = settings.reminder_intervals.includes(days);
                            const newIntervals = exists 
                              ? settings.reminder_intervals.filter(d => d !== days)
                              : [...settings.reminder_intervals, days].sort((a, b) => a - b);
                            setSettings({...settings, reminder_intervals: newIntervals});
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            settings.reminder_intervals.includes(days)
                              ? 'bg-[#a12328] text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Volume2 size={14} /> Alert Sound
                    </label>
                    <select 
                      value={settings.alert_sound}
                      onChange={(e) => setSettings({...settings, alert_sound: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20 text-sm"
                    >
                      <option value="default">Default System</option>
                      <option value="chime">Modern Chime</option>
                      <option value="digital">Digital Alert</option>
                      <option value="none">Silent</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Advanced Reminder Settings */}
              <section className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Advanced Reminders</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Daily Closing Report Time</label>
                    <input 
                      type="time"
                      value={settings.daily_report_time}
                      onChange={(e) => setSettings({...settings, daily_report_time: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Cheque Alerts</label>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSettings({...settings, cheque_alerts_enabled: !settings.cheque_alerts_enabled})}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.cheque_alerts_enabled ? 'bg-[#a12328]' : 'bg-slate-200 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.cheque_alerts_enabled ? 'left-7' : 'left-1'}`}></div>
                      </button>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {settings.cheque_alerts_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase">Task Categories</label>
                    <button 
                      onClick={() => {
                        const cat = prompt('Enter new task category:');
                        if (cat) setSettings({...settings, task_categories: [...settings.task_categories, cat]});
                      }}
                      className="p-1 text-[#a12328] hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settings.task_categories.map((cat, i) => (
                      <span key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold">
                        {cat}
                        <button 
                          onClick={() => setSettings({...settings, task_categories: settings.task_categories.filter((_, idx) => idx !== i)})}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <NotificationToggle 
                label="Email Notifications" 
                description="Receive daily summaries and alerts via email."
                enabled={settings.notifications.email}
                onChange={(val: boolean) => setSettings({...settings, notifications: {...settings.notifications, email: val}})}
              />
              <NotificationToggle 
                label="Push Notifications" 
                description="Get real-time alerts on your desktop or mobile."
                enabled={settings.notifications.push}
                onChange={(val: boolean) => setSettings({...settings, notifications: {...settings.notifications, push: val}})}
              />
              <NotificationToggle 
                label="WhatsApp Alerts" 
                description="Receive critical business alerts on WhatsApp."
                enabled={settings.notifications.whatsapp}
                onChange={(val: boolean) => setSettings({...settings, notifications: {...settings.notifications, whatsapp: val}})}
              />
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-700">
            <button 
              onClick={() => auth.signOut()}
              className="flex items-center gap-2 text-red-500 font-bold hover:text-red-600 transition-colors"
            >
              <LogOut size={20} />
              <span>Sign Out of Account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsTab = ({ icon: Icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
      active 
        ? 'bg-[#a12328] text-white shadow-lg' 
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

const SettingsInput = ({ label, value, onChange, placeholder, disabled }: any) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
    <input 
      type="text" 
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-transparent focus:border-[#a12328]/20 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20 disabled:opacity-50"
    />
  </div>
);

const NotificationToggle = ({ label, description, enabled, onChange }: any) => (
  <div className="flex items-center justify-between">
    <div>
      <h5 className="font-bold text-slate-900 dark:text-white">{label}</h5>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
    <button 
      onClick={() => onChange(!enabled)}
      className={`w-12 h-6 rounded-full transition-all relative ${enabled ? 'bg-[#a12328]' : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enabled ? 'left-7' : 'left-1'}`}></div>
    </button>
  </div>
);
