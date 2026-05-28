# 🚀 ANTIGRAVITY CRM DASHBOARD — SENIOR ENGINEERING BUILD PROMPT

---

## PROJECT OVERVIEW

Build a **production-grade, full-stack CRM Dashboard** with:
- **Backend**: Python + FastAPI (with `venv`)
- **Frontend**: Next.js 14 (App Router)
- **Data Source**: Live Google Sheets via Google Sheets API v4
- **Admin Panel**: Separate `/admin` route to configure Sheet URL + column visibility
- **Design**: Modern · Minimal · Luxurious · Dark-first · Playground UI

---

## DIRECTORY STRUCTURE

```
crm-dashboard/
├── backend/
│   ├── venv/                        # Python virtual environment (gitignored)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI entrypoint
│   │   ├── config.py                # Settings via pydantic-settings
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── sheets.py            # Google Sheets fetch + parse
│   │   │   ├── config_router.py     # Admin config CRUD (sheet URL, columns)
│   │   │   └── dashboard.py        # Aggregated dashboard data endpoint
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── sheets_service.py    # Google Sheets API v4 logic
│   │   │   └── config_service.py    # Read/write config.json or SQLite
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── sheet_config.py      # Pydantic models
│   │   │   └── dashboard.py        # Dashboard response models
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── cache.py             # TTL in-memory cache for sheet data
│   ├── config_store.json            # Persisted admin config (sheet URL, visible columns)
│   ├── requirements.txt
│   ├── .env.example
│   └── .env                         # GOOGLE_CREDENTIALS_JSON, etc. (gitignored)
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx               # Root layout, font imports, global CSS
│   │   ├── page.tsx                 # Redirect → /dashboard
│   │   ├── dashboard/
│   │   │   ├── page.tsx             # Main CRM Dashboard page
│   │   │   └── loading.tsx          # Skeleton loader
│   │   └── admin/
│   │       ├── page.tsx             # Admin config panel
│   │       └── loading.tsx
│   ├── components/
│   │   ├── ui/                      # Primitives: Button, Badge, Input, Modal, Tooltip
│   │   ├── dashboard/
│   │   │   ├── DashboardShell.tsx   # Layout wrapper with sidebar
│   │   │   ├── MetricCard.tsx       # KPI cards (animated number)
│   │   │   ├── CRMTable.tsx         # Dynamic table with column toggle
│   │   │   ├── ColumnManager.tsx    # Add/Remove/Reorder column drawer
│   │   │   ├── GraphPanel.tsx       # Recharts/Chart.js graph container
│   │   │   ├── GraphBuilder.tsx     # "Add Graph" — pick X/Y axis + chart type
│   │   │   └── EmptyState.tsx       # No sheet configured state
│   │   └── admin/
│   │       ├── SheetConfigurator.tsx  # Paste sheet URL, test connection
│   │       └── ColumnVisibility.tsx   # Toggle columns on/off globally
│   ├── lib/
│   │   ├── api.ts                   # Typed fetch wrappers for FastAPI
│   │   ├── types.ts                 # Shared TypeScript types
│   │   └── utils.ts                 # cn(), formatters, etc.
│   ├── hooks/
│   │   ├── useSheetData.ts          # SWR hook for polling sheet data
│   │   └── useDashboardConfig.ts    # Column/graph config from localStorage + API
│   ├── public/
│   ├── .env.local.example
│   ├── .env.local                   # NEXT_PUBLIC_API_URL (gitignored)
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## STEP 1 — BACKEND SETUP

### 1.1 Virtual Environment + Dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install --upgrade pip

pip install \
  fastapi==0.111.0 \
  uvicorn[standard]==0.29.0 \
  pydantic==2.7.1 \
  pydantic-settings==2.2.1 \
  google-auth==2.29.0 \
  google-auth-oauthlib==1.2.0 \
  google-api-python-client==2.128.0 \
  python-dotenv==1.0.1 \
  httpx==0.27.0 \
  cachetools==5.3.3 \
  python-multipart==0.0.9

pip freeze > requirements.txt
```

### 1.2 `.env`

```env
GOOGLE_CREDENTIALS_JSON=./credentials.json   # Service account key path
GOOGLE_API_KEY=                              # OR use API key for public sheets
CONFIG_STORE_PATH=./config_store.json
CORS_ORIGINS=http://localhost:3000
CACHE_TTL_SECONDS=60
```

