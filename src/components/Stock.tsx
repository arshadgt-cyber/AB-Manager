import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Package, AlertTriangle, 
  ArrowDown, ArrowUp, Edit2, Trash2, XCircle, MoreVertical
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, 
  deleteDoc, doc, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../utils';
import { generateProductDescription } from '../services/aiService';
import { Sparkles } from 'lucide-react';

export const Stock = ({ user }: { user: User }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'general',
    unit: 'pcs',
    current_stock: '0',
    reorder_level: '10',
    cost_price: '0',
    selling_price: '0',
    location: '',
    notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'stock_items'), where('uid', '==', user.uid), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'stock_items'));
    return () => unsubscribe();
  }, [user]);

  const handleAIGenerate = async () => {
    if (!formData.name) {
      alert("Please enter an item name first.");
      return;
    }
    setGenerating(true);
    try {
      const notes = await generateProductDescription(formData.name, formData.category);
      setFormData({ ...formData, notes });
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("Failed to generate description.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(formData.cost_price);
    const sell = parseFloat(formData.selling_price);
    const profit = sell - cost;
    const profitPct = cost > 0 ? (profit / cost) * 100 : 0;

    try {
      await addDoc(collection(db, 'stock_items'), {
        ...formData,
        current_stock: parseFloat(formData.current_stock),
        reorder_level: parseFloat(formData.reorder_level),
        cost_price: cost,
        selling_price: sell,
        profit_per_unit: profit,
        profit_percentage: profitPct,
        stock_value: parseFloat(formData.current_stock) * cost,
        uid: user.uid,
        status: 'active',
        created_at: serverTimestamp()
      });
      setShowAddModal(false);
      setFormData({ name: '', sku: '', category: 'general', unit: 'pcs', current_stock: '0', reorder_level: '10', cost_price: '0', selling_price: '0', location: '', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stock_items');
    }
  };

  const stats = items.reduce((acc, curr) => {
    acc.totalValue += (curr.stock_value || 0);
    if (curr.current_stock <= curr.reorder_level) acc.lowStockCount++;
    return acc;
  }, { totalValue: 0, lowStockCount: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory</h3>
          <p className="text-slate-500">Manage your stock items and reorder levels.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
        >
          <Plus size={20} />
          <span>Add Item</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">Total Items</p>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{items.length}</h4>
        </div>
        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">Total Stock Value</p>
          <h4 className="text-2xl font-bold text-emerald-600">{stats.totalValue.toLocaleString()} AED</h4>
        </div>
        <div className="p-6 bg-amber-500 rounded-2xl text-white shadow-lg">
          <p className="text-white/80 text-sm font-medium mb-1">Low Stock Alerts</p>
          <h4 className="text-2xl font-bold">{stats.lowStockCount}</h4>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-semibold">Item & SKU</th>
                <th className="px-6 py-3 font-semibold">Category</th>
                <th className="px-6 py-3 font-semibold text-right">Stock</th>
                <th className="px-6 py-3 font-semibold text-right">Cost</th>
                <th className="px-6 py-3 font-semibold text-right">Selling</th>
                <th className="px-6 py-3 font-semibold text-right">Profit</th>
                <th className="px-6 py-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {items.length > 0 ? items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-900 dark:text-white font-bold">{item.name}</p>
                    <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-bold ${item.current_stock <= item.reorder_level ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                        {item.current_stock} {item.unit}
                      </span>
                      {item.current_stock <= item.reorder_level && (
                        <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5">
                          <AlertTriangle size={10} /> LOW
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600 dark:text-slate-400">
                    {item.cost_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-slate-900 dark:text-white font-medium">
                    {item.selling_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-bold text-emerald-600">+{item.profit_per_unit.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-500">{item.profit_percentage.toFixed(1)}%</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-2 text-slate-400 hover:text-[#a12328] transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => deleteDoc(doc(db, 'stock_items', item.id))}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    {loading ? 'Loading...' : 'No stock items found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add New Item</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Item Name</label>
                  <input 
                    type="text" required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">SKU / Barcode</label>
                  <input 
                    type="text" required
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                  <input 
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Unit</label>
                  <select 
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="ltr">Liters (ltr)</option>
                    <option value="box">Boxes</option>
                    <option value="pack">Packs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Current Stock</label>
                  <input 
                    type="number" required
                    value={formData.current_stock}
                    onChange={(e) => setFormData({...formData, current_stock: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Reorder Level</label>
                  <input 
                    type="number" required
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({...formData, reorder_level: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Cost Price (AED)</label>
                  <input 
                    type="number" required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({...formData, cost_price: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Selling Price (AED)</label>
                  <input 
                    type="number" required
                    value={formData.selling_price}
                    onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Location / Warehouse</label>
                <input 
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase">Notes / Description</label>
                  <button 
                    type="button" 
                    onClick={handleAIGenerate}
                    disabled={generating}
                    className="text-[10px] font-bold text-[#a12328] flex items-center gap-1 hover:underline disabled:opacity-50"
                  >
                    <Sparkles size={12} className={generating ? 'animate-spin' : ''} /> 
                    {generating ? 'Generating...' : 'AI Generate Description'}
                  </button>
                </div>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20 h-24 resize-none"
                  placeholder="Enter item details or use AI to generate..."
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full py-4 bg-[#a12328] text-white rounded-2xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
