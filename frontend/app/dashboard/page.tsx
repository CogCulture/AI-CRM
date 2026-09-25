"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DashboardShell from "../../components/dashboard/DashboardShell";
import MetricCard from "../../components/dashboard/MetricCard";
import CRMTable from "../../components/dashboard/CRMTable";
import GraphWidget from "../../components/dashboard/GraphWidget";
import GraphBuilder from "../../components/dashboard/GraphBuilder";
import EmptyState from "../../components/dashboard/EmptyState";
import LeadFormModal from "../../components/dashboard/LeadFormModal";
import RevenueAnalysisWidget from "../../components/dashboard/RevenueAnalysisWidget";
import DataPlatformView from "../../components/dashboard/DataPlatformView";
import ProposalTrackerView from "../../components/dashboard/ProposalTrackerView";
import FollowUpDashboardView from "../../components/dashboard/FollowUpDashboardView";
import TenderDashboardView from "../../components/dashboard/TenderDashboardView";
import { api } from "../../lib/api";
import { SheetData, DashboardSummary, GraphConfig } from "../../lib/types";
import { toast } from "sonner";
import { RefreshCw, Search, Bell, X, AlertCircle } from "lucide-react";

// Helper function to check if a date string is today's date
const isToday = (dateVal: any): boolean => {
  if (!dateVal) return false;
  const dateStr = String(dateVal).trim();
  if (!dateStr || dateStr === "—" || dateStr.toLowerCase() === "placeholder") return false;

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1; // 1-indexed
  const todayYear = today.getFullYear();

  // Try parsing custom formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      // YYYY-MM-DD
      if (parts[0].length === 4) {
        return p0 === todayYear && p1 === todayMonth && p2 === todayDay;
      }
      // DD-MM-YYYY
      if (parts[2].length === 4) {
        if (p2 === todayYear) {
          return p0 === todayDay && p1 === todayMonth;
        }
      }
      // YY formats
      if (parts[2].length === 2) {
        const shortYear = todayYear % 100;
        if (p2 === shortYear) {
          return p0 === todayDay && p1 === todayMonth;
        }
      }
    }
  }

  // Fallback to standard JS Date parsing
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return (
      d.getDate() === todayDay &&
      d.getMonth() + 1 === todayMonth &&
      d.getFullYear() === todayYear
    );
  }

  return false;
};

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A0F] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-10 w-10">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-10 w-10 bg-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </span>
          </div>
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">Loading Workspace...</span>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "dashboard";
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("All");

  // Lead modal states
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [modalTitle, setModalTitle] = useState("Add New Lead");

  async function loadData(showToast = false, bypassCache = false) {
    try {
      // Target range based on tab: "Internal Leads" for internal leads, "Active Leads" for Active Leads & Tender
      const targetTabRange = tab === "internal_leads" ? "Internal Leads" : "Active Leads";

      const [sum, data] = await Promise.all([
        api.getDashboardSummary(bypassCache),
        api.getSheetData(bypassCache, targetTabRange),
      ]);
      setSummary(sum);
      setSheetData(data);
      if (showToast) {
        toast.success("CRM dashboard synchronized");
      }
      
      // Check if there are due leads and open the panel automatically
      if (data && data.rows) {
        const deadlineHeader = data.headers.find(h => {
          const hl = h.toLowerCase();
          return hl.includes("deadline") || hl.includes("due");
        }) || "";
        if (deadlineHeader) {
          const due = data.rows.filter(row => isToday(row[deadlineHeader]));
          if (due.length > 0) {
            setShowAlertPanel(true);
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load CRM data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData(false, false);
  }, [tab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true, true);
  };

  const handleLoadMock = async () => {
    setLoading(true);
    try {
      await api.updateConfig({
        sheet_url: "mock",
        sheet_range: "Sheet1"
      });
      await loadData();
      toast.success("Synchronized with Mock CRM Playground data");
    } catch (err: any) {
      toast.error("Failed to load mock data");
      setLoading(false);
    }
  };

  const handleSaveTableConfig = async (visible: string[], order: string[]) => {
    if (summary) {
      setSummary({
        ...summary,
        visible_columns: visible,
        column_order: order,
      });
    }
    await api.updateConfig({
      visible_columns: visible,
      column_order: order,
    });
  };

  const handleAddGraph = async (newGraph: GraphConfig) => {
    if (!summary) return;
    const updatedGraphs = [...(summary.graphs || []), newGraph];
    setSummary({
      ...summary,
      graphs: updatedGraphs,
    });
    await api.updateConfig({
      graphs: updatedGraphs,
    });
  };

  const handleDeleteGraph = async (id: string) => {
    if (!summary) return;
    const updatedGraphs = (summary.graphs || []).filter((g) => g.id !== id);
    setSummary({
      ...summary,
      graphs: updatedGraphs,
    });
    await api.updateConfig({
      graphs: updatedGraphs,
    });
  };

  const handleAddLead = () => {
    setSelectedLead(null);
    setModalTitle("Add New Lead");
    setIsLeadModalOpen(true);
  };

  const handleEditLead = (row: Record<string, any>) => {
    setSelectedLead(row);
    setModalTitle("Edit Lead");
    setIsLeadModalOpen(true);
  };

  const handleDeleteLead = async (row: Record<string, any>) => {
    const rowNum = row._row_num;
    if (!rowNum) {
      toast.error("Invalid lead row index");
      return;
    }
    const confirmed = window.confirm(
      "Are you sure you want to delete this lead? This will permanently remove the row from the Google Sheet."
    );
    if (!confirmed) return;

    try {
      setRefreshing(true);
      await api.deleteLead(rowNum);
      toast.success("Lead deleted successfully");
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveLead = async (leadDataInput: Record<string, any>) => {
    try {
      setRefreshing(true);
      const targetRowNum = leadDataInput._row_num || (selectedLead && selectedLead._row_num);
      if (targetRowNum) {
        await api.updateLead(targetRowNum, leadDataInput);
        toast.success("Lead updated successfully");
      } else {
        await api.addLead(leadDataInput);
        toast.success("Lead added successfully");
      }
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save lead");
      throw err;
    } finally {
      setRefreshing(false);
    }
  };

  const handleQuickUpdateStage = async (row: Record<string, any>, newStage: string) => {
    try {
      setRefreshing(true);
      const rowNum = row._row_num;
      if (!rowNum) {
        toast.error("Invalid lead row index");
        return;
      }
      const updatedRow = { ...row, Stage: newStage };
      await api.updateLead(rowNum, updatedRow);
      toast.success(`Proposal stage moved to "${newStage}"`);
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update proposal stage");
    } finally {
      setRefreshing(false);
    }
  };

  const isConfigured = summary?.configured || sheetData?.configured || (sheetData && sheetData.rows.length > 0);

  // Dynamic default graph configuration based on sheet headers
  const dateCol = sheetData?.headers.find(h => h.toLowerCase().includes("date")) || sheetData?.headers[5] || "";
  const valCol = sheetData?.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("value") || hl.includes("amount") || hl.includes("revenue") || hl.includes("deal size");
  }) || sheetData?.headers[3] || "";
  const stageCol = sheetData?.headers.find(h => h.toLowerCase().includes("stage") || h.toLowerCase().includes("status")) || sheetData?.headers[2] || "";

  const getMonthName = (m: number): string => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[m - 1] || "";
  };

  // Get unique months list for dropdown
  const uniqueMonths = React.useMemo(() => {
    if (!sheetData || !sheetData.rows || !dateCol) return [];
    const monthsMap: Record<string, string> = {};
    
    sheetData.rows.forEach(row => {
      const dateVal = row[dateCol];
      if (!dateVal) return;
      const parts = String(dateVal).trim().split(/[-/.]/);
      if (parts.length === 3) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);
        if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
          let y = p2;
          let m = p1;
          if (parts[0].length === 4) {
            y = p0;
            m = p1;
          }
          const mKey = `${y}-${String(m).padStart(2, '0')}`;
          monthsMap[mKey] = `${getMonthName(m)} ${y}`;
        }
      }
    });

    return Object.keys(monthsMap)
      .sort()
      .map(key => ({
        key,
        label: monthsMap[key]
      }));
  }, [sheetData, dateCol]);

  const isTendersTab = tab === "tenders";
  const isInternalLeadsTab = tab === "internal_leads";

  // Filter rows by tab (lead type) and selected month
  const filteredRows = React.useMemo(() => {
    if (!sheetData || !sheetData.rows) return [];
    
    const sourceColName = sheetData.headers.find(h => {
      const hl = h.toLowerCase().trim();
      return hl === "source" || hl === "sources" || hl.includes("source") || hl.includes("lead source");
    }) || "Source";

    const isRowTender = (row: Record<string, any>) => {
      const val = String(row[sourceColName] || "").trim().toLowerCase();
      if (val === "tender") return true;
      for (const [k, v] of Object.entries(row)) {
        const kl = k.toLowerCase().trim();
        if ((kl === "source" || kl === "sources" || kl.includes("source") || kl.includes("lead source")) && String(v || "").trim().toLowerCase() === "tender") {
          return true;
        }
      }
      return false;
    };

    let rows = sheetData.rows;
    if (isTendersTab) {
      // Tender Section: strictly rows where Source is 'Tender'
      rows = rows.filter(row => isRowTender(row));
    } else if (isInternalLeadsTab) {
      // Internal Leads Section: fetched directly from Internal Leads primary sheet tab
      rows = sheetData.rows;
    } else {
      // Active Leads Section: strictly exclude any row where Source is 'Tender' so they appear in Tender ONLY
      rows = rows.filter(row => !isRowTender(row));
    }

    if (selectedMonth === "All") return rows;
    
    return rows.filter(row => {
      const dateVal = row[dateCol];
      if (!dateVal) return false;
      const parts = String(dateVal).trim().split(/[-/.]/);
      if (parts.length === 3) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);
        if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
          let y = p2;
          let m = p1;
          if (parts[0].length === 4) {
            y = p0;
            m = p1;
          }
          const mKey = `${y}-${String(m).padStart(2, '0')}`;
          return mKey === selectedMonth;
        }
      }
      return false;
    });
  }, [sheetData, selectedMonth, dateCol, isTendersTab, isInternalLeadsTab]);

  const filteredSheetData = React.useMemo<SheetData | null>(() => {
    if (!sheetData) return null;
    return {
      ...sheetData,
      rows: filteredRows
    };
  }, [sheetData, filteredRows]);

  // Active Leads non-tender sheet data slice (used by Proposal Tracker & Follow-Ups to exclude Tenders)
  const activeLeadsSheetData = React.useMemo<SheetData | null>(() => {
    if (!sheetData || !sheetData.rows) return null;
    const sourceColName = sheetData.headers.find(h => {
      const hl = h.toLowerCase().trim();
      return hl === "source" || hl === "sources" || hl.includes("source") || hl.includes("lead source");
    }) || "Source";

    const nonTenders = sheetData.rows.filter(row => {
      const val = String(row[sourceColName] || "").trim().toLowerCase();
      if (val === "tender") return false;
      for (const [k, v] of Object.entries(row)) {
        const kl = k.toLowerCase().trim();
        if ((kl === "source" || kl === "sources" || kl.includes("source") || kl.includes("lead source")) && String(v || "").trim().toLowerCase() === "tender") {
          return false;
        }
      }
      return true;
    });

    return {
      ...sheetData,
      rows: nonTenders,
      total: nonTenders.length
    };
  }, [sheetData]);

  // Calculate display KPIs dynamically based on filtered rows
  const displayKpis = React.useMemo(() => {
    if (!sheetData) return [];
    const rows = filteredRows;
    const totalRows = rows.length;

    const kpisList = [
      { label: "Total Leads", value: totalRows.toLocaleString("en-IN"), delta: "+12%" }
    ];

    let totalValue = 0;
    const uniqueCompanies = new Set<string>();
    const companyCol = sheetData.headers.find(h => h.toLowerCase() === "company" || h.toLowerCase().includes("company"));

    rows.forEach(row => {
      const statusColName = sheetData.headers.find(h => h.toLowerCase() === "status" || h.toLowerCase().includes("status")) || "";
      const stageColName = sheetData.headers.find(h => h.toLowerCase().includes("stage")) || "";
      
      let isWonOrLost = false;
      const stgVals: string[] = [];
      if (stageColName) stgVals.push(String(row[stageColName] || "").toLowerCase());
      if (statusColName) {
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase() === "status") {
            stgVals.push(String(v).toLowerCase());
          }
        }
      }

      stgVals.forEach(stg => {
        if (["won", "closed won", "converted", "completed", "hired", "success", "lost", "dead", "lost lead", "dead lead", "cold"].some(x => stg.includes(x))) {
          isWonOrLost = true;
        }
      });

      if (valCol) {
        const valStr = String(row[valCol] || "").replace(/[$,₹\s]/g, "").replace(/,/g, "").trim();
        const parsed = parseFloat(valStr);
        if (!isNaN(parsed)) {
          if (!isWonOrLost) {
            totalValue += parsed;
          }
        }
      }
      if (companyCol) {
        const compName = String(row[companyCol] || "").trim();
        if (compName) {
          uniqueCompanies.add(compName);
        }
      }
    });

    if (valCol) {
      const formattedVal = totalValue % 1 !== 0 
        ? `₹${totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `₹${totalValue.toLocaleString("en-IN")}`;
      kpisList.push({ label: "Pipeline Value", value: formattedVal, delta: "+8%" });
    } else if (companyCol) {
      kpisList.push({ label: "Unique Companies", value: uniqueCompanies.size.toLocaleString("en-IN"), delta: "+5%" });
    } else {
      kpisList.push({ label: "Pipeline Value", value: "₹0", delta: "+0%" });
    }

    let activeCount = 0;
    let closedWonCount = 0;
    let coldCount = 0;
    const statusColName = sheetData.headers.find(h => h.toLowerCase() === "status" || h.toLowerCase().includes("status")) || "";
    const stageColName = sheetData.headers.find(h => h.toLowerCase().includes("stage")) || "";

    rows.forEach(row => {
      const stgVals: string[] = [];
      if (stageColName) stgVals.push(String(row[stageColName] || "").toLowerCase());
      if (statusColName) {
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase() === "status") {
            stgVals.push(String(v).toLowerCase());
          }
        }
      }

      let isWon = false;
      let isActive = false;
      let isCold = false;
      stgVals.forEach(stg => {
        if (["won", "closed won", "converted", "completed", "hired", "success"].some(x => stg.includes(x))) {
          isWon = true;
        }
        if (["cold", "dead", "lost"].some(x => stg.includes(x))) {
          isCold = true;
        }
        if (["proposal", "negotiation", "active", "discovery", "follow-up", "warm", "hot", "contacted", "lead"].some(x => stg.includes(x))) {
          isActive = true;
        }
      });

      if (isWon) {
        closedWonCount++;
      } else if (isCold) {
        coldCount++;
      } else if (isActive) {
        activeCount++;
      }
    });

    kpisList.push({ label: "Active Leads", value: activeCount.toLocaleString("en-IN"), delta: "+4%" });
    kpisList.push({ label: "Closed Won", value: closedWonCount.toLocaleString("en-IN"), delta: "+0%" });
    kpisList.push({ label: "Cold Leads", value: coldCount.toLocaleString("en-IN"), delta: "+0%" });

    return kpisList;
  }, [filteredRows, sheetData, valCol]);

  const defaultLineGraph: GraphConfig = {
    id: "default-line",
    type: "line",
    title: "Deals & Revenue History",
    x_col: dateCol,
    y_col: valCol
  };

  const defaultPieGraph: GraphConfig = {
    id: "default-pie",
    type: "pie",
    title: "Lead Status Breakdown",
    x_col: stageCol,
    y_col: valCol
  };

  const userGraphs = summary?.graphs || [];
  const lineGraphs = userGraphs.filter(g => g.type !== "pie");
  const pieGraphs = userGraphs.filter(g => g.type === "pie");

  const primaryLineGraph = lineGraphs[0] || defaultLineGraph;
  const primaryPieGraph = pieGraphs[0] || defaultPieGraph;

  const extraGraphs = [
    ...lineGraphs.slice(1),
    ...pieGraphs.slice(1)
  ];

  const deadlineHeader = sheetData?.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("deadline") || hl.includes("due");
  }) || "";

  const dueTodayLeads = deadlineHeader
    ? filteredRows.filter(row => isToday(row[deadlineHeader]))
    : [];

  if (loading) {
    return (
      <DashboardShell>
        <div className="space-y-8 animate-pulse">
          <div className="h-10 w-48 bg-white/5 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="h-24 bg-white/5 rounded-lg" />
            <div className="h-24 bg-white/5 rounded-lg" />
            <div className="h-24 bg-white/5 rounded-lg" />
            <div className="h-24 bg-white/5 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-white/5 rounded-lg" />
            <div className="lg:col-span-1 h-96 bg-white/5 rounded-lg" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      {!isConfigured ? (
        <EmptyState onLoadMock={handleLoadMock} />
      ) : tab === "data" && sheetData ? (
        <DataPlatformView sheetData={sheetData} onRefresh={() => loadData(false, true)} />
      ) : tab === "followups" && sheetData ? (
        <>
          <FollowUpDashboardView
            sheetData={activeLeadsSheetData || sheetData}
            onEditLead={handleEditLead}
            onAddLead={() => {
              setSelectedLead({});
              setModalTitle("Schedule New Follow-Up");
              setIsLeadModalOpen(true);
            }}
            onSaveLead={handleSaveLead}
            onDeleteLead={handleDeleteLead}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
          {/* Lead CRUD Modal for Follow-Ups */}
          <LeadFormModal
            isOpen={isLeadModalOpen}
            onClose={() => setIsLeadModalOpen(false)}
            headers={sheetData.headers}
            initialData={selectedLead}
            onSave={handleSaveLead}
            title={modalTitle}
            mandatoryColumns={summary?.mandatory_columns || []}
          />
        </>
      ) : tab === "proposals" && sheetData ? (
        <>
          <ProposalTrackerView
            sheetData={activeLeadsSheetData || sheetData}
            onEditLead={handleEditLead}
            onAddLead={() => {
              setSelectedLead({ Stage: "Proposal sent" });
              setModalTitle("Track New Proposal");
              setIsLeadModalOpen(true);
            }}
            onUpdateStage={handleQuickUpdateStage}
            onDeleteLead={handleDeleteLead}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
          {/* Lead CRUD Modal for Proposals */}
          <LeadFormModal
            isOpen={isLeadModalOpen}
            onClose={() => setIsLeadModalOpen(false)}
            headers={sheetData.headers}
            initialData={selectedLead}
            onSave={handleSaveLead}
            title={modalTitle}
            mandatoryColumns={summary?.mandatory_columns || []}
          />
        </>
      ) : tab === "tenders" && sheetData ? (
        <TenderDashboardView
          sheetData={sheetData}
          onRefresh={handleRefresh}
          onSaveLead={handleSaveLead}
          onDeleteLead={handleDeleteLead}
          refreshing={refreshing}
        />
      ) : tab === "help" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-sans text-2xl text-gray-900 dark:text-white font-bold tracking-tight">Help & Documentation</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Learn how to manage your workspace, sync Google Sheets, and configure CRM metrics.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-white dark:bg-[#111118] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-2xl shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Connecting Google Sheets</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                To sync live lead data, navigate to <strong className="text-emerald-500">Settings</strong> and paste your Google Sheet URL. Ensure your sheet is shared with View permissions.
              </p>
            </div>
            <div className="p-5 bg-white dark:bg-[#111118] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-2xl shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Managing Sidebar Categories</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                The sidebar categorizes your leads into <strong>Active Leads</strong>, <strong>Internal Leads</strong>, <strong>Tender</strong>, and <strong>Data Platform</strong>.
              </p>
            </div>
            <div className="p-5 bg-white dark:bg-[#111118] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-2xl shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Adding & Updating Leads</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Click <strong className="text-emerald-500">+ Add Lead</strong> on the dashboard to push new rows directly into your connected Google Sheet in real-time.
              </p>
            </div>
            <div className="p-5 bg-white dark:bg-[#111118] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-2xl shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Custom Charts & Widgets</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Click <strong className="text-emerald-500">+ Add Widget</strong> to build interactive line charts and pie breakdowns based on any column in your spreadsheet.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 relative">
          {/* Due Today Alert Box floating in the top right */}
          {dueTodayLeads.length > 0 && showAlertPanel && (
            <div className="fixed top-6 right-6 z-50 w-80 bg-red-50/95 dark:bg-[#1E0D10]/95 border border-red-200 dark:border-red-900/50 rounded-2xl border-l-4 border-l-red-500 p-4 shadow-2xl animate-fade-in transition-all flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 font-sans">
                    <Bell className="w-3.5 h-3.5 text-red-500" />
                    Leads Due Today ({dueTodayLeads.length})
                  </span>
                </div>
                <button
                  onClick={() => setShowAlertPanel(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-gray-400 dark:text-[#555566] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {dueTodayLeads.map((lead, idx) => (
                  <div 
                    key={idx} 
                    className="p-2 bg-gray-50/50 dark:bg-[#161622] rounded-xl border border-black dark:border-black flex items-center justify-between text-[11px] font-sans"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {lead["Company"] || lead["Campaign"] || "Unnamed Lead"}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-[#888899] truncate">
                        {lead["Name"] ? `Contact: ${lead["Name"]}` : (lead["Stage"] ? `Stage: ${lead["Stage"]}` : "No contact details")}
                      </p>
                    </div>
                    {lead["Value"] && (
                      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 ml-2 shrink-0 font-mono">
                        {lead["Value"]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dashboard Title & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="font-sans text-2xl text-gray-900 dark:text-white font-bold tracking-tight">
                {tab === "tenders" 
                  ? "Tender" 
                  : tab === "internal_leads" 
                  ? "Internal Leads" 
                  : tab === "data" 
                  ? "Data Platform" 
                  : tab === "help"
                  ? "Help"
                  : "Active Leads"}
              </h1>
              
              {sheetData && uniqueMonths.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#111118] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-250 dark:border-[rgba(255,255,255,0.08)] text-gray-700 dark:text-white text-xs font-sans font-semibold rounded-lg transition-all cursor-pointer outline-none"
                  >
                    <option value="All">All Months</option>
                    {uniqueMonths.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!sheetData?.is_mock && (
                <>
                  <button
                    onClick={handleAddLead}
                    className="px-3 py-1.5 bg-white dark:bg-[#111118] hover:bg-gray-55 dark:hover:bg-[#1C1C2D] text-gray-700 dark:text-white border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer"
                  >
                    + Add Lead
                  </button>

                  <button
                    onClick={() => setIsBuilderOpen(true)}
                    className="px-3 py-1.5 bg-[#1D9E75] hover:bg-[#198763] text-white rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer shadow-[0_0_12px_rgba(29,158,117,0.15)]"
                  >
                    + Add Widget
                  </button>

                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-1.5 bg-white dark:bg-[rgba(255,255,255,0.03)] hover:bg-gray-55 dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-700 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs font-sans"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-500 dark:text-emerald-400" : ""}`} />
                    Sync Now
                  </button>

                  <button
                    onClick={() => setShowAlertPanel(prev => !prev)}
                    className={`relative p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                      showAlertPanel
                        ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-400"
                        : "bg-white dark:bg-[rgba(255,255,255,0.03)] hover:bg-gray-50 dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-700 dark:text-white"
                    }`}
                    title="Toggle Due Today Alerts"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {dueTodayLeads.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-sm">
                        {dueTodayLeads.length}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Row 1: Top Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {Array.from({ length: 5 }).map((_, index) => {
              const kpi = displayKpis[index];

              if (kpi) {
                return (
                  <MetricCard
                    key={kpi.label}
                    label={kpi.label}
                    value={String(kpi.value)}
                    delta={kpi.delta}
                    index={index}
                  />
                );
              } else {
                return (
                  <div key={index} className="h-full min-h-[100px] flex items-center justify-center text-xs text-gray-400 dark:text-[#555566] font-mono border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#111118] rounded-2xl shadow-sm">
                    Empty Slot
                  </div>
                );
              }
            })}
          </div>

          {/* Row 2: Revenue Analysis & Status Donut Chart side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Revenue Analysis Widget */}
            <div className="lg:col-span-2 min-w-0 flex flex-col">
              {filteredSheetData && (
                <RevenueAnalysisWidget sheetData={filteredSheetData} />
              )}
            </div>

            {/* Donut Chart */}
            <div className="lg:col-span-1 min-w-0 flex flex-col">
              {sheetData && (
                <GraphWidget
                  graph={primaryPieGraph}
                  rows={filteredRows}
                  onDelete={primaryPieGraph.id !== "default-pie" ? handleDeleteGraph : undefined}
                  height={260}
                />
              )}
            </div>

          </div>

          {/* Row 3: Campaign Performance Table (Full Width) */}
          <div className="w-full">
            {sheetData && (
              <CRMTable
                headers={sheetData.headers}
                rows={filteredRows}
                visibleColumns={summary?.visible_columns || []}
                columnOrder={summary?.column_order || []}
                onSaveConfig={handleSaveTableConfig}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onEdit={!sheetData?.is_mock ? handleEditLead : undefined}
                onDelete={!sheetData?.is_mock ? handleDeleteLead : undefined}
                isTenderDashboard={isTendersTab}
                currentTab={tab}
              />
            )}
          </div>

          {/* Row 3: Extra Graphs (If any) */}
          {extraGraphs.length > 0 && sheetData && (
            <div className="space-y-4 pt-6 border-t border-[rgba(255,255,255,0.06)]">
              <h3 className="text-xs font-semibold text-white tracking-wide uppercase font-mono text-[#888899]">More Visual Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {extraGraphs.map((g) => (
                  <GraphWidget
                    key={g.id}
                    graph={g}
                    rows={filteredRows}
                    onDelete={handleDeleteGraph}
                    height={200}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Builder Modal */}
          {sheetData && (
            <GraphBuilder
              isOpen={isBuilderOpen}
              onClose={() => setIsBuilderOpen(false)}
              headers={sheetData.headers}
              rows={filteredRows}
              onSave={handleAddGraph}
            />
          )}

          {/* Lead CRUD Modal */}
          {sheetData && (
            <LeadFormModal
              isOpen={isLeadModalOpen}
              onClose={() => setIsLeadModalOpen(false)}
              headers={sheetData.headers}
              initialData={selectedLead}
              onSave={handleSaveLead}
              title={modalTitle}
              currentTab={tab}
              mandatoryColumns={summary?.mandatory_columns || []}
            />
          )}
        </div>
      )}
    </DashboardShell>
  );
}