### 1.3 `app/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    google_credentials_json: Optional[str] = None
    google_api_key: Optional[str] = None
    config_store_path: str = "./config_store.json"
    cors_origins: list[str] = ["http://localhost:3000"]
    cache_ttl_seconds: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
```

### 1.4 `app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import sheets, config_router, dashboard

app = FastAPI(title="CRM Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sheets.router,        prefix="/api/sheets",    tags=["Sheets"])
app.include_router(config_router.router, prefix="/api/config",    tags=["Config"])
app.include_router(dashboard.router,     prefix="/api/dashboard", tags=["Dashboard"])

@app.get("/health")
def health(): return {"status": "ok"}
```

### 1.5 `app/services/config_service.py`

```python
import json, os
from app.config import settings

DEFAULT_CONFIG = {
    "sheet_url": "",
    "sheet_id": "",
    "sheet_range": "Sheet1",
    "visible_columns": [],      # [] = all visible
    "column_order": [],
    "graphs": []                # [{ id, type, x_col, y_col, title }]
}

def _path(): return settings.config_store_path

def load_config() -> dict:
    if not os.path.exists(_path()):
        save_config(DEFAULT_CONFIG)
    with open(_path(), "r") as f:
        return json.load(f)

def save_config(config: dict):
    with open(_path(), "w") as f:
        json.dump(config, f, indent=2)

def update_config(partial: dict) -> dict:
    cfg = load_config()
    cfg.update(partial)
    save_config(cfg)
    return cfg
```

### 1.6 `app/services/sheets_service.py`

```python
import re
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from google.oauth2 import service_account
from cachetools import TTLCache
from app.config import settings

_cache = TTLCache(maxsize=10, ttl=settings.cache_ttl_seconds)

def _extract_sheet_id(url: str) -> str:
    """Extract Google Sheet ID from URL."""
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
    if not match:
        raise ValueError(f"Cannot extract Sheet ID from URL: {url}")
    return match.group(1)

def _get_service():
    if settings.google_credentials_json:
        creds = Credentials.from_service_account_file(
            settings.google_credentials_json,
            scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
        )
        return build("sheets", "v4", credentials=creds, cache_discovery=False)
    elif settings.google_api_key:
        return build("sheets", "v4", developerKey=settings.google_api_key, cache_discovery=False)
    raise RuntimeError("No Google credentials configured")

def fetch_sheet_data(sheet_url: str, range_name: str = "Sheet1") -> dict:
    """Returns { headers: [...], rows: [[...], ...], total: int }"""
    cache_key = f"{sheet_url}:{range_name}"
    if cache_key in _cache:
        return _cache[cache_key]

    sheet_id = _extract_sheet_id(sheet_url)
    service = _get_service()
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=sheet_id, range=range_name)
        .execute()
    )

    values = result.get("values", [])
    if not values:
        return {"headers": [], "rows": [], "total": 0}

    headers = values[0]
    rows = values[1:]

    # Normalize rows to match header length
    normalized = [
        {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}
        for row in rows
    ]

    data = {"headers": headers, "rows": normalized, "total": len(normalized)}
    _cache[cache_key] = data
    return data
```

### 1.7 `app/routers/config_router.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.services import config_service

router = APIRouter()

class ConfigUpdate(BaseModel):
    sheet_url: Optional[str] = None
    sheet_range: Optional[str] = None
    visible_columns: Optional[List[str]] = None
    column_order: Optional[List[str]] = None
    graphs: Optional[List[dict]] = None

@router.get("/")
def get_config():
    return config_service.load_config()

@router.patch("/")
def update_config(body: ConfigUpdate):
    updates = body.model_dump(exclude_none=True)
    return config_service.update_config(updates)

