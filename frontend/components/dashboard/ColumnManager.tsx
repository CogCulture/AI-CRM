"use client";

import React, { useState } from "react";
import { X, ArrowUp, ArrowDown, Eye, EyeOff, Save, Check } from "lucide-react";
import { toast } from "sonner";

interface ColumnManagerProps {
  isOpen: boolean;
  onClose: () => void;
  allHeaders: string[];
  visibleColumns: string[];
  columnOrder: string[];
  onSave: (visible: string[], order: string[]) => Promise<void>;
}

export default function ColumnManager({
  isOpen,
  onClose,
  allHeaders,
  visibleColumns,
  columnOrder,
  onSave,
}: ColumnManagerProps) {
  // If order is empty, default to allHeaders
  const currentOrder = columnOrder.length > 0 ? columnOrder : [...allHeaders];
  
  // Make sure any missing headers are added to the end of the order
  allHeaders.forEach(h => {
    if (!currentOrder.includes(h)) {
      currentOrder.push(h);
    }
  });

  const [order, setOrder] = useState<string[]>([...currentOrder]);
  const [visible, setVisible] = useState<string[]>(
    visibleColumns.length > 0 ? [...visibleColumns] : [...allHeaders]
  );
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleVisibility = (col: string) => {
    if (visible.includes(col)) {
      // Don't allow hiding ALL columns
      if (visible.length <= 1) {
        toast.warning("At least one column must remain visible");
        return;
      }
      setVisible(visible.filter((c) => c !== col));
    } else {
      setVisible([...visible, col]);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;
    setOrder(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;
    setOrder(newOrder);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(visible, order);
      toast.success("Column visibility & ordering saved");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="w-96 bg-[#0C0C12] border-l border-[rgba(255,255,255,0.08)] h-full relative z-10 flex flex-col justify-between shadow-2xl animate-slide-in">
        <style>
          {`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-slide-in {
              animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}
        </style>

        {/* Header */}
        <div className="p-6 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">Configure Columns</h3>
            <p className="text-xs text-[#888899] mt-1">Manage grid visibility and display order</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.06)] text-[#888899] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-2">
            {order.map((col, idx) => {
              const isVisible = visible.includes(col);
              return (
                <div 
                  key={`${col}-${idx}`}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                    isVisible 
                      ? "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)] text-white" 
                      : "bg-[#09090E]/50 border-transparent text-[#555566]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleVisibility(col)}
                      className={`p-1 rounded cursor-pointer transition-colors ${
                        isVisible 
                          ? "text-indigo-400 hover:text-indigo-300 bg-indigo-500/10" 
                          : "text-[#555566] hover:text-white"
                      }`}
                    >
                      {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <span className="text-sm font-mono tracking-tight truncate max-w-[150px]">{col}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 rounded text-[#888899] hover:text-white disabled:opacity-20 disabled:hover:text-[#888899] transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => moveDown(idx)}
                      disabled={idx === order.length - 1}
                      className="p-1 rounded text-[#888899] hover:text-white disabled:opacity-20 disabled:hover:text-[#888899] transition-colors cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[rgba(255,255,255,0.06)] flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.02)] text-sm font-semibold transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-750 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Config
          </button>
        </div>
      </div>
    </div>
  );
}
