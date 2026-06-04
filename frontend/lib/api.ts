import { SheetData, Config, DashboardSummary } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

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
  getSheetData: (bypassCache = false) => apiFetch<SheetData>(`/api/sheets/data${bypassCache ? "?bypass_cache=true" : ""}`),
  getDashboardSummary: (bypassCache = false) => apiFetch<DashboardSummary>(`/api/dashboard/summary${bypassCache ? "?bypass_cache=true" : ""}`),
  getConfig: () => apiFetch<Config>("/api/config/"),
  updateConfig: (b: Partial<Config>) =>
    apiFetch<Config>("/api/config/", { method: "PATCH", body: JSON.stringify(b) }),
  testConnection: (url: string, range: string = "Sheet1") =>
    apiFetch<{ ok: boolean; headers: string[]; row_count: number; is_mock?: boolean }>("/api/config/test-connection", {
      method: "POST",
      body: JSON.stringify({ sheet_url: url, sheet_range: range }),
    }),
  getAuthStatus: () => apiFetch<{
    authenticated: boolean;
    expired?: boolean;
    email?: string;
    name?: string;
    picture?: string;
  }>("/api/sheets/auth-status"),
  signOut: () => apiFetch<{ ok: boolean }>("/api/sheets/signout", { method: "POST" }),
  addLead: (leadData: Record<string, any>) =>
    apiFetch<{ ok: boolean }>("/api/sheets/lead", { method: "POST", body: JSON.stringify(leadData) }),
  updateLead: (rowNum: number, leadData: Record<string, any>) =>
    apiFetch<{ ok: boolean }>(`/api/sheets/lead/${rowNum}`, { method: "PUT", body: JSON.stringify(leadData) }),
  deleteLead: (rowNum: number) =>
    apiFetch<{ ok: boolean }>(`/api/sheets/lead/${rowNum}`, { method: "DELETE" }),
};
