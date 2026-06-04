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

def is_date_tomorrow(date_str: str) -> bool:
    """Check if the given date is exactly tomorrow (1 day ahead of local time)."""
    parsed = parse_date(date_str)
    if not parsed:
        return False
    # Check against local date offset (+05:30)
    today_local = (datetime.utcnow() + timedelta(hours=5.5)).date()
    tomorrow_local = today_local + timedelta(days=1)
    return parsed == tomorrow_local

def check_and_send_alerts() -> int:
    """Scan all sheet rows, find approaching deadlines/follow-ups, and send email reminders."""
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
    followup_header = next((h for h in headers if "follow" in h.lower() or "followup" in h.lower() or "follow up" in h.lower()), "")
    stage_header = next((h for h in headers if h.lower() == "stage" or "stage" in h.lower()), "")
    poc_header = next((h for h in headers if h.lower() == "cs poc" or h.lower() == "poc" or "poc" in h.lower()), "")
    email_header = next((h for h in headers if "poc email" in h.lower() or "email" in h.lower()), "")
    company_header = next((h for h in headers if h.lower() == "company" or "company" in h.lower() or "campaign" in h.lower()), "")
    value_header = next((h for h in headers if "value" in h.lower() or "amount" in h.lower() or "revenue" in h.lower() or "estimated" in h.lower()), "")
    
    if not email_header:
        print("POC Email header is missing for alerts.")
        return 0
        
    sent_count = 0
    for row in rows:
        company = row.get(company_header, "Unnamed Lead")
        poc_name = row.get(poc_header, "Lead Owner")
        poc_email = row.get(email_header, "").strip()
        amount = row.get(value_header, "")
        
        if not poc_email:
            print(f"Skipping alert for {company}: POC email is empty.")
            continue
            
        stage_val = str(row.get(stage_header, "")).lower().strip()
        
        # Decide checking logic based on stage
        is_deadline_stage = stage_val in ["proposal to be sent", "portfolio to be sent"]
        
        if is_deadline_stage:
            if not deadline_header:
                print(f"Skipping alert for {company}: Stage is '{stage_val}' but Deadline header is missing.")
                continue
            date_val = row.get(deadline_header, "")
            is_tomorrow = is_date_tomorrow(date_val)
            alert_type = "deadline"
        else:
            if not followup_header:
                print(f"Skipping alert for {company}: Stage is '{stage_val}' but Follow Up header is missing.")
                continue
            date_val = row.get(followup_header, "")
            is_tomorrow = is_date_tomorrow(date_val)
            alert_type = "followup"
            
        if is_tomorrow:
            # Check database to see if we already sent an reminder for this date/type
            reminder_key = f"{alert_type}:{date_val}"
            if db_service.has_sent_reminder(company, reminder_key):
                print(f"Reminder already sent for {company} {alert_type}: {date_val}")
                continue
                
            # Send the email alert
            if alert_type == "deadline":
                success = email_service.send_deadline_reminder(
                    to_email=poc_email,
                    poc_name=poc_name,
                    company=company,
                    deadline=date_val,
                    amount=amount
                )
            else:
                success = email_service.send_followup_reminder(
                    to_email=poc_email,
                    poc_name=poc_name,
                    company=company,
                    followup_date=date_val,
                    amount=amount
                )
                
            if success:
                # Mark as sent
                db_service.mark_reminder_sent(company, reminder_key)
                sent_count += 1
                
    return sent_count
