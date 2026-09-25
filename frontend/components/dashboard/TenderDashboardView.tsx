"use client";

import React, { useState, useMemo } from "react";
import { SheetData, GraphConfig } from "../../lib/types";
import TenderVisualsWidget from "./TenderVisualsWidget";
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  MapPin, 
  DollarSign, 
  Tag, 
  RefreshCw,
  Eye,
  X,
  ChevronRight,
  TrendingUp,
  Award,
  Layers,
  FileCheck
} from "lucide-react";
import { toast } from "sonner";

export const TENDER_STAGES = [
  "Tender Identified",
  "Under Review",
  "Qualification Check",
  "Bid Decision Pending",
  "Approved for Bidding",
  "Proposal Preparation",
  "Submitted",
  "Technical Evaluation",
  "Financial Evaluation",
  "Won",
  "Lost",
] as const;

export type TenderStage = typeof TENDER_STAGES[number];

export const TENDER_TYPES = ["Open", "Limited", "RFP", "RFQ"] as const;
export type TenderType = typeof TENDER_TYPES[number];

export interface ProcessedTender extends Record<string, any> {
  _normStage: TenderStage;
  _subDate: Date | null;
  _daysRemaining: number | null;
  _isOverdue: boolean;
  _isDueSoon: boolean;
  _valNum: number;
}

interface TenderDashboardViewProps {
  sheetData: SheetData;
  onRefresh?: () => Promise<void>;
  onSaveLead?: (data: Record<string, any>) => Promise<void>;
  onDeleteLead?: (lead: Record<string, any>) => Promise<void>;
  refreshing?: boolean;
}

// Helper to normalize and parse date strings
const parseDate = (val: any): Date | null => {
  if (!val) return null;
  const str = String(val).trim();
  if (!str || str === "—" || str.toLowerCase() === "placeholder") return null;

  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (parts[0].length === 4) return new Date(p0, p1 - 1, p2);
      if (parts[2].length === 4) return new Date(p2, p1 - 1, p0);
      if (parts[2].length === 2) return new Date(2000 + p2, p1 - 1, p0);
    }
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? null : new Date(parsed);
};

