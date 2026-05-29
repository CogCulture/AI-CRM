"use client";

import React from "react";
import Link from "next/link";
import { Plus, Database, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  onLoadMock: () => void;
}

export default function EmptyState({ onLoadMock }: EmptyStateProps) {
  return (
    <div className="obsidian-glass rounded-xl p-12 text-center max-w-2xl mx-auto border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white/50 dark:bg-[#0C0C12]/30 shadow-2xl relative overflow-hidden my-12 transition-colors duration-150">
      <div className="absolute -right-20 -top-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-16 h-16 rounded-full bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 text-emerald-600 dark:text-emerald-400">
        <Database className="w-8 h-8" />
      </div>

      <h2 className="font-display text-4xl text-gray-900 dark:text-white font-medium mb-3 tracking-wide">
        No Database Synced
      </h2>
      <p className="text-gray-500 dark:text-[#888899] text-sm max-w-md mx-auto mb-8 leading-relaxed">
        Connect your CRM to a Google Sheet spreadsheet to enable real-time tracking, column configurations, custom aggregations, and visual chart plotting.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link 
          href="/admin"
          className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Setup Google Sheet
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
        
        <button 
          onClick={onLoadMock}
          className="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-[rgba(255,255,255,0.04)] dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] hover:border-gray-300 dark:hover:border-[rgba(255,255,255,0.15)] text-gray-900 dark:text-[#f1f1f5] rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
        >
          Explore with Mock Data
        </button>
      </div>
    </div>
  );
}
