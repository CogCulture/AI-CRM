"use client";

import React, { Suspense } from "react";
import DashboardShell from "../../components/dashboard/DashboardShell";
import SheetConfigurator from "../../components/admin/SheetConfigurator";

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A0F] text-white">
        <div className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">Loading Configuration...</div>
      </div>
    }>
      <DashboardShell>
        <SheetConfigurator />
      </DashboardShell>
    </Suspense>
  );
}
