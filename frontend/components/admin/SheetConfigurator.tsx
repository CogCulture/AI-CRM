"use client";

import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, AlertCircle, Database, Upload, FileSpreadsheet, RefreshCw, AlertTriangle, ShieldCheck, Save, Mail, Trash2, Plus, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Config } from "@/lib/types";

export default function SheetConfigurator() {
  const [activeTab, setActiveTab] = useState<"local" | "sheets">("local");
  
  const [config, setConfig] = useState<Config>({
    sheet_url: "",
    sheet_range: "Sheet1",
    visible_columns: [],
    column_order: [],
    graphs: [],
    report_recipients: [],
    mandatory_columns: []
  });

  const [dbStatus, setDbStatus] = useState<{
    loaded: boolean;
    row_count: number;
    headers: string[];
    is_local_db: boolean;
  }>({
    loaded: false,
    row_count: 0,
    headers: [],
    is_local_db: false,
  });

  const [authStatus, setAuthStatus] = useState<{
    authenticated: boolean;
    loading: boolean;
    email?: string;
    name?: string;
    picture?: string;
  }>({
    authenticated: false,
    loading: true,
  });

  // Google Sheets Inputs
  const [urlInput, setUrlInput] = useState("");
  const [rangeInput, setRangeInput] = useState("Sheet1");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    row_count: number;
    headers: string[];
    is_mock?: boolean;
    message?: string;
  } | null>(null);

  // Local DB Seeding Inputs
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [emailInput, setEmailInput] = useState("");

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    if (!emailInput.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    const current = config.report_recipients || [];
    if (current.includes(emailInput.trim())) {
      toast.error("Email is already in the recipient list");
      return;
    }
    const updated = [...current, emailInput.trim()];
    try {
      await api.updateConfig({ report_recipients: updated });
      setConfig(prev => ({ ...prev, report_recipients: updated }));
      setEmailInput("");
      toast.success("Recipient added successfully");
    } catch (err: any) {
      toast.error("Failed to update config");
    }
  };

  const handleRemoveRecipient = async (email: string) => {
    const current = config.report_recipients || [];
    const updated = current.filter(e => e !== email);
    try {
      await api.updateConfig({ report_recipients: updated });
      setConfig(prev => ({ ...prev, report_recipients: updated }));
      toast.success("Recipient removed");
    } catch (err: any) {
      toast.error("Failed to update config");
    }
  };

  const handleToggleMandatory = async (header: string) => {
    const current = config.mandatory_columns || [];
    const updated = current.includes(header)
      ? current.filter(h => h !== header)
      : [...current, header];
    try {
      await api.updateConfig({ mandatory_columns: updated });
      setConfig(prev => ({ ...prev, mandatory_columns: updated }));
      toast.success(`Updated validation for ${header}`);
    } catch (err: any) {
      toast.error("Failed to update config");
    }
  };

  // Load configuration and status
  const loadStatus = async () => {
    try {
      const cfg = await api.getConfig();
      setConfig(cfg);
      
      const isSheetsMode = cfg.sheet_url && cfg.sheet_url !== "mock" && cfg.sheet_url !== "local_db";
      setActiveTab(isSheetsMode ? "sheets" : "local");
      setUrlInput(isSheetsMode ? cfg.sheet_url : "");
      setRangeInput(cfg.sheet_range || "Sheet1");

      const data = await api.getSheetData(true);
      setDbStatus({
        loaded: true,
        row_count: data.rows ? data.rows.length : 0,
        headers: data.headers || [],
        is_local_db: !isSheetsMode,
      });

      if (isSheetsMode) {
        setTestResult({
          tested: true,
          success: true,
          row_count: data.rows ? data.rows.length : 0,
          headers: data.headers || [],
          is_mock: data.is_mock
        });
      }
    } catch (err: any) {
      console.error("Failed to load status:", err);
    }

    try {
      const auth = await api.getAuthStatus();
      setAuthStatus({
        authenticated: auth.authenticated,
        loading: false,
        email: auth.email,
        name: auth.name,
        picture: auth.picture,
      });
    } catch (err) {
      console.error("Failed to check auth status:", err);
      setAuthStatus({ authenticated: false, loading: false });
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Mode switching save
  const handleSwitchMode = async (mode: "local" | "sheets") => {
    if (mode === "local") {
      const confirmed = window.confirm(
        "Switch to Local Database (CSV/Excel) mode?\n\nThis will deactivate the Google Sheets sync. Leads will be managed locally in the CRM."
      );
      if (!confirmed) return;
      
      try {
        await api.updateConfig({
          sheet_url: "local_db",
          sheet_range: "Sheet1"
        });
        toast.success("Switched to Local CRM Database mode");
        await loadStatus();
      } catch (err: any) {
        toast.error(err.message || "Failed to switch mode");
      }
    } else {
      // Switching to sheets: confirm only if currently active on local
      if (!isCurrentModeLocal) { setActiveTab("sheets"); return; }
      const confirmed = window.confirm(
        "Switch to Google Sheets Sync mode?\n\nThis will deactivate the local SQLite storage. Enter and save a Sheet URL below to activate."
      );
      if (!confirmed) return;
      setActiveTab("sheets");
    }
  };

  // Google Sheets Test & Save Handlers
  const handleTestSheets = async () => {
    if (!urlInput.trim()) {
      toast.error("Please enter a Google Sheet URL first");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testConnection(urlInput.trim(), rangeInput.trim());
      setTestResult({
        tested: true,
        success: res.ok,
        row_count: res.row_count,
        headers: res.headers,
        is_mock: res.is_mock
      });
      if (res.ok) {
        toast.success(`Connected! Found ${res.row_count} rows in ${rangeInput}`);
      } else {
        toast.error("Sheets connection test failed");
      }
    } catch (err: any) {
      setTestResult({
        tested: true,
        success: false,
        row_count: 0,
        headers: [],
        message: err.message || "Failed to reach sheet"
      });
      toast.error(err.message || "Connection test failed. Check URL/Credentials.");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSheets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      toast.error("Please enter a Google Sheet URL first");
      return;
    }
    setSaving(true);
    try {
      await api.updateConfig({
        sheet_url: urlInput.trim(),
        sheet_range: rangeInput.trim()
      });
      toast.success("Google Sheets configuration saved and active!");
      await loadStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  // Drag & Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validTypes = [".csv", ".xlsx", ".xls"];
      const isFormatValid = validTypes.some(type => droppedFile.name.toLowerCase().endsWith(type));
      
      if (isFormatValid) {
        setFile(droppedFile);
        toast.success(`Spreadsheet selected: ${droppedFile.name}`);
      } else {
        toast.error("Invalid file format. Please upload CSV or Excel spreadsheet.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const confirmed = window.confirm(
      "CAUTION: Seeding this sheet will overwrite all existing lead records in SQLite. Are you sure you want to proceed?"
    );
    if (!confirmed) return;

    setImporting(true);
    const loadingToastId = toast.loading(`Importing ${file.name}...`);
    
    try {
      const res = await api.importLeads(file);
      toast.dismiss(loadingToastId);
      toast.success(`Successfully imported ${res.row_count} leads and activated SQLite Storage!`);
      setFile(null);
      await loadStatus();
    } catch (err: any) {
      toast.dismiss(loadingToastId);
      toast.error(err.message || "Failed to import spreadsheet");
    } finally {
      setImporting(false);
    }
  };

  const handleGoogleSignIn = () => {
    const redirectUrl = `${window.location.origin}/admin`;
    window.location.href = `/api/sheets/auth?redirect_url=${encodeURIComponent(redirectUrl)}`;
  };

  const handleSignOut = async () => {
    try {
      await api.disconnectSheets();
      setAuthStatus({ authenticated: false, loading: false });
      toast.success("Signed out from Google");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign out");
    }
  };

  const isCurrentModeLocal = config.sheet_url === "local_db" || config.sheet_url === "mock" || !config.sheet_url;

  return (
    <div className="space-y-8 max-w-3xl mx-auto animate-row-reveal font-sans">
      {/* Title */}
      <div>
        <h1 className="font-display text-4xl text-gray-900 dark:text-white font-medium tracking-wide">
          Warehouse Sync Configuration
        </h1>
        <p className="text-xs text-gray-500 dark:text-[#888899] font-mono mt-1">
          Select data sync mode and configure warehouse storage endpoints
        </p>
      </div>

      {/* Mode Switcher — Exclusive Radio Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Local DB card */}
        <button
          type="button"
          id="mode-local-btn"
          onClick={() => {
            if (activeTab === "local") return; // already on this tab
            handleSwitchMode("local");
          }}
          disabled={activeTab === "local"}
          className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
            activeTab === "local"
              ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_16px_rgba(16,185,129,0.12)] cursor-default"
              : "border-gray-200 dark:border-white/10 hover:border-emerald-500/50 cursor-pointer"
          }`}
        >
          <div className={`mt-0.5 p-2 rounded-lg border ${
            activeTab === "local"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400"
          }`}>
            <Database className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Local Database</span>
              {activeTab === "local" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-[#888899] mt-0.5">
              Upload CSV / Excel file. Leads stored locally in SQLite.
            </p>
          </div>
          {/* Radio dot */}
          <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            activeTab === "local"
              ? "border-emerald-500"
              : "border-gray-300 dark:border-white/20"
          }`}>
            {activeTab === "local" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
          </div>
        </button>

        {/* Sheets card */}
        <button
          type="button"
          id="mode-sheets-btn"
          onClick={() => {
            if (activeTab === "sheets") return; // already on this tab
            handleSwitchMode("sheets");
          }}
          disabled={activeTab === "sheets"}
          className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
            activeTab === "sheets"
              ? "border-blue-500 bg-blue-500/5 shadow-[0_0_16px_rgba(59,130,246,0.12)] cursor-default"
              : "border-gray-200 dark:border-white/10 hover:border-blue-500/50 cursor-pointer"
          }`}
        >
          <div className={`mt-0.5 p-2 rounded-lg border ${
            activeTab === "sheets"
              ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
              : "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400"
          }`}>
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Google Sheets Sync</span>
              {activeTab === "sheets" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-500 border border-blue-500/30 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-[#888899] mt-0.5">
              Link a live Google Sheet. Data synced dynamically.
            </p>
          </div>
          {/* Radio dot */}
          <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            activeTab === "sheets"
              ? "border-blue-500"
              : "border-gray-300 dark:border-white/20"
          }`}>
            {activeTab === "sheets" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Active Mode Banner */}
        <div className={`rounded-xl p-5 border transition-all duration-300 ${
          isCurrentModeLocal
            ? "border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.02)]"
            : "border-blue-500/20 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.02)]"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              isCurrentModeLocal
                ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                : "bg-blue-500 shadow-[0_0_8px_#3b82f6]"
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-white">
                Active Source: {isCurrentModeLocal ? "Local CRM Database Layer" : "Google Sheets Live Connection"}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-[#888899] font-mono mt-0.5 truncate">
                {isCurrentModeLocal
                  ? "Dashboard is reading and writing leads locally inside SQLite database."
                  : `Syncing dynamically with Google Sheet: ${config.sheet_url}`}
              </p>
            </div>
          </div>
        </div>

        {/* Tab CONTENT: Local Database */}
        {activeTab === "local" && (
          <div className="space-y-6">
            {/* Database Status */}
            {dbStatus.loaded && (
              <div className="bg-white dark:bg-[#0C0C12]/20 rounded-xl p-6 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-white tracking-wide">
                        Stored CRM Records
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-[#888899]">
                        Total local rows and active schema column headers
                      </p>
                    </div>
                  </div>
                  {!isCurrentModeLocal && (
                    <button
                      type="button"
                      onClick={() => handleSwitchMode("local")}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-all shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                    >
                      Activate Local DB Mode
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                  <div className="p-4 bg-gray-55 dark:bg-white/2 rounded-lg border border-gray-100 dark:border-white/5">
                    <p className="text-[10px] font-mono uppercase text-gray-400 dark:text-[#555566]">Leads in SQLite</p>
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{dbStatus.row_count} records</h4>
                  </div>
                  <div className="p-4 bg-gray-55 dark:bg-white/2 rounded-lg border border-gray-100 dark:border-white/5 col-span-2">
                    <p className="text-[10px] font-mono uppercase text-gray-400 dark:text-[#555566]">Schema Columns</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {dbStatus.headers.map((h, idx) => (
                        <span key={`${h}-${idx}`} className="px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-[rgba(255,255,255,0.04)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-700 dark:text-[#dedee5] rounded">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Importer */}
            <div className="bg-white dark:bg-[#0C0C12]/20 rounded-xl p-6 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] shadow-xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white tracking-wide">
                    Spreadsheet Database Seeding
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-[#888899]">
                    Upload CSV or Excel file to populate SQLite and switch warehouse mode to Local Database
                  </p>
                </div>
              </div>

              <form onSubmit={handleImport} className="space-y-4">
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
                    dragActive
                      ? "border-emerald-500 bg-emerald-500/5"
                      : "border-gray-300 dark:border-white/10 hover:border-emerald-500/50 hover:bg-gray-55 dark:hover:bg-white/2"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileChange}
                  />
                  
                  <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 border border-emerald-500/10">
                    <Upload className="w-6 h-6 animate-pulse" />
                  </div>

                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-800 dark:text-white">
                      {file ? file.name : "Drag and drop your spreadsheet file here"}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-[#555566] mt-1">
                      Supports CSV (.csv) or Excel (.xlsx, .xls)
                    </p>
                  </div>
                </div>

                {file && (
                  <div className="rounded-lg p-4 bg-red-500/5 border border-red-500/20 text-red-400 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold">Warning:</span> Seeding this file will completely overwrite all local lead records. This will also automatically activate Local Database storage.
                    </div>
                  </div>
                )}

                {file && (
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[rgba(255,255,255,0.03)] dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-250 dark:border-[rgba(255,255,255,0.06)] text-gray-850 dark:text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="submit"
                      disabled={importing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
                    >
                      {importing ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Upload & Seed Database
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Tab CONTENT: Google Sheets Sync */}
        {activeTab === "sheets" && (
          <div className="space-y-6">
            {/* Google OAuth Login Gate */}
            <div className="bg-white dark:bg-[#0C0C12]/20 rounded-xl p-6 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19.875 3H4.125C3.504 3 3 3.504 3 4.125v15.75C3 20.496 3.504 21 4.125 21h15.75C20.496 21 21 20.496 21 19.875V4.125C21 3.504 20.496 3 19.875 3z" fill="#23A566"/>
                      <path d="M7.5 9.75h9v1.5h-9zm0 3h9v1.5h-9zm0 3h5.25v1.5H7.5z" fill="#fff"/>
                      <path d="M15 3v6h6L15 3z" fill="#16834F"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white tracking-wide">Google Sheets Authentication</h3>
                    {authStatus.loading ? (
                      <p className="text-xs text-gray-500 dark:text-[#888899]">Checking auth status...</p>
                    ) : authStatus.authenticated ? (
                      <div className="flex items-center gap-2 mt-1">
                        {authStatus.picture && (
                          <img
                            src={authStatus.picture}
                            alt={authStatus.name}
                            className="w-5 h-5 rounded-full border border-green-500/30"
                          />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-gray-800 dark:text-white">{authStatus.name}</p>
                          <p className="text-[10px] text-gray-500 dark:text-[#888899] font-mono">{authStatus.email}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-[#888899]">Connect your Google Account to authorize Google Sheets API v4 access.</p>
                    )}
                  </div>
                </div>

                {authStatus.authenticated && !authStatus.loading && (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                  >
                    Sign Out
                  </button>
                )}
              </div>

              {!authStatus.loading && !authStatus.authenticated && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full py-2.5 bg-white hover:bg-gray-150 text-gray-900 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                    </svg>
                    Sign in with Google
                  </button>
                </div>
              )}
            </div>

            {/* Google Sheets URLs */}
            <div className="bg-white dark:bg-[#0C0C12]/20 rounded-xl p-6 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] shadow-xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white tracking-wide">Sheets Connection</h3>
                  <p className="text-xs text-gray-500 dark:text-[#888899]">Link Google Sheet URL and target tab name</p>
                </div>
              </div>

              <form onSubmit={handleSaveSheets} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">Google Sheet URL</label>
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-gray-55 dark:bg-[rgba(255,255,255,0.02)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-800 dark:text-white font-mono placeholder-gray-400 dark:placeholder-[#555566] transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">Sheet Range Tab</label>
                    <input
                      type="text"
                      placeholder="Sheet1"
                      value={rangeInput}
                      onChange={(e) => setRangeInput(e.target.value)}
                      className="w-full px-4 py-2 text-sm bg-gray-55 dark:bg-[rgba(255,255,255,0.02)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-800 dark:text-white font-mono placeholder-gray-400 dark:placeholder-[#555566] transition-all outline-none"
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={handleTestSheets}
                      disabled={testing}
                      className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[rgba(255,255,255,0.03)] dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-805 dark:text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {testing ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> : <RefreshCw className="w-4 h-4 text-emerald-400" />}
                      Test Connection
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
                    >
                      {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Connection
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Test Results */}
            {testResult && testResult.tested && (
              <div className={`rounded-xl p-6 border transition-all duration-300 ${
                testResult.success 
                  ? "border-green-500/20 bg-green-500/5 shadow-[0_0_20px_rgba(16,185,129,0.03)]" 
                  : "border-red-500/20 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.03)]"
              }`}>
                <div className="flex items-start gap-4">
                  {testResult.success ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-3 flex-1 font-sans">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-white tracking-wide">
                        {testResult.success ? "Google Sheet connection successful" : "Sync Connection Failed"}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-[#888899] mt-1">
                        {testResult.success 
                          ? `Found ${testResult.row_count} records with ${testResult.headers.length} columns in range "${rangeInput}".`
                          : testResult.message || "Failed to fetch values. Confirm Sheet URL, sharing permissions, and API key configurations."}
                      </p>
                    </div>
                    {testResult.success && testResult.headers.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-[rgba(255,255,255,0.06)]">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-[#555566]">Detected Columns</label>
                        <div className="flex flex-wrap gap-1.5">
                          {testResult.headers.map((h, idx) => (
                            <span key={`${h}-${idx}`} className="px-2 py-0.5 text-[10px] font-mono bg-gray-150 dark:bg-[rgba(255,255,255,0.04)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-700 dark:text-[#dedee5] rounded">
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Daily Metrics Reports Card */}
      <div className="bg-white dark:bg-[#0C0C12]/20 rounded-xl p-6 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white tracking-wide">
              Daily Metrics Email Reports
            </h3>
            <p className="text-xs text-gray-500 dark:text-[#888899]">
              Configure recipients to receive a daily dashboard metrics snapshot at 11:30 AM (local time)
            </p>
          </div>
        </div>

        <form onSubmit={handleAddRecipient} className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="email"
                placeholder="recipient@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-2 text-sm bg-gray-55 dark:bg-[rgba(255,255,255,0.02)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-[#555566] transition-all outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </form>

        {/* Recipients List */}
        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">
            Active Recipients ({config.report_recipients?.length || 0})
          </p>
          {(!config.report_recipients || config.report_recipients.length === 0) ? (
            <p className="text-xs text-gray-400 dark:text-[#555566] italic py-1">
              No daily report recipients configured. Reports will not be sent.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5 border border-gray-100 dark:border-white/5 rounded-lg overflow-hidden bg-gray-55/30 dark:bg-white/1">
              {config.report_recipients.map((email) => (
                <div key={email} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-750 dark:text-gray-300 font-mono">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(email)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mandatory Form Fields Card */}
      <div className="bg-white dark:bg-[#0C0C12]/20 rounded-xl p-6 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white tracking-wide">
              Mandatory Lead Fields
            </h3>
            <p className="text-xs text-gray-500 dark:text-[#888899]">
              Define which CRM schema columns are required when users add or update leads
            </p>
          </div>
        </div>

        {dbStatus.headers.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-[#555566] italic">
            No columns detected. Please load/seed a database or link a sheet first.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">
              Select Required Columns
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {dbStatus.headers
                .filter((h) => h !== "_row_num" && h.toLowerCase() !== "no.")
                .map((header) => {
                  const isMandatory = config.mandatory_columns?.includes(header) || false;
                  return (
                    <label
                      key={header}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all duration-200 select-none ${
                        isMandatory
                          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.02)]"
                          : "border-gray-200 dark:border-white/5 bg-gray-55/30 dark:bg-white/1 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/10"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isMandatory}
                        onChange={() => handleToggleMandatory(header)}
                        className="rounded border-gray-300 dark:border-white/10 text-emerald-600 focus:ring-emerald-500/50 w-3.5 h-3.5 cursor-pointer accent-emerald-500"
                      />
                      <span className="truncate">{header}</span>
                    </label>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
