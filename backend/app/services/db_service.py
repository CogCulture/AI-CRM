import sqlite3
import os
import httpx
from datetime import datetime

# Local SQLite DB fallback path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "alerts.db")

# Supabase Credentials from Environment Variables
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

def is_supabase_enabled() -> bool:
    """Check if Supabase configurations are present."""
    return bool(SUPABASE_URL and SUPABASE_KEY)

def init_db():
    """Initialize local SQLite DB if active."""
    if is_supabase_enabled():
        return # Handled in Supabase dashboard SQL schema setup
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sent_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_key TEXT UNIQUE,
            sent_at TEXT
        )
    """)
    conn.commit()
    conn.close()

def get_lead_key(company: str, deadline: str) -> str:
    """Generate a unique string key based on company and deadline."""
    comp_clean = "".join(e for e in company if e.isalnum()).lower()
    dead_clean = "".join(e for e in deadline if e.isalnum()).lower()
    return f"{comp_clean}:{dead_clean}"

def has_sent_reminder(company: str, deadline: str) -> bool:
    """Check if a reminder has already been sent."""
    lead_key = get_lead_key(company, deadline)
    
    if is_supabase_enabled():
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/sent_alerts"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        params = {
            "lead_key": f"eq.{lead_key}",
            "select": "lead_key"
        }
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    rows = res.json()
                    return len(rows) > 0
                else:
                    print(f"Supabase check failed ({res.status_code}): {res.text}. Falling back to SQLite.")
        except Exception as e:
            print(f"Error querying Supabase: {e}. Falling back to SQLite.")

    # SQLite fallback
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM sent_alerts WHERE lead_key = ?", (lead_key,))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def mark_reminder_sent(company: str, deadline: str):
    """Mark a reminder as sent in the database to prevent duplicate alerts."""
    lead_key = get_lead_key(company, deadline)
    sent_at = datetime.utcnow().isoformat()
    
    if is_supabase_enabled():
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/sent_alerts"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates"
        }
        body = {
            "lead_key": lead_key,
            "sent_at": sent_at
        }
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.post(url, headers=headers, json=body)
                if res.status_code in [200, 201]:
                    return
                else:
                    print(f"Supabase insert failed ({res.status_code}): {res.text}. Recording locally.")
        except Exception as e:
            print(f"Error recording to Supabase: {e}. Recording locally.")

    # SQLite fallback
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT OR IGNORE INTO sent_alerts (lead_key, sent_at) VALUES (?, ?)", (lead_key, sent_at))
        conn.commit()
    except Exception as e:
        print(f"Failed to record reminder sent status locally: {e}")
    finally:
        conn.close()
