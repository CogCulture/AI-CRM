"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, Database, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Config } from "@/lib/types";


export default function SheetConfigurator() {
  const [config, setConfig] = useState<Config>({
    sheet_url: "",
    sheet_range: "Sheet1",
    visible_columns: [],
    column_order: [],
    graphs: []
  });
  
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

  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; loading: boolean }>({
    authenticated: false,
    loading: true,
  });

  // Load config and check auth on mount
  useEffect(() => {
    async function load() {
      // 1. Fetch config settings
      try {
        const data = await api.getConfig();
        setConfig(data);
        setUrlInput(data.sheet_url || "");
        setRangeInput(data.sheet_range || "Sheet1");
        
        // If config already has a sheet, run a soft test connection
        if (data.sheet_url) {
          const res = await api.testConnection(data.sheet_url, data.sheet_range || "Sheet1");
          setTestResult({
            tested: true,
            success: res.ok,
            row_count: res.row_count,
            headers: res.headers,
            is_mock: res.is_mock
          });
        }
      } catch (err: any) {
        console.error("Failed to load config:", err);
      }

      // 2. Fetch auth status
      try {
        const auth = await api.getAuthStatus();
        setAuthStatus({ authenticated: auth.authenticated, loading: false });
      } catch (err) {
        console.error("Failed to check auth status:", err);
        setAuthStatus({ authenticated: false, loading: false });
      }

      // 3. Check for auth redirect parameters
      const params = new URLSearchParams(window.location.search);
      const authResult = params.get("auth");
      if (authResult === "success") {
        toast.success("Successfully logged in with Google!");
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          const auth = await api.getAuthStatus();
          setAuthStatus({ authenticated: auth.authenticated, loading: false });
        } catch {}
      } else if (authResult === "failure") {
        const errorMsg = params.get("error") || "Unknown error";
        toast.error(`Google Login failed: ${decodeURIComponent(errorMsg)}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    load();
  }, []);

  const handleGoogleSignIn = () => {
    const redirectUrl = `${window.location.origin}/admin`;
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    window.location.href = `${backendUrl}/api/sheets/auth?redirect_url=${encodeURIComponent(redirectUrl)}`;
  };

  const handleSignOut = async () => {
    try {
      await api.signOut();
      setAuthStatus({ authenticated: false, loading: false });
      toast.success("Signed out from Google");
      // Soft re-test connection (which will likely revert to mock data if it fails)
      if (urlInput.trim()) {
        handleTest();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to sign out");
    }
  };

  const handleTest = async () => {
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
        if (res.is_mock) {
          toast.warning("Syncing succeeded via demo Mock Database fallback.");
        } else {
          toast.success(`Connected! Found ${res.row_count} rows in ${rangeInput}`);
        }
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateConfig({
        sheet_url: urlInput.trim(),
        sheet_range: rangeInput.trim()
      });
      setConfig(prev => ({
        ...prev,
        sheet_url: urlInput.trim(),
        sheet_range: rangeInput.trim()
      }));
      toast.success("Sync configuration saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto animate-row-reveal">
      {/* Title */}
      <div>
        <h1 className="font-display text-4xl text-white font-medium tracking-wide">Sync Configuration</h1>
        <p className="text-xs text-[#888899] font-mono mt-1">Configure live sync endpoint from Google Sheets API v4</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Connection Status Banner */}
        <div className={`obsidian-glass rounded-xl p-5 border ${
          config.sheet_url && config.sheet_url !== "mock"
            ? "border-green-500/20 bg-green-500/5 shadow-[0_0_15px_rgba(16,185,129,0.02)]"
            : "border-amber-500/20 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.02)]"
        }`}>
          <div className="flex items-center gap-3">
            {config.sheet_url && config.sheet_url !== "mock" ? (
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#10b981]" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">
                {config.sheet_url && config.sheet_url !== "mock"
                  ? "Live Workspace Connected"
                  : "Not Connected — Playground Mode Active"}
              </p>
              <p className="text-[10px] text-[#888899] font-mono mt-0.5 truncate">
                {config.sheet_url && config.sheet_url !== "mock"
                  ? `URL: ${config.sheet_url} (Tab: ${config.sheet_range || "Sheet1"})`
                  : "Running on local Mock CRM campaign data. Enter a sheet URL below to connect."}
              </p>
            </div>
          </div>
        </div>

        {/* Google Account Connection Card */}
        <div className="obsidian-glass rounded-xl p-6 border border-[rgba(255,255,255,0.06)] bg-[#0C0C12]/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.991-6.014c1.648 0 3.125.667 4.2 1.74l3.15-3.15A10.36 10.36 0 0 0 13.99 1C8.473 1 4 5.474 4 11s4.473 10 9.991 10c6.046 0 9.99-4.25 9.99-10.16 0-.61-.06-1.125-.18-1.555H12.24z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">Google Account Authentication</h3>
                <p className="text-xs text-[#888899]">
                  {authStatus.loading 
                    ? "Checking authentication status..." 
                    : authStatus.authenticated 
                      ? "Connected to Google. You can now access your private sheets."
                      : "Connect your Google account to access private sheets securely."
                  }
                </p>
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
                className="w-full py-2.5 bg-white hover:bg-gray-100 text-gray-900 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48C21.68,11.83 21.56,11.39 21.35,11.1z" fill="#4285F4" />
                  <path d="M12,20.8c2.68,0 4.93,-0.89 6.58,-2.42l-3.3,-2.58c-0.91,0.61 -2.08,0.98 -3.28,0.98 -2.53,0 -4.68,-1.71 -5.44,-4.02H3.14v2.66C4.78,17.67 8.16,20.8 12,20.8z" fill="#34A853" />
                  <path d="M6.56,12.78c-0.19,-0.57 -0.3,-1.18 -0.3,-1.8c0,-0.62 0.11,-1.23 0.3,-1.8V6.52H3.14c-0.64,1.28 -1,2.72 -1,4.26c0,1.54 0.36,2.98 1,4.26l3.42,-2.26z" fill="#FBBC05" />
                  <path d="M12,5.18c1.46,0 2.77,0.5 3.8,1.49l2.84,-2.84C16.92,2.32 14.67,1.2 12,1.2C8.16,1.2 4.78,4.33 3.14,7.52l3.42,2.66C7.32,6.89 9.47,5.18 12,5.18z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}
        </div>

        {/* Sync Settings Card */}
        <div className="obsidian-glass rounded-xl p-6 border border-[rgba(255,255,255,0.06)] bg-[#0C0C12]/20 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">Sheets Connection</h3>
              <p className="text-xs text-[#888899]">Paste Google Sheet URL and define target Range tab name</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Sheet URL Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-[#888899]">Google Sheet URL</label>
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] focus:border-indigo-500 rounded-lg text-white font-mono placeholder-[#555566] transition-all outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Range Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-[#888899]">Sheet Range Tab</label>
                <input
                  type="text"
                  placeholder="Sheet1"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] focus:border-indigo-500 rounded-lg text-white font-mono placeholder-[#555566] transition-all outline-none"
                />
              </div>

              {/* Action Buttons inside columns */}
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="flex-1 py-2 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.06)] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {testing ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-indigo-400" />
                  )}
                  Test Connection
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-750 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] cursor-pointer"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Configuration
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Test Result Indicator Card */}
        {testResult && testResult.tested && (
          <div className={`obsidian-glass rounded-xl p-6 border transition-all duration-300 ${
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

              <div className="space-y-3 flex-1">
                <div>
                  <h4 className="text-sm font-semibold text-white tracking-wide">
                    {testResult.success 
                      ? testResult.is_mock 
                        ? "Mock database fallback active" 
                        : "Google Sheet connection successful" 
                      : "Sync Connection Failed"}
                  </h4>
                  <p className="text-xs text-[#888899] mt-1">
                    {testResult.success 
                      ? `Found ${testResult.row_count} records with ${testResult.headers.length} properties inside tab range "${rangeInput}".`
                      : testResult.message || "Failed to fetch values. Confirm Sheet URL, sharing permissions, and API key configurations."}
                  </p>
                </div>

                {testResult.success && testResult.headers.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-[#555566]">Detected Columns</label>
                    <div className="flex flex-wrap gap-1.5">
                      {testResult.headers.map((h, idx) => (
                        <span key={`${h}-${idx}`} className="px-2 py-0.5 text-[10px] font-mono bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[#dedee5] rounded">
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
    </div>
  );
}
