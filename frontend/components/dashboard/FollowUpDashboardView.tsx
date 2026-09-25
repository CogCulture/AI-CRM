"use client";

import React, { useState, useMemo } from "react";
import { SheetData } from "../../lib/types";
import { 
  Calendar as CalendarIcon, 
  Phone, 
  Mail, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  User, 
  Building2, 
  CalendarDays, 
  ListFilter, 
  Plus, 
  Edit3, 
  RefreshCw, 
  ExternalLink,
  PhoneCall,
  Video,
  ArrowRight,
  Trash2,
  CalendarX,
  Eye,
  X,
  Info
} from "lucide-react";
import { toast } from "sonner";

interface FollowUpDashboardViewProps {
  sheetData: SheetData;
  onEditLead?: (lead: Record<string, any>) => void;
  onAddLead?: () => void;
  onSaveLead?: (data: Record<string, any>) => Promise<void>;
  onDeleteLead?: (lead: Record<string, any>) => Promise<void>;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}

export interface ProcessedLead extends Record<string, any> {
  _parsedDate: Date;
  _dateKey: string;
  _daysDiff: number;
  _isToday: boolean;
  _isOverdue: boolean;
  _isUpcoming: boolean;
  _isMeeting: boolean;
  _isCall: boolean;
}

// Helper to normalize and parse dates: DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD, DD-MM-YYYY
export const parseFollowUpDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  if (!str || str === "—" || str.toLowerCase() === "placeholder") return null;

  // Split date by separators
  const parts = str.split(/[-/.]/);
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
      // YY format
      if (parts[2].length === 2) {
        const fullYear = 2000 + p2;
        return new Date(fullYear, p1 - 1, p0);
      }
    }
  }

  const parsed = Date.parse(str);
  return isNaN(parsed) ? null : new Date(parsed);
};

