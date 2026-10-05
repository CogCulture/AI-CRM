import os
import re
import smtplib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union, Tuple
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import settings
from app.services import config_service, sheets_service

# ---------------------------------------------------------------------------
# Core SMTP Sending
# ---------------------------------------------------------------------------

def send_email(to_email: Union[str, List[str]], subject: str, html_content: str) -> bool:
    """Send an HTML email using SMTP configuration in settings to single or multiple recipients."""
    if not settings.smtp_user or not settings.smtp_password:
        print("SMTP user or password not configured. Skipping email dispatch.")
        return False

    if isinstance(to_email, list):
        recipients = [e.strip() for e in to_email if e and e.strip()]
        to_header = ", ".join(recipients)
    else:
        recipients = [to_email.strip()] if to_email and to_email.strip() else []
        to_header = to_email.strip() if to_email else ""

    if not recipients:
        print("No valid recipients provided. Skipping email dispatch.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Cog Culture CRM <{settings.smtp_user}>"
    msg["To"] = to_header

    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_user, recipients, msg.as_string())
        server.quit()
        print(f"Successfully sent email '{subject}' to {to_header}")
        return True
    except Exception as e:
        print(f"Failed to send email to {to_header}: {e}")
        return False

# ---------------------------------------------------------------------------
# Recipient Management (Testing Mode vs Production Mode)
# ---------------------------------------------------------------------------

def get_email_recipients(override_recipient: Optional[str] = None) -> Tuple[List[str], bool]:
    """
    Returns (recipients_list, is_test_mode).
    If override_recipient is provided, returns ([override_recipient], True).
    Otherwise reads config: if email_test_mode is True, routes strictly to email_test_recipient.
    """
    if override_recipient and override_recipient.strip():
        return [override_recipient.strip()], True

    cfg = config_service.load_config()
    test_mode = cfg.get("email_test_mode", True)
    test_recipient = cfg.get("email_test_recipient", "kanishk@cogculture.agency").strip()
    prod_recipients = cfg.get("email_prod_recipients", [
        "kanika@cogculture.agency",
        "vaibhav@cogculture.agency",
        "daksh@cogculture.agency"
    ])

    if test_mode:
        return [test_recipient if test_recipient else "kanishk@cogculture.agency"], True
    else:
        valid_prod = [r.strip() for r in prod_recipients if r and r.strip()]
        return valid_prod if valid_prod else ["kanishk@cogculture.agency"], False

# ---------------------------------------------------------------------------
# Helpers: Parsing & Formatting
# ---------------------------------------------------------------------------

def robust_parse_date(date_val: Any) -> Optional[datetime.date]:
    """Parse various date formats (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, etc.) into datetime.date."""
    if not date_val:
        return None
    date_str = str(date_val).strip()
    if not date_str or date_str in ["—", "-", "placeholder", "nan", "none"]:
        return None

    clean = re.sub(r'[\/\.]', '-', date_str.split()[0].strip())
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d-%m-%y", "%m-%d-%Y", "%m-%d-%y"):
        try:
            return datetime.strptime(clean, fmt).date()
        except ValueError:
            pass

    parts = clean.split("-")
    if len(parts) == 3:
        try:
            p1, p2, p3 = int(parts[0]), int(parts[1]), int(parts[2])
            if p3 < 100:
                p3 += 2000
            if p1 > 1900:
                return datetime(p1, p2, p3).date()
            if p3 > 1900:
                return datetime(p3, p2, p1).date()
        except Exception:
            pass
    return None

def format_inr(val: Any) -> str:
    """Format string or number into Indian Currency (Lakh/Crore layout: ₹21,00,000)."""
    if not val:
        return "—"
    clean_val = str(val).split("(")[0].replace(",", "").replace("₹", "").replace("$", "").strip()
    try:
        num = float(clean_val)
        num_int = int(round(num))
        s = str(num_int)
        if len(s) > 3:
            last3 = s[-3:]
            remaining = s[:-3]
            groups = []
            while len(remaining) > 2:
                groups.append(remaining[-2:])
                remaining = remaining[:-2]
            if remaining:
                groups.append(remaining)
            groups.reverse()
            formatted = ",".join(groups) + "," + last3
        else:
            formatted = s
        return f"₹{formatted}"
    except Exception:
        return str(val).split("(")[0].strip() or "—"

