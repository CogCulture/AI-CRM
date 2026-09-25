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
import { RefreshCw, Search, Bell, X, AlertCircle, Eye, EyeOff, Layers, FileSpreadsheet } from "lucide-react";

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
  const [septSheetData, setSeptSheetData] = useState<SheetData | null>(null);
  const [activeSheetSubTab, setActiveSheetSubTab] = useState<"sept" | "oct" | "both">("sept");
  const [activeTargetTab, setActiveTargetTab] = useState<string>("Active Leads from Sept");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [includeArchived, setIncludeArchived] = useState(false);

  // Lead modal states
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [modalTitle, setModalTitle] = useState("Add New Lead");

  async function loadData(showToast = false, bypassCache = false) {
    try {
      if (tab === "internal_leads") {
        const [sum, data] = await Promise.all([
          api.getDashboardSummary(bypassCache),
          api.getSheetData(bypassCache, "Internal Leads"),
        ]);
        setSummary(sum);
        setSheetData(data);
      } else {
        const [sum, legacyData, septData] = await Promise.all([
          api.getDashboardSummary(bypassCache),
          api.getSheetData(bypassCache, "Active Leads"),
          api.getSheetData(bypassCache, "Active Leads from Sept"),
        ]);
        setSummary(sum);
        setSheetData(legacyData);
        setSeptSheetData(septData);
      }

      if (showToast) {
        toast.success("CRM dashboard synchronized");
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

  const handleAddLead = (targetSheet?: string) => {
    setSelectedLead(null);
    const chosenTab = typeof targetSheet === "string" 
      ? targetSheet 
      : tab === "internal_leads" 
      ? "Internal Leads" 
      : activeSheetSubTab === "oct" 
      ? "Active Leads" 
      : "Active Leads from Sept";
    setActiveTargetTab(chosenTab);
    setModalTitle(`Add New Lead (${chosenTab})`);
    setIsLeadModalOpen(true);
  };

  const handleEditLead = (row: Record<string, any>) => {
    setSelectedLead(row);
    const rowTab = row._sheet_tab || (tab === "internal_leads" ? "Internal Leads" : activeSheetSubTab === "oct" ? "Active Leads" : "Active Leads from Sept");
    setActiveTargetTab(rowTab);
    setModalTitle(`Edit Lead (${rowTab})`);
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
      const rowTab = row._sheet_tab || (tab === "internal_leads" ? "Internal Leads" : activeSheetSubTab === "oct" ? "Active Leads" : "Active Leads from Sept");
      await api.deleteLead(rowNum, rowTab);
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
      const rowTab = leadDataInput._sheet_tab || (selectedLead && selectedLead._sheet_tab) || activeTargetTab || "Active Leads from Sept";
      if (targetRowNum) {
        await api.updateLead(targetRowNum, leadDataInput, rowTab);
        toast.success("Lead updated successfully");
      } else {
        await api.addLead(leadDataInput, rowTab);
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
      const rowTab = row._sheet_tab || "Active Leads";
      await api.updateLead(rowNum, updatedRow, rowTab);
      toast.success(`Proposal stage moved to "${newStage}"`);
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update proposal stage");
    } finally {
      setRefreshing(false);
    }
  };

  const isConfigured = summary?.configured || sheetData?.configured || (sheetData && sheetData.rows.length > 0) || (septSheetData && septSheetData.rows.length > 0);

  const isTendersTab = tab === "tenders";
  const isInternalLeadsTab = tab === "internal_leads";
  const isActiveLeadsView = !isTendersTab && !isInternalLeadsTab && !["data", "followups", "proposals", "help"].includes(tab);

  // Select active sheet dataset for Active Leads view
  const currentActiveSheetData = React.useMemo<SheetData | null>(() => {
    if (!isActiveLeadsView) return sheetData;
    if (activeSheetSubTab === "sept" && septSheetData) return septSheetData;
    if (activeSheetSubTab === "oct" && sheetData) return sheetData;
    if (activeSheetSubTab === "both" && septSheetData && sheetData) {
      const mergedHeaders = Array.from(new Set([...septSheetData.headers, ...sheetData.headers]));
      return {
        ...septSheetData,
        headers: mergedHeaders,
        rows: [...septSheetData.rows, ...sheetData.rows],
        total: septSheetData.total + sheetData.total,
        hidden_count: (septSheetData.hidden_count || 0) + (sheetData.hidden_count || 0),
        unhidden_count: (septSheetData.unhidden_count || 0) + (sheetData.unhidden_count || 0),
      };
    }
    return septSheetData || sheetData;
  }, [isActiveLeadsView, activeSheetSubTab, septSheetData, sheetData]);

  // Dynamic default graph configuration based on active sheet headers
  const dateCol = currentActiveSheetData?.headers.find(h => h.toLowerCase().includes("date")) || currentActiveSheetData?.headers[1] || "";
  // Do not show revenue estimations in Active Leads
  const valCol = isActiveLeadsView ? "" : (currentActiveSheetData?.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("value") || hl.includes("amount") || hl.includes("revenue") || hl.includes("deal size");
  }) || "");
  const stageCol = currentActiveSheetData?.headers.find(h => h.toLowerCase().includes("status") || h.toLowerCase().includes("stage")) || currentActiveSheetData?.headers[2] || "";

  const getMonthName = (m: number): string => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[m - 1] || "";
  };

  // Get unique months list for dropdown
  const uniqueMonths = React.useMemo(() => {
    if (!currentActiveSheetData || !currentActiveSheetData.rows || !dateCol) return [];
    const monthsMap: Record<string, string> = {};
    
    currentActiveSheetData.rows.forEach(row => {
      if (!includeArchived && row._is_hidden) return;
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
  }, [currentActiveSheetData, dateCol, includeArchived]);

  const isRowTender = (row: Record<string, any>) => {
    for (const [k, v] of Object.entries(row)) {
      const kl = k.toLowerCase().trim();
      if ((kl === "source" || kl === "sources" || kl.includes("source") || kl.includes("lead source")) && String(v || "").trim().toLowerCase() === "tender") {
        return true;
      }
    }
    return false;
  };

  // Unhidden non-tender rows for "Active Leads from Sept"
  const septActiveRows = React.useMemo(() => {
    if (!septSheetData?.rows) return [];
    return septSheetData.rows.filter(row => {
      if (!includeArchived && row._is_hidden) return false;
      return !isRowTender(row);
    });
  }, [septSheetData, includeArchived]);

  // Unhidden non-tender rows for "Active Leads"
  const legacyActiveRows = React.useMemo(() => {
    if (!sheetData?.rows) return [];
    return sheetData.rows.filter(row => {
      if (!includeArchived && row._is_hidden) return false;
      return !isRowTender(row);
    });
  }, [sheetData, includeArchived]);

  // Filter rows by tab (lead type) and selected month
  const filteredRows = React.useMemo(() => {
    const baseData = isActiveLeadsView ? currentActiveSheetData : sheetData;
    if (!baseData || !baseData.rows) return [];

    let rows = baseData.rows;

    // By default, strictly filter out hidden / collapsed rows from Google Sheets (archive)
    if (!includeArchived) {
      rows = rows.filter(row => !row._is_hidden);
    }

    if (isTendersTab) {
      // Tender Section: strictly rows where Source is 'Tender'
      rows = rows.filter(row => isRowTender(row));
    } else if (isInternalLeadsTab) {
      // Internal Leads Section: fetched directly from Internal Leads primary sheet tab
      rows = rows;
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
  }, [currentActiveSheetData, sheetData, selectedMonth, dateCol, isTendersTab, isInternalLeadsTab, isActiveLeadsView, includeArchived]);

  const filteredSheetData = React.useMemo<SheetData | null>(() => {
    const baseData = isActiveLeadsView ? currentActiveSheetData : sheetData;
    if (!baseData) return null;
    return {
      ...baseData,
      rows: filteredRows
    };
  }, [currentActiveSheetData, sheetData, isActiveLeadsView, filteredRows]);

  // Active Leads non-tender sheet data slice (used by Proposal Tracker & Follow-Ups to exclude Tenders)
  const activeLeadsSheetData = React.useMemo<SheetData | null>(() => {
    if (!sheetData || !sheetData.rows) return null;
    const nonTenders = sheetData.rows.filter(row => {
      if (!includeArchived && row._is_hidden) return false;
      return !isRowTender(row);
    });

    return {
      ...sheetData,
      rows: nonTenders,
      total: nonTenders.length
    };
  }, [sheetData, includeArchived]);

  // Calculate display KPIs dynamically based on filtered rows
  const displayKpis = React.useMemo(() => {
    const targetData = isActiveLeadsView ? (currentActiveSheetData || sheetData) : sheetData;
    if (!targetData) return [];
    const rows = filteredRows;
    const totalRows = rows.length;

    const kpisList = [
      { label: "Total Leads", value: totalRows.toLocaleString("en-IN"), delta: "+12%" }
    ];

    let totalValue = 0;
    const uniqueCompanies = new Set<string>();
    const companyCol = targetData.headers.find(h => h.toLowerCase() === "company" || h.toLowerCase().includes("company"));

    rows.forEach(row => {
      const statusColName = targetData.headers.find(h => h.toLowerCase() === "status" || h.toLowerCase().includes("status")) || "";
      const stageColName = targetData.headers.find(h => h.toLowerCase().includes("stage")) || "";
      
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
      kpisList.push({ label: "Unique Companies", value: totalRows.toLocaleString("en-IN"), delta: "+0%" });
    }

    let activeCount = 0;
    let closedWonCount = 0;
    let coldCount = 0;
    const statusColName = targetData.headers.find(h => h.toLowerCase() === "status" || h.toLowerCase().includes("status")) || "";
    const stageColName = targetData.headers.find(h => h.toLowerCase().includes("stage")) || "";

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
  }, [filteredRows, currentActiveSheetData, sheetData, isActiveLeadsView, valCol]);

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
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

              {/* Sheet Tab Switcher for Active Leads */}
              {isActiveLeadsView && septSheetData && (
                <div className="flex items-center p-1 bg-gray-100 dark:bg-[#111118] rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold">
                  <button
                    onClick={() => setActiveSheetSubTab("sept")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSheetSubTab === "sept"
                        ? "bg-white dark:bg-[#1C1C2D] text-emerald-600 dark:text-emerald-400 shadow-sm font-bold"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <span>Active Leads from Sept</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px]">
                      {septActiveRows.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveSheetSubTab("oct")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSheetSubTab === "oct"
                        ? "bg-white dark:bg-[#1C1C2D] text-emerald-600 dark:text-emerald-400 shadow-sm font-bold"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <span>Active Leads</span>
                    <span className="px-1.5 py-0.5 bg-gray-500/10 text-gray-600 dark:text-gray-400 rounded-full text-[10px]">
                      {legacyActiveRows.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveSheetSubTab("both")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSheetSubTab === "both"
                        ? "bg-white dark:bg-[#1C1C2D] text-emerald-600 dark:text-emerald-400 shadow-sm font-bold"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <span>All Active Sheets</span>
                    <span className="px-1.5 py-0.5 bg-gray-500/10 text-gray-600 dark:text-gray-400 rounded-full text-[10px]">
                      {septActiveRows.length + legacyActiveRows.length}
                    </span>
                  </button>
                </div>
              )}
              
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

            <div className="flex items-center gap-2.5 flex-wrap">
              {!sheetData?.is_mock && (
                <>
                  {/* Unhidden vs All Leads Toggle */}
                  {currentActiveSheetData && (currentActiveSheetData.hidden_count || 0) > 0 && (
                    <button
                      onClick={() => setIncludeArchived(!includeArchived)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer border ${
                        includeArchived
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-xs"
                          : "bg-white dark:bg-[#111118] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
                      }`}
                      title={includeArchived ? "Switch back to viewing only unhidden active leads" : `Include ${currentActiveSheetData.hidden_count} hidden/archived rows from Google Sheets`}
                    >
                      {includeArchived ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-amber-500" />
                          <span>All Leads ({filteredRows.length})</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Unhidden Only ({filteredRows.length})</span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            ({currentActiveSheetData.hidden_count} hidden)
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleAddLead()}
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
          <div className="w-full space-y-6">
            {isActiveLeadsView && activeSheetSubTab === "both" && septSheetData && sheetData ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Active Leads from Sept ({septActiveRows.length} Leads)
                    </h2>
                    <button
                      onClick={() => handleAddLead("Active Leads from Sept")}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      + Add to Active Leads from Sept
                    </button>
                  </div>
                  <CRMTable
                    headers={septSheetData.headers}
                    rows={septActiveRows}
                    visibleColumns={[]}
                    columnOrder={[]}
                    onSaveConfig={handleSaveTableConfig}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onEdit={!sheetData?.is_mock ? handleEditLead : undefined}
                    onDelete={!sheetData?.is_mock ? handleDeleteLead : undefined}
                    isTenderDashboard={false}
                    currentTab={tab}
                  />
                </div>
                <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-white/10">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Active Leads ({legacyActiveRows.length} Unhidden Leads)
                    </h2>
                    <button
                      onClick={() => handleAddLead("Active Leads")}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      + Add to Active Leads
                    </button>
                  </div>
                  <CRMTable
                    headers={sheetData.headers}
                    rows={legacyActiveRows}
                    visibleColumns={[]}
                    columnOrder={[]}
                    onSaveConfig={handleSaveTableConfig}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onEdit={!sheetData?.is_mock ? handleEditLead : undefined}
                    onDelete={!sheetData?.is_mock ? handleDeleteLead : undefined}
                    isTenderDashboard={false}
                    currentTab={tab}
                  />
                </div>
              </>
            ) : sheetData ? (
              <CRMTable
                headers={(isActiveLeadsView ? currentActiveSheetData?.headers : sheetData.headers) || sheetData.headers}
                rows={filteredRows}
                visibleColumns={isActiveLeadsView && activeSheetSubTab === "sept" ? [] : (summary?.visible_columns || [])}
                columnOrder={isActiveLeadsView && activeSheetSubTab === "sept" ? [] : (summary?.column_order || [])}
                onSaveConfig={handleSaveTableConfig}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onEdit={!sheetData?.is_mock ? handleEditLead : undefined}
                onDelete={!sheetData?.is_mock ? handleDeleteLead : undefined}
                isTenderDashboard={isTendersTab}
                currentTab={tab}
              />
            ) : null}
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
              headers={(isActiveLeadsView ? currentActiveSheetData?.headers : sheetData.headers) || sheetData.headers}
              rows={filteredRows}
              onSave={handleAddGraph}
            />
          )}

          {/* Lead CRUD Modal */}
          {sheetData && (
            <LeadFormModal
              isOpen={isLeadModalOpen}
              onClose={() => setIsLeadModalOpen(false)}
              headers={(isActiveLeadsView && activeTargetTab === "Active Leads from Sept" && septSheetData ? septSheetData.headers : sheetData.headers)}
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

