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

      // 3. Check for auth redirect parameters
      const params = new URLSearchParams(window.location.search);
      const authResult = params.get("auth");
      if (authResult === "success") {
        toast.success("Successfully logged in with Google!");
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          const auth = await api.getAuthStatus();
          setAuthStatus({
            authenticated: auth.authenticated,
            loading: false,
            email: auth.email,
            name: auth.name,
            picture: auth.picture,
          });
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
              {/* Correct Google Sheets Logo */}
              <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.875 3H4.125C3.504 3 3 3.504 3 4.125v15.75C3 20.496 3.504 21 4.125 21h15.75C20.496 21 21 20.496 21 19.875V4.125C21 3.504 20.496 3 19.875 3z" fill="#23A566"/>
                  <path d="M7.5 9.75h9v1.5h-9zm0 3h9v1.5h-9zm0 3h5.25v1.5H7.5z" fill="#fff"/>
                  <path d="M15 3v6h6L15 3z" fill="#16834F"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">Google Account Authentication</h3>
                {authStatus.loading ? (
                  <p className="text-xs text-[#888899]">Checking authentication status...</p>
                ) : authStatus.authenticated ? (
                  <div className="flex items-center gap-2 mt-1">
                    {authStatus.picture && (
                      <img
                        src={authStatus.picture}
                        alt={authStatus.name || "Google Account"}
                        className="w-5 h-5 rounded-full border border-green-500/30"
                      />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-white">{authStatus.name || "Google Account"}</p>
                      <p className="text-[10px] text-[#888899] font-mono">{authStatus.email || "Connected"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#888899]">Connect your Google account to access private sheets securely.</p>
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
                className="w-full py-2.5 bg-white hover:bg-gray-100 text-gray-900 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              >
                {/* Correct Official Google G Logo */}
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

        {/* Sync Settings Card */}
        <div className="obsidian-glass rounded-xl p-6 border border-[rgba(255,255,255,0.06)] bg-[#0C0C12]/20 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
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
                className="w-full px-4 py-2.5 text-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-white font-mono placeholder-[#555566] transition-all outline-none"
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
                  className="w-full px-4 py-2 text-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-white font-mono placeholder-[#555566] transition-all outline-none"
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
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                  )}
                  Test Connection
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-750 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
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
