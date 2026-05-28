"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, ChartBar, ChartLine, ChartArea, ChartPie } from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, Bar, 
  LineChart, Line, 
  AreaChart, Area, 
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from "recharts";
import { GraphConfig } from "@/lib/types";
import GraphBuilder from "@/components/dashboard/GraphBuilder";


interface GraphPanelProps {
  graphs: GraphConfig[];
  headers: string[];
  rows: Record<string, string>[];
  onAddGraph: (graph: GraphConfig) => Promise<void>;
  onDeleteGraph: (id: string) => Promise<void>;
}

const COLORS = ["#6366F1", "#A5B4FC", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6"];

export default function GraphPanel({
  graphs,
  headers,
  rows,
  onAddGraph,
  onDeleteGraph,
}: GraphPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div className="obsidian-glass rounded-xl h-80 border border-[rgba(255,255,255,0.06)] animate-pulse" />
        <div className="obsidian-glass rounded-xl h-80 border border-[rgba(255,255,255,0.06)] animate-pulse" />
      </div>
    );
  }

  // Parse data for a given graph
  const getGraphData = (g: GraphConfig) => {
    const counts: Record<string, number> = {};
    const sums: Record<string, number> = {};

    rows.forEach((row) => {
      const xVal = row[g.x_col] || "(empty)";
      const yValStr = row[g.y_col] || "1";
      const yVal = parseFloat(yValStr.replace(/[^0-9.-]/g, ""));

      counts[xVal] = (counts[xVal] || 0) + 1;
      if (!isNaN(yVal)) {
        sums[xVal] = (sums[xVal] || 0) + yVal;
      } else {
        sums[xVal] = (sums[xVal] || 0) + 1; // Default fallback to counts
      }
    });

    return Object.keys(sums).map((key) => ({
      name: key,
      value: Number(sums[key].toFixed(2)),
      count: counts[key],
    }));
  };

  const renderChart = (g: GraphConfig) => {
    const chartData = getGraphData(g);
    const hasMultipleRows = chartData.length > 0;

    if (!hasMultipleRows) {
      return (
        <div className="flex items-center justify-center h-64 text-sm text-[#555566] font-mono">
          No aggregate values to display
        </div>
      );
    }

    switch (g.type) {
      case "line":
        return (
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#555566" tickLine={false} tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <YAxis stroke="#555566" tickLine={false} tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip contentStyle={{ background: "#0C0C12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#F1F1F5", fontFamily: "monospace", fontSize: 11 }} />
            <Line type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2} dot={{ fill: "#6366F1", r: 3 }} activeDot={{ r: 6 }} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${g.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#555566" tickLine={false} tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <YAxis stroke="#555566" tickLine={false} tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip contentStyle={{ background: "#0C0C12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#F1F1F5", fontFamily: "monospace", fontSize: 11 }} />
            <Area type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill={`url(#grad-${g.id})`} />
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Pie
              data={chartData}
              cx="50%"
              cy="48%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#0C0C12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#F1F1F5", fontFamily: "monospace", fontSize: 11 }} />
            <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "#888899" }} />
          </PieChart>
        );
      case "bar":
      default:
        return (
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#555566" tickLine={false} tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <YAxis stroke="#555566" tickLine={false} tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <Tooltip contentStyle={{ background: "#0C0C12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#F1F1F5", fontFamily: "monospace", fontSize: 11 }} />
            <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        );
    }
  };

  const getChartIcon = (type: string) => {
    switch (type) {
      case "line": return <ChartLine className="w-4 h-4 text-indigo-400" />;
      case "area": return <ChartArea className="w-4 h-4 text-indigo-400" />;
      case "pie": return <ChartPie className="w-4 h-4 text-indigo-400" />;
      default: return <ChartBar className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl text-white font-medium tracking-wide">Performance Panels</h2>
          <p className="text-xs text-[#888899] font-mono mt-1">Aggregations built dynamically from rows</p>
        </div>

        <button
          onClick={() => setIsBuilderOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 shadow-[0_0_15px_rgba(99,102,241,0.2)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Widget
        </button>
      </div>

      {/* Grid panels */}
      {graphs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {graphs.map((g, idx) => (
            <div 
              key={g.id}
              className="obsidian-glass rounded-xl p-5 border border-[rgba(255,255,255,0.06)] bg-[#0C0C12]/20 flex flex-col justify-between h-88 relative group"
              style={{ animationDelay: `${idx * 150}ms`, animation: "fadeInStagger 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
            >
              {/* Top info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getChartIcon(g.type)}
                  <h4 className="text-sm font-semibold text-white tracking-wide">{g.title}</h4>
                </div>
                <button
                  onClick={() => onDeleteGraph(g.id)}
                  className="p-1 rounded bg-[rgba(255,255,255,0.02)] hover:bg-red-500/10 border border-[rgba(255,255,255,0.04)] hover:border-red-500/20 text-[#555566] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                  title="Remove Graph"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chart */}
              <div className="flex-1 w-full h-64">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    {renderChart(g)}
                  </ResponsiveContainer>
                )}
              </div>

              {/* Aggregation type tag */}
              <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-[#555566]">
                <span>X-Axis: {g.x_col}</span>
                <span>Y-Axis: {g.y_col}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="obsidian-glass rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0C0C12]/10 p-12 text-center my-6">
          <p className="text-sm text-[#888899] font-mono mb-4">No widgets built on this dashboard dashboard yet.</p>
          <button
            onClick={() => setIsBuilderOpen(true)}
            className="px-4 py-2 border border-indigo-500/30 hover:border-indigo-500 text-indigo-400 hover:text-indigo-300 bg-indigo-950/10 rounded-lg text-xs font-semibold font-mono transition-all duration-200 cursor-pointer"
          >
            Create Your First Widget
          </button>
        </div>
      )}

      {/* Builder Modal */}
      <GraphBuilder
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        headers={headers}
        rows={rows}
        onSave={onAddGraph}
      />
    </div>
  );
}
