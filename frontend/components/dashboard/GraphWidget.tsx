"use client";

import React from "react";
import { Trash2, ChartBar, ChartLine, ChartArea, ChartPie, ChevronRight } from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, Bar, 
  LineChart, Line, 
  AreaChart, Area, 
  PieChart, Pie, Cell, Sector,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceDot
} from "recharts";
import { GraphConfig } from "@/lib/types";

interface GraphWidgetProps {
  graph: GraphConfig;
  rows: Record<string, string>[];
  onDelete?: (id: string) => void;
  height?: number;
}

const COLORS = ["#86F3D4", "#38BDF8", "#4E60A6", "#548CA8", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6"];

const getSegmentColor = (name: string, index: number): string => {
  const norm = name.toLowerCase().trim();
  if (norm === "cold") return "#93C5FD"; // light blue
  if (norm === "warm") return "#FCA5A5"; // light red
  if (norm === "hot") return "#DC2626"; // dark red
  return COLORS[index % COLORS.length];
};

const MOCK_LINE_DATA = [
  { name: "May", Deals: 5.0, Revenue: 480 },
  { name: "Jun", Deals: 4.2, Revenue: 400 },
  { name: "Jul", Deals: 3.8, Revenue: 450 },
  { name: "Aug", Deals: 5.2, Revenue: 560 },
  { name: "Sep", Deals: 5.0, Revenue: 480 },
  { name: "Oct", Deals: 5.4, Revenue: 460 },
];

const MOCK_PIE_DATA = [
  { name: "Direct", value: 1708.63, color: "#86F3D4" },
  { name: "Paid", value: 1281.47, color: "#38BDF8" },
  { name: "Social", value: 854.31, color: "#4E60A6" },
  { name: "Other", value: 427.16, color: "#548CA8" },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#12121A] border border-[rgba(255,255,255,0.08)] rounded-lg p-2.5 shadow-2xl font-sans text-xs">
        <p className="text-[#888899] mb-1 font-mono">{payload[0].payload.name}</p>
        <div className="space-y-1 font-mono">
          <p className="text-[#38BDF8] font-semibold">Deals: {payload[0].value}</p>
          <p className="text-[#86F3D4] font-semibold">Revenue: ₹{payload[1].value.toLocaleString("en-IN")}</p>
        </div>
      </div>
    );
  }
  return null;
};

const RenderCustomizedLabel = (props: any) => {
  const { cx, cy } = props;
  return (
    <g>
      {/* Vertical line indicator */}
      <line x1={cx} y1={cy} x2={cx} y2={cy + 85} stroke="rgba(16, 185, 129, 0.35)" strokeWidth="1.25" strokeDasharray="3 3" />
      {/* Background Bubble */}
      <rect 
        x={cx - 20} 
        y={cy - 26} 
        width={40} 
        height={18} 
        rx={4} 
        fill="#10B981" 
        filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.5))"
      />
      {/* Text inside bubble */}
      <text 
        x={cx} 
        y={cy - 14} 
        fill="#062F16" 
        fontSize="10" 
        fontWeight="bold" 
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        ₹560
      </text>
      {/* Glowing point at intersection */}
      <circle cx={cx} cy={cy} r={5} fill="#10B981" stroke="#0A0A0F" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={8} fill="none" stroke="#10B981" strokeWidth={1} opacity={0.5} />
    </g>
  );
};

interface GraphWidgetProps {
  graph: GraphConfig;
  rows: Record<string, string>[];
  onDelete?: (id: string) => void;
  height?: number;
  isMock?: boolean;
}

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const mx = cx + 5 * cos;
  const my = cy + 5 * sin;

  return (
    <g>
      <Sector
        cx={mx}
        cy={my}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={6}
        stroke="none"
      />
    </g>
  );
};

const SafePie = Pie as any;

