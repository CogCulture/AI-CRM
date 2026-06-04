import re
from datetime import datetime, timedelta
from app.services import config_service, sheets_service, email_service, db_service

def parse_date(date_str: str):
    """Parse common date formats used in sheets into a datetime.date object."""
    if not date_str or not date_str.strip():
        return None
    # Strip any time component if present
    date_part = date_str.split()[0].strip()
    # Normalize separators
    date_part = date_part.replace("/", "-").replace(".", "-")
    
    # Try parsing patterns (strictly DD-MM-YYYY and YYYY-MM-DD)
    for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(date_part, fmt).date()
        except ValueError:
            continue
            
    # Try custom parts extraction in case of DD-MM-YYYY
    parts = date_part.split("-")
    if len(parts) == 3:
        try:
            p1, p2, p3 = int(parts[0]), int(parts[1]), int(parts[2])
            # Check YYYY-MM-DD
            if p1 > 1900:
                return datetime(p1, p2, p3).date()
            # Default strictly to DD-MM-YYYY
            return datetime(p3, p2, p1).date()
        except ValueError:
            pass
            
    return None

def is_deadline_tomorrow(date_str: str) -> bool:
    """Check if the deadline date is exactly tomorrow (1 day ahead of local time)."""
    parsed = parse_date(date_str)
    if not parsed:
        return False
    # Check against local date offset (+05:30)
    # Since current local time is provided, we can fetch today's date in local time or simple utc
    today_local = (datetime.utcnow() + timedelta(hours=5.5)).date()
    tomorrow_local = today_local + timedelta(days=1)
    return parsed == tomorrow_local

def check_and_send_alerts() -> int:
    """Scan all sheet rows, find approaching deadlines, and send email reminders."""
    cfg = config_service.load_config()
    sheet_url = cfg.get("sheet_url")
    range_name = cfg.get("sheet_range", "Sheet1")
    
    if not sheet_url:
        print("Sheet URL not configured. Skipping alert checks.")
        return 0
        
    try:
        data = sheets_service.fetch_sheet_data(sheet_url, range_name, bypass_cache=True)
    except Exception as e:
        print(f"Failed to fetch sheet data for alert check: {e}")
        return 0
        
    headers = data.get("headers", [])
    rows = data.get("rows", [])
    
    # Locate column headers (case-insensitive matches)
    deadline_header = next((h for h in headers if "deadline" in h.lower() or "due" in h.lower()), "")
    poc_header = next((h for h in headers if h.lower() == "cs poc" or h.lower() == "poc" or "poc" in h.lower()), "")
    email_header = next((h for h in headers if "poc email" in h.lower() or "email" in h.lower()), "")
    company_header = next((h for h in headers if h.lower() == "company" or "company" in h.lower() or "campaign" in h.lower()), "")
    value_header = next((h for h in headers if "value" in h.lower() or "amount" in h.lower() or "revenue" in h.lower() or "estimated" in h.lower()), "")
    
    if not deadline_header or not email_header:
        print(f"Required headers missing for alerts (Deadline: '{deadline_header}', POC Email: '{email_header}').")
        return 0
        
    sent_count = 0
    for row in rows:
        deadline_val = row.get(deadline_header, "")
        
        if is_deadline_tomorrow(deadline_val):
            company = row.get(company_header, "Unnamed Lead")
            poc_name = row.get(poc_header, "Lead Owner")
            poc_email = row.get(email_header, "").strip()
            amount = row.get(value_header, "")
            
            if not poc_email:
                print(f"Skipping alert for {company}: POC email is empty.")
                continue
                
            # Check SQLite if already notified
            if db_service.has_sent_reminder(company, deadline_val):
                print(f"Reminder already sent for {company} deadline: {deadline_val}")
                continue
                
            # Send the email alert
            success = email_service.send_deadline_reminder(
                to_email=poc_email,
                poc_name=poc_name,
                company=company,
                deadline=deadline_val,
                amount=amount
            )
            
            if success:
                # Mark as sent
                db_service.mark_reminder_sent(company, deadline_val)
                sent_count += 1
                
    return sent_count
