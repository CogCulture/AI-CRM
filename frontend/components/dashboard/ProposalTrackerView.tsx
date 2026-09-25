"use client";

import React, { useState, useMemo } from "react";
import { SheetData } from "../../lib/types";
import { 
  Send, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Filter, 
  Search, 
  SlidersHorizontal, 
  Plus, 
  Edit3, 
  Trash2, 
  ArrowRight, 
  Building2, 
  User, 
  Calendar,
  Layers,
  Table as TableIcon,
  RefreshCw
} from "lucide-react";

interface ProposalTrackerViewProps {
  sheetData: SheetData;
  onEditLead?: (lead: Record<string, any>) => void;
  onAddLead?: () => void;
  onUpdateStage?: (lead: Record<string, any>, newStage: string) => Promise<void>;
  onDeleteLead?: (lead: Record<string, any>) => Promise<void>;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}

// Stage classification definition
const STAGE_COLUMNS = [
  {
    id: "sent",
    title: "Proposal Sent",
    description: "Delivered to client, pending initial review",
    matches: ["proposal sent", "proposal submitted", "proposal"],
    color: "blue",
    badgeBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    headerBg: "border-t-2 border-t-blue-500",
  },
  {
    id: "prep",
    title: "Proposal to be Sent",
    description: "Under preparation or scheduled for dispatch",
    matches: ["proposal to be sent", "proposal prep", "preparing"],
    color: "amber",
    badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    headerBg: "border-t-2 border-t-amber-500",
  },
  {
    id: "negotiation",
    title: "In Negotiation",
    description: "Terms, pricing, and scope adjustments",
    matches: ["negotiation", "under negotiation", "discussing"],
    color: "purple",
    badgeBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    headerBg: "border-t-2 border-t-purple-500",
  },
  {
    id: "won",
    title: "Closed Won",
    description: "Proposal accepted, deal finalized",
    matches: ["won", "closed won", "converted", "completed", "success"],
    color: "emerald",
    badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    headerBg: "border-t-2 border-t-emerald-500",
  },
  {
    id: "lost",
    title: "Closed Lost",
    description: "Declined, cancelled, or unresponsive",
    matches: ["lost", "closed lost", "dead", "cancelled"],
    color: "rose",
    badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    headerBg: "border-t-2 border-t-rose-500",
  },
];

// Helper to parse dates
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
      if (parts[0].length === 4) return new Date(p0, p1 - 1, p2);
      if (parts[2].length === 4) return new Date(p2, p1 - 1, p0);
    }
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : new Date(parsed);
};

// Calculate proposal aging in days
const getAgingDays = (dateVal: any): number | null => {
  const d = parseDate(dateVal);
  if (!d) return null;
  const now = new Date();
  const diffTime = now.getTime() - d.getTime();
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return days >= 0 ? days : 0;
};

