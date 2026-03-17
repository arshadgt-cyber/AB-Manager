import React from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Edit2, Trash2 } from 'lucide-react';

interface SwipeableRowProps {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}

export const SwipeableRow = ({ children, onEdit, onDelete }: SwipeableRowProps) => {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, -50, 0, 50, 100], [1, 0.5, 1, 0.5, 1]);
  const deleteOpacity = useTransform(x, [-100, -50], [1, 0]);
  const editOpacity = useTransform(x, [50, 100], [0, 1]);

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x < -80) {
      onDelete();
    } else if (info.offset.x > 80) {
      onEdit();
    }
  };

  return (
    <div className="relative overflow-hidden group">
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
        <motion.div style={{ opacity: editOpacity }} className="flex items-center gap-2 text-emerald-600 font-bold">
          <Edit2 size={20} />
          <span>Edit</span>
        </motion.div>
        <motion.div style={{ opacity: deleteOpacity }} className="flex items-center gap-2 text-red-600 font-bold">
          <span>Delete</span>
          <Trash2 size={20} />
        </motion.div>
      </div>

      {/* Foreground Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative bg-white dark:bg-slate-800 z-10 cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
};