// Format Date as DD/MM/YYYY
const formatDateStr = (d: Date | null): string => {
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// Format Date for HTML date inputs (YYYY-MM-DD)
const formatDateForInput = (val: any): string => {
  const d = parseDate(val);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Format currency to Indian Rupee notation (₹ Lakhs / Crores / Standard)
const formatCurrency = (val: any): string => {
  if (!val && val !== 0) return "—";
  const clean = String(val).replace(/[^0-9.]/g, "");
  const num = parseFloat(clean);
  if (isNaN(num) || num === 0) return String(val).trim() || "—";
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return `₹${num.toLocaleString("en-IN")}`;
};

// Map existing or loose stages to canonical Tender Stages
const normalizeTenderStage = (rawStage: string): TenderStage => {
  const s = (rawStage || "").trim().toLowerCase();
  if (s.includes("won")) return "Won";
  if (s.includes("lost") || s.includes("dropped") || s.includes("dead")) return "Lost";
  if (s.includes("submitted")) return "Submitted";
  if (s.includes("financial")) return "Financial Evaluation";
  if (s.includes("technical")) return "Technical Evaluation";
  if (s.includes("proposal") && (s.includes("prep") || s.includes("to be sent"))) return "Proposal Preparation";
  if (s.includes("approved")) return "Approved for Bidding";
  if (s.includes("bid decision")) return "Bid Decision Pending";
  if (s.includes("qualification")) return "Qualification Check";
  if (s.includes("review") || s.includes("conversation")) return "Under Review";
  if (s.includes("identified") || s.includes("lead")) return "Tender Identified";
  if (s.includes("proposal sent") || s.includes("portfolio sent")) return "Submitted";
  return "Tender Identified";
};

export default function TenderDashboardView({
  sheetData,
  onRefresh,
  onSaveLead,
  onDeleteLead,
  refreshing = false,
}: TenderDashboardViewProps) {
  // Navigation & Filtering States
  const [activeFilterTab, setActiveFilterTab] = useState<"all" | "active" | "submitted" | "urgent" | "won" | "lost">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>("All");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All");
  
  // Modals
  const [detailTender, setDetailTender] = useState<Record<string, any> | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTender, setEditingTender] = useState<Record<string, any> | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  // Dynamic header matching from Google Sheet
  const headers = sheetData?.headers || [];
  
  const idCol = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return hl === "tender id" || hl.includes("tender id") || hl === "lead id" || hl.includes("ref");
  }) || "Lead ID";

  const nameCol = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return hl === "tender name" || hl.includes("tender name") || hl === "requirement" || hl.includes("project");
  }) || "Requirement";

  const orgCol = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return hl === "organization" || hl.includes("organization") || hl === "company" || hl.includes("client");
  }) || "Company";

  const publishDateCol = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return hl === "publish date" || hl.includes("publish") || hl === "date";
  }) || "Date";

  const submissionDateCol = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return hl === "last submission date" || hl.includes("submission") || hl === "deadline" || hl.includes("due");
  }) || "Deadline";

  const bidOpeningDateCol = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return hl === "bid opening date" || hl.includes("bid opening") || hl.includes("opening") || hl === "follow up date";
  }) || "Follow up date";

  const stageCol = headers.find(h => h.toLowerCase().trim() === "stage" || h.toLowerCase().includes("stage")) || "Stage";
  const stateCol = headers.find(h => ["state", "location", "region", "city"].some(x => h.toLowerCase().includes(x))) || "State / Location";
  const valueCol = headers.find(h => ["tender value", "revenue estimations", "value", "amount", "budget"].some(x => h.toLowerCase().includes(x))) || "Revenue Estimations";
  const typeCol = headers.find(h => ["tender type", "type", "lead type"].some(x => h.toLowerCase().includes(x))) || "Tender Type";
  const categoryCol = headers.find(h => ["category", "type of project", "domain", "scope"].some(x => h.toLowerCase().includes(x))) || "Type of Project";
  const notesCol = headers.find(h => ["notes / remarks", "notes", "remarks", "last update", "follow-up"].some(x => h.toLowerCase().includes(x))) || "Last Update";

  // Today reference
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Filter tenders from rows (strictly where Source is 'Tender' only)
  const tenderRows = useMemo(() => {
    if (!sheetData?.rows) return [];
    const sourceCol = headers.find(h => {
      const hl = h.toLowerCase().trim();
      return hl === "source" || hl === "sources" || hl.includes("source") || hl.includes("lead source");
    }) || "Source";
    
    return sheetData.rows.filter(row => {
      const val = String(row[sourceCol] || "").trim().toLowerCase();
      if (val === "tender") return true;
      for (const [k, v] of Object.entries(row)) {
        const kl = k.toLowerCase().trim();
        if ((kl === "source" || kl === "sources" || kl.includes("source") || kl.includes("lead source")) && String(v || "").trim().toLowerCase() === "tender") {
          return true;
        }
      }
      return false;
    });
  }, [sheetData, headers]);

  // Process tenders with normalized fields, parsed submission dates, and days remaining countdown
  const processedTenders = useMemo<ProcessedTender[]>(() => {
    return tenderRows.map(row => {
      const rawStage = String(row[stageCol] || "Tender Identified");
      const normStage = normalizeTenderStage(rawStage);
      
      const subDate = parseDate(row[submissionDateCol]);
      let daysRemaining: number | null = null;
      let isOverdue = false;
      let isDueSoon = false;

      if (subDate) {
        const compare = new Date(subDate);
        compare.setHours(0, 0, 0, 0);
        const diff = compare.getTime() - today.getTime();
        daysRemaining = Math.round(diff / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) {
          isOverdue = normStage !== "Won" && normStage !== "Lost" && normStage !== "Submitted";
        } else if (daysRemaining <= 3) {
          isDueSoon = normStage !== "Won" && normStage !== "Lost";
        }
      }

      // Clean raw value
      const rawVal = row[valueCol] || "";
      const valNum = parseFloat(String(rawVal).replace(/[^0-9.]/g, "")) || 0;

      return {
        ...row,
        _normStage: normStage,
        _subDate: subDate,
        _daysRemaining: daysRemaining,
        _isOverdue: isOverdue,
        _isDueSoon: isDueSoon,
        _valNum: valNum,
      };
    });
  }, [tenderRows, stageCol, submissionDateCol, valueCol, today]);

  // Filtered tenders based on search, tab, stage dropdown, and tender type
  const filteredTenders = useMemo(() => {
    return processedTenders.filter(t => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || Object.entries(t).some(([k, val]) => {
        if (k.startsWith("_")) return false;
        return val && String(val).toLowerCase().includes(q);
      });

      const matchesStage = selectedStageFilter === "All" || t._normStage === selectedStageFilter || String(t[stageCol] || "").trim() === selectedStageFilter;
      
      const tenderTypeVal = String(t[typeCol] || "Open").toLowerCase();
      const matchesType = selectedTypeFilter === "All" || tenderTypeVal.includes(selectedTypeFilter.toLowerCase());

      let matchesTab = true;
      if (activeFilterTab === "active") {
        matchesTab = !["Won", "Lost"].includes(t._normStage);
      } else if (activeFilterTab === "submitted") {
        matchesTab = ["Submitted", "Technical Evaluation", "Financial Evaluation"].includes(t._normStage);
      } else if (activeFilterTab === "urgent") {
        matchesTab = t._isDueSoon || t._isOverdue;
      } else if (activeFilterTab === "won") {
        matchesTab = t._normStage === "Won";
      } else if (activeFilterTab === "lost") {
        matchesTab = t._normStage === "Lost";
      }

      return matchesSearch && matchesStage && matchesType && matchesTab;
    });
  }, [processedTenders, searchTerm, selectedStageFilter, selectedTypeFilter, activeFilterTab, stageCol, typeCol]);

  // Top Metrics Calculation
  const stats = useMemo(() => {
    let identified = 0;
    let active = 0;
    let submitted = 0;
    let won = 0;
    let lost = 0;
    let totalPipelineVal = 0;

    processedTenders.forEach(t => {
      identified++;
      const stage = t._normStage;
      if (stage === "Won") {
        won++;
      } else if (stage === "Lost") {
        lost++;
      } else {
        active++;
        totalPipelineVal += t._valNum;
      }

      if (["Submitted", "Technical Evaluation", "Financial Evaluation", "Won"].includes(stage)) {
        submitted++;
      }
    });

    const decided = won + lost;
    const winRate = decided > 0 ? Math.round((won / decided) * 100) : 0;

    return {
      identified,
      active,
      submitted,
      won,
      lost,
      winRate,
      totalPipelineVal,
    };
  }, [processedTenders]);



  // Handle stage change (1-click transition)
  const handleUpdateStage = async (tender: Record<string, any>, newStage: TenderStage) => {
    if (!onSaveLead) return;
    const rowNum = tender["_row_num"];
    if (!rowNum) {
      toast.error("Invalid tender row index");
      return;
    }

    setUpdatingId(rowNum);
    try {
      const updated = {
        ...tender,
        [stageCol]: newStage,
        Source: tender["Source"] || "Tender",
        [typeCol]: tender[typeCol] || "Tender",
      };
      await onSaveLead(updated);
      toast.success(`Tender stage updated to "${newStage}"`);
      if (detailTender && detailTender._row_num === rowNum) {
        setDetailTender({ ...detailTender, ...updated, _normStage: newStage });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Save from Tender Detail / Edit Modal
  const handleSaveTenderDetails = async (formData: Record<string, any>) => {
    if (!onSaveLead) return;
    try {
      await onSaveLead({
        ...formData,
        Source: formData["Source"] || "Tender",
        [typeCol]: formData[typeCol] || formData["Tender Type"] || "Open",
      });
      toast.success("Tender saved successfully");
      setIsEditModalOpen(false);
      setIsAddModalOpen(false);
      setEditingTender(null);
      if (detailTender && formData._row_num === detailTender._row_num) {
        setDetailTender(formData);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save tender");
    }
  };

  // Handle Delete Tender
  const handleDeleteTenderClick = async (tender: Record<string, any>) => {
    if (!onDeleteLead) return;
    const name = tender[nameCol] || tender[orgCol] || "this tender";
    const ok = window.confirm(`Permanently delete tender record "${name}" from your CRM and Google Sheet?`);
    if (!ok) return;

    try {
      await onDeleteLead(tender);
      setDetailTender(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete tender");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Title & Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              Tender Management
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-semibold">
                {stats.identified} Tenders
              </span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Track government bids, RFPs, qualification milestones, submission deadlines, and evaluation outcomes.
            </p>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 bg-white dark:bg-[#161622] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl transition-all cursor-pointer shadow-xs"
              title="Refresh tender data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-500" : ""}`} />
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            + New Tender
          </button>
        </div>
      </div>

      {/* Row 1: Executive KPI Cards (5 Tender Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Total Tenders Identified */}
        <div 
          onClick={() => setActiveFilterTab("all")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            activeFilterTab === "all"
              ? "border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-500/50"
              : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 dark:text-[#888899]">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Total Identified</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white tracking-tight">
              {stats.identified}
            </span>
            <p className="text-[11px] text-gray-400 dark:text-[#777788] mt-0.5">
              Registered opportunities
            </p>
          </div>
        </div>

        {/* KPI 2: Active Tenders in Pipeline */}
        <div 
          onClick={() => setActiveFilterTab("active")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            activeFilterTab === "active"
              ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-500/50"
              : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 dark:text-[#888899]">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Active Tenders</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 tracking-tight">
              {stats.active}
            </span>
            <p className="text-[11px] text-gray-400 dark:text-[#777788] mt-0.5 truncate" title={`Pipeline Value: ${formatCurrency(stats.totalPipelineVal)}`}>
              Val: {formatCurrency(stats.totalPipelineVal)}
            </p>
          </div>
        </div>

        {/* KPI 3: Submitted Tenders */}
        <div 
          onClick={() => setActiveFilterTab("submitted")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            activeFilterTab === "submitted"
              ? "border-purple-500 bg-purple-50/40 dark:bg-purple-950/20 ring-1 ring-purple-500/50"
              : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 dark:text-[#888899]">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Submitted</span>
            <FileCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 tracking-tight">
              {stats.submitted}
            </span>
            <p className="text-[11px] text-gray-400 dark:text-[#777788] mt-0.5">
              Bids under evaluation
            </p>
          </div>
        </div>

        {/* KPI 4: Won Tenders */}
        <div 
          onClick={() => setActiveFilterTab("won")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            activeFilterTab === "won"
              ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-500/50"
              : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 dark:text-[#888899]">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Won Tenders</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              {stats.won}
            </span>
            <p className="text-[11px] text-gray-400 dark:text-[#777788] mt-0.5 font-mono">
              Win Rate: {stats.winRate}%
            </p>
          </div>
        </div>

        {/* KPI 5: Lost Tenders */}
        <div 
          onClick={() => setActiveFilterTab("lost")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            activeFilterTab === "lost"
              ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-500/50"
              : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 dark:text-[#888899]">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Lost Tenders</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tracking-tight">
              {stats.lost}
            </span>
            <p className="text-[11px] text-gray-400 dark:text-[#777788] mt-0.5">
              Outbid or disqualified
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: 100% Real Sheet Data Visuals (Tender Bid Values & Stage Breakdown) */}
      <TenderVisualsWidget
        tenders={processedTenders}
        orgCol={orgCol}
        nameCol={nameCol}
        valueCol={valueCol}
        stageCol={stageCol}
      />

      {/* Row 3: Master Tenders Table with Urgency, Search, and Filtering */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] p-5 shadow-sm space-y-4">
        {/* Table Filter Tabs & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#161622] p-1 rounded-xl border border-gray-200 dark:border-white/10 flex-wrap">
            <button
              onClick={() => { setActiveFilterTab("all"); setSelectedStageFilter("All"); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeFilterTab === "all" && selectedStageFilter === "All"
                  ? "bg-white dark:bg-[#1E1E2D] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              All Tenders ({stats.identified})
            </button>
            <button
              onClick={() => { setActiveFilterTab("active"); setSelectedStageFilter("All"); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeFilterTab === "active"
                  ? "bg-white dark:bg-[#1E1E2D] text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Active Pipeline ({stats.active})
            </button>
            <button
              onClick={() => { setActiveFilterTab("submitted"); setSelectedStageFilter("All"); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeFilterTab === "submitted"
                  ? "bg-white dark:bg-[#1E1E2D] text-purple-600 dark:text-purple-400 shadow-xs"
                  : "text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Submitted ({stats.submitted})
            </button>
            <button
              onClick={() => { setActiveFilterTab("urgent"); setSelectedStageFilter("All"); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeFilterTab === "urgent"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shadow-xs"
                  : "text-amber-600 hover:text-amber-700"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Due Soon / Alerts
            </button>
            <button
              onClick={() => { setActiveFilterTab("won"); setSelectedStageFilter("All"); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeFilterTab === "won"
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 shadow-xs"
                  : "text-emerald-600 hover:text-emerald-700"
              }`}
            >
              Won ({stats.won})
            </button>
            <button
              onClick={() => { setActiveFilterTab("lost"); setSelectedStageFilter("All"); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeFilterTab === "lost"
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 shadow-xs"
                  : "text-rose-500 hover:text-rose-600"
              }`}
            >
              Lost ({stats.lost})
            </button>
          </div>

          {/* Search & Type Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tender Type Selector */}
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white font-sans outline-none cursor-pointer"
            >
              <option value="All">All Types</option>
              {TENDER_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#888899]" />
              <input
                type="text"
                placeholder="Search tenders, authority, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-amber-500 transition-all font-sans"
              />
            </div>
          </div>
        </div>

        {/* Master Tenders Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
          <table className="w-full border-collapse text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#161622]/40 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#888899]">
                <th className="py-3 px-4">Tender ID</th>
                <th className="py-3 px-4">Tender Name & Scope</th>
                <th className="py-3 px-4">Organization / Client</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Tender Value</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Last Submission Date</th>
                <th className="py-3 px-4">Countdown</th>
                <th className="py-3 px-4 text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredTenders.length > 0 ? (
                filteredTenders.map((tender, idx) => {
                  const rowNum = tender["_row_num"] || tender[idCol];
                  const tenderId = String(tender[idCol] || `TND-${1000 + Number(rowNum)}`);
                  const tenderName = String(tender[nameCol] || "Unnamed Tender");
                  const organization = String(tender[orgCol] || "Unspecified Authority");
                  const rawVal = tender[valueCol];
                  const stage = tender._normStage;
                  const typeVal = String(tender[typeCol] || "Open");
                  const submissionDate = tender[submissionDateCol] || "—";
                  const daysRemaining = tender._daysRemaining;
                  const isOverdue = tender._isOverdue;
                  const isDueSoon = tender._isDueSoon;
                  const location = String(tender[stateCol] || "");

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors ${
                        isOverdue
                          ? "bg-rose-50/20 dark:bg-rose-950/10 border-l-2 border-l-rose-500"
                          : isDueSoon
                          ? "bg-amber-50/20 dark:bg-amber-950/10 border-l-2 border-l-amber-500"
                          : ""
                      }`}
                    >
                      {/* Tender ID */}
                      <td className="py-3 px-4 font-mono font-semibold text-gray-900 dark:text-white">
                        {tenderId}
                      </td>

                      {/* Tender Name (Click to open Tender Detail Page) */}
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white max-w-[240px]">
                        <button
                          onClick={() => setDetailTender(tender)}
                          className="hover:text-amber-500 transition-colors text-left font-bold cursor-pointer block truncate"
                          title="Open Tender Detail Page"
                        >
                          {tenderName}
                        </button>
                        {location && (
                          <span className="text-[10px] text-gray-400 font-normal flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {location}
                          </span>
                        )}
                      </td>

                      {/* Organization */}
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300 max-w-[180px] truncate" title={organization}>
                        {organization}
                      </td>

                      {/* Tender Type Badge */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300">
                          {typeVal}
                        </span>
                      </td>

                      {/* Tender Value */}
                      <td className="py-3 px-4 font-mono font-bold text-gray-900 dark:text-white">
                        {formatCurrency(rawVal)}
                      </td>

                      {/* Stage Dropdown Selector (Live 1-Click Update) */}
                      <td className="py-3 px-4">
                        <select
                          disabled={updatingId === rowNum}
                          value={stage}
                          onChange={(e) => handleUpdateStage(tender, e.target.value as TenderStage)}
                          className={`text-[10px] font-mono font-semibold px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                            stage === "Won"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                              : stage === "Lost"
                              ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40"
                              : stage === "Submitted"
                              ? "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40"
                              : "bg-gray-50 text-gray-800 border-gray-200 dark:bg-[#161622] dark:text-gray-200 dark:border-white/10"
                          }`}
                        >
                          {TENDER_STAGES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>

                      {/* Last Submission Date */}
                      <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-300">
                        {submissionDate}
                      </td>

                      {/* Urgency Countdown */}
                      <td className="py-3 px-4">
                        {daysRemaining !== null ? (
                          daysRemaining < 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Expired ({Math.abs(daysRemaining)}d ago)
                            </span>
                          ) : daysRemaining === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse">
                              <Clock className="w-2.5 h-2.5" />
                              Due Today
                            </span>
                          ) : daysRemaining <= 3 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <Clock className="w-2.5 h-2.5" />
                              {daysRemaining}d left
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                              {daysRemaining} days left
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400 font-mono">—</span>
                        )}
                      </td>

                      {/* Manage Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Open Detail Page */}
                          <button
                            onClick={() => setDetailTender(tender)}
                            className="p-1 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 transition-colors cursor-pointer"
                            title="Open Tender Detail Page"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {/* Edit Details */}
                          <button
                            onClick={() => { setEditingTender(tender); setIsEditModalOpen(true); }}
                            className="p-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                            title="Edit Tender Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {/* Delete Record */}
                          {onDeleteLead && (
                            <button
                              onClick={() => handleDeleteTenderClick(tender)}
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 transition-colors cursor-pointer"
                              title="Delete tender"
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
                    No tenders match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TENDER DETAIL PAGE / MODAL (MANDATORY FIELDS UPON OPENING) */}
      {/* ========================================================= */}
      {detailTender && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                    {detailTender[nameCol] || "Tender Record"}
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300">
                      {detailTender[idCol] || `TND-${detailTender["_row_num"]}`}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-[#888899] mt-0.5">
                    Authority: <strong className="text-gray-700 dark:text-gray-200 font-semibold">{detailTender[orgCol] || "Unassigned"}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const t = detailTender;
                    setDetailTender(null);
                    setEditingTender(t);
                    setIsEditModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => setDetailTender(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Interactive Stage Stepper */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Current Tender Stage
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {TENDER_STAGES.map((stg) => {
                    const isCurrent = detailTender._normStage === stg;
                    return (
                      <button
                        key={stg}
                        onClick={() => handleUpdateStage(detailTender, stg)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-amber-600 text-white font-bold shadow-xs ring-2 ring-amber-500/40"
                            : "bg-white dark:bg-[#1E1E2D] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        }`}
                      >
                        {stg}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mandatory Detailed Tender Specifications Grid */}
              <div>
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] mb-3">
                  Mandatory Tender Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {/* 1. State / Location */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1 font-semibold">
                      <MapPin className="w-3 h-3 text-amber-500" />
                      State / Location
                    </span>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">
                      {detailTender[stateCol] || <span className="text-gray-400 italic font-normal">Not specified</span>}
                    </p>
                  </div>

                  {/* 2. Tender Value */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1 font-semibold">
                      <DollarSign className="w-3 h-3 text-emerald-500" />
                      Tender Value
                    </span>
                    <p className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(detailTender[valueCol])}
                    </p>
                  </div>

                  {/* 3. Tender Type */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1 font-semibold">
                      <Tag className="w-3 h-3 text-blue-500" />
                      Tender Type
                    </span>
                    <p className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
                      {detailTender[typeCol] || "Open"}
                    </p>
                  </div>

                  {/* 4. Category */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-semibold block">
                      Category
                    </span>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">
                      {detailTender[categoryCol] || <span className="text-gray-400 italic font-normal">—</span>}
                    </p>
                  </div>

                  {/* 5. Publish Date */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1 font-semibold">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      Publish Date
                    </span>
                    <p className="text-xs font-mono font-semibold text-gray-900 dark:text-white">
                      {detailTender[publishDateCol] || "—"}
                    </p>
                  </div>

                  {/* 6. Last Submission Date */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1 font-semibold">
                      <Clock className="w-3 h-3 text-rose-500" />
                      Last Submission Date
                    </span>
                    <p className="text-xs font-mono font-semibold text-rose-600 dark:text-rose-400">
                      {detailTender[submissionDateCol] || "—"}
                    </p>
                  </div>

                  {/* 7. Bid Opening Date */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1 font-semibold">
                      <Calendar className="w-3 h-3 text-purple-500" />
                      Bid Opening Date
                    </span>
                    <p className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400">
                      {detailTender[bidOpeningDateCol] || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes & Remarks Box */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  Notes / Remarks & Corrigendum Details
                </span>
                <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-sans min-h-[80px]">
                  {detailTender[notesCol] || (
                    <span className="text-gray-400 italic">No notes or corrigendum recorded for this tender.</span>
                  )}
                </div>
              </div>

              {/* All Synced Google Sheet Columns for Reference */}
              <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold block">
                  All Record Fields (From Connected Sheet)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {headers.filter(h => h !== "_row_num").map(h => {
                    const v = detailTender[h];
                    if (!v) return null;
                    return (
                      <div key={h} className="p-2 rounded-lg bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                        <span className="text-[9px] font-mono uppercase text-gray-400 block truncate">{h}</span>
                        <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate block">{String(v)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-[#14141C]">
              {onDeleteLead && (
                <button
                  onClick={() => handleDeleteTenderClick(detailTender)}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Tender
                </button>
              )}
              <button
                onClick={() => setDetailTender(null)}
                className="px-4 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-semibold transition-all cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT TENDER MODAL                                   */}
      {/* ========================================================= */}
      {(isAddModalOpen || isEditModalOpen) && (
        <TenderFormModal
          isOpen={isAddModalOpen || isEditModalOpen}
          initialData={editingTender}
          title={isAddModalOpen ? "Register New Tender" : "Edit Tender Record"}
          onClose={() => {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
            setEditingTender(null);
          }}
          onSave={handleSaveTenderDetails}
          fieldNames={{
            id: idCol,
            name: nameCol,
            org: orgCol,
            publishDate: publishDateCol,
            submissionDate: submissionDateCol,
            bidOpeningDate: bidOpeningDateCol,
            stage: stageCol,
            state: stateCol,
            value: valueCol,
            type: typeCol,
            category: categoryCol,
            notes: notesCol,
          }}
        />
      )}
    </div>
  );
}

// Standalone Modal Form for Tender Creation and Editing
function TenderFormModal({
  isOpen,
  initialData,
  title,
  onClose,
  onSave,
  fieldNames,
}: {
  isOpen: boolean;
  initialData: Record<string, any> | null;
  title: string;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
  fieldNames: Record<string, string>;
}) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        [fieldNames.publishDate]: formatDateForInput(initialData[fieldNames.publishDate]),
        [fieldNames.submissionDate]: formatDateForInput(initialData[fieldNames.submissionDate]),
        [fieldNames.bidOpeningDate]: formatDateForInput(initialData[fieldNames.bidOpeningDate]),
      });
    } else {
      setFormData({
        [fieldNames.stage]: "Tender Identified",
        [fieldNames.type]: "Open",
        [fieldNames.publishDate]: formatDateForInput(new Date()),
      });
    }
  }, [initialData, isOpen, fieldNames]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, val: any) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
          <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tender Name */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Tender Name / Requirement Scope *
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Website Revamp & SEO, AI Content Agency..."
                value={formData[fieldNames.name] || ""}
                onChange={(e) => handleChange(fieldNames.name, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            {/* Organization */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Organization / Client Authority *
              </label>
              <input
                required
                type="text"
                placeholder="e.g. NCERT, UNICEF, IIM Jammu..."
                value={formData[fieldNames.org] || ""}
                onChange={(e) => handleChange(fieldNames.org, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            {/* Tender ID */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Tender ID / Reference Number
              </label>
              <input
                type="text"
                placeholder="e.g. GEM/2026/B/12345 or Auto-assigned"
                value={formData[fieldNames.id] || ""}
                onChange={(e) => handleChange(fieldNames.id, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* Tender Stage Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Tender Stage (Dropdown) *
              </label>
              <select
                value={formData[fieldNames.stage] || "Tender Identified"}
                onChange={(e) => handleChange(fieldNames.stage, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500 cursor-pointer font-mono"
              >
                {TENDER_STAGES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Tender Type Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Tender Type (Dropdown) *
              </label>
              <select
                value={formData[fieldNames.type] || "Open"}
                onChange={(e) => handleChange(fieldNames.type, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500 cursor-pointer font-mono"
              >
                {TENDER_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Tender Value */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Tender Value (₹ INR)
              </label>
              <input
                type="text"
                placeholder="e.g. 25,00,000"
                value={formData[fieldNames.value] || ""}
                onChange={(e) => handleChange(fieldNames.value, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* State / Location */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                State / Location
              </label>
              <input
                type="text"
                placeholder="e.g. New Delhi, Mumbai, Pan-India"
                value={formData[fieldNames.state] || ""}
                onChange={(e) => handleChange(fieldNames.state, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g. Creative, Website, Media, Consulting"
                value={formData[fieldNames.category] || ""}
                onChange={(e) => handleChange(fieldNames.category, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            {/* Publish Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Publish Date
              </label>
              <input
                type="date"
                value={formData[fieldNames.publishDate] || ""}
                onChange={(e) => handleChange(fieldNames.publishDate, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            {/* Last Submission Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Last Submission Date *
              </label>
              <input
                required
                type="date"
                value={formData[fieldNames.submissionDate] || ""}
                onChange={(e) => handleChange(fieldNames.submissionDate, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500 font-mono font-semibold"
              />
            </div>

            {/* Bid Opening Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Bid Opening Date
              </label>
              <input
                type="date"
                value={formData[fieldNames.bidOpeningDate] || ""}
                onChange={(e) => handleChange(fieldNames.bidOpeningDate, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            {/* Notes / Remarks */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] font-bold">
                Notes / Remarks & Corrigendum Details
              </label>
              <textarea
                rows={3}
                placeholder="Enter eligibility criteria, pre-bid meeting updates, EMD details, or technical notes..."
                value={formData[fieldNames.notes] || ""}
                onChange={(e) => handleChange(fieldNames.notes, e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving Tender..." : "Save Tender"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
