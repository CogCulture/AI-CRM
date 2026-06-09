"use client";

import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { toast } from "sonner";

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  initialData?: Record<string, any> | null;
  onSave: (data: Record<string, any>) => Promise<void>;
  title: string;
  mandatoryColumns?: string[];
}

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

// Helper to format date cleanly as YYYY-MM-DD for date inputs
const formatDateForInput = (dateVal: any): string => {
  if (!dateVal) return "";
  const parsed = parseDate(dateVal);
  if (!parsed) return String(dateVal).trim();
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function LeadFormModal({
  isOpen,
  onClose,
  headers,
  initialData,
  onSave,
  title,
  mandatoryColumns = [],
}: LeadFormModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Exclude technical metadata fields and ID indices
  const formHeaders = headers.filter(
    (h) => h !== "_row_num" && h.toLowerCase() !== "no."
  );

  useEffect(() => {
    if (initialData) {
      const parsed: Record<string, string> = {};
      formHeaders.forEach((h) => {
        const hl = h.toLowerCase();
        const rawVal = initialData[h];
        if (hl.includes("date") || hl.includes("deadline") || hl.includes("due")) {
          parsed[h] = formatDateForInput(rawVal);
        } else {
          parsed[h] = String(rawVal || "");
        }
      });
      setFormData(parsed);
    } else {
      const empty: Record<string, string> = {};
      formHeaders.forEach((h) => {
        empty[h] = "";
      });
      setFormData(empty);
    }
  }, [initialData, isOpen, headers]);

  if (!isOpen) return null;

  const handleChange = (header: string, val: string) => {
    setFormData((prev) => ({
      ...prev,
      [header]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check mandatory fields validation
    const missing: string[] = [];
    (mandatoryColumns || []).forEach((col) => {
      const val = (formData[col] || "").trim();
      if (!val) {
        missing.push(col);
      }
    });

    if (missing.length > 0) {
      toast.error(`The following field(s) are required: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Click outside backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white dark:bg-[#0C0C12] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[rgba(255,255,255,0.05)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-sans tracking-wide">
            {initialData?._row_num ? `Update Lead (COG-${1000 + Number(initialData._row_num)})` : title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 dark:text-[#555566] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formHeaders.map((header) => {
              const hl = header.toLowerCase();
              const isStatusDropdown = hl === "status";
              const isStageDropdown = hl === "stage";
              const val = formData[header] || "";
              const isRequired = mandatoryColumns.includes(header);

              return (
                <div key={header} className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">
                    {header} {isRequired && <span className="text-red-500 font-bold ml-0.5">*</span>}
                  </label>
                  
                  {isStatusDropdown ? (
                    <select
                      value={val}
                      onChange={(e) => handleChange(header, e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none cursor-pointer"
                    >
                      <option value="">-- Select Status --</option>
                      <option value="Hot">Hot</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                    </select>
                  ) : isStageDropdown ? (
                    <select
                      value={val}
                      onChange={(e) => handleChange(header, e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none cursor-pointer"
                    >
                      <option value="">-- Select Stage --</option>
                      <option value="Lead">Lead</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Proposal sent">Proposal sent</option>
                      <option value="Proposal to be Sent">Proposal to be Sent</option>
                      <option value="Negotiation">Negotiation</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                    </select>
                  ) : (
                    <input
                      type={hl.includes("date") || hl.includes("deadline") || hl.includes("due") ? "date" : "text"}
                      placeholder={hl === "lead id" ? "Auto-generated" : `Enter ${header}...`}
                      value={val}
                      disabled={hl === "lead id"}
                      onChange={(e) => handleChange(header, e.target.value)}
                      className={`w-full px-3.5 py-2 text-xs rounded-lg font-sans outline-none border ${
                        hl === "lead id"
                          ? "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed font-mono font-semibold"
                          : "bg-gray-50 dark:bg-[#161622] border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 text-gray-900 dark:text-white"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="pt-6 border-t border-gray-100 dark:border-[rgba(255,255,255,0.05)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-[#dedee5] text-xs font-semibold rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#1D9E75] hover:bg-[#198763] disabled:bg-[#1D9E75]/50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(29,158,117,0.15)]"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
