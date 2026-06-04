"use client";

import React, { useState } from "react";
import DashboardShell from "../../components/dashboard/DashboardShell";
import { User, Bell, Sliders, Shield, Palette } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../lib/api";

export default function SettingsPage() {
  const [profile, setProfile] = React.useState({
    name: "Loading...",
    email: "Loading...",
    role: "CRM Administrator",
  });

  React.useEffect(() => {
    async function loadProfile() {
      try {
        const status = await api.getAuthStatus();
        if (status.authenticated) {
          setProfile({
            name: status.name || "Authorized User",
            email: status.email || "Google Account",
            role: "CRM Administrator",
          });
        }
      } catch (err) {
        console.error("Failed to load user profile in settings:", err);
      }
    }
    loadProfile();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Preferences updated successfully!");
  };

  return (
    <DashboardShell>
      <div className="space-y-8 max-w-3xl mx-auto animate-row-reveal">
        {/* Title */}
        <div>
          <h1 className="font-sans text-3xl text-white font-bold tracking-tight">System Settings</h1>
          <p className="text-xs text-[#888899] font-mono mt-1">Configure your personal preferences and dashboard interface options</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Profile Card */}
          <div className="obsidian-glass rounded-xl p-6 border border-[rgba(255,255,255,0.06)] bg-[#0C0C12]/20 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">User Profile</h3>
                <p className="text-xs text-[#888899]">Your personal account details</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5 col-span-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#888899]">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] focus:border-indigo-500 rounded-lg text-white font-mono outline-none"
                />
              </div>

              <div className="space-y-1.5 col-span-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#888899]">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-3.5 py-2 text-xs bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.04)] rounded-lg text-[#555566] font-mono outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#888899]">Access Role</label>
                <input
                  type="text"
                  value={profile.role}
                  disabled
                  className="w-full px-3.5 py-2 text-xs bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.04)] rounded-lg text-[#555566] font-mono outline-none cursor-not-allowed"
                />
              </div>

              <div className="col-span-2 pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>

          {/* Preferences Card */}
          <div className="obsidian-glass rounded-xl p-6 border border-[rgba(255,255,255,0.06)] bg-[#0C0C12]/20 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">Display Options</h3>
                <p className="text-xs text-[#888899]">Customize theme, color accents and layouts</p>
              </div>
            </div>

            <div className="space-y-4 pt-2 font-sans text-xs">
              <div className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.04)]">
                <div>
                  <p className="text-white font-medium">Dark Mode first theme</p>
                  <p className="text-[10px] text-[#555566]">Force obsidian-dark UI colors</p>
                </div>
                <div className="w-8 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 relative flex items-center justify-end px-0.5 cursor-pointer">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#3CD395] shadow-md" />
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.04)]">
                <div>
                  <p className="text-white font-medium">Compact Table Mode</p>
                  <p className="text-[10px] text-[#555566]">Optimize CRM rows height to fit more data</p>
                </div>
                <div className="w-8 h-4 rounded-full bg-white/5 border border-white/10 relative flex items-center justify-start px-0.5 cursor-pointer">
                  <div className="w-3.5 h-3.5 rounded-full bg-gray-500 shadow-md" />
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-white font-medium">Auto Refresh Data</p>
                  <p className="text-[10px] text-[#555566]">Automatically fetch fresh workspace metrics every 60s</p>
                </div>
                <div className="w-8 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 relative flex items-center justify-end px-0.5 cursor-pointer">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#3CD395] shadow-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
