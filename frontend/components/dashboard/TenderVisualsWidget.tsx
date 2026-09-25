"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { TrendingUp, PieChart as PieIcon, DollarSign, Building2, Layers, CheckCircle2 } from "lucide-react";
import { ProcessedTender, TenderStage } from "./TenderDashboardView";

interface TenderVisualsWidgetProps {
  tenders: ProcessedTender[];
  orgCol: string;
  nameCol: string;
  valueCol: string;
  stageCol: string;
}

// Stage color palette for visual consistency across charts
const STAGE_COLORS: Record<string, string> = {
  "Tender Identified": "#94A3B8", // slate-400
  "Under Review": "#3B82F6", // blue-500
  "Qualification Check": "#0EA5E9", // sky-500
  "Bid Decision Pending": "#F59E0B", // amber-500
  "Approved for Bidding": "#14B8A6", // teal-500
  "Proposal Preparation": "#EAB308", // yellow-500
  "Submitted": "#8B5CF6", // purple-500
  "Technical Evaluation": "#6366F1", // indigo-500
  "Financial Evaluation": "#06B6D4", // cyan-500
  "Won": "#10B981", // emerald-500
  "Lost": "#EF4444", // rose-500
};

const getStageColor = (stage: string): string => {
  return STAGE_COLORS[stage] || "#A855F7";
};

// Format currency to Indian Rupee notation (₹ Lakhs / Crores / Standard)
const formatINR = (val: number): string => {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${val.toLocaleString("en-IN")}`;
};

// Format Y-Axis values cleanly
const formatYAxisTick = (val: number): string => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(0)} L`;
  if (val === 0) return "₹0";
  return `₹${val.toLocaleString("en-IN")}`;
};

