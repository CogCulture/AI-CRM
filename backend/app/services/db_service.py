import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "alerts.db")

def init_db():
    """Initialize the SQLite database and create the sent_alerts table if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sent_alerts (
            id INTEGER PRIMARY KEY AUTOCT_INCREMENT,
            lead_key TEXT UNIQUE,
            sent_at TEXT
        )
    """.replace("AUTOCT_INCREMENT", "AUTOINCREMENT"))  # Typo safety
    conn.commit()
    conn.close()

def get_lead_key(company: str, deadline: str) -> str:
    """Generate a unique string key based on company and deadline to identify a lead notification event."""
    comp_clean = "".join(e for e in company if e.isalnum()).lower()
    dead_clean = "".join(e for e in deadline if e.isalnum()).lower()
    return f"{comp_clean}:{dead_clean}"

def has_sent_reminder(company: str, deadline: str) -> bool:
    """Check if a reminder has already been sent for the given lead and deadline."""
    init_db()
    lead_key = get_lead_key(company, deadline)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM sent_alerts WHERE lead_key = ?", (lead_key,))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def mark_reminder_sent(company: str, deadline: str):
    """Mark a reminder as sent in the database to prevent duplicate alerts."""
    init_db()
    lead_key = get_lead_key(company, deadline)
    sent_at = datetime.utcnow().isoformat()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT OR IGNORE INTO sent_alerts (lead_key, sent_at) VALUES (?, ?)", (lead_key, sent_at))
        conn.commit()
    except Exception as e:
        print(f"Failed to record reminder sent status: {e}")
    finally:
        conn.close()
