import os
from datetime import datetime
from app.services import config_service, email_service, db_service, sheets_service

def send_daily_metrics_report(bypass_duplicate_check: bool = False) -> int:
    """Computes dashboard KPIs and sends a daily snapshot email to all configured report recipients."""
    cfg = config_service.load_config()
    recipients = cfg.get("report_recipients", [])
    
    if not recipients:
        print("No report recipients configured. Skipping daily metrics report.")
        return 0

    # Retrieve current metrics from dashboard summary logic
    from app.routers.dashboard import get_summary
    try:
        summary = get_summary(bypass_cache=True)
    except Exception as e:
        print(f"Failed to fetch dashboard summary for report: {e}")
        return 0
        
    kpis = summary.get("kpis", [])
    if not kpis:
        print("No metrics available to send. Skipping daily report.")
        return 0

    # Fetch raw row data to get status counts
    sheet_url = cfg.get("sheet_url")
    range_name = cfg.get("sheet_range", "Sheet1")
    hot_count = 0
    warm_count = 0
    cold_count = 0
    status_col_found = False
    try:
        data = sheets_service.fetch_sheet_data(sheet_url or "mock", range_name, bypass_cache=True)
        headers = data.get("headers", [])
        rows = data.get("rows", [])
        status_col = next((h for h in headers if h.lower() == "status"), "")
        if status_col:
            status_col_found = True
            for row in rows:
                val = str(row.get(status_col, "")).lower().strip()
                if "hot" in val:
                    hot_count += 1
                elif "warm" in val:
                    warm_count += 1
                elif "cold" in val:
                    cold_count += 1
    except Exception as e:
        print(f"Failed to fetch status counts for report: {e}")

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    # 1. Check if report was already sent today to prevent duplicate sends
    reminder_key = f"daily_report:{today_str}"
    if not bypass_duplicate_check and db_service.has_sent_reminder("system", reminder_key):
        print(f"Daily metrics report already sent for today: {today_str}")
        return 0

    # 2. Build premium styled HTML email
    subject = f"Daily CRM Leads Snapshot — {datetime.utcnow().strftime('%B %d, %Y')}"
    
    kpis_html = ""
    for kpi in kpis:
        label = kpi.get("label", "")
        val = kpi.get("value", "")
        delta = kpi.get("delta", "")
        
        # Color delta conditionally
        delta_color = "#10b981" if "+" in delta else "#ef4444"
        if delta == "+0%" or delta == "0%":
            delta_color = "#64748b"
            
        kpis_html += f"""
        <div style="display: inline-block; width: 46%; min-width: 250px; margin: 6px; vertical-align: top; text-align: left; box-sizing: border-box;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; min-height: 85px;">
                <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">{label}</div>
                <div style="font-size: 22px; font-weight: bold; color: #0f172a; margin: 8px 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">{val}</div>
                <div style="font-size: 11px; font-weight: 600; color: {delta_color}; white-space: nowrap; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">{delta} vs last month</div>
            </div>
        </div>
        """

    kpis_wrapper = f"""
    <div style="text-align: center; margin: 15px -6px;">
        {kpis_html}
    </div>
    """

    status_html = ""
    if status_col_found:
        status_html = f"""
        <div style="margin: 20px 0; border-top: 1px dashed #e2e8f0; padding-top: 20px; text-align: center;">
            <div style="display: inline-block; margin: 6px; vertical-align: top;">
                <div style="background-color: #fee2e2; color: #dc2626; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: bold; border: 1px solid #fca5a5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; white-space: nowrap;">
                    🔥 Hot Leads: {hot_count}
                </div>
            </div>
            <div style="display: inline-block; margin: 6px; vertical-align: top;">
                <div style="background-color: #fef3c7; color: #d97706; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: bold; border: 1px solid #fcd34d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; white-space: nowrap;">
                    ⚡ Warm Leads: {warm_count}
                </div>
            </div>
            <div style="display: inline-block; margin: 6px; vertical-align: top;">
                <div style="background-color: #dbeafe; color: #2563eb; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: bold; border: 1px solid #bfdbfe; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; white-space: nowrap;">
                    ❄️ Cold Leads: {cold_count}
                </div>
            </div>
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f6f8;
            margin: 0;
            padding: 0;
            color: #333333;
        }}
        .container {{
            max-width: 650px;
            margin: 40px auto;
            background: #ffffff;
            border: 1px solid #e1e8ed;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }}
        .header {{
            background: #0f172a;
            color: #ffffff;
            padding: 35px 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 22px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }}
        .header p {{
            margin: 8px 0 0 0;
            font-size: 13px;
            color: #94a3b8;
            font-family: monospace;
        }}
        .content {{
            padding: 35px;
            line-height: 1.6;
        }}
        .greeting {{
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #0f172a;
        }}
        .cta-btn {{
            display: inline-block;
            background-color: #0f172a;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 13px;
            margin: 25px 0;
            text-align: center;
        }}
        .footer {{
            background-color: #f8fafc;
            color: #64748b;
            padding: 25px;
            text-align: center;
            font-size: 11px;
            border-top: 1px solid #e2e8f0;
        }}
        @media only screen and (max-width: 600px) {{
            .container {{
                margin: 0 !important;
                border-radius: 0 !important;
                width: 100% !important;
            }}
            .content {{
                padding: 20px !important;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Daily CRM Leads Summary</h1>
            <p>Snapshot Date: {datetime.utcnow().strftime('%Y-%m-%d')} | UTC</p>
        </div>
        <div class="content">
            <div class="greeting">Hello,</div>
            <p>Here is your daily check-up snapshot of lead metrics and pipeline status generated from the CRM dashboard.</p>
            
            {kpis_wrapper}

            {status_html}
            
            <p style="margin-top: 20px;">For detailed insights, user reports, and active lead profiles, access the live dashboard panel.</p>
            
            <div style="text-align: center;">
                <a href="https://crm.cogculture.agency/dashboard" class="cta-btn">Access CRM Dashboard</a>
            </div>
            
            <p style="font-size: 12px; color: #64748b; margin-top: 30px;">Best regards,<br>Obsidian CRM Engine</p>
        </div>
        <div class="footer">
            This report was auto-generated and dispatched to configured recipients.<br>
            To manage report settings, visit the Admin Panel.
        </div>
    </div>
</body>
</html>
"""

    # 3. Dispatch to all recipients
    sent_emails = 0
    for email in recipients:
        email = email.strip()
        if not email:
            continue
        success = email_service.send_email(
            to_email=email,
            subject=subject,
            html_content=html_content
        )
        if success:
            sent_emails += 1
            
    if sent_emails > 0:
        db_service.mark_reminder_sent("system", reminder_key)
        print(f"Successfully sent daily metrics report to {sent_emails} recipient(s).")
        
    return sent_emails
