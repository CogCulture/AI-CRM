"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Compass, 
  BarChart2, 
  Database, 
  Settings, 
  HelpCircle, 
  LogOut 
} from "lucide-react";
import { ThemeToggle } from "../ThemeToggle";
import { api } from "../../lib/api";

interface DashboardShellProps {
  children: React.ReactNode;
}

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

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "dashboard";
  const [user, setUser] = useState<{ name: string; email: string; picture: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const status = await api.getAuthStatus();
        if (!status.authenticated) {
          router.replace("/login");
        } else if (status.email && !isWorkEmail(status.email)) {
          await api.signOut();
          router.replace("/login?error=work_email_required");
        } else {
          setUser({
            name: status.name || "Authorized User",
            email: status.email || "Google Account",
            picture: status.picture || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
          });
        }
      } catch (err) {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Tenders", href: "/dashboard?tab=tenders", icon: TrendingUp },
    { name: "Data Platform", href: "/dashboard?tab=data", icon: Database },
  ];

  const handleSignOut = async () => {
    try {
      await api.signOut();
      router.replace("/login");
    } catch (err) {
      router.replace("/login");
    }
  };

  if (loading) {
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
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">Verifying Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-[#0A0A0F] font-sans transition-colors duration-150">
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-gray-50 dark:bg-[#08080C] flex flex-col justify-between shrink-0 transition-colors duration-150">
        <div>
          {/* Brand Logo & Theme Toggle */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
                  <path d="M12 8a4 4 0 1 0 4 4" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                </svg>
              </div>
              <span className="font-sans text-xs tracking-[0.15em] font-bold text-gray-900 dark:text-white uppercase">
                UNIFYDATA
              </span>
            </div>
            <ThemeToggle />
          </div>

          {/* Nav Items */}
          <nav className="px-3 py-2 space-y-1">
            {navigation.map((item) => {
              const targetTab = item.href.includes("tab=") ? item.href.split("tab=")[1] : "dashboard";
              const isActive = pathname === "/dashboard" && currentTab === targetTab;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group relative ${
                    isActive
                      ? "text-emerald-700 dark:text-[#3CD395] bg-emerald-50 dark:bg-[#132A21] border border-emerald-200 dark:border-[#1E3F33]/40 shadow-[0_0_15px_rgba(16,185,129,0.02)]"
                      : "text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.02)] border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-150 group-hover:scale-105 ${isActive ? "text-emerald-600 dark:text-[#3CD395]" : "text-gray-400 dark:text-[#888899]"}`} />
                  {item.name}
                </Link>
              );
            })}

            <div className="my-4 border-t border-gray-200 dark:border-[rgba(255,255,255,0.06)]" />

            <Link
              href="/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group relative ${
                pathname === "/settings"
                  ? "text-emerald-700 dark:text-[#3CD395] bg-emerald-50 dark:bg-[#132A21] border border-emerald-200 dark:border-[#1E3F33]/40"
                  : "text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.02)] border border-transparent"
              }`}
            >
              <Settings className={`w-4 h-4 transition-transform duration-150 group-hover:scale-105 ${pathname === "/settings" ? "text-emerald-600 dark:text-[#3CD395]" : "text-gray-400 dark:text-[#888899]"}`} />
              Settings
            </Link>

            <Link
              href="/dashboard?tab=help"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.02)] border border-transparent"
            >
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-[#888899]" />
              Help
            </Link>
          </nav>
        </div>

        {/* User Profile Card at Bottom */}
        <div className="p-4 border-t border-gray-200 dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src={user?.picture} 
              alt={user?.name} 
              className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-[rgba(255,255,255,0.1)]"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">{user?.name}</p>
              <p className="text-[10px] text-gray-400 dark:text-[#555566] truncate font-mono mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="p-1 rounded text-gray-400 dark:text-[#555566] hover:text-red-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Core Layout Page Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