@router.post("/test-connection")
def test_connection(body: dict):
    """Test if a sheet URL is accessible before saving."""
    from app.services.sheets_service import fetch_sheet_data
    try:
        data = fetch_sheet_data(body.get("sheet_url", ""), "Sheet1")
        return {"ok": True, "headers": data["headers"], "row_count": data["total"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### 1.8 `app/routers/sheets.py`

```python
from fastapi import APIRouter, HTTPException
from app.services import config_service, sheets_service

router = APIRouter()

@router.get("/data")
def get_sheet_data():
    cfg = config_service.load_config()
    if not cfg.get("sheet_url"):
        return {"headers": [], "rows": [], "total": 0, "configured": False}
    try:
        data = sheets_service.fetch_sheet_data(cfg["sheet_url"], cfg.get("sheet_range", "Sheet1"))
        data["configured"] = True
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 1.9 `app/routers/dashboard.py`

```python
from fastapi import APIRouter
from app.services import config_service, sheets_service

router = APIRouter()

@router.get("/summary")
def get_summary():
    """Returns KPI-ready summary from sheet data."""
    cfg = config_service.load_config()
    if not cfg.get("sheet_url"):
        return {"kpis": [], "configured": False}

    data = sheets_service.fetch_sheet_data(cfg["sheet_url"], cfg.get("sheet_range", "Sheet1"))
    total_rows = data["total"]

    # Basic KPI derivation (extend as needed per actual columns)
    kpis = [{"label": "Total Records", "value": total_rows, "delta": None}]

    return {
        "configured": True,
        "kpis": kpis,
        "headers": data["headers"],
        "visible_columns": cfg.get("visible_columns", []),
        "column_order": cfg.get("column_order", []),
        "graphs": cfg.get("graphs", []),
    }
```

---

## STEP 2 — FRONTEND SETUP

### 2.1 Init Next.js Project

```bash
cd frontend
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```

### 2.2 Install Dependencies

```bash
npm install \
  swr \
  recharts \
  @radix-ui/react-dialog \
  @radix-ui/react-tooltip \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-switch \
  @radix-ui/react-select \
  @dnd-kit/core \
  @dnd-kit/sortable \
  @dnd-kit/utilities \
  clsx \
  tailwind-merge \
  lucide-react \
  framer-motion \
  sonner
```

### 2.3 `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2.4 `lib/api.ts`

```typescript
const BASE = process.env.NEXT_PUBLIC_API_URL;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  getSheetData: ()           => apiFetch<SheetData>("/api/sheets/data"),
  getDashboardSummary: ()    => apiFetch<DashboardSummary>("/api/dashboard/summary"),
  getConfig: ()              => apiFetch<Config>("/api/config/"),
  updateConfig: (b: Partial<Config>) =>
    apiFetch<Config>("/api/config/", { method: "PATCH", body: JSON.stringify(b) }),
  testConnection: (url: string) =>
    apiFetch("/api/config/test-connection", {
      method: "POST",
      body: JSON.stringify({ sheet_url: url }),
    }),
};
```

### 2.5 `lib/types.ts`

```typescript
export interface SheetData {
  headers: string[];
  rows: Record<string, string>[];
  total: number;
  configured: boolean;
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
  kpis: { label: string; value: number | string; delta?: number | null }[];
  headers: string[];
  visible_columns: string[];
  column_order: string[];
  graphs: GraphConfig[];
}
```

---

## STEP 3 — FRONTEND DESIGN SYSTEM

### Design Direction
**Aesthetic**: `Dark Luxury · Obsidian Glass · Editorial CRM`
- Background: near-black `#0A0A0F` with subtle grain texture
- Surface cards: `rgba(255,255,255,0.04)` glass with `1px solid rgba(255,255,255,0.08)` borders
- Accent: Electric Indigo `#6366F1` with `#A5B4FC` highlights
- Typography: `Instrument Serif` (headings) + `DM Mono` (data/numbers) + `Geist` (body)
- Motion: Framer Motion layout animations, staggered table row reveals
- Tables: sticky headers, alternating `rgba` row tints, hover highlight glow
- Charts: dark-mode Recharts with custom tooltips, grid lines `rgba(255,255,255,0.06)`

### 3.1 `tailwind.config.ts` — extend with custom tokens

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "rgba(255,255,255,0.04)",
        border:  "rgba(255,255,255,0.08)",
        accent:  "#6366F1",
        "accent-light": "#A5B4FC",
        base:    "#0A0A0F",
        "text-primary":   "#F1F1F5",
        "text-secondary": "#888899",
      },
      fontFamily: {
        display: ["Instrument Serif", "serif"],
        mono:    ["DM Mono", "monospace"],
        sans:    ["Geist", "sans-serif"],
      },
      backgroundImage: {
        "noise": "url('/noise.svg')",
      },
    },
  },
  plugins: [],
};
export default config;
```

---

## STEP 4 — KEY COMPONENT SPECS

### `CRMTable.tsx` — Dynamic Table
- Renders only `visible_columns` (or all if empty)
- Column order respects `column_order` array (drag-to-reorder via `@dnd-kit`)
- Top-right: `+ Add Column` button → opens `ColumnManager` drawer
- Sticky header row with sort indicators
- Row count badge in table footer
- Framer Motion: `AnimatePresence` on column add/remove

### `ColumnManager.tsx` — Column Drawer
- Slide-in from right (`framer-motion`)
- Checkbox list of all available headers
- Drag handles to reorder
- `Save` → PATCH `/api/config/` with new `visible_columns` + `column_order`

### `GraphPanel.tsx` — Graph Grid
- CSS grid of graph cards (2-col default, responsive)
- Each card: title, chart, resize handle
- Top-right: `+ Add Graph` button → opens `GraphBuilder` modal

### `GraphBuilder.tsx` — Graph Modal
- Select chart type (Bar / Line / Area / Pie) with icon buttons
- Select X column (dropdown from headers)
- Select Y column (dropdown, filtered to likely-numeric cols)
- Title input
- Preview renders live inside modal
- Save → appends to `graphs` config, PATCH to API

### `SheetConfigurator.tsx` — Admin Panel
- Input for Google Sheet URL (full URL accepted, ID extracted server-side)
- `Test Connection` → calls `/api/config/test-connection` → shows green tick + row count
- Sheet Range input (default: `Sheet1`)
- `Save Configuration` → PATCH config
- Status badge: `Connected · 243 rows · Last synced 30s ago`

### `MetricCard.tsx` — KPI Cards
- Animated number counter on mount (framer-motion)
- Subtle upward/downward delta indicator
- Glass card with accent glow on hover

---

## STEP 5 — RUN LOCALLY

### Backend
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm run dev
# → http://localhost:3000
```

