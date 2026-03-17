import React, { useState, useEffect } from 'react';
import { 
  Bell, Clock, AlertCircle, CheckCircle2, MessageSquare, 
  Share2, Calendar, ChevronRight, Smartphone, Mail, Send,
  Trash2, Plus
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, orderBy, 
  getDocs, Timestamp, limit, updateDoc, doc, serverTimestamp,
  addDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { 
  format, addDays, isSameDay, parseISO, startOfMonth, 
  endOfMonth, eachDayOfInterval, isToday, startOfDay,
  addMinutes, isAfter, isBefore
} from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

export const Reminders = ({ user }: { user: User }) => {
  const [chequeAlerts, setChequeAlerts] = useState<any[]>([]);
  const [overdueAlerts, setOverdueAlerts] = useState<any[]>([]);
  const [generalTasks, setGeneralTasks] = useState<any[]>([]);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [alertDays, setAlertDays] = useState(3);
  const [taskForm, setTaskForm] = useState({
    title: '',
    datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    category: 'General'
  });

  useEffect(() => {
    // 1. Upcoming Cheque Alerts (Based on alert days setting)
    let unsubscribeCheques = () => {};
    const days = settings?.cheque_alert_days || alertDays;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = addDays(today, days);
    const futureDateStr = format(futureDate, 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');

    const qCheques = query(
      collection(db, 'cheques'), 
      where('uid', '==', user.uid), 
      where('due_date', '<=', futureDateStr),
      where('due_date', '>=', todayStr),
      where('status', '==', 'pending'),
      where('is_dismissed', '!=', true)
    );

    unsubscribeCheques = onSnapshot(qCheques, (snapshot) => {
      setChequeAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribeCheques();
  }, [user, settings?.cheque_alert_days, alertDays]);

  useEffect(() => {
    // Fetch Settings
    const unsubscribeSettings = onSnapshot(doc(db, 'app_settings', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSettings(data);
        if (data.cheque_alert_days) setAlertDays(data.cheque_alert_days);
      }
    });

    // 2. Customer Overdue Alerts (Credit entries in petty_cash)
    const qOverdue = query(
      collection(db, 'petty_cash'), 
      where('uid', '==', user.uid),
      where('payment_method', '==', 'credit'),
      where('status', '==', 'pending'),
      where('is_dismissed', '!=', true)
    );

    const unsubscribeOverdue = onSnapshot(qOverdue, (snapshot) => {
      const today = new Date();
      const overdue = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((entry: any) => entry.due_date && parseISO(entry.due_date) < today);
      
      setOverdueAlerts(overdue);
    });

    // 3. General Tasks
    const qTasks = query(
      collection(db, 'tasks'),
      where('uid', '==', user.uid),
      orderBy('datetime', 'asc')
    );

    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      setGeneralTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // 4. Daily Closing Summary
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const qToday = query(
      collection(db, 'petty_cash'),
      where('uid', '==', user.uid),
      where('date', '==', todayStr)
    );

    const unsubscribeToday = onSnapshot(qToday, (snapshot) => {
      let totalSales = 0;
      let totalIncome = 0;
      let totalExpense = 0;
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'income') {
          totalIncome += data.amount;
          if (data.category === 'sales') totalSales += data.amount;
        } else {
          totalExpense += data.amount;
        }
      });

      setDailySummary({
        closingCash: totalIncome - totalExpense,
        totalSales,
        count: snapshot.size
      });
    });

    return () => {
      unsubscribeSettings();
      unsubscribeOverdue();
      unsubscribeTasks();
      unsubscribeToday();
    };
  }, [user]);

  // Alarm/Notification Logic
  useEffect(() => {
    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const checkAlarms = () => {
      const now = new Date();
      
      // General Tasks
      generalTasks.forEach(task => {
        if (task.is_completed) return;
        const taskTime = parseISO(task.datetime);
        if (isAfter(now, taskTime) && isBefore(now, addMinutes(taskTime, 1))) {
          const notification = new Notification(`Reminder: ${task.title}`, {
            body: `Category: ${task.category}`,
            icon: '/logo.png',
            tag: task.id // Prevent duplicate notifications
          });
          notification.onclick = () => {
            window.focus();
            setShowTaskModal(true);
            setEditingTask(task);
          };
        }
      });

      // Daily Report
      if (settings?.daily_report_time) {
        const [hours, minutes] = settings.daily_report_time.split(':');
        if (now.getHours() === parseInt(hours) && now.getMinutes() === parseInt(minutes)) {
          new Notification("Daily Closing Report Ready", {
            body: `Closing Cash: AED ${dailySummary?.closingCash.toLocaleString() || '0'}`,
            icon: '/logo.png',
            tag: 'daily-report'
          });
        }
      }
    };

    const interval = setInterval(checkAlarms, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [generalTasks]);

  const snoozeTask = async (task: any) => {
    try {
      const newTime = addMinutes(new Date(), 10);
      await updateDoc(doc(db, 'tasks', task.id), {
        datetime: format(newTime, "yyyy-MM-dd'T'HH:mm"),
        updated_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const taskData = {
        ...taskForm,
        uid: user.uid,
        is_completed: false,
        created_at: serverTimestamp()
      };

      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), taskData);
      } else {
        await addDoc(collection(db, 'tasks'), taskData);
        
        // n8n Sync
        const n8nWebhook = process.env.VITE_N8N_MARKETING_WEBHOOK;
        if (n8nWebhook) {
          fetch(n8nWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'task_created',
              task: taskData,
              user_email: user.email
            })
          }).catch(err => console.error('n8n sync failed:', err));
        }
      }

      setShowTaskModal(false);
      setEditingTask(null);
      setTaskForm({
        title: '',
        datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        category: 'General'
      });
    } catch (error) {
      handleFirestoreError(error, editingTask ? OperationType.UPDATE : OperationType.CREATE, 'tasks');
    }
  };

  const toggleTaskStatus = async (task: any) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        is_completed: !task.is_completed
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tasks');
    }
  };

  const handleDismiss = async (id: string, collectionName: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), {
        is_dismissed: true,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, collectionName);
    }
  };

  const handleSnooze = (id: string) => {
    // For snooze, we'll just hide it from local state for this session
    setChequeAlerts(prev => prev.filter(a => a.id !== id));
    setOverdueAlerts(prev => prev.filter(a => a.id !== id));
  };

  const sendWhatsAppReminder = (entry: any) => {
    const message = `Reminder: Your payment of AED ${entry.amount} is overdue. Please settle at your earliest convenience. - AB Manager`;
    // Since we don't have a phone number in PettyCash, we'll prompt for it or just open WhatsApp
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const shareDailyReport = () => {
    if (!dailySummary) return;
    const message = `Daily Closing Summary (${format(new Date(), 'dd MMM yyyy')}):\nToday's Closing Cash: AED ${dailySummary.closingCash.toLocaleString()}\nTotal Sales: AED ${dailySummary.totalSales.toLocaleString()}\nGenerated via AB Manager`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const updateAlertSettings = async (days: number) => {
    try {
      await updateDoc(doc(db, 'app_settings', user.uid), {
        cheque_alert_days: days
      });
      setAlertDays(days);
      setShowAlertSettings(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'app_settings');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Smart Reminders</h3>
          <p className="text-slate-500 text-sm">Automated alerts for your business operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAlertSettings(true)}
            className="p-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 transition-all"
            title="Alert Settings"
          >
            <Bell size={20} />
          </button>
          <button 
            onClick={() => setShowTaskModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
          >
            <Plus size={18} />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Calendar View */}
      <div 
        className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"
        style={{ width: '600px', maxWidth: '100%' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar size={18} className="text-[#a12328]" />
            Business Calendar
          </h4>
          <div className="flex gap-2">
            <button onClick={() => setSelectedDate(addDays(selectedDate, -30))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <span className="text-sm font-bold text-slate-900 dark:text-white min-w-[100px] text-center">
              {format(selectedDate, 'MMMM yyyy')}
            </span>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 30))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase py-2">
              {day}
            </div>
          ))}
          {(() => {
            const start = startOfMonth(selectedDate);
            const end = endOfMonth(selectedDate);
            const days = eachDayOfInterval({ start, end });
            const padding = start.getDay();
            
            const elements = [];
            for (let i = 0; i < padding; i++) {
              elements.push(<div key={`pad-${i}`} className="aspect-square"></div>);
            }
            
            days.forEach(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const hasCheque = chequeAlerts.some(c => c.due_date === dateStr);
              const hasOverdue = overdueAlerts.some(o => o.due_date === dateStr);
              const hasTask = generalTasks.some(t => format(parseISO(t.datetime), 'yyyy-MM-dd') === dateStr);
              
              elements.push(
                <div 
                  key={dateStr} 
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl relative cursor-pointer transition-all ${
                    isToday(day) ? 'bg-[#a12328] text-white shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span className={`text-xs font-bold ${isToday(day) ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex gap-0.5 mt-1">
                    {hasCheque && <div className="w-1 h-1 bg-amber-500 rounded-full"></div>}
                    {hasOverdue && <div className="w-1 h-1 bg-red-500 rounded-full"></div>}
                    {hasTask && <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>}
                  </div>
                </div>
              );
            });
            
            return elements;
          })()}
        </div>
      </div>

      {/* Daily Closing Summary Card */}
      <div className="bg-gradient-to-br from-[#a12328] to-[#c42e34] p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-md">
              Daily Summary ({settings?.daily_report_time || '9:00 PM'})
            </span>
            <button 
              onClick={shareDailyReport}
              className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
            >
              <Share2 size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Closing Cash</p>
              <h4 className="text-2xl font-bold">AED {dailySummary?.closingCash.toLocaleString() || '0'}</h4>
            </div>
            <div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Total Sales</p>
              <h4 className="text-2xl font-bold">AED {dailySummary?.totalSales.toLocaleString() || '0'}</h4>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/80 italic">
            "Click the share icon to send this report to your manager or partners."
          </p>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cheque Alerts */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock size={18} className="text-[#a12328]" />
            Upcoming Cheques
          </h4>
          <div className="space-y-3">
            {chequeAlerts.length > 0 ? chequeAlerts.map(cheque => (
              <div key={cheque.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between group hover:border-[#a12328]/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Cheque #{cheque.cheque_number}</p>
                    <p className="text-xs text-slate-500">Due: {cheque.due_date} • AED {cheque.amount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleSnooze(cheque.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Snooze"
                    >
                      <Clock size={14} />
                    </button>
                    <button 
                      onClick={() => handleDismiss(cheque.id, 'cheques')}
                      className="p-1.5 text-slate-400 hover:text-emerald-500 transition-colors"
                      title="Dismiss"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500">No cheques due tomorrow.</p>
              </div>
            )}
          </div>
        </div>

        {/* Overdue Alerts */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertCircle size={18} className="text-red-500" />
            Overdue Payments
          </h4>
          <div className="space-y-3">
            {overdueAlerts.length > 0 ? overdueAlerts.map(entry => (
              <div key={entry.id} className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20 shadow-sm flex items-center justify-between group hover:bg-red-100/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{entry.customer_name}</p>
                    <p className="text-xs text-red-600 font-medium">Overdue: AED {entry.amount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleSnooze(entry.id)}
                    className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Snooze"
                  >
                    <Clock size={16} />
                  </button>
                  <button 
                    onClick={() => handleDismiss(entry.id, 'petty_cash')}
                    className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                    title="Dismiss"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                  <button 
                    onClick={() => sendWhatsAppReminder(entry)}
                    className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
                    title="Send WhatsApp Warning"
                  >
                    <MessageSquare size={16} />
                  </button>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500">All payments are up to date.</p>
              </div>
            )}
          </div>
        </div>

        {/* General Tasks */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            General Tasks
          </h4>
          <div className="space-y-3">
            {generalTasks.length > 0 ? generalTasks.map(task => (
              <div key={task.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                task.is_completed 
                  ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-60' 
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'
              }`}>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleTaskStatus(task)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      task.is_completed 
                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {task.is_completed && <CheckCircle2 size={14} />}
                  </button>
                  <div>
                    <p className={`text-sm font-bold ${task.is_completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      {task.title}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {format(parseISO(task.datetime), 'dd MMM, HH:mm')} • {task.category}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!task.is_completed && (
                    <button 
                      onClick={() => snoozeTask(task)}
                      className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                      title="Snooze 10m"
                    >
                      <Clock size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setEditingTask(task);
                      setTaskForm({
                        title: task.title,
                        datetime: task.datetime,
                        category: task.category
                      });
                      setShowTaskModal(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-[#a12328] transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500">No tasks planned.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingTask ? 'Edit Task' : 'New Task'}
                </h3>
                <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-slate-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleTaskSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Task Title</label>
                  <input 
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                    placeholder="e.g., Call supplier for pump parts"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Date & Time</label>
                    <input 
                      type="datetime-local"
                      required
                      value={taskForm.datetime}
                      onChange={e => setTaskForm({...taskForm, datetime: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                    <select 
                      value={taskForm.category}
                      onChange={e => setTaskForm({...taskForm, category: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20 text-sm"
                    >
                      {settings?.task_categories?.map((cat: string) => (
                        <option key={cat} value={cat}>{cat}</option>
                      )) || (
                        <>
                          <option value="General">General</option>
                          <option value="Financial">Financial</option>
                          <option value="Urgent">Urgent</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all mt-4"
                >
                  {editingTask ? 'Update Task' : 'Save Task'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Alert Settings Modal */}
      <AnimatePresence>
        {showAlertSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Alert Settings</h3>
                <button onClick={() => setShowAlertSettings(false)} className="text-slate-400 hover:text-slate-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Cheque Advance Alert (Days)</label>
                  <input 
                    type="number"
                    value={alertDays}
                    onChange={(e) => setAlertDays(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 italic">
                    You will see alerts for cheques due within this number of days.
                  </p>
                </div>
                <button 
                  onClick={() => updateAlertSettings(alertDays)}
                  className="w-full py-3 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Technical Setup Info */}
      <div className="bg-slate-900 p-6 rounded-3xl text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#a12328] rounded-2xl">
            <Smartphone size={24} />
          </div>
          <div>
            <h5 className="font-bold text-lg">Mobile Push Integration</h5>
            <p className="text-sm text-slate-400 mt-1">
              This module is configured to sync with Android AlarmManager. Alerts will trigger 24h before cheque due dates and at 9:00 PM daily for closing summaries, even if the app is closed.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-bold text-emerald-500 uppercase">System Active</span>
              </div>
              <button className="text-xs font-bold text-slate-400 hover:text-white transition-colors underline underline-offset-4">
                Configure Notification Channels
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
