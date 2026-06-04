"use client";

import React, { useState, useMemo } from "react";
import { SheetData } from "@/lib/types";
import { Search, Calendar, AlertTriangle, CheckCircle2, Clock, DollarSign, Users } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import LeadFormModal from "./LeadFormModal";

interface DataPlatformViewProps {
  sheetData: SheetData;
  onRefresh: () => Promise<void>;
}

// Helper to parse dates like DD/MM/YYYY or DD-MM-YYYY
const parseDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  const dateStr = String(dateVal).trim();
  if (!dateStr || dateStr === "—" || dateStr.toLowerCase() === "placeholder") return null;

  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      // YYYY-MM-DD
      if (parts[0].length === 4) {
        return new Date(p0, p1 - 1, p2);
      }
      // DD-MM-YYYY or DD/MM/YYYY
      if (parts[2].length === 4) {
        return new Date(p2, p1 - 1, p0);
      }
    }
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : new Date(parsed);
};

export default function DataPlatformView({ sheetData, onRefresh }: DataPlatformViewProps) {
  const [activeFilter, setActiveFilter] = useState<"ongoing" | "expired" | "due_today">("ongoing");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Column detection
  const dateCol = sheetData.headers.find(h => h.toLowerCase().includes("date")) || "";
  const companyCol = sheetData.headers.find(h => h.toLowerCase() === "company" || h.toLowerCase().includes("company")) || "";
  const statusCol = sheetData.headers.find(h => h.toLowerCase() === "status" || h.toLowerCase().includes("status")) || "";
  const stageCol = sheetData.headers.find(h => h.toLowerCase() === "stage" || h.toLowerCase().includes("stage")) || "";
  const deadlineCol = sheetData.headers.find(h => h.toLowerCase().includes("deadline") || h.toLowerCase().includes("due")) || "";
  const pocCol = sheetData.headers.find(h => h.toLowerCase().includes("poc")) || "";
  const valCol = sheetData.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("value") || hl.includes("amount") || hl.includes("revenue") || hl.includes("estimations") || hl.includes("deal size");
  }) || "";

  // Group leads by category based on current local date: 2026-06-04
  const today = new Date(2026, 5, 4); // June 4, 2026 (local context is 2026-06-04)

  const categorizedLeads = useMemo(() => {
    const categories = {
      ongoing: [] as Record<string, any>[],
      expired: [] as Record<string, any>[],
      due_today: [] as Record<string, any>[],
    };

    if (!sheetData || !sheetData.rows) return categories;

    sheetData.rows.forEach(row => {
      const deadlineStr = deadlineCol ? String(row[deadlineCol] || "").trim() : "";
      const deadlineDate = parseDate(deadlineStr);

      if (!deadlineDate) {
        categories.ongoing.push(row);
        return;
      }

      // Midnight comparison
      const dDate = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
      const tDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      if (dDate.getTime() === tDate.getTime()) {
        categories.due_today.push(row);
      } else if (dDate.getTime() < tDate.getTime()) {
        categories.expired.push(row);
      } else {
        categories.ongoing.push(row);
      }
    });

    return categories;
  }, [sheetData, deadlineCol]);

  // Filter current active list by search term
  const displayedLeads = useMemo(() => {
    const list = categorizedLeads[activeFilter];
    if (!searchTerm.trim()) return list;

    return list.filter(row => {
      return Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [categorizedLeads, activeFilter, searchTerm]);

  // Calculate metrics for active category
  const metrics = useMemo(() => {
    const list = categorizedLeads[activeFilter];
    let totalRevenue = 0;
    const uniquePocs = new Set<string>();

    list.forEach(row => {
      if (valCol) {
        const valStr = String(row[valCol] || "").replace(/[$,₹\s]/g, "").replace(/,/g, "").trim();
        const num = parseFloat(valStr);
        if (!isNaN(num)) totalRevenue += num;
      }
      if (pocCol) {
        const pocName = String(row[pocCol] || "").trim();
        if (pocName) uniquePocs.add(pocName);
      }
    });

    return {
      count: list.length,
      revenue: totalRevenue,
      pocs: uniquePocs.size
    };
  }, [categorizedLeads, activeFilter, valCol, pocCol]);

  const handleEdit = (row: Record<string, any>) => {
    setSelectedLead(row);
    setIsEditModalOpen(true);
  };

  const handleSaveLead = async (leadDataInput: Record<string, any>) => {
    if (!selectedLead || !selectedLead._row_num) return;
    try {
      await api.updateLead(selectedLead._row_num, leadDataInput);
      toast.success("Lead updated successfully");
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update lead");
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="font-sans text-2xl text-gray-900 dark:text-white font-bold tracking-tight">
          Data Platform
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#888899] font-mono mt-1">
          Operational warehouse control center for all sheets sync tables
        </p>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-[#111118]/80 p-3 rounded-2xl border border-gray-150 dark:border-white/5">
        <div className="flex items-center gap-2">
          {/* Ongoing Filter */}
          <button
            onClick={() => setActiveFilter("ongoing")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold font-sans transition-all flex items-center gap-2 cursor-pointer ${
              activeFilter === "ongoing"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-[#3CD395] border border-emerald-150 dark:border-emerald-500/20"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white border border-transparent"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Ongoing
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-gray-200/50 dark:bg-white/5 text-gray-500 dark:text-[#888899]">
              {categorizedLeads.ongoing.length}
            </span>
          </button>

          {/* Due Today Filter */}
          <button
            onClick={() => setActiveFilter("due_today")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold font-sans transition-all flex items-center gap-2 cursor-pointer ${
              activeFilter === "due_today"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-[#FBBF24] border border-amber-150 dark:border-amber-500/20"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white border border-transparent"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Due Today
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-gray-200/50 dark:bg-white/5 text-gray-500 dark:text-[#888899]">
              {categorizedLeads.due_today.length}
            </span>
          </button>

          {/* Expired Filter */}
          <button
            onClick={() => setActiveFilter("expired")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold font-sans transition-all flex items-center gap-2 cursor-pointer ${
              activeFilter === "expired"
                ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-150 dark:border-red-500/20"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white border border-transparent"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Expired
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-gray-200/50 dark:bg-white/5 text-gray-500 dark:text-[#888899]">
              {categorizedLeads.expired.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-[#888899]" />
          <input
            type="text"
            placeholder="Search leads in this list..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/5 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#555566] outline-none font-sans"
          />
        </div>
      </div>

      {/* KPI Cards specific to filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Count */}
        <div className="p-5 rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#111118] flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-gray-400 dark:text-[#888899]">Filter Total Leads</p>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{metrics.count} leads</h4>
          </div>
        </div>

        {/* Pipeline / Closed Value */}
        <div className="p-5 rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#111118] flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-gray-400 dark:text-[#888899]">Filter Revenue Sum</p>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{formatCurrency(metrics.revenue)}</h4>
          </div>
        </div>

        {/* Designated POCs */}
        <div className="p-5 rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#111118] flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl border border-indigo-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-gray-400 dark:text-[#888899]">Active Designated POCs</p>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{metrics.pocs} owners</h4>
          </div>
        </div>
      </div>

      {/* Main Table for Filtered List */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#111118] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#161622]/40 text-[10px] font-sans font-semibold uppercase tracking-wider text-gray-500 dark:text-[#888899]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 text-right">Revenue Estimate</th>
                <th className="py-3 px-4">Deadline</th>
                <th className="py-3 px-4">Cog POC</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedLeads.length > 0 ? (
                displayedLeads.map((row, idx) => {
                  const dlVal = deadlineCol ? String(row[deadlineCol] || "").trim() : "";
                  const revStr = valCol ? String(row[valCol] || "").replace(/[$,₹\s]/g, "").replace(/,/g, "").trim() : "";
                  const parsedRev = parseFloat(revStr);
                  const formattedRev = !isNaN(parsedRev) ? formatCurrency(parsedRev) : "—";
                  
                  return (
                    <tr 
                      key={idx} 
                      className="border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50/30 dark:hover:bg-white/2 transition-colors text-xs font-sans text-gray-900 dark:text-gray-100"
                    >
                      <td className="py-3 px-4 font-mono">{dateCol ? row[dateCol] : "—"}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                        {companyCol ? row[companyCol] : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {statusCol && row[statusCol] && (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none ${
                            String(row[statusCol]).toLowerCase() === "hot"
                              ? "bg-red-50 text-red-600 dark:bg-red-550/10 dark:text-red-400"
                              : "bg-blue-50 text-blue-600 dark:bg-blue-550/10 dark:text-blue-400"
                          }`}>
                            {row[statusCol]}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {stageCol && row[stageCol] && (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none ${
                            ["won", "success", "converted"].some(x => String(row[stageCol]).toLowerCase().includes(x))
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-[#3cd395]"
                              : ["lost", "dead"].some(x => String(row[stageCol]).toLowerCase().includes(x))
                                ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
                          }`}>
                            {row[stageCol]}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-[#3cd395] font-semibold">
                        {formattedRev}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-mono ${
                          activeFilter === "expired" ? "text-red-500 font-semibold" : 
                          activeFilter === "due_today" ? "text-amber-500 font-semibold animate-pulse" : "text-gray-600 dark:text-gray-400"
                        }`}>
                          {dlVal || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4">{pocCol ? row[pocCol] : "—"}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleEdit(row)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-150 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-450 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Quick Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 dark:text-[#555566] text-sm font-sans">
                    No leads found matching current filter state.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {sheetData && isEditModalOpen && (
        <LeadFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          headers={sheetData.headers}
          initialData={selectedLead}
          onSave={handleSaveLead}
          title="Quick Update Lead"
        />
      )}
    </div>
  );
}
