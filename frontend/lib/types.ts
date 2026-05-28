export interface SheetData {
  headers: string[];
  rows: Record<string, string>[];
  total: number;
  configured: boolean;
  is_mock?: boolean;
}

export interface Config {
  sheet_url: string;
  sheet_range: string;
  visible_columns: string[];
  column_order: string[];
  graphs: GraphConfig[];
}

export interface GraphConfig {
  id: string;
  type: "bar" | "line" | "pie" | "area";
  x_col: string;
  y_col: string;
  title: string;
}

export interface DashboardSummary {
  configured: boolean;
  kpis: { label: string; value: number | string; delta?: string | null }[];
  headers: string[];
  visible_columns: string[];
  column_order: string[];
  graphs: GraphConfig[];
}
