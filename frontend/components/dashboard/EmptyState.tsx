"use client";

import React from "react";
import Link from "next/link";
import { Plus, Database, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  onLoadMock: () => void;
}

export default function EmptyState({ onLoadMock }: EmptyStateProps) {
  return (
    <div className="obsidian-glass rounded-xl p-12 text-center max-w-2xl mx-auto border border-[rgba(255,255,255,0.06)] bg-[#0C0C12]/30 shadow-2xl relative overflow-hidden my-12">
      <div className="absolute -right-20 -top-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-16 h-16 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6 text-indigo-400">
        <Database className="w-8 h-8" />
      </div>

      <h2 className="font-display text-4xl text-white font-medium mb-3 tracking-wide">
        No Database Synced
      </h2>
      <p className="text-[#888899] text-sm max-w-md mx-auto mb-8 leading-relaxed">
        Connect your CRM to a Google Sheet spreadsheet to enable real-time tracking, column configurations, custom aggregations, and visual chart plotting.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link 
          href="/admin"
          className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Setup Google Sheet
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
        
        <button 
          onClick={onLoadMock}
          className="w-full sm:w-auto px-6 py-3 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] text-[#f1f1f5] rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
        >
          Explore with Mock Data
        </button>
      </div>
    </div>
  );
}
