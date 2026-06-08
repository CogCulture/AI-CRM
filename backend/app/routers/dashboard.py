from fastapi import APIRouter, Header, HTTPException
from app.services import config_service, sheets_service

def format_indian_currency(val: float) -> str:
    """Format a numeric value using the Indian Numbering System (Lakh/Crore layout)."""
    val_rounded = round(val, 2)
    parts = str(val_rounded).split('.')
    int_part = parts[0]
    dec_part = parts[1] if len(parts) > 1 else "00"
    if len(dec_part) < 2:
        dec_part = dec_part + "0"
    
    sign = ""
    if int_part.startswith('-'):
        sign = "-"
        int_part = int_part[1:]
        
    n = len(int_part)
    if n <= 3:
        formatted_int = int_part
    else:
        last_three = int_part[-3:]
        remaining = int_part[:-3]
        groups = []
        while len(remaining) > 2:
            groups.append(remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.append(remaining)
        groups.reverse()
        formatted_int = ",".join(groups) + "," + last_three
        
    if val % 1 == 0:
        return f"{sign}₹{formatted_int}"
    else:
        return f"{sign}₹{formatted_int}.{dec_part}"

router = APIRouter()

@router.get("/summary")
def get_summary(bypass_cache: bool = False):
    """Returns KPI-ready summary from sheet data."""
    cfg = config_service.load_config()
    sheet_url = cfg.get("sheet_url")
    range_name = cfg.get("sheet_range", "Sheet1")
    is_configured = bool(sheet_url)

    data = sheets_service.fetch_sheet_data(sheet_url or "mock", range_name, bypass_cache=bypass_cache)
    total_rows = data["total"]

    # Dynamic columns scan
    visitor_col = None
    contact_col = None
    lead_col = None
    value_col = None
    stage_col = None
    status_col = None
    company_col = None

    for h in data["headers"]:
        h_low = h.lower()
        if any(x in h_low for x in ["visitor", "click", "traffic", "impression", "session", "user"]):
            if not visitor_col: visitor_col = h
        if any(x in h_low for x in ["contact", "signup", "subscriber", "registration"]):
            if not contact_col: contact_col = h
        if any(x in h_low for x in ["lead", "deal", "company", "customer", "conversion"]):
            # Avoid conflict with value or stage
            if not any(x in h_low for x in ["value", "amount", "revenue", "stage", "phase", "status"]):
                if not lead_col: lead_col = h
        if any(x in h_low for x in ["value", "amount", "revenue", "deal size", "price"]):
            if not value_col: value_col = h
        if any(x in h_low for x in ["stage", "phase"]):
            if not stage_col: stage_col = h
        if any(x in h_low for x in ["status", "state"]):
            if not status_col: status_col = h
        if "company" in h_low:
            company_col = h

    # Initialize aggregators
    total_visitors = 0.0
    total_contacts = 0.0
    total_leads = 0.0
    total_value = 0.0
    closed_won_count = 0
    active_count = 0
    unique_companies = set()

    def parse_float(val) -> float:
        if val is None:
            return 0.0
        val_str = str(val).replace("$", "").replace(",", "").replace("%", "").strip()
        try:
            return float(val_str)
        except ValueError:
            return 0.0

    for row in data["rows"]:
        if visitor_col:
            total_visitors += parse_float(row.get(visitor_col))
        if contact_col:
            total_contacts += parse_float(row.get(contact_col))
        if lead_col:
            total_leads += parse_float(row.get(lead_col))
        if value_col:
            total_value += parse_float(row.get(value_col))
        if company_col:
            comp_name = str(row.get(company_col, "")).strip()
            if comp_name:
                unique_companies.add(comp_name)

        # Stage and Status check
        stg_vals = []
        if stage_col:
            stg_vals.append(str(row.get(stage_col, "")).lower())
        if status_col:
            # Note: headers could have multiple 'Status' columns (like in user's sheet: Status, Lead Type, Status)
            # Fetch all matching keys for 'Status' to be safe
            for k, v in row.items():
                if k.lower() == "status":
                    stg_vals.append(str(v).lower())
            
        is_won = False
        is_active = False
        for stg in stg_vals:
            if any(x in stg for x in ["won", "closed won", "converted", "completed", "hired", "success"]):
                is_won = True
            if any(x in stg for x in ["proposal", "negotiation", "active", "discovery", "follow-up", "warm", "contacted"]):
                is_active = True
                
        if is_won:
            closed_won_count += 1
        elif is_active:
            active_count += 1

    kpis = []
    if not is_configured or sheet_url == "mock":
        kpis.append({"label": "Visitors", "value": "30,794", "delta": "+22%"})
        kpis.append({"label": "Contacts", "value": "1,983", "delta": "+21%"})
        kpis.append({"label": "Attributable Deals", "value": "57.0", "delta": "+12.6%"})
        kpis.append({"label": "Revenue", "value": "$10,622.21", "delta": "+15.2%"})
    else:
        # First KPI: Total Leads/Rows
        kpis.append({"label": "Total Leads", "value": f"{total_rows:,}", "delta": "+12%"})
        
        # Second KPI: Pipeline Value or Unique Companies
        if value_col:
            kpis.append({"label": "Pipeline Value", "value": format_indian_currency(total_value), "delta": "+8%"})
        elif company_col:
            kpis.append({"label": "Unique Companies", "value": f"{len(unique_companies):,}", "delta": "+5%"})
        else:
            kpis.append({"label": "Pipeline Value", "value": "₹0", "delta": "+0%"})
            
        # Third KPI: Active Leads
        kpis.append({"label": "Active Leads", "value": f"{active_count:,}", "delta": "+4%"})
            
        # Fourth KPI: Closed Won, Contacts or Visitors
        if closed_won_count > 0:
            kpis.append({"label": "Closed Won", "value": f"{closed_won_count:,}", "delta": "+15%"})
        elif contact_col:
            kpis.append({"label": f"Total {contact_col}", "value": f"{total_contacts:,.0f}", "delta": "+10%"})
        elif visitor_col:
            kpis.append({"label": f"Total {visitor_col}", "value": f"{total_visitors:,.0f}", "delta": "+15%"})
        else:
            kpis.append({"label": "Closed Won", "value": "0", "delta": "+0%"})

    return {
        "configured": is_configured,
        "kpis": kpis,
        "headers": data["headers"],
        "visible_columns": cfg.get("visible_columns", []),
        "column_order": cfg.get("column_order", []),
        "graphs": cfg.get("graphs", []),
    }


@router.post("/trigger-reminders")
def trigger_reminders(x_cron_key: str = Header(None)):
    """Manual trigger to scan and send deadline email reminders immediately, secured by secret key in production."""
    import os
    expected_key = os.environ.get("CRON_SECRET_KEY")
    if expected_key and x_cron_key != expected_key:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid cron secret key")
        
    from app.services.alert_service import check_and_send_alerts
    try:
        sent_count = check_and_send_alerts()
        return {"status": "success", "sent_count": sent_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/trigger-daily-report")
def trigger_daily_report():
    """Trigger the daily metrics snapshot report email dispatch immediately for testing, bypassing daily duplicate checks."""
    from app.services.report_service import send_daily_metrics_report
    try:
        sent_count = send_daily_metrics_report(bypass_duplicate_check=True)
        return {"status": "success", "sent_count": sent_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}


