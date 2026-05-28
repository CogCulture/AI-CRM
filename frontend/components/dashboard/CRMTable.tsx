"use client";

import React, { useState } from "react";
import { SlidersHorizontal, ArrowUpDown, Search } from "lucide-react";
import ColumnManager from "./ColumnManager";

interface CRMTableProps {
  headers: string[];
  rows: Record<string, string>[];
  visibleColumns: string[];
  columnOrder: string[];
  onSaveConfig: (visible: string[], order: string[]) => Promise<void>;
  searchTerm?: string;
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

export default function CRMTable({
  headers,
  rows,
  visibleColumns,
  columnOrder,
  onSaveConfig,
  searchTerm,
}: CRMTableProps) {
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const isNumericColumn = (colName: string) => {
    const norm = colName.toLowerCase();
    return ["visitors", "contacts", "companies", "leads", "value", "amount", "revenue", "no."].some(x => norm.includes(x));
  };
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const activeSearch = searchTerm !== undefined ? searchTerm : localSearchTerm;

  // Determine active columns and order
  const displayCols = columnOrder.length > 0 ? columnOrder : [...headers];
  const activeCols = displayCols.filter((col) => {
    if (visibleColumns.length === 0) return headers.includes(col);
    return visibleColumns.includes(col) && headers.includes(col);
  });

  // Include missing headers that aren't in columnOrder yet
  headers.forEach((h) => {
    if (!displayCols.includes(h)) {
      displayCols.push(h);
      if (visibleColumns.length === 0 || visibleColumns.includes(h)) {
        activeCols.push(h);
      }
    }
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

  // Filter rows based on search
  const filteredRows = rows.filter((row) => {
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(activeSearch.toLowerCase())
    );
  });

  // Sort filtered rows
  const sortedRows = [...filteredRows];
  if (sortColumn) {
    sortedRows.sort((a, b) => {
      const valA = a[sortColumn] || "";
      const valB = b[sortColumn] || "";
      
      const numA = parseFloat(valA.replace(/[^0-9.-]/g, ""));
      const numB = parseFloat(valB.replace(/[^0-9.-]/g, ""));
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }
      
      return sortDirection === "asc" 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111118] overflow-hidden shadow-xl">
      {/* Table Action Bar */}
      <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white tracking-wide">
          Campaign Performance
        </h3>
        
        <div className="flex items-center gap-2">
          {/* Channels Dropdown Button */}
          <button className="px-3 py-1.5 bg-[#161622] hover:bg-[#1C1C2D] border border-[rgba(255,255,255,0.06)] text-white text-xs font-sans rounded-lg flex items-center gap-1.5 transition-all cursor-pointer">
            <span className="text-[#888899]">Channels:</span>
            <span className="text-white font-semibold">All</span>
          </button>

          {/* Configure Columns Trigger */}
          <button
            onClick={() => setIsManagerOpen(true)}
            className="p-1.5 bg-[#161622] hover:bg-[#1C1C2D] border border-[rgba(255,255,255,0.06)] text-[#888899] hover:text-white rounded-lg transition-all cursor-pointer"
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
            <tr className="border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] text-[10px] font-mono uppercase tracking-wider text-[#888899]">
              {activeCols.map((col, idx) => {
                const isRight = isNumericColumn(col) && col.toLowerCase() !== "no.";
                return (
                  <th 
                    key={`${col}-${idx}`} 
                    className={`py-3 px-4 font-semibold select-none cursor-pointer hover:bg-[rgba(255,255,255,0.03)] hover:text-white transition-colors ${
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
            </tr>
          </thead>
          <tbody>
            {sortedRows.length > 0 ? (
              sortedRows.map((row, rowIdx) => (
                <tr 
                  key={rowIdx}
                  className="border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors duration-200 text-xs font-mono row-fade-in"
                  style={{ animationDelay: `${rowIdx * 30}ms` }}
                >
                  {activeCols.map((col, idx) => {
                    const cellVal = row[col] || "";
                    const isNo = col.toLowerCase() === "no.";
                    const isCampaign = col.toLowerCase() === "campaign";
                    const isValue = col.toLowerCase() === "value";

                    if (isCampaign) {
                      const parts = cellVal.split("\n");
                      const mainTitle = parts[0];
                      const subtitle = parts[1] || "";
                      return (
                        <td key={`${col}-${idx}`} className="py-3 px-4 text-left">
                          <div className="flex items-center gap-3">
                            {getCampaignIcon(mainTitle)}
                            <div className="flex flex-col">
                              <span className="font-sans font-semibold text-white text-xs">{mainTitle}</span>
                              {subtitle && <span className="text-[10px] text-[#555566] font-mono mt-0.5">{subtitle}</span>}
                            </div>
                          </div>
                        </td>
                      );
                    }

                    const isRight = isNumericColumn(col) && col.toLowerCase() !== "no.";
                    return (
                      <td 
                        key={`${col}-${idx}`} 
                        className={`py-3 px-4 text-xs ${
                          isNo ? "text-[#555566]" : "text-[#dedee5]"
                        } ${
                          isRight ? "text-right" : "text-left"
                        }`}
                      >
                        {isValue ? (
                          <span className="font-sans font-bold text-[#3CD395]">
                            {cellVal}
                          </span>
                        ) : (
                          cellVal
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={activeCols.length || 1} className="py-12 text-center text-[#555566] text-sm">
                  No records match your query
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer statistics */}
      <div className="p-4 bg-[rgba(255,255,255,0.01)] border-t border-[rgba(255,255,255,0.05)] flex items-center justify-between text-[10px] text-[#555566] font-mono">
        <span>Showing {sortedRows.length} of {rows.length} campaigns</span>
        <span>Active columns: {activeCols.length}</span>
      </div>

      {/* Column Manager Drawer Overlay */}
      <ColumnManager
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        allHeaders={headers}
        visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        onSave={onSaveConfig}
      />
    </div>
  );
}
