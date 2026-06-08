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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sent_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_key TEXT UNIQUE,
            sent_at TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            name TEXT,
            picture TEXT,
            last_login TEXT
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

def upsert_user(email: str, name: str, picture: str) -> str:
    """Upsert user information in database and return user's UUID."""
    import uuid
    if not email:
        return ""
    
    email_clean = email.strip().lower()
    now_str = datetime.utcnow().isoformat()
    
    # Check if user already exists
    user_id = None
    
    if is_supabase_enabled():
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        params = {
            "email": f"eq.{email_clean}",
            "select": "id"
        }
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    rows = res.json()
                    if rows:
                        user_id = rows[0].get("id")
        except Exception as e:
            print(f"Error querying user from Supabase: {e}")

    if not user_id:
        # SQLite fallback check or if Supabase check returned nothing
        init_db()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email_clean,))
        row = cursor.fetchone()
        conn.close()
        if row:
            user_id = row[0]
    
    # If user still doesn't have a UUID, generate one
    if not user_id:
        user_id = str(uuid.uuid4())

    # Upsert into Supabase
    if is_supabase_enabled():
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        body = {
            "id": user_id,
            "email": email_clean,
            "name": name,
            "picture": picture,
            "last_login": now_str
        }
        try:
            with httpx.Client(timeout=8.0) as client:
                # Upsert using POST with on_conflict parameter
                upsert_url = f"{url}?on_conflict=email"
                res = client.post(upsert_url, headers=headers, json=body)
                if res.status_code in [200, 201]:
                    return user_id
                else:
                    print(f"Supabase user upsert failed ({res.status_code}): {res.text}. Falling back to SQLite.")
        except Exception as e:
            print(f"Error upserting user to Supabase: {e}. Falling back to SQLite.")

    # SQLite fallback upsert
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO users (id, email, name, picture, last_login)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                name=excluded.name,
                picture=excluded.picture,
                last_login=excluded.last_login
        """, (user_id, email_clean, name, picture, now_str))
        conn.commit()
    except Exception as e:
        print(f"Failed to upsert user locally: {e}")
    finally:
        conn.close()

    return user_id
