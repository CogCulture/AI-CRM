"use client";

import React, { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { SheetData } from "@/lib/types";

interface RevenueAnalysisWidgetProps {
  sheetData: SheetData;
}

const COLORS = {
  won: "#1D9E75", // Green
  lost: "#EF4444", // Red
};

const MOCK_REVENUE_DATA = [
  { name: "Jan", "Won Revenue": 45000, "Lost Revenue": 12000 },
  { name: "Feb", "Won Revenue": 62000, "Lost Revenue": 8000 },
  { name: "Mar", "Won Revenue": 55000, "Lost Revenue": 22000 },
  { name: "Apr", "Won Revenue": 89000, "Lost Revenue": 15000 },
  { name: "May", "Won Revenue": 104000, "Lost Revenue": 31000 },
];

const CustomRevenueTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const formatCurrency = (val: number) => {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(val);
    };

    return (
      <div className="bg-[#0C0C12] border border-[rgba(255,255,255,0.08)] rounded-lg p-2.5 shadow-2xl font-sans text-xs">
        <p className="text-[#888899] mb-1.5 font-mono">{payload[0].payload.name}</p>
        <div className="space-y-1.5 font-mono">
          {payload.map((item: any, index: number) => {
            const isWon = item.name.toLowerCase().includes("won");
            const color = isWon ? "#1D9E75" : "#EF4444";
            return (
              <p key={index} style={{ color }} className="font-semibold flex items-center gap-4">
                <span>{item.name}:</span>
                <span>{formatCurrency(item.value)}</span>
              </p>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default function RevenueAnalysisWidget({ sheetData }: RevenueAnalysisWidgetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMock = sheetData.is_mock;

  // Resolve estimated revenue column
  const revenueHeader = sheetData.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("estimated") || hl.includes("est") || hl.includes("revenue");
  }) || sheetData.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("value") || hl.includes("amount") || hl.includes("deal size");
  }) || "";

  const statusHeader = sheetData.headers.find(h => h.toLowerCase() === "status") || "";
  const stageHeader = sheetData.headers.find(h => h.toLowerCase() === "stage") || "";
  const dateHeader = sheetData.headers.find(h => h.toLowerCase().includes("date")) || "";

  // Parse total won/lost/estimated revenues
  let wonRevenue = 0;
  let lostRevenue = 0;
  let totalEstimatedRevenue = 0;
  const monthlyDataMap: Record<string, { won: number; lost: number }> = {};
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (!isMock && sheetData.rows && revenueHeader) {
    sheetData.rows.forEach(row => {
      const revStr = String(row[revenueHeader] || "0");
      const revVal = parseFloat(revStr.replace(/[^0-9.-]/g, "")) || 0;
      
      totalEstimatedRevenue += revVal;

      const statusVal = String(row[statusHeader] || "").toLowerCase().trim();
      const stageVal = String(row[stageHeader] || "").toLowerCase().trim();

      const isWon = ["won", "closed won", "converted", "completed", "hired", "success"].some(x => statusVal.includes(x) || stageVal.includes(x));
      const isLost = ["lost", "dead", "lost lead", "dead lead", "cold"].some(x => statusVal.includes(x) || stageVal.includes(x));

      if (isWon) {
        wonRevenue += revVal;
      } else if (isLost) {
        lostRevenue += revVal;
      }

      // Group by month for chart representation
      if (dateHeader) {
        const dateVal = String(row[dateHeader] || "");
        let monthName = "Other";
        const parts = dateVal.split(/[-/.]/);
        if (parts.length === 3) {
          let monthIdx = -1;
          // check YYYY-MM-DD
          if (parts[0].length === 4) {
            monthIdx = parseInt(parts[1], 10) - 1;
          } else {
            monthIdx = parseInt(parts[1], 10) - 1; // assume middle is month in DD/MM/YYYY
          }
          if (monthIdx >= 0 && monthIdx < 12) {
            monthName = MONTHS[monthIdx];
          }
        }
        
        if (monthName !== "Other") {
          if (!monthlyDataMap[monthName]) {
            monthlyDataMap[monthName] = { won: 0, lost: 0 };
          }
          if (isWon) monthlyDataMap[monthName].won += revVal;
          if (isLost) monthlyDataMap[monthName].lost += revVal;
        }
      }
    });
  }

  // Formatting chart data
  let chartData = MOCK_REVENUE_DATA;
  if (!isMock && Object.keys(monthlyDataMap).length > 0) {
    chartData = Object.keys(monthlyDataMap)
      .map(month => ({
        name: month,
        "Won Revenue": monthlyDataMap[month].won,
        "Lost Revenue": monthlyDataMap[month].lost,
      }))
      .sort((a, b) => MONTHS.indexOf(a.name) - MONTHS.indexOf(b.name));
  } else if (!isMock) {
    // If no monthly groupings found, aggregate by campaign or fallback
    wonRevenue = wonRevenue || 0;
    lostRevenue = lostRevenue || 0;
    chartData = [
      { name: "Current Period", "Won Revenue": wonRevenue, "Lost Revenue": lostRevenue }
    ];
  } else {
    // Mock totals
    wonRevenue = MOCK_REVENUE_DATA.reduce((acc, curr) => acc + curr["Won Revenue"], 0);
    lostRevenue = MOCK_REVENUE_DATA.reduce((acc, curr) => acc + curr["Lost Revenue"], 0);
  }

  // Set total estimated revenue for mock data
  if (isMock) {
    totalEstimatedRevenue = wonRevenue + lostRevenue + 150000; // Mock total estimate including active leads
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#111118] p-5 shadow-xl transition-colors duration-150 flex flex-col md:flex-row gap-6 w-full h-full">
      {/* Left side: Metrics Cards */}
      <div className="flex flex-col gap-3 w-full md:w-72 shrink-0 justify-center">
        {/* Total Estimated Revenue Card */}
        <div className="p-3.5 rounded-xl border border-gray-150 dark:border-white/5 bg-gray-50/30 dark:bg-[#161622]/40 flex flex-col justify-between h-20 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-[#888899] font-sans">
            Total Estimated Revenue
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base font-bold text-blue-600 dark:text-[#38BDF8] font-sans flex items-center gap-1">
              {formatCurrency(totalEstimatedRevenue)}
            </span>
            <span className="text-[9px] font-bold text-blue-500 flex items-center font-mono">
              ↑ 0%
            </span>
          </div>
        </div>

        {/* Won Revenue Card */}
        <div className="p-3.5 rounded-xl border border-gray-150 dark:border-white/5 bg-gray-50/30 dark:bg-[#161622]/40 flex flex-col justify-between h-20 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-[#888899] font-sans">
            Won Revenue
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base font-bold font-sans flex items-center gap-1" style={{ color: "#1D9E75" }}>
              +{formatCurrency(wonRevenue)}
            </span>
            <span className="text-[9px] font-bold flex items-center font-mono" style={{ color: "#1D9E75" }}>
              ↑ 0%
            </span>
          </div>
        </div>

        {/* Lost Revenue Card */}
        <div className="p-3.5 rounded-xl border border-gray-150 dark:border-white/5 bg-gray-50/30 dark:bg-[#161622]/40 flex flex-col justify-between h-20 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-[#888899] font-sans">
            Lost Revenue
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-base font-bold font-sans flex items-center gap-1" style={{ color: "#EF4444" }}>
              -{formatCurrency(lostRevenue)}
            </span>
            <span className="text-[9px] font-bold flex items-center font-mono" style={{ color: "#EF4444" }}>
              ↑ 0%
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Dual Bar Chart */}
      <div className="flex-1 min-w-0 h-64 md:h-auto relative flex flex-col">
        <div className="flex-1">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.06} strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="currentColor" 
                  strokeOpacity={0.1} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: "#888899" }} 
                />
                <YAxis 
                  stroke="currentColor" 
                  strokeOpacity={0.1} 
                  tickLine={false} 
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                  tick={{ fontSize: 10, fill: "#888899" }} 
                />
                <Tooltip content={<CustomRevenueTooltip />} />
                <Bar dataKey="Won Revenue" fill={COLORS.won} radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Lost Revenue" fill={COLORS.lost} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        
        {/* Custom Legend to match mockup */}
        <div className="flex items-center justify-center gap-6 text-[11px] font-sans font-medium text-gray-700 dark:text-[#888899] mt-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[#1D9E75]" />
            <span>Won Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-[#EF4444]" />
            <span>Lost Revenue</span>
          </div>
        </div>
      </div>
    </div>
  );
}