// Format currency in Indian Numbering System
const formatCurrency = (val: number): string => {
  if (val % 1 !== 0) {
    return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₹${val.toLocaleString("en-IN")}`;
};

export default function ProposalTrackerView({
  sheetData,
  onEditLead,
  onAddLead,
  onUpdateStage,
  onDeleteLead,
  onRefresh,
  refreshing = false,
}: ProposalTrackerViewProps) {
  const [viewMode, setViewMode] = useState<"pipeline" | "table">("pipeline");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPOC, setSelectedPOC] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  // Column name detection
  const headers = sheetData?.headers || [];
  const stageCol = headers.find(h => h.toLowerCase() === "stage" || h.toLowerCase().includes("stage")) || "Stage";
  const statusCol = headers.find(h => h.toLowerCase() === "status" || h.toLowerCase().includes("status")) || "Status";
  const companyCol = headers.find(h => ["company", "campaign", "client", "account"].some(x => h.toLowerCase().includes(x))) || "Company";
  const valueCol = headers.find(h => ["value", "amount", "revenue", "price", "deal size"].some(x => h.toLowerCase().includes(x))) || "Value";
  const dateCol = headers.find(h => ["date", "proposal date", "sent date", "created at"].some(x => h.toLowerCase().includes(x))) || "Date";
  const deadlineCol = headers.find(h => ["deadline", "due", "followup", "follow up"].some(x => h.toLowerCase().includes(x))) || "Deadline";
  const pocCol = headers.find(h => ["poc", "owner", "rep", "assignee"].some(x => h.toLowerCase().includes(x))) || "Cog POC";

  // Filter all rows that are proposals or have reached proposal lifecycle
  const allProposals = useMemo(() => {
    if (!sheetData?.rows) return [];
    
    return sheetData.rows.filter(row => {
      const stageVal = String(row[stageCol] || "").toLowerCase().trim();
      // Include any row where stage involves proposal or subsequent pipeline steps
      return (
        stageVal.includes("proposal") || 
        stageVal.includes("negotiation") || 
        ["won", "closed won", "converted"].some(x => stageVal.includes(x)) ||
        ["lost", "closed lost", "dead"].some(x => stageVal.includes(x))
      );
    });
  }, [sheetData, stageCol]);

  // Unique POCs for filter dropdown
  const uniquePOCs = useMemo(() => {
    const set = new Set<string>();
    allProposals.forEach(r => {
      const val = String(r[pocCol] || "").trim();
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [allProposals, pocCol]);

  // Apply search and dropdown filters
  const filteredProposals = useMemo(() => {
    return allProposals.filter(row => {
      const company = String(row[companyCol] || "").toLowerCase();
      const leadId = String(row["Lead ID"] || "").toLowerCase();
      const poc = String(row[pocCol] || "").toLowerCase();
      const stage = String(row[stageCol] || "").toLowerCase();
      const status = String(row[statusCol] || "").toLowerCase();
      const query = searchTerm.toLowerCase().trim();

      const matchesSearch = !query || company.includes(query) || leadId.includes(query) || poc.includes(query) || stage.includes(query);
      const matchesPOC = selectedPOC === "All" || String(row[pocCol] || "").trim() === selectedPOC;
      const matchesStatus = selectedStatus === "All" || String(row[statusCol] || "").trim().toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesPOC && matchesStatus;
    });
  }, [allProposals, searchTerm, selectedPOC, selectedStatus, companyCol, pocCol, stageCol, statusCol]);

  // Determine which column a proposal belongs to
  const getProposalColumnId = (row: Record<string, any>): string => {
    const stageVal = String(row[stageCol] || "").toLowerCase().trim();
    if (stageVal.includes("to be sent") || stageVal.includes("prep")) return "prep";
    if (["won", "closed won", "converted", "completed", "success"].some(x => stageVal.includes(x))) return "won";
    if (["lost", "closed lost", "dead", "cancelled"].some(x => stageVal.includes(x))) return "lost";
    if (stageVal.includes("negotiation")) return "negotiation";
    return "sent"; // Default for "proposal sent" or generic proposal
  };

  // Aggregate Metrics & KPIs
  const metrics = useMemo(() => {
    let totalSentCount = 0;
    let totalPipelineValue = 0;
    let activeValue = 0;
    let wonValue = 0;
    let wonCount = 0;
    let lostCount = 0;
    let inReviewCount = 0;
    let negotiationCount = 0;
    let prepCount = 0;

    allProposals.forEach(row => {
      const colId = getProposalColumnId(row);
      const rawVal = String(row[valueCol] || "").replace(/[^0-9.-]/g, "");
      const numVal = parseFloat(rawVal) || 0;

      totalPipelineValue += numVal;
      totalSentCount++;

      if (colId === "won") {
        wonCount++;
        wonValue += numVal;
      } else if (colId === "lost") {
        lostCount++;
      } else if (colId === "negotiation") {
        negotiationCount++;
        activeValue += numVal;
      } else if (colId === "prep") {
        prepCount++;
        activeValue += numVal;
      } else {
        inReviewCount++;
        activeValue += numVal;
      }
    });

    const activeCount = inReviewCount + negotiationCount + prepCount;
    const completedCount = wonCount + lostCount;
    const winRate = completedCount > 0 
      ? Math.round((wonCount / completedCount) * 100) 
      : (totalSentCount > 0 ? Math.round((wonCount / totalSentCount) * 100) : 0);
    const avgProposalValue = totalSentCount > 0 ? Math.round(totalPipelineValue / totalSentCount) : 0;

    return {
      totalSentCount,
      totalPipelineValue,
      activeCount,
      activeValue,
      wonCount,
      wonValue,
      lostCount,
      inReviewCount,
      negotiationCount,
      prepCount,
      winRate,
      avgProposalValue,
    };
  }, [allProposals, valueCol]);

  // Handle stage change from dropdown or 1-click button
  const handleStageChange = async (row: Record<string, any>, newStage: string) => {
    if (!onUpdateStage) return;
    const id = row["_row_num"] || row["Lead ID"];
    setUpdatingId(id);
    try {
      await onUpdateStage(row, newStage);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                Proposal Tracker
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 font-semibold">
                  {allProposals.length} Tracked
                </span>
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Automatically monitors leads in proposal stages, pipeline movement, aging, and conversion.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Pipeline vs Table Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-[#161622] p-1 rounded-xl border border-gray-200 dark:border-white/10">
            <button
              onClick={() => setViewMode("pipeline")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "pipeline"
                  ? "bg-white dark:bg-[#1F1F2E] text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Stage Board
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-[#1F1F2E] text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              List Table
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 bg-white dark:bg-[#161622] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl transition-all cursor-pointer"
              title="Refresh proposals data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-500" : ""}`} />
            </button>
          )}

          {onAddLead && (
            <button
              onClick={onAddLead}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Track Proposal
            </button>
          )}
        </div>
      </div>

      {/* Row 1: Key Proposal Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Total Proposals Sent */}
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899]">
              Total Proposals Sent
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900 dark:text-white font-sans">
              {metrics.totalSentCount}
            </div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {formatCurrency(metrics.totalPipelineValue)}
            </div>
          </div>
        </div>

        {/* KPI 2: Under Review / Pending */}
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899]">
              Under Client Review
            </span>
            <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 font-sans">
              {metrics.inReviewCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Awaiting feedback
            </div>
          </div>
        </div>

        {/* KPI 3: In Negotiation */}
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899]">
              In Negotiation
            </span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-sans">
              {metrics.negotiationCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Finalizing terms
            </div>
          </div>
        </div>

        {/* KPI 4: Closed Won & Win Rate */}
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899]">
              Closed Won
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-sans">
                {metrics.wonCount}
              </span>
              <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {metrics.winRate}% Win Rate
              </span>
            </div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {formatCurrency(metrics.wonValue)} won
            </div>
          </div>
        </div>

        {/* KPI 5: Avg Proposal Size */}
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899]">
              Avg Proposal Size
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900 dark:text-white font-sans">
              {formatCurrency(metrics.avgProposalValue)}
            </div>
            <div className="text-xs text-rose-500 mt-0.5">
              {metrics.lostCount} proposals lost
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Search, Filters & Actions Bar */}
      <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#888899]" />
          <input
            type="text"
            placeholder="Search proposals by company, POC, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#666677] outline-none focus:border-blue-500 transition-all font-sans"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          {/* POC Filter */}
          {uniquePOCs.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] uppercase font-mono text-gray-400 dark:text-[#888899]">POC:</span>
              <select
                value={selectedPOC}
                onChange={(e) => setSelectedPOC(e.target.value)}
                className="px-2.5 py-1.5 bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white font-sans outline-none cursor-pointer"
              >
                <option value="All">All POCs</option>
                {uniquePOCs.map(poc => (
                  <option key={poc} value={poc}>{poc}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter (Hot/Warm/Cold) */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] uppercase font-mono text-gray-400 dark:text-[#888899]">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white font-sans outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">⚡ Warm</option>
              <option value="Cold">❄️ Cold</option>
            </select>
          </div>

          {(searchTerm || selectedPOC !== "All" || selectedStatus !== "All") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedPOC("All");
                setSelectedStatus("All");
              }}
              className="text-xs text-blue-500 hover:text-blue-600 underline font-medium cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Row 3: Main View: Either Pipeline Stage Board OR Detailed Table */}
      {viewMode === "pipeline" ? (
        /* ================= STAGE MOVEMENT KANBAN BOARD ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
          {STAGE_COLUMNS.map((col) => {
            const columnProposals = filteredProposals.filter(r => getProposalColumnId(r) === col.id);
            const columnTotalValue = columnProposals.reduce((sum, r) => {
              const num = parseFloat(String(r[valueCol] || "").replace(/[^0-9.-]/g, "")) || 0;
              return sum + num;
            }, 0);

            return (
              <div
                key={col.id}
                className={`rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-[#111118]/80 backdrop-blur-sm overflow-hidden flex flex-col shadow-sm ${col.headerBg}`}
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-xs text-gray-900 dark:text-white">
                        {col.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${col.badgeBg}`}>
                        {columnProposals.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-[#777788] mt-0.5 truncate max-w-[170px]" title={col.description}>
                      {col.description}
                    </p>
                  </div>
                  {columnTotalValue > 0 && (
                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {formatCurrency(columnTotalValue)}
                    </span>
                  )}
                </div>

                {/* Column Cards Container */}
                <div className="p-3 space-y-2.5 max-h-[620px] overflow-y-auto">
                  {columnProposals.length > 0 ? (
                    columnProposals.map((lead, idx) => {
                      const rowNum = lead["_row_num"] || lead["Lead ID"];
                      const isUpdating = updatingId === rowNum;
                      const company = String(lead[companyCol] || "Unnamed Lead");
                      const leadId = String(lead["Lead ID"] || `COG-${1000 + Number(rowNum)}`);
                      const val = String(lead[valueCol] || "");
                      const poc = String(lead[pocCol] || "Unassigned");
                      const dateVal = lead[dateCol] || lead[deadlineCol] || "";
                      const aging = getAgingDays(dateVal);
                      const statusVal = String(lead[statusCol] || "").trim().toLowerCase();

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161622] hover:border-blue-400 dark:hover:border-blue-500/50 transition-all shadow-xs flex flex-col gap-2.5 group relative"
                        >
                          {/* Top Row: Lead ID & Value */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono font-semibold text-gray-400 dark:text-[#888899]">
                              {leadId}
                            </span>
                            {val ? (
                              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {val.startsWith("₹") || val.startsWith("$") ? val : `₹${val}`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-mono">—</span>
                            )}
                          </div>

                          {/* Company Name */}
                          <div className="min-w-0">
                            <h4
                              onClick={() => onEditLead && onEditLead(lead)}
                              className="text-xs font-bold text-gray-900 dark:text-white truncate cursor-pointer hover:text-blue-500 transition-colors"
                              title={company}
                            >
                              {company}
                            </h4>
                          </div>

                          {/* Meta: POC & Date / Aging */}
                          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-[#888899]">
                            <div className="flex items-center gap-1 truncate max-w-[110px]" title={poc}>
                              <User className="w-3 h-3 shrink-0" />
                              <span className="truncate">{poc}</span>
                            </div>

                            {aging !== null && (
                              <div
                                className={`flex items-center gap-1 font-mono text-[9px] px-1.5 py-0.5 rounded ${
                                  aging > 7 && col.id === "sent"
                                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-bold"
                                    : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"
                                }`}
                                title={`Proposal sent ${aging} days ago`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {aging === 0 ? "Today" : `${aging}d ago`}
                              </div>
                            )}
                          </div>

                          {/* Status Badge & Quick Move Bar */}
                          <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-1">
                            {/* Status indicator */}
                            {statusVal ? (
                              <span
                                className={`text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                                  statusVal === "hot"
                                    ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/30"
                                    : statusVal === "warm"
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30"
                                    : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30"
                                }`}
                              >
                                {statusVal}
                              </span>
                            ) : <span />}

                            {/* Stage Transition Quick Action Dropdown */}
                            {onUpdateStage && (
                              <div className="relative">
                                <select
                                  disabled={isUpdating}
                                  value={lead[stageCol] || ""}
                                  onChange={(e) => handleStageChange(lead, e.target.value)}
                                  className="text-[10px] font-sans font-medium bg-gray-50 dark:bg-[#1E1E2D] hover:bg-gray-100 dark:hover:bg-[#252538] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-0.5 text-gray-700 dark:text-gray-200 cursor-pointer outline-none transition-colors"
                                  title="Change proposal stage"
                                >
                                  <option value="Proposal sent">Move: Sent</option>
                                  <option value="Negotiation">Move: Negotiation</option>
                                  <option value="Won">Move: Won</option>
                                  <option value="Lost">Move: Lost</option>
                                  <option value="Proposal to be Sent">Move: Prep</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-xs text-gray-400 dark:text-[#555566] font-sans border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
                      No proposals in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= DETAILED PROPOSALS LIST TABLE ================= */
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#161622]/40 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#888899]">
                  <th className="py-3 px-4">Lead ID</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4 text-right">Proposal Value</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">Client Status</th>
                  <th className="py-3 px-4">Proposal Date</th>
                  <th className="py-3 px-4">Aging / Velocity</th>
                  <th className="py-3 px-4">Cog POC</th>
                  <th className="py-3 px-4 text-center">Quick Move / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredProposals.length > 0 ? (
                  filteredProposals.map((lead, idx) => {
                    const rowNum = lead["_row_num"] || lead["Lead ID"];
                    const company = String(lead[companyCol] || "Unnamed Lead");
                    const leadId = String(lead["Lead ID"] || `COG-${1000 + Number(rowNum)}`);
                    const val = String(lead[valueCol] || "—");
                    const stage = String(lead[stageCol] || "");
                    const status = String(lead[statusCol] || "");
                    const dateVal = lead[dateCol] || lead[deadlineCol] || "—";
                    const aging = getAgingDays(dateVal);
                    const poc = String(lead[pocCol] || "Unassigned");
                    const colId = getProposalColumnId(lead);

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-gray-900 dark:text-white">
                          {leadId}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          <button
                            onClick={() => onEditLead && onEditLead(lead)}
                            className="hover:text-blue-500 transition-colors text-left font-bold cursor-pointer"
                          >
                            {company}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {val}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              colId === "won"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                                : colId === "negotiation"
                                ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40"
                                : colId === "lost"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40"
                            }`}
                          >
                            {stage || "Proposal Sent"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {status ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                                status.toLowerCase() === "hot"
                                  ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                                  : status.toLowerCase() === "warm"
                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                                  : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                              }`}
                            >
                              {status}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-300">
                          {dateVal}
                        </td>
                        <td className="py-3 px-4">
                          {aging !== null ? (
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                aging > 7 && colId === "sent"
                                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-bold"
                                  : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {aging === 0 ? "Today" : `${aging} days active`}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          {poc}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {onUpdateStage && (
                              <select
                                value={lead[stageCol] || ""}
                                onChange={(e) => handleStageChange(lead, e.target.value)}
                                className="text-[10px] font-sans font-medium bg-gray-50 dark:bg-[#1E1E2D] border border-gray-200 dark:border-white/10 rounded px-2 py-1 text-gray-700 dark:text-gray-200 cursor-pointer outline-none"
                              >
                                <option value="Proposal sent">Proposal Sent</option>
                                <option value="Negotiation">Negotiation</option>
                                <option value="Won">Won</option>
                                <option value="Lost">Lost</option>
                                <option value="Proposal to be Sent">To be Sent</option>
                              </select>
                            )}

                            {onEditLead && (
                              <button
                                onClick={() => onEditLead(lead)}
                                className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 rounded transition-colors cursor-pointer"
                                title="Edit full lead record"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onDeleteLead && (
                              <button
                                onClick={() => onDeleteLead(lead)}
                                className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 rounded transition-colors cursor-pointer"
                                title="Delete proposal"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400 dark:text-[#555566] text-xs">
                      No proposals match the current filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State If No Proposals Exist At All */}
      {allProposals.length === 0 && (
        <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111118] space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center">
            <Send className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white font-sans">
            No Proposals In Pipeline Yet
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
            When any lead’s stage is set to <strong>"Proposal sent"</strong> or <strong>"Negotiation"</strong>, it will automatically appear here in this dedicated proposal movement tracker.
          </p>
          {onAddLead && (
            <button
              onClick={onAddLead}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Your First Proposal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