export default function GraphWidget({ graph, rows, onDelete, height = 220, isMock: isMockProp }: GraphWidgetProps) {
  const isMock = isMockProp !== undefined ? isMockProp : (rows.length > 0 && "Campaign" in rows[0]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Aggregate and format data to prevent legend overflow
  const getGraphData = () => {
    const counts: Record<string, number> = {};
    const sums: Record<string, number> = {};

    // 1. Check if the X column is date-like
    let isDateCol = false;
    let sampleDatesCount = 0;
    rows.slice(0, 50).forEach((row) => {
      const val = row[graph.x_col] || "";
      if (val && (val.includes("/") || val.includes("-") || val.match(/^\d{4}/))) {
        sampleDatesCount++;
      }
    });
    if (sampleDatesCount > 15) {
      isDateCol = true;
    }

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    rows.forEach((row) => {
      let xVal = row[graph.x_col] || "(empty)";
      const yValStr = row[graph.y_col] || "1";
      const yVal = parseFloat(yValStr.replace(/[^0-9.-]/g, ""));

      // Date Grouping by Month
      if (isDateCol && xVal !== "(empty)") {
        let monthIdx = -1;
        const slashMatch = xVal.match(/\d+[\/\-](\d+)[\/\-]\d+/); // Matches middle number in 16/09/2025
        if (slashMatch) {
          monthIdx = parseInt(slashMatch[1], 10) - 1;
        } else {
          const isoMatch = xVal.match(/^\d{4}\-(\d+)\-\d+/); // Matches middle in 2026-05-12
          if (isoMatch) {
            monthIdx = parseInt(isoMatch[1], 10) - 1;
          }
        }
        if (monthIdx >= 0 && monthIdx < 12) {
          xVal = MONTHS[monthIdx];
        }
      }

      // Aggregate Stage or Status values into counts or sums
      counts[xVal] = (counts[xVal] || 0) + 1;
      if (!isNaN(yVal)) {
        sums[xVal] = (sums[xVal] || 0) + yVal;
      } else {
        sums[xVal] = (sums[xVal] || 0) + 1;
      }
    });

    let rawData = Object.keys(sums).map((key) => ({
      name: key,
      value: graph.type === "pie" ? counts[key] : Number(sums[key].toFixed(2)),
      count: counts[key],
    }));

    // Chronological sort for months
    if (isDateCol) {
      rawData.sort((a, b) => MONTHS.indexOf(a.name) - MONTHS.indexOf(b.name));
    } else {
      rawData.sort((a, b) => b.value - a.value);
    }

    // Pie chart legend safety: limit to Top 5 + "Other"
    if (graph.type === "pie" && rawData.length > 5) {
      const top5 = rawData.slice(0, 5);
      const remaining = rawData.slice(5);
      const otherVal = remaining.reduce((acc, c) => acc + c.value, 0);
      const otherCnt = remaining.reduce((acc, c) => acc + c.count, 0);
      return [
        ...top5,
        {
          name: "Other",
          value: Number(otherVal.toFixed(2)),
          count: otherCnt
        }
      ];
    }

    // General limit: if too many bars/lines, take top 12 to prevent rendering crash
    if (graph.type !== "pie" && !isDateCol && rawData.length > 12) {
      const top11 = rawData.slice(0, 11);
      const remaining = rawData.slice(11);
      const otherVal = remaining.reduce((acc, c) => acc + c.value, 0);
      const otherCnt = remaining.reduce((acc, c) => acc + c.count, 0);
      return [
        ...top11,
        {
          name: "Other",
          value: Number(otherVal.toFixed(2)),
          count: otherCnt
        }
      ];
    }

    return rawData;
  };

  const chartData = getGraphData();
  const hasData = chartData.length > 0;

  const totalSum = chartData.reduce((acc, curr) => acc + curr.value, 0);
  const isCurrency = graph.y_col.toLowerCase().includes("value") || 
                     graph.y_col.toLowerCase().includes("amount") || 
                     graph.y_col.toLowerCase().includes("revenue");
  const formattedTotal = isCurrency
    ? `₹${totalSum.toLocaleString("en-IN")}`
    : totalSum.toLocaleString("en-IN");

  const renderChart = () => {
    if (isMock) {
      if (graph.type === "line" || graph.id === "default-line") {
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={MOCK_LINE_DATA} margin={{ top: 15, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="name" stroke="currentColor" strokeOpacity={0.1} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#888899" }} />
              
              <YAxis 
                yAxisId="left"
                stroke="currentColor"
                strokeOpacity={0.1}
                tickLine={false} 
                axisLine={false}
                domain={[2, 8]}
                ticks={[2, 4, 6, 8]}
                tick={{ fontSize: 10, fill: "#888899" }} 
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="currentColor"
                strokeOpacity={0.1}
                tickLine={false} 
                axisLine={false}
                domain={[200, 1000]}
                ticks={[200, 400, 600, 800, 1000]}
                tickFormatter={(v) => `₹${v}`}
                tick={{ fontSize: 10, fill: "#888899" }} 
              />
              
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.08, strokeWidth: 1 }} />
              
              <Line yAxisId="left" type="monotone" dataKey="Deals" stroke="#185FA5" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#185FA5" }} />
              <Line yAxisId="right" type="monotone" dataKey="Revenue" stroke="#1D9E75" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#1D9E75" }} />
              
              <ReferenceDot yAxisId="right" x="Aug" y={560} shape={RenderCustomizedLabel} />
            </LineChart>
          </ResponsiveContainer>
        );
      }

      if (graph.type === "pie" || graph.id === "default-pie") {
        return (
          <div className="relative w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <SafePie
                  data={MOCK_PIE_DATA}
                  cx="50%"
                  cy="40%"
                  innerRadius={58}
                  outerRadius={73}
                  paddingAngle={3}
                  dataKey="value"
                  activeIndex={0}
                  activeShape={renderActiveShape}
                  cornerRadius={6}
                  stroke="none"
                >
                  {MOCK_PIE_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </SafePie>
                <Tooltip formatter={(v) => `${Number(v).toLocaleString("en-IN")} leads`} contentStyle={{ background: "#0C0C12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#F1F1F5", fontFamily: "sans-serif", fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }
    }

    if (!hasData) {
      return (
        <div className="flex items-center justify-center h-full text-xs text-[#555566] font-mono">
          No data available
        </div>
      );
    }

    switch (graph.type) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="name" stroke="currentColor" strokeOpacity={0.1} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#888899" }} />
              <YAxis stroke="currentColor" strokeOpacity={0.1} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#888899" }} />
              <Tooltip contentStyle={{ background: "#12121A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#F1F1F5", fontFamily: "sans-serif", fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke="#1D9E75" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#1D9E75" }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${graph.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.06} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="currentColor" strokeOpacity={0.1} tickLine={false} tick={{ fontSize: 9, fontFamily: "monospace" }} />
              <YAxis stroke="currentColor" strokeOpacity={0.1} tickLine={false} tick={{ fontSize: 9, fontFamily: "monospace" }} />
              <Tooltip contentStyle={{ background: "#0C0C12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#F1F1F5", fontFamily: "monospace", fontSize: 10 }} />
              <Area type="monotone" dataKey="value" stroke="#1D9E75" strokeWidth={2} fillOpacity={1} fill={`url(#grad-${graph.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <div className="relative w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <SafePie
                  data={chartData}
                  cx="50%"
                  cy="40%"
                  innerRadius={58}
                  outerRadius={73}
                  paddingAngle={3}
                  dataKey="value"
                  activeIndex={0}
                  activeShape={renderActiveShape}
                  cornerRadius={6}
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getSegmentColor(entry.name, index)} />
                  ))}
                </SafePie>
                <Tooltip formatter={(v) => `${Number(v).toLocaleString("en-IN")} leads`} contentStyle={{ background: "#0C0C12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#F1F1F5", fontFamily: "sans-serif", fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      case "bar":
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.06} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="currentColor" strokeOpacity={0.1} tickLine={false} tick={{ fontSize: 9, fontFamily: "monospace" }} />
              <YAxis stroke="currentColor" strokeOpacity={0.1} tickLine={false} tick={{ fontSize: 9, fontFamily: "monospace" }} />
              <Tooltip contentStyle={{ background: "#0C0C12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#F1F1F5", fontFamily: "monospace", fontSize: 10 }} />
              <Bar dataKey="value" fill="#1D9E75" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="rounded-2xl p-5 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#111118] flex flex-col justify-between relative group shadow-lg min-w-0 w-full h-full transition-colors duration-150">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wide">{graph.title}</h4>
        </div>
        
        {isMock && (graph.type === "line" || graph.id === "default-line") ? (
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
              <span className="text-[#888899]">Deals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#86F3D4]" />
              <span className="text-[#888899]">Revenue</span>
            </div>
          </div>
        ) : isMock && (graph.type === "pie" || graph.id === "default-pie") ? (
          <button className="p-1 rounded border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#161622] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] text-[#888899] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          onDelete && (
            <button
              onClick={() => onDelete(graph.id)}
              className="p-1 rounded bg-[rgba(255,255,255,0.02)] hover:bg-red-500/10 border border-gray-200 dark:border-[rgba(255,255,255,0.04)] hover:border-red-500/20 text-[#555566] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
              title="Remove Widget"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )
        )}
      </div>

      {/* Body */}
      <div className="w-full min-w-0 relative flex-1" style={{ minHeight: `${height}px` }}>
        {mounted && renderChart()}
      </div>

      {/* Footer / Custom Mock Legend info */}
      {isMock && (graph.type === "pie" || graph.id === "default-pie") ? (
        <div className="flex items-center justify-center gap-4 text-[10px] font-mono mt-3.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#86F3D4]" />
            <span className="text-[#888899]">Direct</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
            <span className="text-[#888899]">Paid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4E60A6]" />
            <span className="text-[#888899]">Social</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#548CA8]" />
            <span className="text-[#888899]">Other</span>
          </div>
        </div>
      ) : graph.type === "pie" ? (
        <div className="flex items-center justify-center gap-4 text-[10px] font-mono mt-3.5 flex-wrap">
          {chartData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getSegmentColor(entry.name, index) }} />
              <span className="text-[#888899]">{entry.name} ({entry.count})</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2.5 flex items-center justify-between text-[9px] font-mono text-[#555566] border-t border-gray-100 dark:border-[rgba(255,255,255,0.04)] pt-2">
          <span>X: {graph.x_col}</span>
          <span>Y: {graph.y_col}</span>
        </div>
      )}
    </div>
  );
}
