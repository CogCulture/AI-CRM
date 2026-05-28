"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Compass, 
  BarChart2, 
  Database, 
  Settings, 
  HelpCircle, 
  MoreVertical 
} from "lucide-react";

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Revenue Analytics", href: "/dashboard?tab=revenue", icon: TrendingUp },
    { name: "Journeys", href: "/dashboard?tab=journeys", icon: Compass },
    { name: "Performance", href: "/dashboard?tab=performance", icon: BarChart2 },
    { name: "Data Platform", href: "/dashboard?tab=data", icon: Database },
  ];

  return (
    <div className="flex min-h-screen bg-[#0A0A0F] font-sans">
      {/* Sidebar */}
      <aside className="w-56 border-r border-[rgba(255,255,255,0.06)] bg-[#08080C] flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="p-5 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
                <path d="M12 8a4 4 0 1 0 4 4" strokeLinecap="round" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <span className="font-sans text-sm tracking-[0.15em] font-bold text-white uppercase">
              UNIFYDATA
            </span>
          </div>

          {/* Nav Items */}
          <nav className="px-3 py-2 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === "/dashboard" && item.name === "Dashboard";
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group relative ${
                    isActive
                      ? "text-[#3CD395] bg-[#132A21] border border-[#1E3F33]/40 shadow-[0_0_15px_rgba(16,185,129,0.02)]"
                      : "text-[#888899] hover:text-white hover:bg-[rgba(255,255,255,0.02)] border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-105 ${isActive ? "text-[#3CD395]" : "text-[#888899]"}`} />
                  {item.name}
                </Link>
              );
            })}

            <div className="my-4 border-t border-[rgba(255,255,255,0.06)]" />

            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group relative ${
                pathname === "/admin"
                  ? "text-[#3CD395] bg-[#132A21] border border-[#1E3F33]/40"
                  : "text-[#888899] hover:text-white hover:bg-[rgba(255,255,255,0.02)] border border-transparent"
              }`}
            >
              <Settings className={`w-4 h-4 transition-transform duration-200 group-hover:scale-105 ${pathname === "/admin" ? "text-[#3CD395]" : "text-[#888899]"}`} />
              Settings
            </Link>

            <Link
              href="/dashboard?tab=help"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group text-[#888899] hover:text-white hover:bg-[rgba(255,255,255,0.02)] border border-transparent"
            >
              <HelpCircle className="w-4 h-4 text-[#888899]" />
              Help
            </Link>
          </nav>
        </div>

        {/* User Profile Card at Bottom */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" 
              alt="Arlene Lane" 
              className="w-8 h-8 rounded-full object-cover border border-[rgba(255,255,255,0.1)]"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">Arlene Lane</p>
              <p className="text-[10px] text-[#555566] truncate font-mono mt-0.5">globex.com</p>
            </div>
          </div>
          <button className="p-1 rounded text-[#555566] hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
            <MoreVertical className="w-4 h-4" />
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
