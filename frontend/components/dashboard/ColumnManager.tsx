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
  const [visible, setVisible] = useState<string[]>(() => {
    if (visibleColumns.length === 0) return [...allHeaders];
    const initialVisible = [...visibleColumns];
    allHeaders.forEach(h => {
      if (!visibleColumns.includes(h) && !columnOrder.includes(h) && !initialVisible.includes(h)) {
        initialVisible.push(h);
      }
    });
    return initialVisible;
  });
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-150"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="w-96 bg-white dark:bg-[#0C0C12] border-l border-gray-200 dark:border-[rgba(255,255,255,0.08)] h-full relative z-10 flex flex-col justify-between shadow-2xl animate-slide-in transition-colors duration-150">
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
        <div className="p-6 border-b border-gray-100 dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Configure Columns</h3>
            <p className="text-xs text-gray-500 dark:text-[#888899] mt-1">Manage grid visibility and display order</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-[rgba(255,255,255,0.03)] dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
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
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors duration-150 ${
                    isVisible 
                      ? "bg-gray-50 dark:bg-[rgba(255,255,255,0.02)] border-gray-200 dark:border-[rgba(255,255,255,0.05)] text-gray-900 dark:text-white" 
                      : "bg-transparent border-transparent text-gray-400 dark:text-[#555566]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleVisibility(col)}
                      className={`p-1 rounded cursor-pointer transition-colors ${
                        isVisible 
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" 
                          : "text-gray-400 dark:text-[#555566] hover:text-gray-900 dark:hover:text-white"
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
                      className="p-1 rounded text-gray-400 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white disabled:opacity-20 disabled:hover:text-gray-400 dark:disabled:hover:text-[#888899] transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => moveDown(idx)}
                      disabled={idx === order.length - 1}
                      className="p-1 rounded text-gray-400 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white disabled:opacity-20 disabled:hover:text-gray-400 dark:disabled:hover:text-[#888899] transition-colors cursor-pointer"
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
        <div className="p-6 border-t border-gray-100 dark:border-[rgba(255,255,255,0.06)] flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-[rgba(255,255,255,0.06)] hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.02)] text-sm font-semibold transition-colors cursor-pointer text-center text-gray-700 dark:text-white"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-750 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
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
