import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Filter, ArrowDownRight, ArrowUpRight, 
  Wallet, Calendar, CreditCard, Globe, FileText, Trash2, Edit2, XCircle,
  MoreVertical, Share2, RotateCcw, Camera, Loader2, Sparkles, Download,
  FileSpreadsheet, File as FileIcon, MessageCircle, PieChart, List
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, 
  deleteDoc, doc, orderBy, limit, Timestamp, serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils';
import { ActionMenu } from './ActionMenu';
import { SwipeableRow } from './SwipeableRow';
import { GoogleGenAI, Type } from '@google/genai';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, HeadingLevel, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

export const PettyCash = ({ user }: { user: User }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'income',
    payment_method: 'cash',
    amount: '',
    category: 'sales',
    description: '',
    reference_number: '',
    customer_name: '',
    due_date: '',
    status: 'pending'
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'app_settings', user.uid));
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    };
    fetchSettings();

    const q = query(
      collection(db, 'petty_cash'), 
      where('uid', '==', user.uid), 
      where('is_archived', '!=', true),
      orderBy('is_archived'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntries(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'petty_cash');
    });

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
        updated_at: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'petty_cash', editingId), data);
      } else {
        await addDoc(collection(db, 'petty_cash'), {
          ...data,
          created_at: serverTimestamp()
        });
      }

      // --- Social Proof Advertising Trigger ---
      const amount = parseFloat(formData.amount);
      const targetProducts = ['Pedrollo', 'Telemecanique', 'Water Pump', 'Pressure Switch'];
      const isTargetProduct = targetProducts.some(p => 
        formData.description.toLowerCase().includes(p.toLowerCase())
      );

      if (!editingId && formData.type === 'income' && (amount >= 1000 || isTargetProduct)) {
        const webhookUrl = process.env.VITE_N8N_MARKETING_WEBHOOK;
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_name: formData.description,
              amount: amount,
              customer: formData.customer_name || 'Valued Customer',
              category: formData.category,
              timestamp: new Date().toISOString(),
              uid: user.uid
            })
          }).catch(err => console.error('Marketing webhook failed:', err));
          
          // Log to marketing_logs
          await addDoc(collection(db, 'marketing_logs'), {
            uid: user.uid,
            product_name: formData.description,
            status: 'success',
            channels: ['WhatsApp', 'Instagram', 'Google My Business'],
            timestamp: serverTimestamp()
          });
        }
      }

      setShowAddModal(false);
      setEditingId(null);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'income',
        payment_method: 'cash',
        amount: '',
        category: 'sales',
        description: '',
        reference_number: '',
        customer_name: '',
        due_date: '',
        status: 'pending'
      });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'petty_cash');
    }
  };

  const handleEdit = (tx: any) => {
    setFormData({
      date: tx.date,
      type: tx.type,
      payment_method: tx.payment_method,
      amount: tx.amount.toString(),
      category: tx.category,
      description: tx.description,
      reference_number: tx.reference_number || '',
      customer_name: tx.customer_name || '',
      due_date: tx.due_date || '',
      status: tx.status || 'pending'
    });
    setEditingId(tx.id);
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // Soft Delete: Move to archived state
      await updateDoc(doc(db, 'petty_cash', id), {
        is_archived: true,
        archived_at: serverTimestamp()
      });
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'petty_cash');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Revert this entry? This will mark it as cancelled and fix the balance.')) return;
    try {
      await updateDoc(doc(db, 'petty_cash', id), {
        status: 'cancelled',
        amount: 0, // Fixing balance by setting amount to 0
        updated_at: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'petty_cash');
    }
  };

  const handleShare = (tx: any) => {
    const message = `AL BERAKAH Transaction:\nDate: ${tx.date}\nCategory: ${tx.category}\nAmount: AED ${tx.amount}\nStatus: ${tx.payment_method}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
                text: "Extract the following information from this receipt: total amount, date, vendor name (use as description), and suggest a category (e.g., sales, purchase, salary, rent, utilities, transport, office supplies, maintenance, marketing, other). If it's a receipt for something bought, type should be 'expense'. If it's an invoice for something sold, type should be 'income'."
              }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER, description: "Total amount on the receipt" },
                date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
                description: { type: Type.STRING, description: "Vendor name or brief description of items" },
                category: { type: Type.STRING, description: "Suggested category in lowercase" },
                type: { type: Type.STRING, description: "'income' or 'expense'" }
              },
              required: ["amount", "date", "description", "category", "type"]
            }
          }
        });

        if (response.text) {
          const data = JSON.parse(response.text);
          setFormData(prev => ({
            ...prev,
            amount: data.amount ? data.amount.toString() : prev.amount,
            date: data.date || prev.date,
            description: data.description || prev.description,
            category: data.category || prev.category,
            type: data.type || prev.type
          }));
        }
        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error scanning receipt:", error);
      alert("Failed to scan receipt. Please try again.");
      setIsScanning(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (entries.length === 0) {
      alert("Not enough data to generate insights.");
      return;
    }

    setIsGeneratingInsights(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Prepare a summary of the data for the AI
      const recentEntries = entries.slice(0, 50).map(e => ({
        date: e.date,
        type: e.type,
        amount: e.amount,
        category: e.category,
        description: e.description
      }));

      const prompt = `
        You are a financial advisor for a business. Analyze the following recent petty cash transactions and provide 3-4 bullet points of actionable financial insights. 
        Keep it concise, professional, and highlight any unusual spending, trends, or areas for cost-saving.
        Format the response in simple markdown with bullet points.
        
        Transactions:
        ${JSON.stringify(recentEntries, null, 2)}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      if (response.text) {
        setInsights(response.text);
      }
    } catch (error) {
      console.error("Error generating insights:", error);
      alert("Failed to generate insights. Please try again.");
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const calculateBalances = (targetDate: string) => {
    const pastEntries = entries.filter(e => e.date < targetDate && e.status !== 'cancelled');
    const targetEntries = entries.filter(e => e.date === targetDate && e.status !== 'cancelled');
    
    const openingBalance = pastEntries.reduce((sum, e) => {
      if (e.payment_method === 'cash') {
        return e.type === 'income' ? sum + e.amount : sum - e.amount;
      }
      return sum;
    }, 0);

    const cashIncome = targetEntries.filter(e => e.type === 'income' && e.payment_method === 'cash').reduce((sum, e) => sum + e.amount, 0);
    const cashExpense = targetEntries.filter(e => e.type === 'expense' && e.payment_method === 'cash').reduce((sum, e) => sum + e.amount, 0);
    
    const closingBalance = openingBalance + cashIncome - cashExpense;
    
    return { openingBalance, closingBalance, targetEntries };
  };

  const handleExportPDFDaily = () => {
    if (entries.length === 0) return alert("No data to export.");
    setShowExportMenu(false);

    const targetDate = entries[0].date;
    const { openingBalance, closingBalance, targetEntries } = calculateBalances(targetDate);

    const doc = new jsPDF();
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`OPENING BALANCE - ${openingBalance}/-`, 105, 15, { align: "center" });
    
    doc.setFontSize(10);
    const [year, month, day] = targetDate.split('-');
    doc.text(`DATE: ${day}/${month}/${year}`, 14, 25);

    const incomeEntries = targetEntries.filter(e => e.type === 'income');
    const expenseEntries = targetEntries.filter(e => e.type === 'expense');

    const body = [
      [{ content: 'INCOME', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ...incomeEntries.map(tx => ['', tx.description || tx.category, tx.payment_method.toUpperCase(), tx.amount.toString()]),
      [{ content: 'EXPENSES', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ...expenseEntries.map(tx => ['', tx.description || tx.category, tx.payment_method.toUpperCase(), tx.amount.toString()]),
      [
        { content: '', styles: { fillColor: [255, 255, 255] } },
        { content: 'CLOSING BALANCE :', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 255, 255] } },
        { content: `${closingBalance}/-`, styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } }
      ]
    ];

    autoTable(doc, {
      startY: 30,
      head: [['', 'Description', 'Payment Method', 'Amount (AED)']],
      body: body,
      theme: 'grid',
      styles: { lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 40, halign: 'center' }
      }
    });

    doc.save(`daily_cash_report_${targetDate}.pdf`);
  };

  const handleExportPDFStandard = () => {
    if (entries.length === 0) return alert("No data to export.");
    setShowExportMenu(false);

    const doc = new jsPDF();
    doc.text("Petty Cash Standard Report", 14, 15);
    
    const tableColumn = ["Date", "Type", "Category", "Description", "Method", "Amount", "Status"];
    const tableRows = entries.map(tx => [
      tx.date, tx.type, tx.category, tx.description || '', tx.payment_method, tx.amount.toString(), tx.status || 'completed'
    ]);

    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 20 });
    doc.save(`petty_cash_standard_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleExportExcelStandard = () => {
    if (entries.length === 0) return alert("No data to export.");
    setShowExportMenu(false);

    const excelData = entries.map(tx => ({
      Date: tx.date, Type: tx.type, Category: tx.category, Description: tx.description || '',
      'Payment Method': tx.payment_method, 'Amount (AED)': tx.amount, Status: tx.status || 'completed'
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Petty Cash");
    XLSX.writeFile(workbook, `petty_cash_standard_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportExcelCategory = () => {
    if (entries.length === 0) return alert("No data to export.");
    setShowExportMenu(false);

    const categoryTotals = entries.reduce((acc: any, tx: any) => {
      if (!acc[tx.category]) acc[tx.category] = { income: 0, expense: 0 };
      if (tx.type === 'income') acc[tx.category].income += tx.amount;
      else acc[tx.category].expense += tx.amount;
      return acc;
    }, {});

    const excelData = Object.keys(categoryTotals).map(cat => ({
      Category: cat.toUpperCase(),
      'Total Income (AED)': categoryTotals[cat].income,
      'Total Expense (AED)': categoryTotals[cat].expense,
      'Net (AED)': categoryTotals[cat].income - categoryTotals[cat].expense
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Category Summary");
    XLSX.writeFile(workbook, `category_summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportWordDetailed = async () => {
    if (entries.length === 0) return alert("No data to export.");
    setShowExportMenu(false);

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ["Date", "Type", "Category", "Description", "Method", "Amount", "Status"].map(h => 
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })], shading: { fill: "F3F4F6" } })
          )
        }),
        ...entries.map(tx => new TableRow({
          children: [tx.date, tx.type, tx.category, tx.description || '', tx.payment_method, tx.amount.toString(), tx.status || 'completed']
            .map(val => new TableCell({ children: [new Paragraph({ text: val })] }))
        }))
      ]
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: "Petty Cash Detailed Report", heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
          table
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `petty_cash_detailed_${format(new Date(), 'yyyy-MM-dd')}.docx`);
  };

  const handleShareWhatsApp = () => {
    setShowExportMenu(false);
    if (entries.length === 0) return alert("No data to share.");
    
    const targetDate = entries[0].date;
    const { openingBalance, closingBalance, targetEntries } = calculateBalances(targetDate);
    
    const [year, month, day] = targetDate.split('-');
    const displayDate = `${day}/${month}/${year}`;
    
    let text = `*PETTY CASH - ${displayDate}*\n\n`;
    text += `*OPENING BALANCE:* ${openingBalance}/-\n\n\n`;

    const groupedIncome: Record<string, any[]> = { 'CASH': [], 'CARD': [], 'BANK TRANSFER': [], 'CHEQUE': [] };
    const groupedExpense: Record<string, any[]> = { 'CASH': [], 'CARD': [], 'BANK TRANSFER': [], 'CHEQUE': [] };

    targetEntries.forEach(tx => {
      const m = (tx.payment_method || '').toLowerCase();
      let key = 'OTHER';
      if (m.includes('cash')) key = 'CASH';
      else if (m.includes('card') || m.includes('credit')) key = 'CARD';
      else if (m.includes('bank') || m.includes('transfer')) key = 'BANK TRANSFER';
      else if (m.includes('cheque') || m.includes('check')) key = 'CHEQUE';
      else key = (tx.payment_method || 'OTHER').toUpperCase();

      if (tx.type === 'income') {
        if (!groupedIncome[key]) groupedIncome[key] = [];
        groupedIncome[key].push(tx);
      } else {
        if (!groupedExpense[key]) groupedExpense[key] = [];
        groupedExpense[key].push(tx);
      }
    });

    const allKeys = new Set(['CASH', 'CARD', 'BANK TRANSFER', 'CHEQUE']);
    Object.keys(groupedIncome).forEach(k => allKeys.add(k));
    Object.keys(groupedExpense).forEach(k => allKeys.add(k));
    const finalKeys = Array.from(allKeys);

    finalKeys.forEach(key => {
      text += `*INCOME(${key}) :*\n`;
      if (groupedIncome[key] && groupedIncome[key].length > 0) {
        groupedIncome[key].forEach(tx => {
          text += `* ${(tx.description || tx.category).toUpperCase()} - ${tx.amount}/-\n`;
        });
      }
    });

    text += `\n\n`;

    finalKeys.forEach(key => {
      text += `*EXPENSES(${key}) :*\n`;
      if (groupedExpense[key] && groupedExpense[key].length > 0) {
        groupedExpense[key].forEach(tx => {
          text += `* ${(tx.description || tx.category).toUpperCase()} - ${tx.amount}/-\n`;
        });
      }
    });

    text += `\n\n*CLOSING BALANCE : ${closingBalance}/-*`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const totals = entries.reduce((acc, curr) => {
    if (curr.type === 'income') acc.income += curr.amount;
    else acc.expense += curr.amount;
    return acc;
  }, { income: 0, expense: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Petty Cash</h3>
          <p className="text-slate-500">Track your daily income and expenses.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={exportMenuRef}>
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={entries.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
              title="Export Options"
            >
              <Download size={20} />
              <span className="hidden sm:inline">Export</span>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-2 z-50">
                <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">PDF Reports</div>
                <button 
                  onClick={handleExportPDFDaily}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <FileText size={16} className="text-red-500" />
                  Daily Cash Report (Image Style)
                </button>
                <button 
                  onClick={handleExportPDFStandard}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <List size={16} className="text-red-500" />
                  Standard List
                </button>

                <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mt-2 border-t border-slate-100 dark:border-slate-700 pt-3">Excel Reports</div>
                <button 
                  onClick={handleExportExcelStandard}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                  Standard List
                </button>
                <button 
                  onClick={handleExportExcelCategory}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <PieChart size={16} className="text-emerald-600" />
                  Category Summary
                </button>

                <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mt-2 border-t border-slate-100 dark:border-slate-700 pt-3">Word Reports</div>
                <button 
                  onClick={handleExportWordDetailed}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <FileIcon size={16} className="text-blue-600" />
                  Detailed Report
                </button>

                <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mt-2 border-t border-slate-100 dark:border-slate-700 pt-3">Share</div>
                <button 
                  onClick={handleShareWhatsApp}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <MessageCircle size={16} className="text-green-500" />
                  Share to WhatsApp
                </button>
              </div>
            )}
          </div>
          <button 
            onClick={handleGenerateInsights}
            disabled={isGeneratingInsights || entries.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {isGeneratingInsights ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            <span className="hidden sm:inline">{isGeneratingInsights ? 'Analyzing...' : 'AI Insights'}</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#a12328] text-white rounded-xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
          >
            <Plus size={20} />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">Total Income</p>
          <h4 className="text-2xl font-bold text-emerald-600">{totals.income.toLocaleString()} AED</h4>
        </div>
        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-1">Total Expenses</p>
          <h4 className="text-2xl font-bold text-red-600">{totals.expense.toLocaleString()} AED</h4>
        </div>
        <div className="p-6 bg-gradient-to-br from-[#a12328] to-[#c42e34] rounded-2xl text-white shadow-lg">
          <p className="text-white/80 text-sm font-medium mb-1">Net Balance</p>
          <h4 className="text-2xl font-bold">{(totals.income - totals.expense).toLocaleString()} AED</h4>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search transactions..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm outline-none focus:ring-2 ring-[#a12328]/20"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-medium">
            <Filter size={18} />
            <span>Filter</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase tracking-wider flex px-6 py-3 font-semibold">
              <div className="w-32">Date</div>
              <div className="w-24">Type</div>
              <div className="w-32">Category</div>
              <div className="flex-1">Description</div>
              <div className="w-24">Method</div>
              <div className="w-32 text-right">Amount</div>
              <div className="w-20 text-center">Actions</div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {entries.length > 0 ? entries.map((tx) => (
                <SwipeableRow 
                  key={tx.id} 
                  onEdit={() => handleEdit(tx)} 
                  onDelete={() => setShowDeleteConfirm(tx.id)}
                >
                  <div 
                    className={`flex items-center px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${tx.status === 'cancelled' ? 'opacity-50 grayscale' : ''}`}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Long press/Right click simulation
                    }}
                  >
                    <div className="w-32 text-sm text-slate-600 dark:text-slate-400">{tx.date}</div>
                    <div className="w-24">
                      <span className={`flex items-center gap-1 text-xs font-bold uppercase ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.type === 'income' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        {tx.type}
                      </span>
                    </div>
                    <div className="w-32">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {tx.category}
                      </span>
                    </div>
                    <div className="flex-1 text-sm text-slate-900 dark:text-white font-medium">
                      {tx.description}
                      {tx.payment_method === 'credit' && (
                        <div className="text-[10px] text-[#a12328] font-bold uppercase mt-1">
                          Customer: {tx.customer_name}
                        </div>
                      )}
                      {tx.status === 'cancelled' && (
                        <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold">Cancelled</span>
                      )}
                    </div>
                    <div className="w-24 text-sm text-slate-500 capitalize">{tx.payment_method}</div>
                    <div className={`w-32 text-sm font-bold text-right ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()} AED
                    </div>
                    <div className="w-20 flex justify-center">
                      <ActionMenu 
                        onEdit={() => handleEdit(tx)}
                        onDelete={() => setShowDeleteConfirm(tx.id)}
                        onShare={() => handleShare(tx)}
                        onCancel={() => handleCancel(tx.id)}
                        cancelLabel="Revert Entry"
                      />
                    </div>
                  </div>
                </SwipeableRow>
              )) : (
                <div className="px-6 py-12 text-center text-slate-500">
                  {loading ? 'Loading entries...' : 'No entries found.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights Modal */}
      {insights && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20">
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                <Sparkles size={24} />
                <h3 className="text-xl font-bold">Financial Insights</h3>
              </div>
              <button onClick={() => setInsights(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {insights.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 text-slate-700 dark:text-slate-300">{line}</p>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button 
                  onClick={() => setInsights(null)}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Confirm Delete</h3>
            <p className="text-slate-500 text-sm mb-6">
              Are you sure you want to delete this transaction? It will be archived for your records.
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
                Delete
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
                {editingId ? 'Edit Transaction' : 'Add New Entry'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingId && (
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-3">
                  <input type="file" accept="*/*" className="hidden" ref={fileInputRef} onChange={handleScanReceipt} />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isScanning} 
                    className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                    {isScanning ? 'Scanning Receipt...' : 'Scan Receipt with AI'}
                  </button>
                  <p className="text-xs text-slate-500 text-center">Upload a photo or document (PDF, etc.) of a receipt to auto-fill the details below.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Amount (AED)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Method</label>
                  <select 
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                  >
                    {(settings?.payment_methods || ['Cash', 'Bank Transfer', 'Cheque', 'Credit Card']).map((method: string) => (
                      <option key={method} value={method.toLowerCase()}>{method}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.payment_method === 'credit' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Customer Name</label>
                    <input 
                      type="text" required
                      placeholder="Enter name..."
                      value={formData.customer_name}
                      onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Due Date</label>
                    <input 
                      type="date" required
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                <select 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20"
                >
                  {(settings?.petty_cash_categories || ['Sales', 'Purchase', 'Salary', 'Rent', 'Utilities', 'Transport', 'Office Supplies', 'Maintenance', 'Marketing', 'Other']).map((cat: string) => (
                    <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                <textarea 
                  placeholder="Enter details..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none focus:ring-2 ring-[#a12328]/20 h-20 resize-none"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full py-4 bg-[#a12328] text-white rounded-2xl font-bold shadow-lg hover:bg-[#8a1e22] transition-all"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
