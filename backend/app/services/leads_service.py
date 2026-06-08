import sqlite3
import json
import httpx
from datetime import datetime
from app.services.db_service import DB_PATH, init_db, SUPABASE_URL, SUPABASE_KEY, is_supabase_enabled
from app.services import config_service

def _supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """)
    conn.commit()
    conn.row_factory = sqlite3.Row
    return conn

def get_all_leads() -> dict:
    """Fetch all leads from Supabase or SQLite fallback."""
    cfg = config_service.load_config()
    headers = cfg.get("headers", cfg.get("column_order", []))
    if not headers:
        headers = ["Date", "Company", "Status", "Stage", "Deadline", "Cog POC", "POC email", "Value"]
        config_service.update_config({"headers": headers})

    rows = []

    if is_supabase_enabled():
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/leads"
        params = {
            "select": "id,data",
            "order": "id.asc"
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=_supabase_headers(), params=params)
                if res.status_code == 200:
                    db_rows = res.json()
                    for r in db_rows:
                        lead_data = r.get("data") or {}
                        lead_data["_row_num"] = r["id"] # Map primary key id to _row_num
                        rows.append(lead_data)
                else:
                    print(f"Supabase leads fetch failed ({res.status_code}): {res.text}. Falling back to SQLite.")
                    raise RuntimeError("Supabase error")
        except Exception as e:
            print(f"Error querying Supabase leads: {e}. Falling back to SQLite.")
            # Let it fall through to SQLite fallback below

    # SQLite fallback (if Supabase query failed or disabled)
    if not is_supabase_enabled() or not rows:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, data FROM leads ORDER BY id ASC")
            db_rows = cursor.fetchall()
            conn.close()
            
            # If SQLite has rows, parse them
            if db_rows:
                rows = []
                for r in db_rows:
                    try:
                        lead_data = json.loads(r["data"])
                        lead_data["_row_num"] = r["id"]
                        rows.append(lead_data)
                    except Exception:
                        pass
        except Exception as sqlite_err:
            print(f"SQLite fallback query failed: {sqlite_err}")

    # Seed mock data if completely empty
    if not rows and (not cfg.get("sheet_url") or cfg.get("sheet_url") == "mock"):
        mock_headers = ["No.", "Campaign", "Visitors", "Contacts", "Companies", "Leads", "Value"]
        mock_rows = [
            {"No.": "1", "Campaign": "ROQ\nSearch/brand", "Visitors": "1,181", "Contacts": "217", "Companies": "150", "Leads": "28.9", "Value": "$78.29"},
            {"No.": "2", "Campaign": "Website Ads\nRetargeting", "Visitors": "998", "Contacts": "182", "Companies": "121", "Leads": "20.1", "Value": "$63.21"},
            {"No.": "3", "Campaign": "Demo\nRequest", "Visitors": "891", "Contacts": "145", "Companies": "81", "Leads": "14.2", "Value": "$48.39"},
            {"No.": "4", "Campaign": "Global\nTool", "Visitors": "541", "Contacts": "98", "Companies": "67", "Leads": "10.7", "Value": "$35.71"}
        ]
        import_leads(mock_headers, mock_rows)
        return get_all_leads()

    return {
        "headers": headers,
        "rows": rows,
        "total": len(rows),
        "is_mock": False
    }

def add_lead(lead_data: dict) -> dict:
    """Insert a new lead record into Supabase or SQLite fallback."""
    clean_data = {k: v for k, v in lead_data.items() if k not in ["id", "_row_num"]}
    
    if is_supabase_enabled():
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/leads"
        body = {"data": clean_data}
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.post(url, headers=_supabase_headers(), json=body)
                if res.status_code in [200, 201]:
                    rows = res.json()
                    if rows:
                        return {"ok": True, "id": rows[0]["id"]}
                print(f"Supabase lead insert failed ({res.status_code}): {res.text}. Recording to SQLite fallback.")
        except Exception as e:
            print(f"Error inserting to Supabase: {e}. Falling back to SQLite.")

    # SQLite fallback
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO leads (data, created_at, updated_at) VALUES (?, ?, ?)",
        (json.dumps(clean_data), now_str, now_str)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"ok": True, "id": new_id}

def update_lead(lead_id: int, lead_data: dict) -> dict:
    """Update an existing lead record in Supabase or SQLite fallback."""
    clean_data = {k: v for k, v in lead_data.items() if k not in ["id", "_row_num"]}
    
    if is_supabase_enabled():
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/leads"
        params = {"id": f"eq.{lead_id}"}
        body = {
            "data": clean_data,
            "updated_at": datetime.utcnow().isoformat()
        }
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.patch(url, headers=_supabase_headers(), params=params, json=body)
                if res.status_code in [200, 204]:
                    return {"ok": True}
                print(f"Supabase lead update failed ({res.status_code}): {res.text}. Falling back to SQLite.")
        except Exception as e:
            print(f"Error updating Supabase lead: {e}. Falling back to SQLite.")

    # SQLite fallback
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE leads SET data = ?, updated_at = ? WHERE id = ?",
        (json.dumps(clean_data), now_str, lead_id)
    )
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    if rows_affected == 0:
        raise ValueError(f"Lead with ID {lead_id} not found.")
    return {"ok": True}

def delete_lead(lead_id: int) -> dict:
    """Delete a lead record in Supabase or SQLite fallback."""
    if is_supabase_enabled():
        url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/leads"
        params = {"id": f"eq.{lead_id}"}
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.delete(url, headers=_supabase_headers(), params=params)
                if res.status_code in [200, 204]:
                    return {"ok": True}
                print(f"Supabase lead deletion failed ({res.status_code}): {res.text}. Falling back to SQLite.")
        except Exception as e:
            print(f"Error deleting Supabase lead: {e}. Falling back to SQLite.")

    # SQLite fallback
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    if rows_affected == 0:
        raise ValueError(f"Lead with ID {lead_id} not found.")
    return {"ok": True}

def import_leads(headers: list, rows: list):
    """Overwrites all leads in Supabase or SQLite fallback."""
    if is_supabase_enabled():
        delete_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/leads"
        insert_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/leads"
        
        try:
            with httpx.Client(timeout=15.0) as client:
                # 1. Clear existing rows
                del_res = client.delete(delete_url, headers=_supabase_headers(), params={"id": "not.is.null"})
                if del_res.status_code not in [200, 204]:
                    print(f"Warning: Supabase truncate did not return success code: {del_res.text}")
                
                # 2. Bulk Insert rows
                bulk_payload = []
                now_str = datetime.utcnow().isoformat()
                for row in rows:
                    clean_row = {k: v for k, v in row.items() if k not in ["id", "_row_num"]}
                    bulk_payload.append({
                        "data": clean_row,
                        "created_at": now_str,
                        "updated_at": now_str
                    })
                
                if bulk_payload:
                    ins_res = client.post(insert_url, headers=_supabase_headers(), json=bulk_payload)
                    if ins_res.status_code not in [200, 201]:
                        raise RuntimeError(f"Supabase bulk insert failed ({ins_res.status_code}): {ins_res.text}")
                        
            # Update config headers and exit early if Supabase succeeded
            config_service.update_config({
                "headers": headers,
                "visible_columns": headers,
                "column_order": headers,
                "sheet_url": "local_db"
            })
            return
            
        except Exception as e:
            print(f"Failed to bulk import to Supabase: {e}. Seeding to SQLite fallback.")

    # SQLite fallback
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    try:
        cursor.execute("BEGIN TRANSACTION")
        cursor.execute("DELETE FROM leads")
        for row in rows:
            clean_row = {k: v for k, v in row.items() if k not in ["id", "_row_num"]}
            cursor.execute(
                "INSERT INTO leads (data, created_at, updated_at) VALUES (?, ?, ?)",
                (json.dumps(clean_row), now_str, now_str)
            )
        cursor.execute("COMMIT")
    except Exception as e:
        cursor.execute("ROLLBACK")
        raise e
    finally:
        conn.close()

    config_service.update_config({
        "headers": headers,
        "visible_columns": headers,
        "column_order": headers,
        "sheet_url": "local_db"
    })
