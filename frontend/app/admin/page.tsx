"use client";

import React from "react";
import DashboardShell from "../../components/dashboard/DashboardShell";
import SheetConfigurator from "../../components/admin/SheetConfigurator";

export default function AdminPage() {
  return (
    <DashboardShell>
      <SheetConfigurator />
    </DashboardShell>
  );
}
