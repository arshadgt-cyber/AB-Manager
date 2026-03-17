import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2, Share2, XCircle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ActionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

export const ActionMenu = ({ onEdit, onDelete, onShare, onCancel, cancelLabel = "Cancel" }: ActionMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <MoreVertical size={18} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 py-2"
          >
            <MenuButton icon={Edit2} label="Edit" onClick={() => { onEdit(); setIsOpen(false); }} />
            <MenuButton icon={Share2} label="Share to WhatsApp" onClick={() => { onShare(); setIsOpen(false); }} />
            {onCancel && (
              <MenuButton icon={RotateCcw} label={cancelLabel} onClick={() => { onCancel(); setIsOpen(false); }} />
            )}
            <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
            <MenuButton icon={Trash2} label="Delete" variant="danger" onClick={() => { onDelete(); setIsOpen(false); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MenuButton = ({ icon: Icon, label, onClick, variant = 'default' }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${
      variant === 'danger' 
        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' 
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
    }`}
  >
    <Icon size={16} />
    <span>{label}</span>
  </button>
);
