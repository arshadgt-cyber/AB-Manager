import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, FileCheck, Clock, CheckCircle2, 
  XCircle, Printer, ArrowUpRight, ArrowDownRight, MoreVertical, Trash2,
  AlertCircle, Share2, RotateCcw, Edit2, Camera, Loader2, Sparkles
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, 
  deleteDoc, doc, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils';
import { ActionMenu } from './ActionMenu';
import { SwipeableRow } from './SwipeableRow';
import { GoogleGenAI, Type } from '@google/genai';
import { useRef } from 'react';

export const Cheques = ({ user }: { user: User }) => {
  const [cheques, setCheques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    cheque_type: 'outgoing',
    payee_name: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    bank_name: 'Emirates NBD',
    cheque_number: '',
    status: 'pending',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    alert_days: 3
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'app_settings', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(data);
      }
    };
    fetchSettings();

    const q = query(
      collection(db, 'cheques'), 
      where('uid', '==', user.uid), 
      where('is_archived', '!=', true),
      orderBy('is_archived'),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCheques(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'cheques'));
    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
        uid: user.uid,
        is_archived: false,
        updated_at: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'cheques', editingId), data);
      } else {
        await addDoc(collection(db, 'cheques'), {
          ...data,
          created_at: serverTimestamp(),
          print_count: 0
        });
      }

      setShowAddModal(false);
      setEditingId(null);
      setFormData({
        cheque_type: 'outgoing',
        payee_name: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        bank_name: 'Emirates NBD',
        cheque_number: '',
        status: 'pending',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
        alert_days: settings?.cheque_alert_days || 3
      });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'cheques');
    }
  };

  const handleEdit = (ch: any) => {
    setFormData({
      cheque_type: ch.cheque_type,
      payee_name: ch.payee_name,
      amount: ch.amount.toString(),
      date: ch.date,
      bank_name: ch.bank_name,
      cheque_number: ch.cheque_number,
      status: ch.status,
      due_date: ch.due_date,
      notes: ch.notes || '',
      alert_days: ch.alert_days || 3
    });
    setEditingId(ch.id);
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'cheques', id), {
        is_archived: true,
        archived_at: serverTimestamp()
      });
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'cheques');
    }
  };

  const handleVoid = async (id: string) => {
    if (!confirm('Mark this cheque as Void/Cancelled?')) return;
    try {
      await updateDoc(doc(db, 'cheques', id), { 
        status: 'void',
        updated_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'cheques');
    }
  };

  const handleShare = (ch: any) => {
    const message = `AL BERAKAH Cheque Details:\nType: ${ch.cheque_type}\nParty: ${ch.payee_name}\nBank: ${ch.bank_name}\nNumber: ${ch.cheque_number}\nAmount: AED ${ch.amount}\nDue Date: ${ch.due_date}\nStatus: ${ch.status}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleScanCheque = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64String,
                  mimeType: file.type
                }
              },
              {
                text: "Extract the following information from this cheque or receipt: payee/party name, amount, date, cheque number, and bank name. If it's a cheque you are receiving, type should be 'incoming'. If it's a cheque you are giving, type should be 'outgoing'."
              }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER, description: "Total amount" },
                date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
                payee_name: { type: Type.STRING, description: "Name of the party or payee" },
                cheque_number: { type: Type.STRING, description: "Cheque number" },
                bank_name: { type: Type.STRING, description: "Name of the bank" },
                cheque_type: { type: Type.STRING, description: "'incoming' or 'outgoing'" }
              },
              required: ["amount", "date", "payee_name", "cheque_number", "bank_name", "cheque_type"]
            }
          }
        });

        if (response.text) {
          const data = JSON.parse(response.text);
          setFormData(prev => ({
            ...prev,
            amount: data.amount ? data.amount.toString() : prev.amount,
            date: data.date || prev.date,
            due_date: data.date || prev.due_date,
            payee_name: data.payee_name || prev.payee_name,
            cheque_number: data.cheque_number || prev.cheque_number,
            bank_name: data.bank_name || prev.bank_name,
            cheque_type: data.cheque_type || prev.cheque_type
          }));
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error scanning cheque:", error);
      alert("Failed to scan cheque. Please try again.");
      setIsScanning(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'cheques', id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'cheques');
    }
  };

  const stats = cheques.reduce((acc, curr) => {
    const amount = curr.amount || 0;
    if (curr.status === 'pending') {
      if (curr.cheque_type === 'incoming') acc.toReceive += amount;
      else acc.toPay += amount;
      acc.pendingCount++;
    } else if (curr.status === 'cleared') {
      acc.bankBalance += (curr.cheque_type === 'incoming' ? amount : -amount);
    } else if (curr.status === 'bounced') {
      acc.bouncedCount++;
    }
    return acc;
  }, { toReceive: 0, toPay: 0, pendingCount: 0, bankBalance: 0, bouncedCount: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Cheque Management</h3>
          <p className="text-slate-500">Track incoming and outgoing cheques.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
          >
            <Plus size={20} />
            <span>New Cheque</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">Bank Balance (Cleared)</p>
          <h4 className={`text-2xl font-bold ${stats.bankBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {stats.bankBalance.toLocaleString()} AED
          </h4>
        </div>
        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">To Receive (PDCs)</p>
          <h4 className="text-2xl font-bold text-emerald-600">{stats.toReceive.toLocaleString()} AED</h4>
        </div>
        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">To Pay (PDCs)</p>
          <h4 className="text-2xl font-bold text-red-600">{stats.toPay.toLocaleString()} AED</h4>
        </div>
        <div className="p-6 bg-[#a12328] rounded-2xl text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Pending Cheques</p>
              <h4 className="text-2xl font-bold">{stats.pendingCount}</h4>
            </div>
            {stats.bouncedCount > 0 && (
              <div className="bg-white/20 p-2 rounded-lg animate-pulse">
                <XCircle size={20} />
                <span className="text-[10px] font-bold block mt-1">{stats.bouncedCount} Bounced</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase tracking-wider flex px-6 py-3 font-semibold">
              <div className="w-24">Type</div>
              <div className="flex-1">Party / Payee</div>
              <div className="w-48">Bank & Number</div>
              <div className="w-32">Due Date</div>
              <div className="w-32 text-right">Amount</div>
              <div className="w-32">Status</div>
              <div className="w-24 text-center">Actions</div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {cheques.length > 0 ? cheques.map((ch) => (
                <SwipeableRow 
                  key={ch.id} 
                  onEdit={() => handleEdit(ch)} 
                  onDelete={() => setShowDeleteConfirm(ch.id)}
                >
                  <div className={`flex items-center px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${ch.status === 'bounced' ? 'bg-red-50 dark:bg-red-900/10' : ''} ${ch.status === 'void' ? 'opacity-50 grayscale' : ''}`}>
                    <div className="w-24">
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${ch.cheque_type === 'incoming' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {ch.cheque_type === 'incoming' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        {ch.cheque_type}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-900 dark:text-white font-bold">{ch.payee_name}</p>
                      {ch.status === 'bounced' && (
                        <span className="text-[10px] text-red-600 font-black uppercase flex items-center gap-1 mt-1">
                          <AlertCircle size={12} /> Bounced Alert
                        </span>
                      )}
                      {ch.status === 'void' && (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold mt-1 inline-block">Void</span>
                      )}
                    </div>
                    <div className="w-48">
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{ch.bank_name}</p>
                      <p className="text-xs text-slate-500">#{ch.cheque_number}</p>
                    </div>
                    <div className="w-32 text-sm text-slate-600 dark:text-slate-400">{ch.due_date}</div>
                    <div className="w-32 text-sm font-bold text-right text-slate-900 dark:text-white">
                      {ch.amount.toLocaleString()} AED
                    </div>
                    <div className="w-32 px-2">
                      <select 
                        value={ch.status}
                        onChange={(e) => updateStatus(ch.id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border-none outline-none w-full ${
                          ch.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          ch.status === 'cleared' ? 'bg-emerald-100 text-emerald-700' :
                          ch.status === 'bounced' ? 'bg-red-100 text-red-700' :
                          ch.status === 'void' ? 'bg-slate-200 text-slate-600' :
                          'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="deposited">Deposited</option>
                        <option value="cleared">Cleared</option>
                        <option value="bounced">Bounced</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="void">Void</option>
                      </select>
                    </div>
                    <div className="w-24 flex justify-center items-center gap-1">
                      <button className="p-1.5 text-slate-400 hover:text-[#a12328] transition-colors">
                        <Printer size={16} />
                      </button>
                      <ActionMenu 
                        onEdit={() => handleEdit(ch)}
                        onDelete={() => setShowDeleteConfirm(ch.id)}
                        onShare={() => handleShare(ch)}
                        onCancel={() => handleVoid(ch.id)}
                        cancelLabel="Void Cheque"
                      />
                    </div>
                  </div>
                </SwipeableRow>
              )) : (
                <div className="px-6 py-12 text-center text-slate-500">
                  {loading ? 'Loading...' : 'No cheques found.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Archive Cheque</h3>
            <p className="text-slate-500 text-sm mb-6">
              Are you sure you want to remove this cheque from active list? It will be archived for your records.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Cheque' : 'Add New Cheque'}
              </h3>
              <div className="flex items-center gap-2">
                {!editingId && (
                  <>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleScanCheque}
                      accept="image/*,application/pdf"
                      className="hidden" 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isScanning}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all disabled:opacity-50"
                    >
                      {isScanning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isScanning ? 'Scanning...' : 'Scan with AI'}
                    </button>
                  </>
                )}
                <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={24} />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                  <select 
                    value={formData.cheque_type}
                    onChange={(e) => setFormData({...formData, cheque_type: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  >
                    <option value="outgoing">Outgoing (To Pay)</option>
                    <option value="incoming">Incoming (To Receive)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Cheque Number</label>
                  <input 
                    type="text" required
                    value={formData.cheque_number}
                    onChange={(e) => setFormData({...formData, cheque_number: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Party / Payee Name</label>
                <input 
                  type="text" required
                  value={formData.payee_name}
                  onChange={(e) => setFormData({...formData, payee_name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Amount (AED)</label>
                  <input 
                    type="number" required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Bank Name</label>
                  <select 
                    value={formData.bank_name}
                    onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  >
                    {(settings?.banks || [
                      {name: 'Emirates NBD'}, 
                      {name: 'Dubai Islamic Bank'}, 
                      {name: 'Abu Dhabi Commercial Bank'}, 
                      {name: 'First Abu Dhabi Bank'}, 
                      {name: 'Mashreq Bank'}, 
                      {name: 'RAKBANK'}, 
                      {name: 'Other'}
                    ]).map((bank: any) => (
                      <option key={bank.name} value={bank.name}>{bank.name} {bank.alias ? `(${bank.alias})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Cheque Date</label>
                  <input 
                    type="date" required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Due Date</label>
                  <input 
                    type="date" required
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Alert (Days Before)</label>
                  <input 
                    type="number" required
                    value={formData.alert_days}
                    onChange={(e) => setFormData({...formData, alert_days: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
              </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full py-4 bg-[#a12328] text-white rounded-2xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
                >
                  Save Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
