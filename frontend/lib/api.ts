import { SheetData, Config, DashboardSummary } from "./types";

const BASE = "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`API error ${res.status}: ${errText}`);
  }
  return res.json();
}

export const api = {
  getSheetData: (bypassCache = false, sheetRange?: string) => {
    const params = new URLSearchParams();
    if (bypassCache) params.set("bypass_cache", "true");
    if (sheetRange) params.set("sheet_range", sheetRange);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<SheetData>(`/api/sheets/data${query}`);
  },
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
    id?: string;
    expired?: boolean;
    email?: string;
    name?: string;
    picture?: string;
  }>("/api/sheets/auth-status"),
  signOut: () => apiFetch<{ ok: boolean }>("/api/sheets/signout", { method: "POST" }),
  disconnectSheets: () => apiFetch<{ ok: boolean }>("/api/sheets/disconnect-sheets", { method: "POST" }),
  addLead: (leadData: Record<string, any>, sheetRange?: string) =>
    apiFetch<{ ok: boolean }>(`/api/sheets/lead${sheetRange ? `?sheet_range=${encodeURIComponent(sheetRange)}` : ""}`, { method: "POST", body: JSON.stringify(leadData) }),
  updateLead: (rowNum: number, leadData: Record<string, any>, sheetRange?: string) =>
    apiFetch<{ ok: boolean }>(`/api/sheets/lead/${rowNum}${sheetRange ? `?sheet_range=${encodeURIComponent(sheetRange)}` : ""}`, { method: "PUT", body: JSON.stringify(leadData) }),
  deleteLead: (rowNum: number, sheetRange?: string) =>
    apiFetch<{ ok: boolean }>(`/api/sheets/lead/${rowNum}${sheetRange ? `?sheet_range=${encodeURIComponent(sheetRange)}` : ""}`, { method: "DELETE" }),
  importLeads: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`/api/sheets/import`, {
      method: "POST",
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`Import error ${res.status}: ${errText}`);
      }
      return res.json();
    });
  },
  triggerDailyLeadsDigest: (overrideRecipient?: string) =>
    apiFetch<any>(`/api/dashboard/trigger-daily-leads-digest${overrideRecipient ? `?override_recipient=${encodeURIComponent(overrideRecipient)}` : ""}`, { method: "POST" }),
  triggerProposalsFollowupAlert: (overrideRecipient?: string) =>
    apiFetch<any>(`/api/dashboard/trigger-proposals-followup-alert${overrideRecipient ? `?override_recipient=${encodeURIComponent(overrideRecipient)}` : ""}`, { method: "POST" }),
  previewDailyLeadsDigest: (overrideRecipient?: string) =>
    apiFetch<{ subject: string; html: string; recipients: string[]; is_test_mode: boolean; new_leads_count: number; hot_leads_count: number }>(`/api/dashboard/preview-daily-leads-digest${overrideRecipient ? `?override_recipient=${encodeURIComponent(overrideRecipient)}` : ""}`),
  previewProposalsFollowupAlert: (overrideRecipient?: string) =>
    apiFetch<{ subject: string; html: string; recipients: string[]; is_test_mode: boolean; proposals_today_count: number; followups_due_count: number }>(`/api/dashboard/preview-proposals-followup-alert${overrideRecipient ? `?override_recipient=${encodeURIComponent(overrideRecipient)}` : ""}`),
};

