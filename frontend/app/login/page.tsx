"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

// Check if email domain is a public/personal email provider
function isWorkEmail(email: string): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  const publicDomains = [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "aol.com",
    "icloud.com",
    "mail.com",
    "gmx.com",
    "yandex.com"
  ];
  return !publicDomains.includes(domain);
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A0F] text-white">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">Loading Security Gate...</span>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // 1. Parse query parameter errors
    const errorParam = searchParams.get("error");
    const authParam = searchParams.get("auth");

    if (errorParam) {
      setErrorMsg(decodeURIComponent(errorParam));
    } else if (authParam === "failure") {
      setErrorMsg("Google Sign-In failed. Please try again.");
    }

    // 2. Check if already authenticated
    async function checkExistingAuth() {
      try {
        const status = await api.getAuthStatus();
        if (status.authenticated && status.email) {
          if (isWorkEmail(status.email)) {
            // Already logged in with work email, send to dashboard
            router.replace("/dashboard");
          } else {
            // Logged in with personal email, sign out immediately
            await api.signOut();
            setErrorMsg("Work email is required. Please sign in with your corporate account.");
            setChecking(false);
          }
        } else {
          setChecking(false);
        }
      } catch (err) {
        setChecking(false);
      }
    }
    
    checkExistingAuth();
  }, [router, searchParams]);

  const handleGoogleSignIn = () => {
    setSigningIn(true);
    setErrorMsg(null);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    window.location.href = `${backendUrl}/api/sheets/auth?redirect_url=${encodeURIComponent(redirectUrl)}`;
  };

  if (checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A0F] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-10 w-10">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-10 w-10 bg-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </span>
          </div>
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400 animate-pulse">Initializing Security Gate...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0F] items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* Main glass card */}
      <div className="w-full max-w-md bg-[#0D0D15]/40 backdrop-blur-xl border border-[rgba(255,255,255,0.06)] rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 flex flex-col items-center">
        
        {/* Brand/Logo Section */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
              <path d="M12 8a4 4 0 1 0 4 4" strokeLinecap="round" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <span className="text-sm tracking-[0.2em] font-bold text-white uppercase">
            UNIFYDATA
          </span>
        </div>

        {/* Title & Subtitle */}
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
          <p className="text-xs text-[#888899] max-w-[280px] mx-auto leading-relaxed">
            Please authenticate using your official company Google Workspace account.
          </p>
        </div>

        {/* Alert/Error Container */}
        {errorMsg && (
          <div className="w-full mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-start gap-3 animate-head-shake">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-200/90 leading-relaxed font-sans">
              {errorMsg === "work_email_required" 
                ? "Work email is required. Personal accounts (Gmail, Yahoo, etc.) are restricted."
                : errorMsg}
            </div>
          </div>
        )}

        {/* Google Authentication Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={signingIn}
          className="w-full py-3 px-4 bg-white hover:bg-gray-150 disabled:bg-white/90 text-gray-900 text-sm font-semibold rounded-xl flex items-center justify-center gap-3 transition-all cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.08)] hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] select-none"
        >
          {signingIn ? (
            <RefreshCw className="w-4 h-4 animate-spin text-gray-900" />
          ) : (
            <svg className="w-4.5 h-4.5" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
          )}
          {signingIn ? "Connecting Google Account..." : "Sign in with Google"}
        </button>

        {/* Footer Brand Notes */}
        <div className="mt-8 flex items-center gap-1.5 text-[10px] text-[#555566] font-mono">
          <Sparkles className="w-3 h-3 text-emerald-500/40" />
          <span>Secured with OAuth 2.0 & SSL encryption</span>
        </div>
      </div>
    </div>
  );
}