---

## STEP 6 — GOOGLE SHEETS AUTH

### Option A — Service Account (Recommended for production)
1. GCP Console → Create Service Account
2. Download JSON key → save as `backend/credentials.json`
3. Share your Google Sheet with the service account email (`...@project.iam.gserviceaccount.com`) as Viewer
4. Set `GOOGLE_CREDENTIALS_JSON=./credentials.json` in `.env`

### Option B — API Key (Public sheets only)
1. GCP Console → APIs & Services → Credentials → Create API Key
2. Restrict to Google Sheets API
3. Set `GOOGLE_API_KEY=your_key` in `.env`
4. Sheet must be published: File → Share → Publish to web

---

## STEP 7 — `.gitignore`

```
# Backend
backend/venv/
backend/.env
backend/credentials.json
backend/config_store.json

# Frontend
frontend/.env.local
frontend/node_modules/
frontend/.next/

# General
.DS_Store
*.pyc
__pycache__/
```

---

## STEP 8 — README.md

````markdown
# CRM Dashboard

> Obsidian-dark, live Google Sheets-powered CRM playground.

## Stack
- **Backend**: Python 3.11 · FastAPI · Google Sheets API v4
- **Frontend**: Next.js 14 App Router · TypeScript · Tailwind CSS · Recharts · Framer Motion

## Quick Start

### Backend
```bash
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in credentials
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend && npm install
cp .env.local.example .env.local
npm run dev
```

## Admin Panel
Navigate to `/admin` to:
- Paste your Google Sheet URL
- Test the connection
- Toggle visible columns

## Dashboard
Navigate to `/dashboard` to:
- View live data from your sheet
- Add/remove/reorder columns
- Build graphs (Bar, Line, Area, Pie) from any two columns
````

---

## ENGINEERING PRINCIPLES APPLIED

| Principle | Implementation |
|---|---|
| Separation of concerns | `routers/` → HTTP, `services/` → business logic, `models/` → types |
| Config-driven UI | All column/graph state persisted in `config_store.json` via API |
| Live data | SWR `refreshInterval: 30000` polls sheet data every 30s |
| Caching | TTL in-memory cache (`cachetools`) prevents Google API rate limiting |
| Type safety | Pydantic v2 (backend) + TypeScript strict mode (frontend) |
| Graceful empty states | `configured: false` flag renders onboarding prompt in dashboard |
| No hardcoding | All sheet config is runtime-configurable via Admin UI |
| DX | Hot reload both sides, `.env.example` committed, venv isolated |

---

> **Next steps after scaffold**: Add OAuth2 for admin auth, PostgreSQL for config persistence, WebSocket for real-time sheet push, and Vercel + Railway deploys.
