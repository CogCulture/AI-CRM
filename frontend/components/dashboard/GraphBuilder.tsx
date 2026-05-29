"use client";

import React, { useState } from "react";
import { X, ChartBar, ChartLine, ChartArea, ChartPie, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { GraphConfig } from "@/lib/types";

interface GraphBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  rows: Record<string, string>[];
  onSave: (graph: GraphConfig) => Promise<void>;
}

export default function GraphBuilder({
  isOpen,
  onClose,
  headers,
  rows,
  onSave,
}: GraphBuilderProps) {
  const [type, setType] = useState<"bar" | "line" | "pie" | "area">("bar");
  const [xCol, setXCol] = useState(headers[0] || "");
  
  // Find likely numeric columns for default Y column
  const numericHeaders = headers.filter(h => {
    return rows.some(r => {
      const val = r[h] || "";
      const cleaned = val.replace(/[^0-9.-]/g, "");
      return cleaned !== "" && !isNaN(parseFloat(cleaned));
    });
  });
  const [yCol, setYCol] = useState(numericHeaders[0] || headers[1] || headers[0] || "");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const chartTypes: { id: "bar" | "line" | "area" | "pie"; name: string; icon: any }[] = [
    { id: "bar", name: "Bar Chart", icon: ChartBar },
    { id: "line", name: "Line Chart", icon: ChartLine },
    { id: "area", name: "Area Chart", icon: ChartArea },
    { id: "pie", name: "Donut Chart", icon: ChartPie },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Widget Title is required");
      return;
    }
    if (!xCol || !yCol) {
      toast.error("Both X and Y columns must be selected");
      return;
    }

    setSaving(true);
    const newGraph: GraphConfig = {
      id: Math.random().toString(36).substring(2, 11),
      type,
      x_col: xCol,
      y_col: yCol,
      title: title.trim(),
    };

    try {
      await onSave(newGraph);
      toast.success("Dashboard widget added successfully");
      setTitle("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save graph widget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-150"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="bg-white dark:bg-[#0C0C12] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-xl w-full max-w-lg relative z-10 flex flex-col justify-between shadow-2xl overflow-hidden animate-zoom-in transition-colors duration-150">
        <style>
          {`
            @keyframes zoomIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
            .animate-zoom-in {
              animation: zoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}
        </style>

        {/* Header */}
        <div className="p-6 border-b border-gray-150 dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Create Performance Widget</h3>
            <p className="text-xs text-gray-500 dark:text-[#888899] mt-1">Configure parameters to plot visual aggregates</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-[rgba(255,255,255,0.03)] dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-5">
            {/* Widget Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">Widget Title</label>
              <input
                type="text"
                placeholder="e.g. Sales Pipeline by Deal Stage"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 focus:border-emerald-500 dark:bg-[rgba(255,255,255,0.02)] dark:border-[rgba(255,255,255,0.06)] rounded-lg text-gray-900 dark:text-white font-mono placeholder-[#555566] transition-all outline-none"
              />
            </div>

            {/* Type selector */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] block">Chart Type</label>
              <div className="grid grid-cols-4 gap-3">
                {chartTypes.map((item) => {
                  const Icon = item.icon;
                  const isSelected = type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-150 cursor-pointer ${
                        isSelected 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400" 
                          : "bg-gray-50/50 dark:bg-[rgba(255,255,255,0.01)] border-gray-200 dark:border-[rgba(255,255,255,0.04)] text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.03)]"
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1" />
                      <span className="text-[10px] font-medium font-mono">{item.name.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* X Axis dropdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">Label Axis (X)</label>
                <select
                  value={xCol}
                  onChange={(e) => setXCol(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0E0E14] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-lg text-gray-800 dark:text-[#dedee5] font-mono outline-none focus:border-emerald-500"
                >
                  {headers.map((h, idx) => (
                    <option key={`${h}-${idx}`} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Y Axis dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">Value Axis (Y)</label>
                <select
                  value={yCol}
                  onChange={(e) => setYCol(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0E0E14] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-lg text-gray-800 dark:text-[#dedee5] font-mono outline-none focus:border-emerald-500"
                >
                  {headers.map((h, idx) => (
                    <option key={`${h}-${idx}`} value={h}>
                      {h} {numericHeaders.includes(h) ? " (number)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-150 dark:border-[rgba(255,255,255,0.06)] bg-gray-50/50 dark:bg-[#0A0A0F]/50 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-[rgba(255,255,255,0.06)] hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.02)] text-sm font-semibold transition-colors cursor-pointer text-center text-gray-700 dark:text-white"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-750 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Widget
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