def get_status_style(status_val: str) -> Tuple[str, str, str]:
    """Returns (text_color, bg_color, display_label)."""
    st = str(status_val or "").strip().lower()
    if "hot" in st:
        return ("#dc2626", "#fee2e2", "HOT")
    elif "warm" in st:
        return ("#d97706", "#fef3c7", "WARM")
    elif "cold" in st:
        return ("#475569", "#f1f5f9", "COLD")
    elif "discovery" in st:
        return ("#2563eb", "#dbeafe", "DISCOVERY")
    elif "won" in st:
        return ("#059669", "#d1fae5", "CLOSED WON")
    return ("#475569", "#f1f5f9", status_val.upper() if status_val else "LEAD")

# ---------------------------------------------------------------------------
# Data Collection Pipeline
# ---------------------------------------------------------------------------

def fetch_pipeline_digest_data() -> Dict[str, Any]:
    """Gathers and segments CRM leads across sheet tabs for the daily digests."""
    cfg = config_service.load_config()
    sheet_url = cfg.get("sheet_url")
    tabs = cfg.get("sheet_tabs", ["Active Leads", "Internal Leads"])

    all_rows: List[Dict[str, Any]] = []
    if sheet_url:
        for tab in tabs:
            try:
                data = sheets_service.fetch_sheet_data(sheet_url, tab, bypass_cache=True)
                for r in data.get("rows", []):
                    r["_origin_tab"] = tab
                    all_rows.append(r)
            except Exception as e:
                print(f"Error fetching tab {tab} for digest: {e}")

    # Reference dates in India Standard Time (+05:30)
    today = (datetime.utcnow() + timedelta(hours=5, minutes=30)).date()
    yesterday = today - timedelta(days=1)

    leads_yesterday = []
    hot_leads = []
    proposals_today = []
    followups_day2 = []
    followups_day5 = []
    followups_overdue = []

    # Sort all rows by date descending to find latest recent leads if yesterday has 0 entries
    sorted_by_date = []
    for r in all_rows:
        d = robust_parse_date(r.get("Date"))
        if d:
            sorted_by_date.append((d, r))
    sorted_by_date.sort(key=lambda x: x[0], reverse=True)
    recent_leads = [item[1] for item in sorted_by_date[:6]]

    for r in all_rows:
        d = robust_parse_date(r.get("Date"))
        if d == yesterday:
            leads_yesterday.append(r)

        st = str(r.get("Status", "")).strip().lower()
        stg = str(r.get("Stage", "")).strip().lower()

        # Active Hot Leads
        if st == "hot" and not any(x in stg for x in ["won", "lost", "dead", "dropped"]):
            hot_leads.append(r)

        # Skip closed/dead leads for proposals & follow-ups
        if any(x in st for x in ["won", "lost", "dead", "dropped"]) or any(x in stg for x in ["won", "lost", "dead", "dropped"]):
            continue

        # Proposals to be sent
        if "proposal to be sent" in stg or "portfolio to be sent" in stg:
            proposals_today.append(r)
        elif "proposal sent" in stg or "portfolio sent" in stg:
            sent_d = robust_parse_date(r.get("Date")) or robust_parse_date(r.get("Follow up date"))
            if sent_d:
                days_ago = (today - sent_d).days
                if days_ago == 2:
                    followups_day2.append({"row": r, "sent_date": sent_d, "days_ago": days_ago})
                elif days_ago == 5:
                    followups_day5.append({"row": r, "sent_date": sent_d, "days_ago": days_ago})
                elif days_ago > 5:
                    followups_overdue.append({"row": r, "sent_date": sent_d, "days_ago": days_ago})
                elif 0 <= days_ago < 5:
                    # Recent proposals (1-4 days)
                    followups_day2.append({"row": r, "sent_date": sent_d, "days_ago": days_ago})

    return {
        "today": today,
        "yesterday": yesterday,
        "all_rows_count": len(all_rows),
        "leads_yesterday": leads_yesterday,
        "recent_leads": recent_leads,
        "hot_leads": hot_leads,
        "proposals_today": proposals_today,
        "followups_day2": followups_day2,
        "followups_day5": followups_day5,
        "followups_overdue": followups_overdue,
    }

