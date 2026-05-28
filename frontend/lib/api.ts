import { SheetData, Config, DashboardSummary } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`API error ${res.status}: ${errText}`);
  }
  return res.json();
}

export const api = {
  getSheetData: () => apiFetch<SheetData>("/api/sheets/data"),
  getDashboardSummary: () => apiFetch<DashboardSummary>("/api/dashboard/summary"),
  getConfig: () => apiFetch<Config>("/api/config/"),
  updateConfig: (b: Partial<Config>) =>
    apiFetch<Config>("/api/config/", { method: "PATCH", body: JSON.stringify(b) }),
  testConnection: (url: string, range: string = "Sheet1") =>
    apiFetch<{ ok: boolean; headers: string[]; row_count: number; is_mock?: boolean }>("/api/config/test-connection", {
      method: "POST",
      body: JSON.stringify({ sheet_url: url, sheet_range: range }),
    }),
  getAuthStatus: () => apiFetch<{ authenticated: boolean; expired?: boolean }>("/api/sheets/auth-status"),
  signOut: () => apiFetch<{ ok: boolean }>("/api/sheets/signout", { method: "POST" }),
};
