"use client";

import React, { useState, useEffect } from "react";
import DashboardShell from "../../components/dashboard/DashboardShell";
import MetricCard from "../../components/dashboard/MetricCard";
import CRMTable from "../../components/dashboard/CRMTable";
import GraphWidget from "../../components/dashboard/GraphWidget";
import GraphBuilder from "../../components/dashboard/GraphBuilder";
import EmptyState from "../../components/dashboard/EmptyState";
import { api } from "../../lib/api";
import { SheetData, DashboardSummary, GraphConfig } from "../../lib/types";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  async function loadData(showToast = false) {
    try {
      const [sum, data] = await Promise.all([
        api.getDashboardSummary(),
        api.getSheetData(),
      ]);
      setSummary(sum);
      setSheetData(data);
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
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
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

  const isConfigured = summary?.configured || sheetData?.configured || (sheetData && sheetData.rows.length > 0);

  // Dynamic default graph configuration based on sheet headers
  const dateCol = sheetData?.headers.find(h => h.toLowerCase().includes("date")) || sheetData?.headers[5] || "";
  const valCol = sheetData?.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("value") || hl.includes("amount") || hl.includes("revenue") || hl.includes("deal size");
  }) || sheetData?.headers[3] || "";
  const stageCol = sheetData?.headers.find(h => h.toLowerCase().includes("stage") || h.toLowerCase().includes("status")) || sheetData?.headers[2] || "";

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
    title: "Top Revenue Channels",
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

  return (
    <DashboardShell>
      {!isConfigured ? (
        <EmptyState onLoadMock={handleLoadMock} />
      ) : (
        <div className="space-y-6">
          {/* Dashboard Title & Actions */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-sans text-2xl text-white font-bold tracking-tight">
                Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Mockup Search Bar */}
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555566]" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#161622] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] focus:border-indigo-500 rounded-full text-white placeholder-[#555566] transition-all outline-none font-sans"
                />
              </div>

              {!sheetData?.is_mock && (
                <>
                  <button
                    onClick={() => setIsBuilderOpen(true)}
                    className="px-3.5 py-2 border border-indigo-500/30 hover:border-indigo-500 text-indigo-400 hover:text-indigo-300 bg-indigo-950/10 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer"
                  >
                    + Add Widget
                  </button>

                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.06)] text-white hover:text-indigo-400 rounded-lg transition-all cursor-pointer flex items-center gap-2 text-xs font-mono"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
                    Sync Now
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Row 1: 2x2 KPIs (Left) + Primary Line Chart (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* 2x2 KPI Grid */}
            <div className="lg:col-span-1 grid grid-cols-2 gap-4 h-full content-between">
              {summary && summary.kpis && summary.kpis.slice(0, 4).map((kpi, index) => (
                <MetricCard
                  key={kpi.label}
                  label={kpi.label}
                  value={String(kpi.value)}
                  delta={kpi.delta}
                  index={index}
                />
              ))}
              {summary && summary.kpis && summary.kpis.length < 4 && Array.from({ length: 4 - summary.kpis.length }).map((_, i) => (
                <div key={i} className="obsidian-glass border border-[rgba(255,255,255,0.03)] rounded-xl p-4 bg-[#0C0C12]/10 h-24 flex items-center justify-center text-xs text-[#555566] font-mono">
                  Empty Slot
                </div>
              ))}
            </div>

            {/* Line/Area Graph */}
            <div className="lg:col-span-2 h-full flex flex-col justify-between min-w-0">
              {sheetData && (
                <GraphWidget
                  graph={primaryLineGraph}
                  rows={sheetData.rows}
                  onDelete={primaryLineGraph.id !== "default-line" ? handleDeleteGraph : undefined}
                  height={190}
                />
              )}
            </div>
          </div>

          {/* Row 2: Table (Left) + Donut Chart (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Table */}
            <div className="lg:col-span-2 overflow-hidden">
              {sheetData && (
                <CRMTable
                  headers={sheetData.headers}
                  rows={sheetData.rows}
                  visibleColumns={summary?.visible_columns || []}
                  columnOrder={summary?.column_order || []}
                  onSaveConfig={handleSaveTableConfig}
                  searchTerm={searchTerm}
                />
              )}
            </div>

            {/* Donut Chart */}
            <div className="lg:col-span-1 min-w-0 flex flex-col justify-between">
              {sheetData && (
                <GraphWidget
                  graph={primaryPieGraph}
                  rows={sheetData.rows}
                  onDelete={primaryPieGraph.id !== "default-pie" ? handleDeleteGraph : undefined}
                  height={225}
                />
              )}
            </div>
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
                    rows={sheetData.rows}
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
              rows={sheetData.rows}
              onSave={handleAddGraph}
            />
          )}
        </div>
      )}
    </DashboardShell>
  );
}