# ---------------------------------------------------------------------------
# HTML Builders
# ---------------------------------------------------------------------------

def build_daily_leads_digest_html(data: Dict[str, Any], recipients: List[str], is_test_mode: bool) -> Tuple[str, str]:
    """Builds HTML for Email 1: Daily Leads & New Intake Digest."""
    today = data["today"]
    yesterday = data["yesterday"]
    today_formatted = today.strftime("%B %d, %Y")
    yesterday_formatted = yesterday.strftime("%A, %B %d")

    leads_yesterday = data["leads_yesterday"]
    recent_leads = data["recent_leads"]
    hot_leads = data["hot_leads"]

    display_leads = leads_yesterday if leads_yesterday else recent_leads
    is_fallback = len(leads_yesterday) == 0

    subject = f"Daily Leads & New Intake Digest - {today_formatted}"
    recipients_str = ", ".join(recipients)

    # Calculate total value of displayed leads
    total_val = 0.0
    for r in display_leads:
        val_str = str(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value") or "").split("(")[0].replace(",", "").replace("₹", "").replace("$", "").strip()
        try:
            total_val += float(val_str)
        except Exception:
            pass

    # Build Leads Items HTML
    leads_html = ""
    for idx, r in enumerate(display_leads, 1):
        company = r.get("Company") or "Unnamed Lead"
        lead_id = r.get("Lead ID") or f"LEAD-{idx}"
        status = r.get("Status") or "Lead"
        stage = r.get("Stage") or ""
        source = r.get("Lead Source") or r.get("Source") or "Direct / Inbound"
        poc = r.get("Cog POC") or "Unassigned"
        req = r.get("Requirement") or "General Marketing & Strategy"
        rev = r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value") or ""
        retainer = r.get("Retainer Cost") or r.get("Retainer cost") or ""
        client_name = r.get("POC Name") or r.get("Name") or ""
        client_phone = r.get("Contact No.") or r.get("Phone") or ""
        client_email = r.get("Email Id") or r.get("Email") or ""
        follow_date = r.get("Follow up date") or ""
        notes = r.get("Remarks /Updates") or r.get("Last Update") or r.get("Follow-up") or r.get("Intro Call") or "Lead logged in CRM."

        text_col, bg_col, status_label = get_status_style(status)
        rev_formatted = format_inr(rev)
        retainer_formatted = format_inr(retainer) if retainer else ""

        contact_parts = []
        if client_name: contact_parts.append(f"<strong>{client_name}</strong>")
        if client_phone: contact_parts.append(client_phone)
        if client_email: contact_parts.append(f"<a href='mailto:{client_email}' style='color:#2563eb;text-decoration:none;'>{client_email}</a>")
        contact_display = " • ".join(contact_parts) if contact_parts else "No direct prospect contact details recorded"

        leads_html += f"""
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px;">
                <div>
                    <span style="font-size: 16px; font-weight: 700; color: #0f172a;">{idx}. {company}</span>
                    <span style="font-size: 11px; font-family: monospace; color: #64748b; margin-left: 8px; background: #f8fafc; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">{lead_id}</span>
                </div>
                <div style="text-align: right;">
                    <span style="background-color: {bg_col}; color: {text_col}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">{status_label}</span>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
                <tr>
                    <td style="padding: 4px 0; width: 140px; color: #64748b; font-weight: 600;">Lead Source:</td>
                    <td style="padding: 4px 0;"><strong>{source}</strong> <span style="color:#94a3b8;">(Handled by {poc})</span></td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Requirement:</td>
                    <td style="padding: 4px 0; color: #0f172a;">{req}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Est. Revenue:</td>
                    <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">{rev_formatted} {f'<span style="font-size:11px;font-weight:normal;color:#64748b;">(Retainer: {retainer_formatted})</span>' if retainer_formatted and retainer_formatted != "—" else ''}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Prospect Contact:</td>
                    <td style="padding: 4px 0;">{contact_display}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: #64748b; font-weight: 600; vertical-align: top;">Follow-up / Notes:</td>
                    <td style="padding: 4px 0; color: #334155; line-height: 1.4;">
                        {f'<span style="display:inline-block;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;margin-bottom:4px;">Scheduled: {follow_date}</span><br>' if follow_date else ''}
                        {notes}
                    </td>
                </tr>
            </table>
        </div>
        """

    # Build Hot Leads Table HTML
    hot_leads_html = ""
    for idx, r in enumerate(hot_leads, 1):
        company = r.get("Company") or "Lead"
        req = r.get("Requirement") or "—"
        poc = r.get("Cog POC") or "—"
        rev = r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value") or ""
        notes = r.get("Remarks /Updates") or r.get("Last Update") or r.get("Follow-up") or "—"
        rev_formatted = format_inr(rev)

        hot_leads_html += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; font-weight: 700; color: #0f172a;">{idx}. {company}</td>
            <td style="padding: 10px 8px; color: #334155;">{req}</td>
            <td style="padding: 10px 8px; font-weight: 700; color: #dc2626; white-space: nowrap;">{rev_formatted}</td>
            <td style="padding: 10px 8px; color: #475569;">{poc}</td>
            <td style="padding: 10px 8px; color: #64748b; font-size: 12px; line-height: 1.3;">{notes}</td>
        </tr>
        """

    test_mode_banner = ""
    if is_test_mode:
        test_mode_banner = f"""
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #92400e; font-weight: 600; text-align: center;">
            🧪 TEST MODE ACTIVE: Email routed strictly to <u>{recipients_str}</u>. (Production recipients: kanika@, vaibhav@, daksh@)
        </div>
        """

    section_subtitle = f"Leads logged on {yesterday_formatted}" if not is_fallback else f"0 leads recorded on {yesterday_formatted}. Showing {len(display_leads)} most recent leads:"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 25px 10px; color: #0f172a;">
    <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 28px 24px; text-align: left;">
            <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #38bdf8; margin-bottom: 6px;">
                COG CULTURE • CRM INTELLIGENCE
            </div>
            <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 6px 0;">
                Daily Leads & New Intake Digest
            </div>
            <div style="font-size: 12px; color: #94a3b8;">
                {today_formatted} • Targeted Dispatch
            </div>
        </div>

        <div style="padding: 24px;">
            {test_mode_banner}

            <!-- Summary KPI Badges -->
            <div style="display: flex; gap: 10px; margin-bottom: 24px;">
                <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">Intake Count</div>
                    <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">{len(display_leads)} Leads</div>
                </div>
                <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #dc2626;">Active Hot Leads</div>
                    <div style="font-size: 20px; font-weight: 800; color: #dc2626; margin-top: 4px;">{len(hot_leads)} Leads</div>
                </div>
                <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #16a34a;">Pipeline Intake</div>
                    <div style="font-size: 20px; font-weight: 800; color: #16a34a; margin-top: 4px;">{format_inr(total_val)}</div>
                </div>
            </div>

            <!-- Section 1: Leads Added Yesterday -->
            <div style="margin-bottom: 30px;">
                <div style="border-left: 4px solid #3b82f6; padding-left: 10px; margin-bottom: 14px;">
                    <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0;">New Leads Added Yesterday</h2>
                    <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">{section_subtitle}</p>
                </div>

                {leads_html}
            </div>

            <!-- Section 2: All Active Hot Leads -->
            <div style="margin-bottom: 24px;">
                <div style="border-left: 4px solid #dc2626; padding-left: 10px; margin-bottom: 14px;">
                    <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0;">Active Hot Leads Pulse ({len(hot_leads)})</h2>
                    <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">All high-priority active deals currently requiring close attention</p>
                </div>

                <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                        <thead style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 700;">
                            <tr>
                                <th style="padding: 10px 8px;">Company</th>
                                <th style="padding: 10px 8px;">Requirement</th>
                                <th style="padding: 10px 8px;">Est. Value</th>
                                <th style="padding: 10px 8px;">POC</th>
                                <th style="padding: 10px 8px;">Latest Update</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hot_leads_html}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="https://crm.cogculture.agency/dashboard" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 13px; margin: 0 6px;">Open CRM Dashboard</a>
                <a href="https://crm.cogculture.agency/dashboard?tab=internal_leads" style="display: inline-block; background-color: #f1f5f9; color: #0f172a; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 13px; margin: 0 6px; border: 1px solid #e2e8f0;">View Internal Leads</a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; font-size: 11px; color: #64748b; text-align: center;">
            This is an automated dispatch from the Cog Culture CRM System.<br>
            Sent via <strong>aryan@cogculture.agency</strong> • Scheduled daily at 10:00 AM IST.
        </div>
    </div>
</body>
</html>
"""
    return subject, html_content

def build_proposals_followup_alert_html(data: Dict[str, Any], recipients: List[str], is_test_mode: bool) -> Tuple[str, str]:
    """Builds HTML for Email 2: Daily Proposals & Follow-up Action Alert."""
    today = data["today"]
    today_formatted = today.strftime("%B %d, %Y")

    proposals_today = data["proposals_today"]
    followups_day2 = data["followups_day2"]
    followups_day5 = data["followups_day5"]
    followups_overdue = data["followups_overdue"]

    subject = f"Daily Proposals & Follow-up Action Alert - {today_formatted}"
    recipients_str = ", ".join(recipients)

    # Proposals to Send Today HTML
    proposals_today_html = ""
    if not proposals_today:
        proposals_today_html = """
        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; text-align: center; color: #64748b; font-size: 13px;">
            No new proposals scheduled to be sent today.
        </div>
        """
    else:
        for idx, r in enumerate(proposals_today, 1):
            company = r.get("Company") or "Unnamed Deal"
            poc = r.get("Cog POC") or "Unassigned"
            req = r.get("Requirement") or "General Proposal"
            rev = r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value") or ""
            retainer = r.get("Retainer Cost") or r.get("Retainer cost") or ""
            client_name = r.get("POC Name") or r.get("Name") or ""
            client_phone = r.get("Contact No.") or r.get("Phone") or ""
            client_email = r.get("Email Id") or r.get("Email") or ""
            deadline = r.get("Deadline") or r.get("Follow up date") or "Today"
            notes = r.get("Remarks /Updates") or r.get("Last Update") or r.get("Follow-up") or "Proposal in preparation."

            contact_parts = []
            if client_name: contact_parts.append(client_name)
            if client_phone: contact_parts.append(client_phone)
            if client_email: contact_parts.append(client_email)
            contact_str = " • ".join(contact_parts) if contact_parts else "No contact info"

            proposals_today_html += f"""
            <div style="background-color: #ffffff; border: 1px solid #fed7aa; border-left: 4px solid #f97316; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 15px; font-weight: 700; color: #0f172a;">{idx}. {company}</span>
                    <span style="background: #ffedd5; color: #c2410c; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">PROPOSAL TO BE SENT</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #334155;">
                    <tr>
                        <td style="padding: 2px 0; width: 120px; color: #64748b;">Requirement:</td>
                        <td style="padding: 2px 0; font-weight: 600;">{req}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 0; color: #64748b;">Est. Value / Retainer:</td>
                        <td style="padding: 2px 0; font-weight: 700; color: #0f172a;">{format_inr(rev)} {f'(Retainer: {format_inr(retainer)})' if retainer else ''}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 0; color: #64748b;">Cog POC:</td>
                        <td style="padding: 2px 0; font-weight: 600; color: #2563eb;">{poc}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 0; color: #64748b;">Target Date:</td>
                        <td style="padding: 2px 0; font-weight: 600; color: #f97316;">{deadline}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 0; color: #64748b; vertical-align: top;">Notes / Scope:</td>
                        <td style="padding: 2px 0; color: #475569;">{notes}</td>
                    </tr>
                </table>
            </div>
            """

    # Helper for Follow-up Rows
    def render_followup_group(items: List[Dict[str, Any]], title: str, subtitle: str, badge_bg: str, badge_text: str, badge_label: str, border_color: str) -> str:
        if not items:
            return ""
        cards = ""
        for idx, item in enumerate(items, 1):
            r = item["row"]
            sent_d = item.get("sent_date")
            days_ago = item.get("days_ago", 0)
            sent_str = sent_d.strftime("%b %d, %Y") if sent_d else "—"

            company = r.get("Company") or "Lead"
            poc = r.get("Cog POC") or "Unassigned"
            req = r.get("Requirement") or "—"
            rev = r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value") or ""
            notes = r.get("Remarks /Updates") or r.get("Last Update") or r.get("Follow-up") or "No update recorded."
            client_name = r.get("POC Name") or r.get("Name") or ""
            client_phone = r.get("Contact No.") or r.get("Phone") or ""
            contact_str = f"{client_name} ({client_phone})" if client_name and client_phone else (client_name or client_phone or "—")

            cards += f"""
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid {border_color}; border-radius: 8px; padding: 14px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div>
                        <span style="font-size: 14px; font-weight: 700; color: #0f172a;">{idx}. {company}</span>
                        <span style="font-size: 11px; color: #64748b; margin-left: 6px;">(Sent: {sent_str} • {days_ago} days ago)</span>
                    </div>
                    <span style="background: {badge_bg}; color: {badge_text}; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">{badge_label}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #334155;">
                    <tr>
                        <td style="padding: 2px 0; width: 120px; color: #64748b;">Cog POC:</td>
                        <td style="padding: 2px 0;"><strong>{poc}</strong> &nbsp;|&nbsp; Est: <strong>{format_inr(rev)}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 0; color: #64748b;">Client POC:</td>
                        <td style="padding: 2px 0;">{contact_str}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 0; color: #64748b;">Requirement:</td>
                        <td style="padding: 2px 0;">{req}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 0; color: #64748b; vertical-align: top;">Latest Update:</td>
                        <td style="padding: 2px 0; color: #475569;">{notes}</td>
                    </tr>
                </table>
            </div>
            """

        return f"""
        <div style="margin-bottom: 22px;">
            <div style="margin-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">{title}</span>
                <span style="font-size: 11px; color: #64748b; margin-left: 8px;">— {subtitle}</span>
            </div>
            {cards}
        </div>
        """

    day2_html = render_followup_group(
        followups_day2,
        title=f"1st Follow-up Due (Day 2 Cadence) — {len(followups_day2)} Deals",
        subtitle="Initial check-in required 2 days after sending proposal",
        badge_bg="#ccfbf1",
        badge_text="#0f766e",
        badge_label="1st Follow-up",
        border_color="#0d9488"
    )

    day5_html = render_followup_group(
        followups_day5,
        title=f"2nd Follow-up Due (Day 5 Cadence) — {len(followups_day5)} Deals",
        subtitle="Secondary check-in required 5 days after sending proposal",
        badge_bg="#ede9fe",
        badge_text="#6d28d9",
        badge_label="2nd Follow-up",
        border_color="#7c3aed"
    )

    overdue_html = render_followup_group(
        followups_overdue[:15], # cap at top 15 overdue to prevent huge email length
        title=f"⚠️ Overdue Follow-ups (Day 6+ Cadence) — {len(followups_overdue)} Deals",
        subtitle="Dispatched daily until lead stage or status changes (showing top 15)",
        badge_bg="#fee2e2",
        badge_text="#b91c1c",
        badge_label="Action Overdue",
        border_color="#dc2626"
    )

    test_mode_banner = ""
    if is_test_mode:
        test_mode_banner = f"""
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #92400e; font-weight: 600; text-align: center;">
            🧪 TEST MODE ACTIVE: Email routed strictly to <u>{recipients_str}</u>. (Production recipients: kanika@, vaibhav@, daksh@)
        </div>
        """

    total_followups_due = len(followups_day2) + len(followups_day5) + len(followups_overdue)

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 25px 10px; color: #0f172a;">
    <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #31104b 100%); color: #ffffff; padding: 28px 24px; text-align: left;">
            <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #c084fc; margin-bottom: 6px;">
                COG CULTURE • DEAL CLOSING INTELLIGENCE
            </div>
            <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 6px 0;">
                Daily Proposals & Follow-up Action Alert
            </div>
            <div style="font-size: 12px; color: #cbd5e1;">
                {today_formatted} • Action Required
            </div>
        </div>

        <div style="padding: 24px;">
            {test_mode_banner}

            <!-- Summary Action Badges -->
            <div style="display: flex; gap: 10px; margin-bottom: 24px;">
                <div style="flex: 1; background: #fff7ed; border: 1px solid #ffedd5; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #c2410c;">Proposals to Send</div>
                    <div style="font-size: 20px; font-weight: 800; color: #c2410c; margin-top: 4px;">{len(proposals_today)} Deals</div>
                </div>
                <div style="flex: 1; background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #0f766e;">Cadence (Day 2 & 5)</div>
                    <div style="font-size: 20px; font-weight: 800; color: #0f766e; margin-top: 4px;">{len(followups_day2) + len(followups_day5)} Due</div>
                </div>
                <div style="flex: 1; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #b91c1c;">Overdue (Day 6+)</div>
                    <div style="font-size: 20px; font-weight: 800; color: #b91c1c; margin-top: 4px;">{len(followups_overdue)} Due</div>
                </div>
            </div>

            <!-- Part 1: Proposals to be Sent Today -->
            <div style="margin-bottom: 30px;">
                <div style="border-left: 4px solid #ea580c; padding-left: 10px; margin-bottom: 14px;">
                    <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0;">Part 1: Proposals Scheduled To Be Sent ({len(proposals_today)})</h2>
                    <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Deals currently in proposal preparation pipeline</p>
                </div>

                {proposals_today_html}
            </div>

            <!-- Part 2: Proposal Follow-ups Cadence -->
            <div style="margin-bottom: 24px;">
                <div style="border-left: 4px solid #7c3aed; padding-left: 10px; margin-bottom: 14px;">
                    <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0;">Part 2: Proposal Follow-up Cadence ({total_followups_due} Deals Pending)</h2>
                    <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Rule: 1st follow-up after 2 days • 2nd follow-up after 5 days • Continuous reminders thereafter</p>
                </div>

                {day2_html}
                {day5_html}
                {overdue_html}
            </div>

            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="https://crm.cogculture.agency/dashboard?tab=proposals" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 13px; margin: 0 6px;">Open Proposal Tracker</a>
                <a href="https://crm.cogculture.agency/dashboard?tab=follow_ups" style="display: inline-block; background-color: #f1f5f9; color: #0f172a; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 13px; margin: 0 6px; border: 1px solid #e2e8f0;">View Follow-up Dashboard</a>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; font-size: 11px; color: #64748b; text-align: center;">
            This is an automated dispatch from the Cog Culture CRM System.<br>
            Sent via <strong>aryan@cogculture.agency</strong> • Scheduled daily at 10:00 AM IST.
        </div>
    </div>
</body>
</html>
"""
    return subject, html_content

# ---------------------------------------------------------------------------
# Dispatch & Preview Operations
# ---------------------------------------------------------------------------

def dispatch_daily_leads_digest(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    """Generates and dispatches Email 1 to configured recipients."""
    recipients, is_test_mode = get_email_recipients(override_recipient)
    data = fetch_pipeline_digest_data()
    subject, html_content = build_daily_leads_digest_html(data, recipients, is_test_mode)
    
    success = send_email(recipients, subject, html_content)
    return {
        "success": success,
        "subject": subject,
        "recipients": recipients,
        "is_test_mode": is_test_mode,
        "new_leads_count": len(data["leads_yesterday"]),
        "hot_leads_count": len(data["hot_leads"]),
        "displayed_leads_count": len(data["leads_yesterday"]) if data["leads_yesterday"] else len(data["recent_leads"])
    }

def dispatch_proposals_followup_alert(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    """Generates and dispatches Email 2 to configured recipients."""
    recipients, is_test_mode = get_email_recipients(override_recipient)
    data = fetch_pipeline_digest_data()
    subject, html_content = build_proposals_followup_alert_html(data, recipients, is_test_mode)
    
    success = send_email(recipients, subject, html_content)
    return {
        "success": success,
        "subject": subject,
        "recipients": recipients,
        "is_test_mode": is_test_mode,
        "proposals_today_count": len(data["proposals_today"]),
        "followups_day2_count": len(data["followups_day2"]),
        "followups_day5_count": len(data["followups_day5"]),
        "followups_overdue_count": len(data["followups_overdue"]),
        "total_followups_due": len(data["followups_day2"]) + len(data["followups_day5"]) + len(data["followups_overdue"])
    }

def preview_daily_leads_digest(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    """Returns HTML preview and metadata for Email 1 without sending."""
    recipients, is_test_mode = get_email_recipients(override_recipient)
    data = fetch_pipeline_digest_data()
    subject, html_content = build_daily_leads_digest_html(data, recipients, is_test_mode)
    return {
        "subject": subject,
        "html": html_content,
        "recipients": recipients,
        "is_test_mode": is_test_mode,
        "new_leads_count": len(data["leads_yesterday"]),
        "hot_leads_count": len(data["hot_leads"])
    }

def preview_proposals_followup_alert(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    """Returns HTML preview and metadata for Email 2 without sending."""
    recipients, is_test_mode = get_email_recipients(override_recipient)
    data = fetch_pipeline_digest_data()
    subject, html_content = build_proposals_followup_alert_html(data, recipients, is_test_mode)
    return {
        "subject": subject,
        "html": html_content,
        "recipients": recipients,
        "is_test_mode": is_test_mode,
        "proposals_today_count": len(data["proposals_today"]),
        "followups_due_count": len(data["followups_day2"]) + len(data["followups_day5"]) + len(data["followups_overdue"])
    }

# ---------------------------------------------------------------------------
# Legacy Reminders (Retained for backward compatibility)
# ---------------------------------------------------------------------------

def send_deadline_reminder(to_email: str, poc_name: str, company: str, deadline: str, stage: str) -> bool:
    """Dispatch a professional email reminder for an upcoming lead deadline."""
    subject = f"Urgent Action Required: Deadline Approaching for {company}"
    html_content = f"""<!DOCTYPE html><html><body><div style='font-family:sans-serif;padding:20px;'><p>Hi {poc_name},</p><p>Deadline approaching for <strong>{company}</strong>: {deadline}</p></div></body></html>"""
    return send_email(to_email, subject, html_content)

def send_followup_reminder(to_email: str, poc_name: str, company: str, followup_date: str, stage: str) -> bool:
    """Dispatch a professional email reminder for an upcoming lead follow-up date."""
    subject = f"Action Required: Follow-up Scheduled for {company}"
    html_content = f"""<!DOCTYPE html><html><body><div style='font-family:sans-serif;padding:20px;'><p>Hi {poc_name},</p><p>Follow-up scheduled for <strong>{company}</strong> on {followup_date}</p></div></body></html>"""
    return send_email(to_email, subject, html_content)
