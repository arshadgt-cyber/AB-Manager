import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Wallet, FileCheck, Package, Users, Truck, 
  Database, Bot, Megaphone, BarChart3, Settings as SettingsIcon, Bell, 
  Menu, X, Sun, Moon, LogOut, Clock, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';

// --- Components ---
import { Dashboard } from './components/Dashboard';
import { PettyCash } from './components/PettyCash';
import { Cheques } from './components/Cheques';
import { Stock } from './components/Stock';
import { Reminders } from './components/Reminders';
import { AIStudio } from './components/AIStudio';
import { Marketing } from './components/Marketing';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';

// --- Types ---

type Page = 
  | 'Dashboard' | 'PettyCash' | 'Cheques' | 'Stock' 
  | 'Reminders' | 'AIStudio' 
  | 'Marketing' | 'Reports' | 'Settings' | 'Notifications';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'PettyCash', label: 'Petty Cash', icon: Wallet },
  { id: 'Cheques', label: 'Cheques', icon: FileCheck },
  { id: 'Stock', label: 'Stock', icon: Package },
  { id: 'Reminders', label: 'Reminders', icon: Bell },
  { id: 'AIStudio', label: 'AI Studio', icon: Bot },
  { id: 'Marketing', label: 'Marketing', icon: Megaphone },
  { id: 'Reports', label: 'Reports', icon: BarChart3 },
  { id: 'Settings', label: 'Settings', icon: SettingsIcon },
];

const BOTTOM_NAV_ITEMS: { id: Page | 'Menu', label: string, icon: React.ElementType }[] = [
  { id: 'Dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'PettyCash', label: 'Cash', icon: Wallet },
  { id: 'Cheques', label: 'Cheques', icon: FileCheck },
  { id: 'Stock', label: 'Stock', icon: Package },
  { id: 'Menu', label: 'Menu', icon: Menu },
];

// --- Components ---

const Sidebar = ({ activePage, setActivePage, isOpen, setIsOpen, user }: { 
  activePage: Page, 
  setActivePage: (p: Page) => void, 
  isOpen: boolean, 
  setIsOpen: (b: boolean) => void,
  user: User | null
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Content */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="AB Manager Logo" className="w-10 h-10 rounded-xl object-cover shadow-lg" />
              <div>
                <h1 className="font-bold text-slate-900 dark:text-white leading-tight">AB Manager</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Pro</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-slate-500">
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActivePage(item.id);
                  if (window.innerWidth < 1024) setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  activePage === item.id 
                    ? 'bg-gradient-to-r from-[#a12328] to-[#c42e34] text-white shadow-md' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <item.icon size={20} className={activePage === item.id ? 'text-white' : 'group-hover:text-[#a12328] transition-colors'} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User Section */}
          {user && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-700" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

const Header = ({ activePage, setIsOpen, theme, setTheme }: { 
  activePage: Page, 
  setIsOpen: (b: boolean) => void,
  theme: 'light' | 'dark',
  setTheme: (t: 'light' | 'dark') => void
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 lg:px-8 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <button onClick={() => setIsOpen(true)} className="lg:hidden p-2 text-slate-500">
          <Menu size={24} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{activePage}</h2>
          <p className="text-xs text-slate-500 hidden sm:block">{format(new Date(), 'EEEE, MMMM dd, yyyy')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <div className="relative">
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
          </button>
        </div>
      </div>
    </header>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<Page>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // Load theme from local storage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme);

    // Test connection to Firestore
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a12328', '#c42e34', '#ffffff']
      });
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#a12328] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Loading AB Manager...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 text-center"
        >
          <img src="/logo.png" alt="AB Manager Logo" className="w-24 h-24 rounded-2xl object-cover shadow-xl mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">AB Manager</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Complete business management system for UAE SMEs.</p>
          
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-6 h-6" />
            Sign in with Google
          </button>
          
          <p className="mt-8 text-xs text-slate-400">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
        user={user}
      />
      
      <div className="lg:pl-72 flex flex-col min-h-screen">
        <Header 
          activePage={activePage} 
          setIsOpen={setIsSidebarOpen} 
          theme={theme} 
          setTheme={setTheme} 
        />
        
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activePage === 'Dashboard' && <Dashboard user={user} />}
              {activePage === 'PettyCash' && <PettyCash user={user} />}
              {activePage === 'Cheques' && <Cheques user={user} />}
              {activePage === 'Stock' && <Stock user={user} />}
              {activePage === 'Reminders' && <Reminders user={user} />}
              {activePage === 'AIStudio' && <AIStudio user={user} />}
              {activePage === 'Marketing' && <Marketing user={user} />}
              {activePage === 'Reports' && <Reports user={user} />}
              {activePage === 'Settings' && <Settings user={user} />}
              {activePage === 'Notifications' && (
                <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 mb-4">
                    <Clock size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{activePage} Page</h3>
                  <p className="text-slate-500">This module is currently under development as part of the master blueprint implementation.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around p-2">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'Menu') {
                    setIsSidebarOpen(true);
                  } else {
                    setActivePage(item.id as Page);
                  }
                }}
                className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl transition-colors ${
                  isActive 
                    ? 'text-[#a12328] dark:text-[#e53e45]' 
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <item.icon size={22} className={isActive ? 'mb-1' : 'mb-1 opacity-80'} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