// Format a date cleanly as YYYY-MM-DD for storage
export const formatDateString = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}`;
};

export default function FollowUpDashboardView({
  sheetData,
  onEditLead,
  onAddLead,
  onSaveLead,
  onDeleteLead,
  onRefresh,
  refreshing = false,
}: FollowUpDashboardViewProps) {
  // Calendar current view month
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  const [activeTab, setActiveTab] = useState<"all" | "today" | "overdue" | "upcoming">("all");
  const [selectedPOC, setSelectedPOC] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [viewDetailsLead, setViewDetailsLead] = useState<Record<string, any> | null>(null);

  // Column headers matching (dynamically inferred from spreadsheet headers)
  const headers = sheetData?.headers || [];
  const followUpCol = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return hl === "follow up date" || hl.includes("follow up") || hl.includes("followup");
  }) || "Follow up date";

  const deadlineCol = headers.find(h => h.toLowerCase().includes("deadline") || h.toLowerCase().includes("due")) || "Deadline";
  const introCallCol = headers.find(h => h.toLowerCase().includes("intro call") || h.toLowerCase().includes("call") || h.toLowerCase().includes("meeting")) || "Intro Call";
  const companyCol = headers.find(h => ["company", "campaign", "client", "account"].some(x => h.toLowerCase().includes(x))) || "Company";
  const pocCol = headers.find(h => ["cog poc", "poc", "owner", "rep", "assignee"].some(x => h.toLowerCase().includes(x))) || "Cog POC";
  const pocEmailCol = headers.find(h => h.toLowerCase().includes("poc email") || h.toLowerCase().includes("email")) || "POC email";
  const nameCol = headers.find(h => h.toLowerCase() === "name" || h.toLowerCase().includes("contact")) || "Name";
  const phoneCol = headers.find(h => h.toLowerCase() === "phone" || h.toLowerCase().includes("phone") || h.toLowerCase().includes("mobile")) || "Phone";
  const emailCol = headers.find(h => h.toLowerCase() === "email" || h.toLowerCase().includes("email")) || "Email";
  const statusCol = headers.find(h => h.toLowerCase() === "status" || h.toLowerCase().includes("status")) || "Status";
  const stageCol = headers.find(h => h.toLowerCase() === "stage" || h.toLowerCase().includes("stage")) || "Stage";
  const valueCol = headers.find(h => ["value", "amount", "revenue"].some(x => h.toLowerCase().includes(x))) || "Value";
  const lastUpdateCol = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return hl === "last update" || hl.includes("update") || hl.includes("notes");
  }) || "Last Update";
  const followUpNotesCol = headers.find(h => {
    const hl = h.toLowerCase().trim();
    return (hl.includes("follow") && !hl.includes("date")) || hl === "follow-up";
  }) || "Follow-up";

  // Dynamically discover ALL note / update / follow-up text columns so any newly added note columns are automatically reflected
  const noteColumns = useMemo(() => {
    return headers.filter(h => {
      const hl = h.toLowerCase().trim();
      return (
        hl.includes("update") ||
        hl.includes("note") ||
        (hl.includes("follow") && !hl.includes("date")) ||
        hl.includes("comment") ||
        hl.includes("remark") ||
        hl.includes("message")
      );
    });
  }, [headers]);

  const getCombinedNotes = (lead: Record<string, any>): string => {
    const parts: string[] = [];
    noteColumns.forEach(col => {
      const val = String(lead[col] || "").trim();
      if (val && val !== "—") {
        if (noteColumns.length > 1 && col.toLowerCase() !== "last update") {
          parts.push(`${col}: ${val}`);
        } else {
          parts.push(val);
        }
      }
    });
    return parts.join(" • ");
  };

  // Today reference dates (at midnight for clean day comparison)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Process and classify all leads with follow-up or deadline dates
  const processedLeads = useMemo<ProcessedLead[]>(() => {
    if (!sheetData?.rows) return [];

    return sheetData.rows.map(row => {
      const rowDateVal = row[followUpCol] || row[deadlineCol];
      const parsedDate = parseFollowUpDate(rowDateVal);
      
      let dateKey = "";
      let isOverdue = false;
      let isToday = false;
      let isUpcoming = false;
      let daysDiff = 0;

      const stageVal = String(row[stageCol] || "").toLowerCase();
      const isWonOrLost = ["won", "closed won", "lost", "closed lost", "dead"].some(x => stageVal.includes(x));

      if (parsedDate) {
        const compareDate = new Date(parsedDate);
        compareDate.setHours(0, 0, 0, 0);
        
        dateKey = `${compareDate.getFullYear()}-${String(compareDate.getMonth() + 1).padStart(2, "0")}-${String(compareDate.getDate()).padStart(2, "0")}`;
        
        const diffTime = compareDate.getTime() - today.getTime();
        daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
          isToday = true;
        } else if (daysDiff < 0) {
          // Only flag as overdue if not already Won/Lost
          if (!isWonOrLost) {
            isOverdue = true;
          }
        } else {
          isUpcoming = true;
        }
      }

      // Check if it has a meeting or call scheduled
      const introCallVal = String(row[introCallCol] || "").trim().toLowerCase();
      const isMeeting = introCallVal.includes("meeting") || introCallVal.includes("scheduled") || introCallVal.includes("demo");
      const isCall = !isMeeting; // Default interaction type

      return {
        ...row,
        _parsedDate: parsedDate,
        _dateKey: dateKey,
        _daysDiff: daysDiff,
        _isToday: isToday,
        _isOverdue: isOverdue,
        _isUpcoming: isUpcoming,
        _isMeeting: isMeeting,
        _isCall: isCall,
      };
    }).filter((r): r is ProcessedLead => r._parsedDate !== null);
  }, [sheetData, followUpCol, deadlineCol, stageCol, introCallCol, today]);

  // Unique POC list
  const uniquePOCs = useMemo(() => {
    const s = new Set<string>();
    processedLeads.forEach(l => {
      const poc = String(l[pocCol] || "").trim();
      if (poc) s.add(poc);
    });
    return Array.from(s).sort();
  }, [processedLeads, pocCol]);

  // Filtered leads based on search across ALL columns, POC, and active filter tab
  const filteredLeads = useMemo(() => {
    return processedLeads.filter(lead => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || Object.entries(lead).some(([k, val]) => {
        if (k.startsWith("_")) return false;
        return val && String(val).toLowerCase().includes(q);
      });
      const matchesPOC = selectedPOC === "All" || String(lead[pocCol] || "").trim() === selectedPOC;

      let matchesTab = true;
      if (activeTab === "today") matchesTab = lead._isToday;
      else if (activeTab === "overdue") matchesTab = lead._isOverdue;
      else if (activeTab === "upcoming") matchesTab = lead._isUpcoming;

      return matchesSearch && matchesPOC && matchesTab;
    });
  }, [processedLeads, searchTerm, selectedPOC, activeTab, pocCol]);

  // Top Metrics
  const stats = useMemo(() => {
    let callsToday = 0;
    let meetingsToday = 0;
    let overdueCount = 0;
    let upcomingCount = 0;

    processedLeads.forEach(l => {
      if (selectedPOC !== "All" && String(l[pocCol] || "").trim() !== selectedPOC) return;

      if (l._isToday) {
        if (l._isMeeting) meetingsToday++;
        else callsToday++;
      } else if (l._isOverdue) {
        overdueCount++;
      } else if (l._isUpcoming && l._daysDiff <= 7) {
        upcomingCount++;
      }
    });

    return {
      callsToday,
      meetingsToday,
      overdueCount,
      upcomingCount,
      totalToday: callsToday + meetingsToday,
    };
  }, [processedLeads, selectedPOC, pocCol]);

  // Calendar Day Events Mapping
  const calendarEventsMap = useMemo(() => {
    const map: Record<string, { calls: number; meetings: number; overdue: number; leads: typeof processedLeads }> = {};
    processedLeads.forEach(l => {
      if (selectedPOC !== "All" && String(l[pocCol] || "").trim() !== selectedPOC) return;
      if (!l._dateKey) return;

      if (!map[l._dateKey]) {
        map[l._dateKey] = { calls: 0, meetings: 0, overdue: 0, leads: [] };
      }

      if (l._isMeeting) map[l._dateKey].meetings++;
      else map[l._dateKey].calls++;

      if (l._isOverdue) map[l._dateKey].overdue++;

      map[l._dateKey].leads.push(l);
    });
    return map;
  }, [processedLeads, selectedPOC, pocCol]);

  // Calendar Days Matrix Generation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayIndex = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    const days = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayIndex - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      const dateKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
      days.push({
        dayNumber: d,
        dateKey,
        isCurrentMonth: false,
        isToday: false,
        events: calendarEventsMap[dateKey] || null,
      });
    }

    // Current month days
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dayNumber: d,
        dateKey,
        isCurrentMonth: true,
        isToday: dateKey === todayStr,
        events: calendarEventsMap[dateKey] || null,
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remaining = 35 - days.length > 0 ? 35 - days.length : (42 - days.length > 0 ? 42 - days.length : 0);
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dateKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
      days.push({
        dayNumber: i,
        dateKey,
        isCurrentMonth: false,
        isToday: false,
        events: calendarEventsMap[dateKey] || null,
      });
    }

    return days;
  }, [currentDate, calendarEventsMap, today]);

  // Leads for the selected day in calendar
  const selectedDayLeads = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return calendarEventsMap[selectedCalendarDate]?.leads || [];
  }, [selectedCalendarDate, calendarEventsMap]);

  // Quick Reschedule action
  const handleQuickReschedule = async (lead: Record<string, any>, daysToAdd: number) => {
    if (!onSaveLead) return;
    const rowNum = lead["_row_num"];
    if (!rowNum) {
      toast.error("Invalid lead index");
      return;
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    const newDateStr = formatDateString(targetDate);

    setUpdatingId(rowNum);
    try {
      const updated = { ...lead, [followUpCol]: newDateStr };
      await onSaveLead(updated);
      toast.success(`Follow-up rescheduled to ${newDateStr}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reschedule follow-up");
    } finally {
      setUpdatingId(null);
    }
  };

  // Clear / Delete Follow-Up schedule (removes from calendar & schedule while keeping the lead in CRM)
  const handleClearFollowUp = async (lead: Record<string, any>) => {
    if (!onSaveLead) return;
    const rowNum = lead["_row_num"];
    if (!rowNum) {
      toast.error("Invalid lead index");
      return;
    }

    const company = String(lead[companyCol] || "this lead");
    const confirmed = window.confirm(
      `Clear follow-up schedule for "${company}"?\n\nThis will remove it from the follow-up dashboard and calendar, while keeping the client lead intact in your CRM.`
    );
    if (!confirmed) return;

    setUpdatingId(rowNum);
    try {
      const updated: Record<string, any> = { ...lead, [followUpCol]: "" };
      if (lead[deadlineCol] && !lead[followUpCol]) {
        updated[deadlineCol] = "";
      }
      await onSaveLead(updated);
      toast.success(`Follow-up cleared for ${company}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to clear follow-up");
    } finally {
      setUpdatingId(null);
    }
  };

  // Permanently delete lead row from Google Sheet & CRM
  const handleDeleteLeadConfirm = async (lead: Record<string, any>) => {
    if (!onDeleteLead) return;
    await onDeleteLead(lead);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Title & Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              Follow-Up Dashboard
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 font-semibold">
                {processedLeads.length} Scheduled
              </span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Track calls, meetings, overdue tasks, and client touchpoints across your pipeline.
            </p>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* POC Filter */}
          {uniquePOCs.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] uppercase font-mono text-gray-400 dark:text-[#888899]">POC:</span>
              <select
                value={selectedPOC}
                onChange={(e) => setSelectedPOC(e.target.value)}
                className="px-2.5 py-1.5 bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white font-sans outline-none cursor-pointer"
              >
                <option value="All">All Team Members</option>
                {uniquePOCs.map(poc => (
                  <option key={poc} value={poc}>{poc}</option>
                ))}
              </select>
            </div>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 bg-white dark:bg-[#161622] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl transition-all cursor-pointer"
              title="Refresh follow-up data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-500" : ""}`} />
            </button>
          )}

          {onAddLead && (
            <button
              onClick={onAddLead}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Schedule Follow-Up
            </button>
          )}
        </div>
      </div>

      {/* Row 1: Top Follow-Up Metrics & Command Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Follow-Up Calls Today */}
        <div 
          onClick={() => setActiveTab("today")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            activeTab === "today" 
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20" 
              : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899]">
              Calls Scheduled Today
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-sans">
              {stats.callsToday}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Active phone outreach
            </div>
          </div>
        </div>

        {/* KPI 2: Meetings Scheduled Today */}
        <div 
          onClick={() => setActiveTab("today")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            activeTab === "today" 
              ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20" 
              : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899]">
              Meetings Scheduled Today
            </span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Video className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-sans">
              {stats.meetingsToday}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Client demos & calls
            </div>
          </div>
        </div>

        {/* KPI 3: Overdue Follow-ups */}
        <div 
          onClick={() => setActiveTab("overdue")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            activeTab === "overdue" 
              ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20" 
              : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-500 font-bold">
              Overdue Follow-ups
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-sans">
              {stats.overdueCount}
            </div>
            <div className="text-xs text-rose-500 font-semibold mt-0.5">
              Requires immediate action
            </div>
          </div>
        </div>

        {/* KPI 4: Upcoming (Next 7 Days) */}
        <div 
          onClick={() => setActiveTab("upcoming")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
            activeTab === "upcoming" 
              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" 
              : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899]">
              Upcoming (Next 7 Days)
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-sans">
              {stats.upcomingCount}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Scheduled pipeline touches
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Split View (Interactive Monthly Calendar on Left + Daily Agenda on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Interactive Monthly Calendar (7 cols on Desktop) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
          {/* Calendar Header with Month/Year Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const now = new Date();
                  setCurrentDate(now);
                  setSelectedCalendarDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 text-center text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#777788] py-1 border-b border-gray-100 dark:border-white/5">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Month Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell, idx) => {
              const isSelected = selectedCalendarDate === cell.dateKey;
              const hasEvents = !!cell.events;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedCalendarDate(cell.dateKey)}
                  className={`min-h-[72px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20"
                      : cell.isToday
                      ? "border-emerald-500/50 bg-emerald-50/10 dark:bg-emerald-950/10"
                      : cell.isCurrentMonth
                      ? "border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.01] hover:bg-gray-100 dark:hover:bg-white/[0.03]"
                      : "border-transparent opacity-25"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-mono font-bold ${
                      cell.isToday
                        ? "w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]"
                        : cell.isCurrentMonth
                        ? "text-gray-900 dark:text-gray-200"
                        : "text-gray-400"
                    }`}>
                      {cell.dayNumber}
                    </span>
                    {cell.events?.overdue ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs" title="Overdue follow-up" />
                    ) : null}
                  </div>

                  {/* Day activity pills */}
                  {hasEvents && cell.events && (
                    <div className="space-y-0.5 mt-1">
                      {cell.events.calls > 0 && (
                        <div className="text-[9px] font-semibold font-mono bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 px-1 py-0.2 rounded truncate flex items-center gap-1">
                          <Phone className="w-2 h-2 shrink-0" />
                          <span>{cell.events.calls} call{cell.events.calls > 1 ? "s" : ""}</span>
                        </div>
                      )}
                      {cell.events.meetings > 0 && (
                        <div className="text-[9px] font-semibold font-mono bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 px-1 py-0.2 rounded truncate flex items-center gap-1">
                          <Video className="w-2 h-2 shrink-0" />
                          <span>{cell.events.meetings} meet</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Calendar Footer Legend */}
          <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] text-gray-500 dark:text-[#888899]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Phone Follow-ups
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Intro Meetings
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Overdue
              </span>
            </div>
            <span className="text-[10px] font-mono">
              Click any date to view day agenda
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Daily Activity Agenda & Selected Day Detail (5 cols on Desktop) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
          {/* Header & Date Badge */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899]">
                Scheduled Agenda
              </span>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mt-0.5">
                {selectedCalendarDate ? (
                  <>
                    <CalendarIcon className="w-4 h-4 text-emerald-500" />
                    {selectedCalendarDate}
                  </>
                ) : "No Date Selected"}
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
              {selectedDayLeads.length} Lead{selectedDayLeads.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* List of Leads for the Selected Calendar Day */}
          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {selectedDayLeads.length > 0 ? (
              selectedDayLeads.map((lead, idx) => {
                const rowNum = lead["_row_num"] || lead["Lead ID"];
                const isUpdating = updatingId === rowNum;
                const company = String(lead[companyCol] || "Unnamed Company");
                const contactName = String(lead[nameCol] || "");
                const phone = String(lead[phoneCol] || "");
                const email = String(lead[emailCol] || "");
                const poc = String(lead[pocCol] || "Unassigned");
                const stage = String(lead[stageCol] || "");
                const status = String(lead[statusCol] || "");
                const isMeeting = lead._isMeeting;

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161622] flex flex-col gap-2.5 hover:border-emerald-500/50 transition-all shadow-xs"
                  >
                    {/* Top Row: Company & Type Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4
                          onClick={() => onEditLead && onEditLead(lead)}
                          className="font-bold text-xs text-gray-900 dark:text-white truncate cursor-pointer hover:text-emerald-500 transition-colors"
                          title={company}
                        >
                          {company}
                        </h4>
                        {contactName && (
                          <p className="text-[11px] text-gray-500 dark:text-[#888899] truncate flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" />
                            {contactName}
                          </p>
                        )}
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        isMeeting
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40"
                      }`}>
                        {isMeeting ? "Meeting" : "Follow-Up Call"}
                      </span>
                    </div>

                    {/* Meta: POC & Stage */}
                    <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-[#777788] pt-1">
                      <span>Owner: <strong className="text-gray-700 dark:text-gray-300 font-normal">{poc}</strong></span>
                      {stage && (
                        <span className="px-2 py-0.5 rounded bg-gray-200/60 dark:bg-white/5 font-mono">
                          {stage}
                        </span>
                      )}
                    </div>

                    {/* Follow-Up / Last Update Notes (Dynamically combined from all note & follow-up columns) */}
                    {getCombinedNotes(lead) && (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200 font-sans">
                        <span className="font-semibold text-[9px] uppercase font-mono block text-amber-600 dark:text-amber-400 mb-0.5">
                          Follow-up Context & Notes:
                        </span>
                        <span className="line-clamp-2 leading-tight">
                          {getCombinedNotes(lead)}
                        </span>
                      </div>
                    )}

                    {/* Direct Contact Actions & Quick Reschedule / Delete Buttons */}
                    <div className="pt-2 border-t border-gray-200/50 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 transition-colors"
                            title={`Call ${phone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {email && (
                          <a
                            href={`mailto:${email}?subject=Follow-up regarding ${company}`}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 transition-colors"
                            title={`Email ${email}`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => setViewDetailsLead(lead)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/5 dark:text-gray-300 transition-colors cursor-pointer"
                          title="View all columns & record details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onEditLead && (
                          <button
                            onClick={() => onEditLead(lead)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/5 dark:text-gray-300 transition-colors cursor-pointer"
                            title="Edit full lead details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Quick Reschedule & Delete/Clear Controls */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {onSaveLead && (
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-gray-400">Postpone:</span>
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickReschedule(lead, 1)}
                              className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1E1E2D] hover:bg-gray-100 dark:hover:bg-[#2A2A3E] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 cursor-pointer"
                              title="Reschedule to Tomorrow"
                            >
                              +1d
                            </button>
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickReschedule(lead, 3)}
                              className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1E1E2D] hover:bg-gray-100 dark:hover:bg-[#2A2A3E] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 cursor-pointer"
                              title="Reschedule +3 days"
                            >
                              +3d
                            </button>
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickReschedule(lead, 7)}
                              className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1E1E2D] hover:bg-gray-100 dark:hover:bg-[#2A2A3E] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 cursor-pointer"
                              title="Reschedule +1 week"
                            >
                              +1w
                            </button>
                          </div>
                        )}

                        {/* Clear Follow-up Schedule (Removes from calendar & agenda) */}
                        {onSaveLead && (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleClearFollowUp(lead)}
                            className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="Clear follow-up schedule (keep lead in CRM)"
                          >
                            <CalendarX className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            Clear
                          </button>
                        )}

                        {/* Delete Lead Entirely */}
                        {onDeleteLead && (
                          <button
                            disabled={isUpdating}
                            onClick={() => handleDeleteLeadConfirm(lead)}
                            className="p-1 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 transition-all cursor-pointer"
                            title="Permanently delete lead row from Google Sheet & CRM"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-gray-400 dark:text-[#555566] space-y-2 border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
                <CheckCircle2 className="w-6 h-6 mx-auto text-gray-300 dark:text-gray-600" />
                <p>No follow-ups scheduled for this day.</p>
                <p className="text-[10px]">Click any date on the calendar with badges to see its agenda.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Master Follow-Ups List with Category Tabs (Overdue, Today, Upcoming) */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] p-5 shadow-sm space-y-4">
        {/* Category Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#161622] p-1 rounded-xl border border-gray-200 dark:border-white/10 flex-wrap">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white dark:bg-[#1E1E2D] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              All Scheduled ({processedLeads.length})
            </button>
            <button
              onClick={() => setActiveTab("overdue")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "overdue"
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 shadow-xs"
                  : "text-rose-500 hover:text-rose-600"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue ({stats.overdueCount})
            </button>
            <button
              onClick={() => setActiveTab("today")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "today"
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 shadow-xs"
                  : "text-emerald-600 hover:text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Today ({stats.totalToday})
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "upcoming"
                  ? "bg-white dark:bg-[#1E1E2D] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Upcoming ({stats.upcomingCount})
            </button>
          </div>

          {/* Search Bar inside List */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#888899]" />
            <input
              type="text"
              placeholder="Search by company, POC, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-emerald-500 transition-all font-sans"
            />
          </div>
        </div>

        {/* Master Follow-Up Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
          <table className="w-full border-collapse text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#161622]/40 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-[#888899]">
                <th className="py-3 px-4">Lead ID</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Scheduled Date</th>
                <th className="py-3 px-4">Urgency / Aging</th>
                <th className="py-3 px-4">Follow-Up Notes</th>
                <th className="py-3 px-4">Cog POC</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 text-center">Quick Reachout</th>
                <th className="py-3 px-4 text-center">Reschedule</th>
                <th className="py-3 px-4 text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredLeads.length > 0 ? (
                filteredLeads.map((lead, idx) => {
                  const rowNum = lead["_row_num"] || lead["Lead ID"];
                  const isUpdating = updatingId === rowNum;
                  const company = String(lead[companyCol] || "Unnamed Company");
                  const leadId = String(lead["Lead ID"] || `COG-${1000 + Number(rowNum)}`);
                  const contact = String(lead[nameCol] || "—");
                  const phone = String(lead[phoneCol] || "");
                  const email = String(lead[emailCol] || "");
                  const poc = String(lead[pocCol] || "Unassigned");
                  const stage = String(lead[stageCol] || "");
                  const dateStr = lead[followUpCol] || lead[deadlineCol] || "";
                  const daysDiff = lead._daysDiff;
                  const noteText = getCombinedNotes(lead);

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors ${
                        lead._isOverdue
                          ? "bg-rose-50/30 dark:bg-rose-950/10 border-l-2 border-l-rose-500"
                          : lead._isToday
                          ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-l-2 border-l-emerald-500"
                          : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-gray-900 dark:text-white">
                        {leadId}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                        <button
                          onClick={() => setViewDetailsLead(lead)}
                          className="hover:text-emerald-500 transition-colors text-left font-bold cursor-pointer"
                          title="View all columns & record details"
                        >
                          {company}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                        {contact}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-300 font-semibold">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4">
                        {lead._isToday ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <Clock className="w-2.5 h-2.5" />
                            Due Today
                          </span>
                        ) : lead._isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {Math.abs(daysDiff)}d overdue
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                            In {daysDiff} days
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        {noteText ? (
                          <span className="text-[11px] text-gray-700 dark:text-gray-300 line-clamp-2 block" title={noteText}>
                            {noteText}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                        {poc}
                      </td>
                      <td className="py-3 px-4">
                        {stage ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-white/5 font-mono text-gray-700 dark:text-gray-300">
                            {stage}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {phone && (
                            <a
                              href={`tel:${phone}`}
                              className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded transition-colors"
                              title={`Call ${phone}`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {email && (
                            <a
                              href={`mailto:${email}?subject=Follow-up regarding ${company}`}
                              className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded transition-colors"
                              title={`Email ${email}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {onSaveLead && (
                          <div className="flex items-center justify-center gap-1 text-[10px]">
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickReschedule(lead, 1)}
                              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 cursor-pointer"
                              title="Reschedule to Tomorrow"
                            >
                              +1d
                            </button>
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickReschedule(lead, 3)}
                              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 cursor-pointer"
                              title="Reschedule +3 days"
                            >
                              +3d
                            </button>
                            <button
                              disabled={isUpdating}
                              onClick={() => handleQuickReschedule(lead, 7)}
                              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 cursor-pointer"
                              title="Reschedule +1 week"
                            >
                              +1w
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View All Details */}
                          <button
                            onClick={() => setViewDetailsLead(lead)}
                            className="p-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                            title="View all columns & record details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {/* Edit Lead */}
                          {onEditLead && (
                            <button
                              onClick={() => onEditLead(lead)}
                              className="p-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                              title="Edit lead details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Clear Follow-up Schedule */}
                          {onSaveLead && (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleClearFollowUp(lead)}
                              className="p-1 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 transition-colors cursor-pointer"
                              title="Clear follow-up schedule (keep lead in CRM)"
                            >
                              <CalendarX className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Delete Lead Entirely */}
                          {onDeleteLead && (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleDeleteLeadConfirm(lead)}
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 transition-colors cursor-pointer"
                              title="Permanently delete lead row from Google Sheet & CRM"
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
                  <td colSpan={11} className="py-12 text-center text-gray-400 dark:text-[#555566] text-xs">
                    No follow-ups match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Full Lead Details & Dynamic Columns Modal */}
      {viewDetailsLead && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                    {viewDetailsLead[companyCol] || "Lead Details"}
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                      {viewDetailsLead["Lead ID"] || `COG-${1000 + Number(viewDetailsLead["_row_num"] || 0)}`}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-[#888899] mt-0.5">
                    All active columns dynamically synced from your Google Sheet.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewDetailsLead(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Dynamic Columns Grid */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {headers
                  .filter(h => h !== "_row_num")
                  .map(header => {
                    const val = viewDetailsLead[header];
                    const valStr = val !== undefined && val !== null ? String(val).trim() : "";
                    const isLink = valStr.startsWith("http://") || valStr.startsWith("https://") || valStr.includes("linkedin.com");

                    return (
                      <div 
                        key={header} 
                        className="p-3 rounded-xl bg-gray-50/70 dark:bg-[#161622] border border-gray-100 dark:border-white/5 space-y-1"
                      >
                        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#888899] block font-semibold truncate" title={header}>
                          {header}
                        </span>
                        {isLink ? (
                          <a
                            href={valStr}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:text-blue-600 underline font-mono flex items-center gap-1 break-all"
                          >
                            {valStr}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 break-words font-sans">
                            {valStr || <span className="text-gray-400 font-normal italic">—</span>}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-[#14141C] flex-wrap">
              <div className="flex items-center gap-2">
                {onSaveLead && (
                  <button
                    onClick={async () => {
                      await handleClearFollowUp(viewDetailsLead);
                      setViewDetailsLead(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CalendarX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Clear Follow-Up
                  </button>
                )}
                {onDeleteLead && (
                  <button
                    onClick={async () => {
                      await handleDeleteLeadConfirm(viewDetailsLead);
                      setViewDetailsLead(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Lead
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onEditLead && (
                  <button
                    onClick={() => {
                      const lead = viewDetailsLead;
                      setViewDetailsLead(null);
                      onEditLead(lead);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Full Lead
                  </button>
                )}
                <button
                  onClick={() => setViewDetailsLead(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-semibold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