// Custom Tooltip for Organization Bids Bar Chart
const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const stageColor = getStageColor(data.stage);

    return (
      <div className="bg-gray-900/95 dark:bg-[#0C0C12]/95 backdrop-blur-md border border-gray-700/60 dark:border-white/10 rounded-xl p-3 shadow-2xl font-sans text-xs max-w-xs space-y-2">
        <div className="flex items-center justify-between gap-2 border-b border-gray-700/40 dark:border-white/5 pb-1.5">
          <span className="font-bold text-white truncate">{data.org}</span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono shrink-0"
            style={{ backgroundColor: `${stageColor}20`, color: stageColor, borderColor: `${stageColor}40` }}
          >
            {data.stage}
          </span>
        </div>
        {data.requirement && (
          <p className="text-[11px] text-gray-300 dark:text-gray-400 line-clamp-2">
            <span className="text-gray-400 dark:text-[#777788]">Scope:</span> {data.requirement}
          </p>
        )}
        <div className="pt-1 flex items-baseline justify-between font-mono">
          <span className="text-gray-400 dark:text-[#777788] text-[11px]">Bid Value:</span>
          <span className="text-sm font-bold text-emerald-400">
            {formatINR(data.value)}
          </span>
        </div>
        {data.tenderId && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            Ref: {data.tenderId}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Stage Donut Chart
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const stageColor = getStageColor(data.name);

    return (
      <div className="bg-gray-900/95 dark:bg-[#0C0C12]/95 backdrop-blur-md border border-gray-700/60 dark:border-white/10 rounded-xl p-2.5 shadow-2xl font-sans text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stageColor }} />
          <span className="font-bold text-white">{data.name}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4 font-mono text-[11px]">
          <span className="text-gray-400">{data.count} {data.count === 1 ? "Tender" : "Tenders"}</span>
          <span className="font-semibold text-emerald-400">{data.percent}%</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function TenderVisualsWidget({
  tenders,
  orgCol,
  nameCol,
  valueCol,
  stageCol,
}: TenderVisualsWidgetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute 100% Real Bar Chart Data for Tenders by Organization
  const barData = useMemo(() => {
    // Collect all tenders with non-zero or explicit bid values
    const valued = tenders
      .filter((t) => (t._valNum || 0) > 0)
      .map((t) => {
        const org = String(t[orgCol] || t["Company"] || "Tender").trim();
        const requirement = String(t[nameCol] || t["Requirement"] || "").trim();
        const stage = t._normStage || "Tender Identified";
        const tenderId = String(t["Lead ID"] || t["Tender ID"] || "").trim();
        const val = t._valNum || 0;

        return {
          org: org.length > 16 ? `${org.slice(0, 14)}…` : org,
          fullOrg: org,
          requirement,
          stage,
          tenderId,
          value: val,
        };
      })
      .sort((a, b) => b.value - a.value);

    return valued;
  }, [tenders, orgCol, nameCol]);

  // Compute Unvalued Tenders (Empanelment / LTA / Pending valuation)
  const unvaluedTenders = useMemo(() => {
    return tenders.filter((t) => (t._valNum || 0) === 0);
  }, [tenders]);

  // Compute Pipeline Value Totals
  const { totalPipelineVal, activePipelineVal, highestBid, avgBidVal } = useMemo(() => {
    let total = 0;
    let active = 0;
    let highest = 0;
    let highestOrg = "";

    tenders.forEach((t) => {
      const val = t._valNum || 0;
      total += val;
      if (t._normStage !== "Lost") {
        active += val;
      }
      if (val > highest) {
        highest = val;
        highestOrg = String(t[orgCol] || t["Company"] || "");
      }
    });

    const valuedCount = tenders.filter((t) => (t._valNum || 0) > 0).length;
    const avg = valuedCount > 0 ? Math.round(total / valuedCount) : 0;

    return {
      totalPipelineVal: total,
      activePipelineVal: active,
      highestBid: { val: highest, org: highestOrg },
      avgBidVal: avg,
    };
  }, [tenders, orgCol]);

  // Compute 100% Real Donut Chart Data for Stage Distribution
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    const total = tenders.length;

    tenders.forEach((t) => {
      const stage = t._normStage || "Tender Identified";
      counts[stage] = (counts[stage] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        value: count,
        percent: total > 0 ? ((count / total) * 100).toFixed(1) : "0",
        color: getStageColor(name),
      }))
      .sort((a, b) => b.count - a.count);
  }, [tenders]);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 h-72 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] animate-pulse" />
        <div className="lg:col-span-1 h-72 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
      {/* Left 2 Cols: Real Tender Values by Organization */}
      <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] p-5 shadow-sm flex flex-col justify-between">
        <div>
          {/* Header & Stat Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-white/5 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                  Tender Bid Values by Organization
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-semibold">
                    100% Real Sheet Data
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#888899]">
                  Comparative bid valuations submitted to institutional & government prospects
                </p>
              </div>
            </div>

            {/* Top Stat Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 flex flex-col items-end">
                <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400">Total Bids Value</span>
                <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatINR(totalPipelineVal)}
                </span>
              </div>
              {highestBid.val > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-white/5 flex flex-col items-end">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400">Top Bid ({highestBid.org})</span>
                  <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400">
                    {formatINR(highestBid.val)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="w-full h-56 pt-1">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 10, right: 10, left: 5, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="currentColor"
                    className="text-gray-200 dark:text-white/5"
                  />
                  <XAxis
                    dataKey="org"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-gray-500 dark:text-[#888899] font-medium"
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-gray-400 dark:text-[#666677] font-mono"
                    tickFormatter={formatYAxisTick}
                    width={58}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar
                    dataKey="value"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  >
                    {barData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getStageColor(entry.stage)}
                        className="transition-opacity hover:opacity-80 cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No tender valuations recorded yet in sheet.
              </div>
            )}
          </div>
        </div>

        {/* Footer Note on Unvalued Tenders */}
        {unvaluedTenders.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] text-gray-500 dark:text-[#888899]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span>
                <strong>{unvaluedTenders.length} Bids</strong> (
                {unvaluedTenders.map((t) => t[orgCol] || t["Company"]).join(", ")}) are Empanelment, LTA, or pending financial bid opening.
              </span>
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 ml-2">
              Active Pipeline: {formatINR(activePipelineVal)}
            </span>
          </div>
        )}
      </div>

      {/* Right 1 Col: Real Tender Stage Donut Chart */}
      <div className="lg:col-span-1 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111118] p-5 shadow-sm flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                <PieIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                  Stage Distribution
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#888899]">
                  {tenders.length} Total Tender Opportunities
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/40">
              100% Real
            </span>
          </div>

          {/* Donut Chart with Centered Count */}
          <div className="relative w-full h-44 flex items-center justify-center">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={3}
                      cornerRadius={4}
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`pie-cell-${index}`}
                          fill={entry.color}
                          className="transition-opacity hover:opacity-85 cursor-pointer outline-none"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Badge inside Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold font-mono text-gray-900 dark:text-white tracking-tight">
                    {tenders.length}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-[#777788]">
                    Tenders
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-400">No tenders available</div>
            )}
          </div>
        </div>

        {/* Legend List */}
        <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {pieData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-gray-50/60 dark:bg-[#161622]/60 border border-gray-100 dark:border-white/5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-700 dark:text-gray-200 font-medium truncate">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] shrink-0 ml-2">
                <span className="font-bold text-gray-900 dark:text-white">
                  {item.count}
                </span>
                <span className="text-gray-400 text-[10px]">
                  ({item.percent}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
