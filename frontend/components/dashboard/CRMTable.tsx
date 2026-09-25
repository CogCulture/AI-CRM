"use client";

import React, { useState, useEffect } from "react";
import { SlidersHorizontal, ArrowUpDown, Edit3, Trash2, Search, X } from "lucide-react";
import ColumnManager from "./ColumnManager";

interface CRMTableProps {
  headers: string[];
  rows: Record<string, any>[];
  visibleColumns: string[];
  columnOrder: string[];
  onSaveConfig: (visible: string[], order: string[]) => Promise<void>;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  onEdit?: (row: Record<string, any>) => void;
  onDelete?: (row: Record<string, any>) => void;
  isTenderDashboard?: boolean;
  currentTab?: string;
}

const getCampaignIcon = (name: string) => {
  const norm = name.toLowerCase().trim();
  if (norm.includes("roq")) {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 17 L10 11 L14 15 L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (norm.includes("website")) {
    return (
      <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-white shrink-0 shadow-md">
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      </div>
    );
  }
  if (norm.includes("demo")) {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-md">
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-md">
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    </div>
  );
};

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

// Helper to format date cleanly as YYYY-MM-DD
const formatDisplayDate = (dateVal: any): string => {
  if (!dateVal) return "—";
  const dateStr = String(dateVal).trim();
  if (!dateStr || dateStr === "—" || dateStr.toLowerCase() === "placeholder") return "—";
  
  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr;
  
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Helper to retrieve or generate a unique Lead ID
const getLeadId = (row: Record<string, any>): string => {
  if (row["Lead ID"]) return String(row["Lead ID"]);
  const rowNum = row._row_num;
  if (!rowNum) return "—";
  return `COG-${1000 + Number(rowNum)}`;
};

// Helper to retrieve row source value
const getRowSource = (row: Record<string, any>): string => {
  for (const [k, v] of Object.entries(row)) {
    const kLower = k.toLowerCase().trim();
    if (kLower === "source" || kLower === "sources" || kLower.includes("source") || kLower.includes("lead source")) {
      const val = String(v || "").trim();
      if (val) return val;
    }
  }
  return "";
};

// Helper to assign distinct, soft, eye-friendly high-contrast pastel colors based on source across the row
const getSourceRowClasses = (sourceStr: string): string => {
  const norm = sourceStr.toLowerCase().trim();
  if (!norm) return "bg-white dark:bg-[#111118] hover:bg-gray-50/80 dark:hover:bg-[rgba(255,255,255,0.03)]";
  
  // 1. Internal -> Slate / Gray (#F1F5F9, #334155)
  if (norm.includes("internal")) {
    return "bg-[#F1F5F9] dark:bg-[#1E293B]/90 text-[#334155] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#334155] border-l-4 border-l-[#64748B] font-medium";
  }
  // 2. LinkedIn -> Blue (#DBEAFE, #1D4ED8)
  if (norm.includes("linkedin")) {
    return "bg-[#DBEAFE] dark:bg-[#1E3A8A]/90 text-[#1D4ED8] dark:text-[#BFDBFE] hover:bg-[#BFDBFE] dark:hover:bg-[#1E40AF] border-l-4 border-l-[#2563EB] font-medium";
  }
  // 3. Website -> Green (#DCFCE7, #15803D)
  if (norm.includes("website") || norm.includes("web")) {
    return "bg-[#DCFCE7] dark:bg-[#14532D]/90 text-[#15803D] dark:text-[#BBF7D0] hover:bg-[#BBF7D0] dark:hover:bg-[#166534] border-l-4 border-l-[#16A34A] font-medium";
  }
  // 4. Inbound -> Purple (#F3E8FF, #7E22CE)
  if (norm.includes("inbound")) {
    return "bg-[#F3E8FF] dark:bg-[#581C87]/90 text-[#7E22CE] dark:text-[#E9D5FF] hover:bg-[#E9D5FF] dark:hover:bg-[#6B21A8] border-l-4 border-l-[#9333EA] font-medium";
  }
  // 5. Direct Mail / Mail -> Rose (#FFE4E6, #BE123C)
  if (norm.includes("direct mail") || norm.includes("mail")) {
    return "bg-[#FFE4E6] dark:bg-[#881337]/90 text-[#BE123C] dark:text-[#FECDD3] hover:bg-[#FECDD3] dark:hover:bg-[#9F1239] border-l-4 border-l-[#E11D48] font-medium";
  }
  // 6. Direct -> Orange (#FFEDD5, #C2410C)
  if (norm.includes("direct")) {
    return "bg-[#FFEDD5] dark:bg-[#7C2D12]/90 text-[#C2410C] dark:text-[#FED7AA] hover:bg-[#FED7AA] dark:hover:bg-[#9A3412] border-l-4 border-l-[#EA580C] font-medium";
  }
  // 7. Tender -> Warm Gold / Amber (#FEF3C7, #78350F)
  if (norm.includes("tender")) {
    return "bg-[#FEF3C7] dark:bg-[#78350F]/90 text-[#78350F] dark:text-[#FDE68A] hover:bg-[#FDE68A] dark:hover:bg-[#92400E] border-l-4 border-l-[#D97706] font-medium";
  }

  // Dynamic hash fallback for custom sources
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % 5;
  const colorClasses = [
    "bg-[#ECFCCB] dark:bg-[#1B2909]/90 text-[#365314] dark:text-[#D9F99D] hover:bg-[#D9F99D] border-l-4 border-l-[#65A30D] font-medium",
    "bg-[#CFFAFE] dark:bg-[#082B30]/90 text-[#164E63] dark:text-[#A5F3FC] hover:bg-[#A5F3FC] border-l-4 border-l-[#0891B2] font-medium",
    "bg-[#FAE8FF] dark:bg-[#340A31]/90 text-[#701A75] dark:text-[#F5D0FE] hover:bg-[#F5D0FE] border-l-4 border-l-[#C026D3] font-medium",
    "bg-[#FEF9C3] dark:bg-[#322D08]/90 text-[#713F12] dark:text-[#FEF08A] hover:bg-[#FEF08A] border-l-4 border-l-[#CA8A04] font-medium",
    "bg-[#EDE9FE] dark:bg-[#201548]/90 text-[#4C1D95] dark:text-[#DDD6FE] hover:bg-[#DDD6FE] border-l-4 border-l-[#7C3AED] font-medium",
  ];
  return colorClasses[colorIndex];
};

// Helper to retrieve color block styling for the Source Legend bar
const getLegendColor = (sourceStr: string) => {
  const norm = sourceStr.toLowerCase().trim();
  if (norm.includes("internal")) {
    return { name: sourceStr, dot: "bg-[#64748B]", pill: "bg-[#F1F5F9] dark:bg-[#1E293B]/90 text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#64748B]/40" };
  }
  if (norm.includes("linkedin")) {
    return { name: sourceStr, dot: "bg-[#2563EB]", pill: "bg-[#DBEAFE] dark:bg-[#1E3A8A]/90 text-[#1D4ED8] dark:text-[#BFDBFE] border-[#BFDBFE] dark:border-[#2563EB]/40" };
  }
  if (norm.includes("website") || norm.includes("web")) {
    return { name: sourceStr, dot: "bg-[#16A34A]", pill: "bg-[#DCFCE7] dark:bg-[#14532D]/90 text-[#15803D] dark:text-[#BBF7D0] border-[#BBF7D0] dark:border-[#16A34A]/40" };
  }
  if (norm.includes("inbound")) {
    return { name: sourceStr, dot: "bg-[#9333EA]", pill: "bg-[#F3E8FF] dark:bg-[#581C87]/90 text-[#7E22CE] dark:text-[#E9D5FF] border-[#E9D5FF] dark:border-[#9333EA]/40" };
  }
  if (norm.includes("direct mail") || norm.includes("mail")) {
    return { name: sourceStr, dot: "bg-[#E11D48]", pill: "bg-[#FFE4E6] dark:bg-[#881337]/90 text-[#BE123C] dark:text-[#FECDD3] border-[#FECDD3] dark:border-[#E11D48]/40" };
  }
  if (norm.includes("direct")) {
    return { name: sourceStr, dot: "bg-[#EA580C]", pill: "bg-[#FFEDD5] dark:bg-[#7C2D12]/90 text-[#C2410C] dark:text-[#FED7AA] border-[#FED7AA] dark:border-[#EA580C]/40" };
  }
  if (norm.includes("tender")) {
    return { name: sourceStr, dot: "bg-[#D97706]", pill: "bg-[#FEF3C7] dark:bg-[#78350F]/90 text-[#78350F] dark:text-[#FDE68A] border-[#FDE68A] dark:border-[#D97706]/40" };
  }
  return { name: sourceStr, dot: "bg-[#0284C7]", pill: "bg-sky-50 dark:bg-sky-950/80 text-sky-900 dark:text-sky-200 border-sky-200 dark:border-sky-800/40" };
};

// Helper to retrieve row status value
const getRowStatus = (row: Record<string, any>): string => {
  for (const [k, v] of Object.entries(row)) {
    const kLower = k.toLowerCase().trim();
    if (kLower === "status") {
      const val = String(v || "").trim();
      if (val) return val;
    }
  }
  return "";
};

// Helper to retrieve status glowing dot styling
const getStatusDotClasses = (statusStr: string): string => {
  const norm = statusStr.toLowerCase().trim();
  if (norm === "hot") return "bg-[#FF1744] shadow-[0_0_12px_#FF1744] animate-[pulse_0.8s_ease-in-out_infinite] scale-125";
  if (norm === "warm") return "bg-[#FFD600] shadow-[0_0_8px_#FFD600]";
  if (norm === "cold") return "bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]";
  if (norm === "discovery") return "bg-[#AA00FF] shadow-[0_0_8px_#AA00FF]";
  if (["won", "closed won", "converted", "completed", "success"].some(x => norm.includes(x))) return "bg-[#00E676] shadow-[0_0_8px_#00E676]";
  if (["dead", "lost"].some(x => norm.includes(x))) return "bg-[#424242] shadow-[0_0_8px_#424242]";
  if (norm === "lead") return "bg-gray-400 shadow-[0_0_8px_rgba(156,163,175,0.8)]";
  if (norm === "proposal sent" || norm === "proposal") return "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]";
  if (norm === "portfolio sent" || norm === "portfolio") return "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]";
  if (norm === "tender lead" || norm === "tender") return "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]";
  if (!norm) return "";
  return "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.8)]";
};

export default function CRMTable({
  headers,
  rows,
  visibleColumns,
  columnOrder,
  onSaveConfig,
  searchTerm,
  onSearchChange,
  onEdit,
  onDelete,
  isTenderDashboard,
  currentTab,
}: CRMTableProps) {
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const isNumericColumn = (colName: string) => {
    const norm = colName.toLowerCase();
    if (norm === "lead id") return false;
    return ["visitors", "contacts", "companies", "leads", "value", "amount", "revenue", "no."].some(x => norm.includes(x));
  };
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  // Dynamic Filters based on headers
  const typeColumn = headers.find(h => h.toLowerCase().includes("type") || h.toLowerCase().includes("channel"));
  const uniqueTypes = typeColumn 
    ? Array.from(new Set(rows.map(r => String(r[typeColumn] || "").trim()).filter(Boolean)))
    : [];
  const [selectedType, setSelectedType] = useState("All");

  const statusColumn = headers.find(h => h.toLowerCase() === "status") || headers.find(h => h.toLowerCase().includes("status")) || "";
  const uniqueStatuses = statusColumn 
    ? Array.from(new Set(rows.map(r => String(r[statusColumn] || "").trim()).filter(Boolean)))
    : [];
  const [selectedStatus, setSelectedStatus] = useState("All");

  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedDetailsRow, setSelectedDetailsRow] = useState<Record<string, any> | null>(null);

  const activeSearch = searchTerm !== undefined ? searchTerm : localSearchTerm;

  // Reset pagination index on search / sort / filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearch, sortColumn, sortDirection, selectedType, selectedStatus]);

  // Determine active columns and order
  const displayCols = columnOrder.length > 0 ? columnOrder : [...headers];
  const activeColsRaw = displayCols.filter((col) => {
    if (visibleColumns.length === 0) return headers.includes(col);
    // Show if it's explicitly visible, or if it's a new column not yet present in columnOrder config
    return (visibleColumns.includes(col) || (headers.includes(col) && !columnOrder.includes(col))) && headers.includes(col);
  });

  // Include missing headers that aren't in columnOrder yet
  headers.forEach((h) => {
    if (!displayCols.includes(h)) {
      displayCols.push(h);
      activeColsRaw.push(h); // Make it visible by default since it is brand new
    }
  });

  // Inject "Lead ID" at the very beginning of the active columns list (filtering out any duplicates)
  let activeCols = ["Lead ID", ...activeColsRaw.filter((col) => col !== "Lead ID")];
  
  // Globally remove Status column from table display
  activeCols = activeCols.filter(col => {
    const colLower = col.toLowerCase().trim();
    if (colLower === "status") return false;
    
    // For Tender Dashboard, remove specific columns
    if (isTenderDashboard) {
      if (
        colLower === "source" || 
        colLower === "sources" || 
        colLower.includes("poc email") ||
        colLower === "email" ||
        colLower.includes("message from prospect")
      ) {
        return false;
      }
    }

    // For Active Leads and Internal Leads, ONLY show the requested columns
    if (currentTab === "active_leads" || currentTab === "internal_leads") {
      const isAllowed = 
        colLower === "lead id" || 
        colLower === "date" || 
        colLower.includes("company") || 
        colLower === "requirement" || 
        colLower === "stage" || 
        colLower === "cog poc" || 
        colLower === "poc" ||
        colLower === "actions"; // keep actions column if any
      
      if (!isAllowed) {
        return false;
      }
    }

    return true;
  });

  // Sorting logic
  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Filter rows based on search and selected options
  const filteredRows = rows.filter((row) => {
    const leadId = getLeadId(row).toLowerCase();
    const matchesSearch = Object.values(row).some((val) =>
      String(val).toLowerCase().includes(activeSearch.toLowerCase())
    ) || leadId.includes(activeSearch.toLowerCase());

    let matchesType = true;
    if (typeColumn && selectedType !== "All") {
      matchesType = String(row[typeColumn] || "").trim() === selectedType;
    }

    let matchesStatus = true;
    if (statusColumn && selectedStatus !== "All") {
      matchesStatus = String(row[statusColumn] || "").trim() === selectedStatus;
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  // Sort filtered rows
  const sortedRows = [...filteredRows];
  if (sortColumn) {
    sortedRows.sort((a, b) => {
      let valA = sortColumn === "Lead ID" ? getLeadId(a) : (a[sortColumn] || "");
      let valB = sortColumn === "Lead ID" ? getLeadId(b) : (b[sortColumn] || "");
      
      const numA = parseFloat(String(valA).replace(/[^0-9.-]/g, ""));
      const numB = parseFloat(String(valB).replace(/[^0-9.-]/g, ""));
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }
      
      return sortDirection === "asc" 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }

  // Slice rows for current page
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = sortedRows.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  const sourceColumn = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return hl === "source" || hl === "sources" || hl.includes("source") || hl.includes("lead source");
  });
  const activeSources = sourceColumn
    ? Array.from(new Set(rows.map(r => String(r[sourceColumn] || "").trim()).filter(Boolean)))
    : ["Internal", "Tender", "Website", "Linkedin", "Inbound"];

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#111118] overflow-hidden shadow-xl transition-colors duration-150">
      {/* Table Action Bar */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-[rgba(255,255,255,0.05)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Section Title & Soothing Source Color Palette Legend */}
        <div className="flex flex-col gap-2 min-w-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-sans tracking-tight">
            Campaign Performance
          </h3>
          
          {/* Soothing Source Palette Legend Blocks */}
          <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899] mr-1">
              Source Palette:
            </span>
            {activeSources.map(src => {
              const item = getLegendColor(src);
              return (
                <div
                  key={src}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border transition-all shadow-xs ${item.pill}`}
                >
                  <span className={`w-2 h-2 rounded-full ${item.dot} shadow-xs shrink-0`} />
                  <span>{src}</span>
                </div>
              );
            })}
          </div>
          
          {/* Status Palette Legend Blocks */}
          <div className="flex items-center flex-wrap gap-1.5 pt-0.5 mt-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899] mr-1">
              Status Palette:
            </span>
            {["Hot", "Warm", "Cold", "Discovery", "Won", "Lost"].map(status => {
              const dotClass = getStatusDotClasses(status);
              return (
                <div
                  key={status}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border transition-all shadow-xs bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700/50"
                >
                  <span className={`w-2 h-2 rounded-full ${dotClass} shadow-xs shrink-0`} />
                  <span>{status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Controls & Filters */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Type Filter */}
          {typeColumn && (
            <div className="relative">
              <button
                onClick={() => {
                  setIsTypeDropdownOpen(!isTypeDropdownOpen);
                  setIsStatusDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#161622] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] text-gray-700 dark:text-white text-xs font-sans rounded-lg transition-colors cursor-pointer"
              >
                <span className="text-gray-400 dark:text-[#888899]">Type:</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedType}</span>
                <svg className={`w-3 h-3 text-gray-400 dark:text-[#888899] transition-transform duration-200 ${isTypeDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isTypeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsTypeDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => {
                        setSelectedType("All");
                        setIsTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-sans hover:bg-gray-50 dark:hover:bg-[#1C1C2D] transition-colors cursor-pointer ${
                        selectedType === "All" ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50/50 dark:bg-[#1C1C2D]/50" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      All
                    </button>
                    {uniqueTypes.map(t => (
                      <button
                        key={t}
                        onClick={() => {
                          setSelectedType(t);
                          setIsTypeDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-sans hover:bg-gray-50 dark:hover:bg-[#1C1C2D] transition-colors cursor-pointer ${
                          selectedType === t ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50/50 dark:bg-[#1C1C2D]/50" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Status Filter */}
          {statusColumn && (
            <div className="relative">
              <button
                onClick={() => {
                  setIsStatusDropdownOpen(!isStatusDropdownOpen);
                  setIsTypeDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#161622] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] text-gray-700 dark:text-white text-xs font-sans rounded-lg transition-colors cursor-pointer"
              >
                <span className="text-gray-400 dark:text-[#888899]">Status:</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedStatus}</span>
                <svg className={`w-3 h-3 text-gray-400 dark:text-[#888899] transition-transform duration-200 ${isStatusDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isStatusDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsStatusDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => {
                        setSelectedStatus("All");
                        setIsStatusDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-sans hover:bg-gray-50 dark:hover:bg-[#1C1C2D] transition-colors cursor-pointer ${
                        selectedStatus === "All" ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50/50 dark:bg-[#1C1C2D]/50" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      All
                    </button>
                    {uniqueStatuses.map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          setSelectedStatus(s);
                          setIsStatusDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-sans hover:bg-gray-50 dark:hover:bg-[#1C1C2D] transition-colors cursor-pointer ${
                          selectedStatus === s ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50/50 dark:bg-[#1C1C2D]/50" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Search bar inside Table */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-[#888899]" />
            <input
              type="text"
              placeholder="Search by company or stage..."
              value={activeSearch}
              onChange={(e) => {
                if (onSearchChange) {
                  onSearchChange(e.target.value);
                } else {
                  setLocalSearchTerm(e.target.value);
                }
              }}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] hover:border-gray-350 dark:hover:border-[rgba(255,255,255,0.15)] focus:border-blue-500 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#555566] transition-all outline-none font-sans"
            />
          </div>

          {/* Configure Columns Trigger */}
          <button
            onClick={() => setIsManagerOpen(true)}
            className="p-1.5 bg-white hover:bg-gray-50 dark:bg-[#161622] dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Configure Columns"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#161622]/40 text-[10px] font-sans font-semibold uppercase tracking-wider text-gray-500 dark:text-[#888899]">
              {activeCols.map((col, idx) => {
                const isRight = isNumericColumn(col) && col.toLowerCase() !== "no.";
                return (
                  <th 
                    key={`${col}-${idx}`} 
                    className={`py-3 px-4 select-none cursor-pointer hover:bg-gray-150/50 dark:hover:bg-[rgba(255,255,255,0.03)] hover:text-gray-950 dark:hover:text-white transition-colors ${
                      isRight ? "text-right" : "text-left"
                    }`}
                    onClick={() => handleSort(col)}
                  >
                    <div className={`flex items-center gap-1 ${isRight ? "justify-end" : "justify-start"}`}>
                      {col}
                      <ArrowUpDown className="w-3 h-3 text-[#555566]" />
                    </div>
                  </th>
                );
              })}
              {(onEdit || onDelete) && (
                <th className="py-3 px-4 font-semibold text-center select-none text-[10px] tracking-wider text-gray-500 dark:text-[#888899] w-24">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((row, rowIdx) => {
                const rowSource = getRowSource(row);
                const rowClass = getSourceRowClasses(rowSource);
                return (
                  <tr 
                    key={rowIdx}
                    className={`border-b border-gray-200/60 dark:border-white/5 last:border-0 transition-colors duration-150 text-xs font-sans text-gray-900 dark:text-gray-100 row-fade-in ${rowClass}`}
                    style={{ animationDelay: `${rowIdx * 30}ms` }}
                  >
                  {activeCols.map((col, idx) => {
                    const cellVal = col === "Lead ID" ? getLeadId(row) : String(row[col] || "");
                    const isNo = col.toLowerCase() === "no.";
                    const isCampaign = col.toLowerCase() === "campaign";
                    const isValue = ["value", "amount", "revenue", "estimations", "deal size"].some(x => col.toLowerCase().includes(x));

                    if (isCampaign) {
                      const parts = cellVal.split("\n");
                      const mainTitle = parts[0];
                      const subtitle = parts[1] || "";
                      return (
                        <td key={`${col}-${idx}`} className="py-3 px-4 text-left">
                          <div className="flex items-center gap-3">
                            {getCampaignIcon(mainTitle)}
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900 dark:text-white text-xs">{mainTitle}</span>
                              {subtitle && <span className="text-[10px] text-gray-400 dark:text-[#555566] mt-0.5">{subtitle}</span>}
                            </div>
                          </div>
                        </td>
                      );
                    }

                    const isRight = isNumericColumn(col) && col.toLowerCase() !== "no.";
                    
                    // Render formatted cells
                    const renderCellContent = () => {
                      if (col === "Lead ID") {
                        const leadStatus = getRowStatus(row);
                        const statusDotClasses = getStatusDotClasses(leadStatus);
                        return (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-950 dark:text-white font-mono">
                              {cellVal}
                            </span>
                            {statusDotClasses && (
                              <span 
                                className={`w-2 h-2 rounded-full ${statusDotClasses}`} 
                                title={leadStatus}
                              />
                            )}
                          </div>
                        );
                      }
                      if (col.toLowerCase().includes("company")) {
                        const rowSource = getRowSource(row).toLowerCase();
                        const isWebsite = rowSource.includes("website") || rowSource.includes("web");
                        return (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedDetailsRow(row)}
                              className="font-bold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left cursor-pointer"
                            >
                              {cellVal}
                            </button>
                            {isWebsite && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
                                Fresh Lead
                              </span>
                            )}
                          </div>
                        );
                      }
                      if (isValue) {
                        // Apply currency formatting prefix if not already present
                        const cleanVal = cellVal.replace(/[₹$,\s]/g, "");
                        const numericVal = parseFloat(cleanVal);
                        const formatted = !isNaN(numericVal) 
                          ? `₹${numericVal.toLocaleString("en-IN")}`
                          : cellVal;
                        return (
                          <span className="font-semibold text-emerald-600 dark:text-[#3cd395] font-mono">
                            {formatted || "—"}
                          </span>
                        );
                      }
                      
                      const colLower = col.toLowerCase();
                      const isStatus = colLower.includes("status");
                      const isStage = colLower.includes("stage");
                      const isType = colLower.includes("type");
                      const isSource = colLower.includes("source");
                      const isDate = colLower.includes("date") || colLower.includes("deadline") || colLower.includes("due");

                      if (isDate && cellVal.trim() !== "") {
                        return (
                          <span className="font-mono text-gray-700 dark:text-[#dedee5]">
                            {formatDisplayDate(cellVal)}
                          </span>
                        );
                      }

                      if (isSource && cellVal.trim() !== "" && cellVal.length <= 25) {
                        return (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/80 dark:bg-black/40 border border-black/15 dark:border-white/20 shadow-xs">
                            {cellVal}
                          </span>
                        );
                      }
                      
                      // Render statuses or stages as badges only if the value is short (e.g., standard status keywords)
                      if ((isStatus || isStage) && cellVal.trim() !== "" && cellVal.length <= 20) {
                        const valLower = cellVal.toLowerCase().trim();
                        let badgeClass = "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/80 dark:text-gray-300 dark:border-gray-700/50";
                        
                        if (valLower === "hot") {
                          badgeClass = "bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50";
                        } else if (valLower === "warm") {
                          badgeClass = "bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
                        } else if (valLower === "cold") {
                          badgeClass = "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
                        } else if (valLower === "discovery") {
                          badgeClass = "bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20";
                        } else if (valLower === "lead") {
                          badgeClass = "bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-850 dark:text-gray-400 dark:border-gray-700/40";
                        } else if (valLower === "proposal sent" || valLower === "proposal") {
                          badgeClass = "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-450 dark:border-blue-500/20";
                        } else if (valLower === "portfolio sent" || valLower === "portfolio") {
                          badgeClass = "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-450 dark:border-amber-500/20";
                        } else if (valLower === "tender lead" || valLower === "tender") {
                          badgeClass = "bg-yellow-55 text-yellow-800 border border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-450 dark:border-yellow-500/20";
                        } else if (["won", "converted", "completed", "success"].some(x => valLower.includes(x))) {
                          badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-[#3cd395] dark:border-emerald-500/20";
                        } else if (["dead", "lost"].some(x => valLower.includes(x))) {
                          badgeClass = "bg-red-50 text-red-700 border border-red-100 dark:bg-red-500/10 dark:text-red-450 dark:border-red-500/20";
                        }
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${badgeClass}`}>
                            {cellVal}
                          </span>
                        );
                      }
                      
                      // Render type as Indigo/Purple badge
                      if (isType && cellVal.trim() !== "" && cellVal.length <= 20) {
                        const valLower = cellVal.toLowerCase().trim();
                        let badgeClass = "bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20";
                        if (valLower.includes("inbound")) {
                          badgeClass = "bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
                        }
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${badgeClass}`}>
                            {cellVal}
                          </span>
                        );
                      }

                      // Truncate long notes or description texts
                      if (cellVal.length > 25) {
                        return (
                          <span className="block truncate max-w-[220px] text-gray-700 dark:text-[#dedee5] cursor-help" title={cellVal}>
                            {cellVal}
                          </span>
                        );
                      }
                      
                      return cellVal;
                    };

                    return (
                      <td 
                        key={`${col}-${idx}`} 
                        className={`py-3 px-4 text-xs ${
                          isNo ? "text-gray-400 dark:text-[#555566] font-mono" : "text-gray-800 dark:text-[#dedee5]"
                        } ${
                          isRight ? "text-right" : "text-left"
                        }`}
                      >
                        {renderCellContent()}
                      </td>
                    );
                  })}
                  {(onEdit || onDelete) && (
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 dark:bg-emerald-500/10 dark:border-emerald-500/20 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 rounded transition-colors cursor-pointer"
                            title="Edit Lead"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            className="p-1 bg-red-50 hover:bg-red-100 border border-red-250 dark:bg-red-500/10 dark:border-red-500/20 text-rose-600 hover:text-rose-500 dark:text-rose-450 rounded transition-colors cursor-pointer"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={(activeCols.length + ((onEdit || onDelete) ? 1 : 0)) || 1} className="py-12 text-center text-[#555566] text-sm font-sans">
                  No records match your query
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer statistics & Pagination controls */}
      <div className="p-4 bg-gray-50/50 dark:bg-[rgba(255,255,255,0.01)] border-t border-gray-100 dark:border-[rgba(255,255,255,0.05)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-500 dark:text-[#888899] font-sans">
        <div className="flex items-center gap-4">
          <span>
            Showing {sortedRows.length > 0 ? indexOfFirstRow + 1 : 0} to{" "}
            {Math.min(indexOfLastRow, sortedRows.length)} of {sortedRows.length}{" "}
            entries
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#555566]">Per Page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded text-gray-900 dark:text-white font-sans outline-none cursor-pointer text-[10px]"
            >
              {[5, 8, 12, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-250 dark:bg-[#161622] dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-900 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px]"
            >
              Prev
            </button>
            
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              if (
                totalPages > 6 &&
                pNum !== 1 &&
                pNum !== totalPages &&
                Math.abs(pNum - currentPage) > 1
              ) {
                if (pNum === 2 && currentPage > 3) {
                  return <span key="ellipsis-start" className="px-1 text-[#555566]">...</span>;
                }
                if (pNum === totalPages - 1 && currentPage < totalPages - 2) {
                  return <span key="ellipsis-end" className="px-1 text-[#555566]">...</span>;
                }
                return null;
              }

              return (
                <button
                  key={pNum}
                  onClick={() => setCurrentPage(pNum)}
                  className={`px-2.5 py-1 rounded border text-[10px] cursor-pointer transition-colors ${
                    currentPage === pNum
                      ? "bg-[#1E3A8A] border-[#1E3A8A] text-white font-bold"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-[#161622] dark:hover:bg-[#1C1C2D] border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-800 dark:text-white"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-250 dark:bg-[#161622] dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-900 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px]"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Column Manager Drawer */}
      <ColumnManager
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        allHeaders={headers}
        visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        onSave={onSaveConfig}
      />

      {/* Lead Details Modal */}
      {selectedDetailsRow && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" onClick={() => setSelectedDetailsRow(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-[#161622]/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-sans flex items-center gap-2">
                <span>{selectedDetailsRow["Company Name"] || selectedDetailsRow["Company"] || "Lead Details"}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {getLeadId(selectedDetailsRow)}
                </span>
              </h3>
              <button 
                onClick={() => setSelectedDetailsRow(null)}
                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-[#1C1C2D] dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                {headers.filter(h => h !== "_row_num").map(h => (
                  <div key={h} className="flex flex-col gap-1.5 border-b border-gray-100 dark:border-[rgba(255,255,255,0.05)] pb-3 last:border-0">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-[#888899] uppercase tracking-wider font-mono">
                      {h}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-[#dedee5] font-sans break-words whitespace-pre-wrap">
                      {String(selectedDetailsRow[h] || "—")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
