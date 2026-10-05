"""
Executive-grade email generation and dispatch service for Cog Culture CRM.
Implements dynamic, minimalist boardroom reporting for Director & CMO.
"""

import os
import re
import smtplib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union, Tuple
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header

from app.config import settings
from app.services import config_service, sheets_service
from app.services.email_components import (
    render_preheader,
    render_test_mode_banner,
    render_header,
    render_kpi_strip,
    render_executive_summary_box,
    render_section_title,
    render_chip,
    render_owner_tag,
    render_cta_button,
    render_footer,
    wrap_email_document,
    FONT_STACK
)

# ---------------------------------------------------------------------------
# Core SMTP Dispatch
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

    # Ensure subject has no raw HTML entities
    clean_subject = subject.replace("&bull;", "·")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(clean_subject, "utf-8")
    msg["From"] = f"Cog Culture CRM <{settings.smtp_user}>"
    msg["To"] = to_header

    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_user, recipients, msg.as_string())
        server.quit()
        safe_sub = clean_subject.encode("ascii", "replace").decode("ascii")
        print(f"Successfully sent email '{safe_sub}' to {to_header}")
        return True
    except Exception as e:
        safe_sub = clean_subject.encode("ascii", "replace").decode("ascii")
        print(f"Failed to send email to {to_header}: {safe_sub} | error: {e}")
        return False

def get_email_recipients(override_recipient: Optional[str] = None) -> Tuple[List[str], bool]:
    """Returns (recipients_list, is_test_mode)."""
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
# Formatting & Parsing Helpers
# ---------------------------------------------------------------------------

def robust_parse_date(date_val: Any) -> Optional[datetime.date]:
    """Parse common CRM date formats into datetime.date."""
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
            if p3 < 100: p3 += 2000
            if p1 > 1900: return datetime(p1, p2, p3).date()
            if p3 > 1900: return datetime(p3, p2, p1).date()
        except Exception:
            pass
    return None

def parse_num(val: Any) -> float:
    """Parse currency / numeric string safely."""
    if not val:
        return 0.0
    clean_val = str(val).split("(")[0].replace(",", "").replace("₹", "").replace("$", "").strip()
    try:
        return float(clean_val)
    except Exception:
        return 0.0

def format_inr_compact(num: float) -> str:
    """Format in boardroom Indian currency notation (₹1.68 Cr, ₹84.0L, ₹21.0L)."""
    if not num or num <= 0:
        return "Not set"
    if num >= 10000000:
        cr_val = num / 10000000.0
        return f"₹{cr_val:.2f} Cr"
    elif num >= 100000:
        l_val = num / 100000.0
        return f"₹{l_val:.1f}L"
    else:
        return f"₹{int(round(num)):,}"

def is_test_record(company_name: str) -> bool:
    """Flags test / placeholder lead rows that should be purged."""
    clean = (company_name or "").strip().lower()
    return clean in ["ldmckjvc r", "test", "test lead", "placeholder", "demo", "sample"]

# ---------------------------------------------------------------------------
# Data Collection & Dynamic Pipeline Analytics
# ---------------------------------------------------------------------------

def fetch_pipeline_digest_data() -> Dict[str, Any]:
    """Gathers, dedupes, and analyzes live CRM data across all tabs."""
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

    today = (datetime.utcnow() + timedelta(hours=5, minutes=30)).date()
    yesterday = today - timedelta(days=1)

    # 1. Deduplicate & Clean Hot Leads
    hot_leads_map: Dict[str, Dict[str, Any]] = {}
    audit_deduped_hot: List[str] = []
    audit_filtered_test: List[str] = []

    for r in all_rows:
        company = (r.get("Company") or "").strip()
        if not company:
            continue
        if is_test_record(company):
            if company not in audit_filtered_test:
                audit_filtered_test.append(company)
            continue

        st = str(r.get("Status", "")).strip().lower()
        stg = str(r.get("Stage", "")).strip().lower()

        if st == "hot" and not any(x in stg for x in ["won", "lost", "dead", "dropped"]):
            comp_key = company.lower()
            val = parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value"))
            poc = (r.get("Cog POC") or "").strip()

            if comp_key not in hot_leads_map:
                hot_leads_map[comp_key] = r
            else:
                audit_deduped_hot.append(company)
                existing = hot_leads_map[comp_key]
                existing_val = parse_num(existing.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or existing.get("Revenue Estimations") or existing.get("Value"))
                existing_poc = (existing.get("Cog POC") or "").strip()
                # Pick row with value or POC
                if (val > existing_val) or (not existing_poc and poc):
                    hot_leads_map[comp_key] = r

    hot_leads = list(hot_leads_map.values())
    hot_leads.sort(key=lambda r: parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value")), reverse=True)
    hot_pipeline_value = sum(parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value")) for r in hot_leads)

    # 2. Recent & New Intake Leads
    leads_yesterday = []
    sorted_by_date = []
    for r in all_rows:
        company = (r.get("Company") or "").strip()
        if not company or is_test_record(company):
            continue
        d = robust_parse_date(r.get("Date"))
        if d:
            sorted_by_date.append((d, r))
            if d == yesterday:
                leads_yesterday.append(r)

    sorted_by_date.sort(key=lambda x: x[0], reverse=True)
    recent_leads = [item[1] for item in sorted_by_date[:6]]
    display_leads = leads_yesterday if leads_yesterday else recent_leads
    is_yesterday_intake = len(leads_yesterday) > 0

    intake_valued_count = sum(1 for r in display_leads if parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value")) > 0)
    intake_total_val = sum(parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value")) for r in display_leads)

    intake_source_counts: Dict[str, int] = {}
    for r in display_leads:
        src = (r.get("Lead Source") or r.get("Source") or "Direct / Inbound").strip()
        intake_source_counts[src] = intake_source_counts.get(src, 0) + 1

    # 3. Proposals to be sent today / queued
    proposals_to_send_raw = []
    for r in all_rows:
        company = (r.get("Company") or "").strip()
        if not company or is_test_record(company):
            continue
        st = str(r.get("Status", "")).strip().lower()
        stg = str(r.get("Stage", "")).strip().lower()
        if any(x in st for x in ["won", "lost", "dead", "dropped"]) or any(x in stg for x in ["won", "lost", "dead", "dropped"]):
            continue

        if "proposal to be sent" in stg or "portfolio to be sent" in stg:
            dline = robust_parse_date(r.get("Deadline")) or robust_parse_date(r.get("Follow up date"))
            proposals_to_send_raw.append({"row": r, "target_date": dline})

    def proposal_sort_key(item):
        td = item.get("target_date")
        if not td: return 9999
        return (td - today).days

    proposals_to_send_raw.sort(key=proposal_sort_key)
    unassigned_proposals_count = sum(1 for p in proposals_to_send_raw if not (p["row"].get("Cog POC") or "").strip() or (p["row"].get("Cog POC") or "").strip().lower() in ["unassigned", "none", "—"])

    # 4. Proposals Follow-ups (Cadence & Overdue)
    followups_due = []
    followups_overdue_all = []
    deduped_followups_map: Dict[str, Dict[str, Any]] = {}

    for r in all_rows:
        company = (r.get("Company") or "").strip()
        if not company or is_test_record(company):
            continue
        st = str(r.get("Status", "")).strip().lower()
        stg = str(r.get("Stage", "")).strip().lower()
        if any(x in st for x in ["won", "lost", "dead", "dropped"]) or any(x in stg for x in ["won", "lost", "dead", "dropped"]):
            continue

        if "proposal sent" in stg or "portfolio sent" in stg:
            sent_d = robust_parse_date(r.get("Date")) or robust_parse_date(r.get("Follow up date"))
            if sent_d:
                days_ago = (today - sent_d).days
                val = parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value"))
                entry = {"row": r, "sent_date": sent_d, "days_ago": days_ago, "value": val}

                comp_key = company.lower()
                if comp_key not in deduped_followups_map or val > deduped_followups_map[comp_key]["value"]:
                    deduped_followups_map[comp_key] = entry

                if days_ago > 5:
                    followups_overdue_all.append(entry)
                elif days_ago >= 0:
                    followups_due.append(entry)

    followups_overdue_all.sort(key=lambda x: (x["value"], x["days_ago"]), reverse=True)

    b_6_10 = [x for x in followups_overdue_all if 6 <= x["days_ago"] <= 10]
    b_11_20 = [x for x in followups_overdue_all if 11 <= x["days_ago"] <= 20]
    b_21_plus = [x for x in followups_overdue_all if x["days_ago"] >= 21]

    total_val_at_risk = sum(item["value"] for item in deduped_followups_map.values())

    return {
        "today": today,
        "yesterday": yesterday,
        "hot_leads": hot_leads,
        "hot_pipeline_value": hot_pipeline_value,
        "display_leads": display_leads,
        "is_yesterday_intake": is_yesterday_intake,
        "intake_valued_count": intake_valued_count,
        "intake_total_val": intake_total_val,
        "intake_source_counts": intake_source_counts,
        "proposals_to_send": proposals_to_send_raw,
        "unassigned_proposals_count": unassigned_proposals_count,
        "followups_due": followups_due,
        "followups_overdue_all": followups_overdue_all,
        "ageing_6_10": len(b_6_10),
        "ageing_11_20": len(b_11_20),
        "ageing_21_plus": len(b_21_plus),
        "total_val_at_risk": total_val_at_risk,
        "audit_deduped_hot": audit_deduped_hot,
        "audit_filtered_test": audit_filtered_test,
    }

# ---------------------------------------------------------------------------
# Template 1: Daily Leads & New Intake Digest (Minimalist)
# ---------------------------------------------------------------------------

def build_daily_leads_digest_html(data: Dict[str, Any], recipients: List[str], is_test_mode: bool) -> Tuple[str, str]:
    today = data["today"]
    today_str = today.strftime("%d %b %Y")
    recipients_str = ", ".join(recipients)

    hot_leads = data["hot_leads"]
    hot_val = data["hot_pipeline_value"]
    display_leads = data["display_leads"]
    is_yesterday = data["is_yesterday_intake"]
    intake_val = data["intake_total_val"]
    intake_valued_count = data["intake_valued_count"]
    source_counts = data["intake_source_counts"]

    preheader = f"{len(display_leads)} new leads · {format_inr_compact(hot_val)} hot pipeline · {len(hot_leads)} active hot deals"
    subject = f"[Cog CRM] Leads Digest · {today.strftime('%d %b')} · {len(display_leads)} new, {format_inr_compact(hot_val)} hot pipeline"

    # KPI Strip
    intake_label = "New Leads Intake" if is_yesterday else "Recent Intake"
    intake_subtext = "Added yesterday" if is_yesterday else "Past 7 days · Top 6"
    intake_val_subtext = f"{intake_valued_count} of {len(display_leads)} leads with value" if intake_valued_count > 0 else "No values entered"

    kpis = [
        {"label": intake_label, "value": f"{len(display_leads)} Leads", "subtext": intake_subtext, "value_color": "#0f172a"},
        {"label": "Active Hot Deals", "value": f"{len(hot_leads)} Deals", "subtext": "High intent pipeline", "value_color": "#dc2626"},
        {"label": "Hot Pipeline Value", "value": format_inr_compact(hot_val), "subtext": f"{len(hot_leads)} qualified deals", "value_color": "#0f172a"},
        {"label": "Intake Value", "value": format_inr_compact(intake_val) if intake_val > 0 else "—", "subtext": intake_val_subtext, "value_color": "#0f172a"},
    ]

    # Executive Summary: 3 dynamic highlights with status dots
    top_hot_deal = hot_leads[0] if hot_leads else None
    top_hot_comp = top_hot_deal.get("Company", "") if top_hot_deal else ""
    top_hot_val_str = format_inr_compact(parse_num(top_hot_deal.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or top_hot_deal.get("Revenue Estimations") or top_hot_deal.get("Value"))) if top_hot_deal else ""
    top_hot_owner = (top_hot_deal.get("Cog POC") or "Unassigned").strip() if top_hot_deal else ""
    top_hot_note = (top_hot_deal.get("Remarks /Updates") or top_hot_deal.get("Last Update") or "").strip() if top_hot_deal else ""

    second_hot = hot_leads[1] if len(hot_leads) > 1 else None
    second_hot_comp = second_hot.get("Company", "") if second_hot else ""
    second_hot_val_str = format_inr_compact(parse_num(second_hot.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or second_hot.get("Revenue Estimations") or second_hot.get("Value"))) if second_hot else ""
    second_hot_owner = (second_hot.get("Cog POC") or "Unassigned").strip() if second_hot else ""
    second_hot_note = (second_hot.get("Remarks /Updates") or second_hot.get("Last Update") or "").strip() if second_hot else ""

    source_summary = ", ".join([f"{src} ({cnt})" for src, cnt in source_counts.items()])

    summary_items = [
        {
            "color": "#dc2626",
            "lead": f"{top_hot_comp} ({top_hot_val_str}) · Owner: {top_hot_owner}:",
            "text": f'"{top_hot_note}"' if top_hot_note else "Top deal in hot pipeline."
        },
        {
            "color": "#d97706",
            "lead": f"{second_hot_comp} ({second_hot_val_str}) · Owner: {second_hot_owner}:",
            "text": f'"{second_hot_note}"' if second_hot_note else "Active in hot pipeline."
        },
        {
            "color": "#2563eb",
            "lead": f"{len(display_leads)} Recent Leads Intake:",
            "text": f"Source distribution: {source_summary}."
        }
    ]

    # Section 1: Active Hot Deals (Minimalist 2-row List Format - Never Overflows)
    hot_leads_items = ""
    for idx, r in enumerate(hot_leads, 1):
        comp = (r.get("Company") or "Lead").strip()
        poc = (r.get("Cog POC") or "").strip()
        req = (r.get("Requirement") or "").strip()
        note = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        v = parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value"))
        v_str = format_inr_compact(v)

        hot_leads_items += f"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #f1f5f9; padding: 8px 0; table-layout: fixed;">
            <tr>
                <td valign="top" style="font-family:{FONT_STACK};">
                    <span style="font-size:13px; font-weight:700; color:#0f172a;">{idx}. {comp}</span>
                </td>
                <td align="right" valign="top" style="font-family:{FONT_STACK}; font-size:13px; font-weight:800; color:#dc2626; white-space:nowrap; padding-left:8px;">
                    {v_str}
                </td>
            </tr>
            <tr>
                <td colspan="2" style="font-family:{FONT_STACK}; font-size:11px; color:#475569; padding-top:2px; line-height:1.4;">
                    {render_owner_tag(poc)} {f'&middot; {req}' if req else ''} {f'&middot; <span style="color:#64748b;">{note}</span>' if note else ''}
                </td>
            </tr>
        </table>
        """

    # Section 2: Recent Intake Leads (Minimalist 2-row List Format)
    new_leads_items = ""
    for idx, r in enumerate(display_leads, 1):
        comp = (r.get("Company") or "Lead").strip()
        stage = (r.get("Stage") or "Discovery").strip()
        src = (r.get("Lead Source") or r.get("Source") or "Direct").strip()
        poc = (r.get("Cog POC") or "").strip()
        req = (r.get("Requirement") or "").strip()
        note = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        v = parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value"))
        v_str = format_inr_compact(v)

        c_phone = r.get("Contact No.") or r.get("Phone") or ""
        c_email = r.get("Email Id") or r.get("Email") or ""
        contact_links = []
        if c_phone: contact_links.append(f'<a href="tel:{c_phone}" style="color:#2563eb;font-weight:600;">Call</a>')
        if c_email: contact_links.append(f'<a href="mailto:{c_email}" style="color:#2563eb;font-weight:600;">Email</a>')
        contact_html = f"&middot; {' / '.join(contact_links)}" if contact_links else ""

        new_leads_items += f"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #f1f5f9; padding: 8px 0; table-layout: fixed;">
            <tr>
                <td valign="top" style="font-family:{FONT_STACK};">
                    <span style="font-size:13px; font-weight:700; color:#0f172a;">{idx}. {comp}</span>
                    <span style="font-size:11px; color:#64748b; margin-left:6px;">{src}</span>
                </td>
                <td align="right" valign="top" style="font-family:{FONT_STACK}; white-space:nowrap; padding-left:8px;">
                    {f'<span style="font-size:13px; font-weight:700; color:#0f172a;">{v_str}</span>' if v > 0 else render_chip(stage, 'scheduled')}
                </td>
            </tr>
            <tr>
                <td colspan="2" style="font-family:{FONT_STACK}; font-size:11px; color:#475569; padding-top:2px; line-height:1.4;">
                    {render_owner_tag(poc)} {f'&middot; {req}' if req else ''} {contact_html} {f'&middot; <span style="color:#64748b;">{note}</span>' if note else ''}
                </td>
            </tr>
        </table>
        """

    body = f"""
    {render_test_mode_banner(recipients_str) if is_test_mode else ''}
    {render_header("Leads & Intake Digest", today_str)}
    {render_kpi_strip(kpis)}
    {render_executive_summary_box("Executive Summary · Needs Attention Today", summary_items)}

    {render_section_title("Active Hot Pipeline", f"{len(hot_leads)} Deals · {format_inr_compact(hot_val)} Total")}
    <div style="margin-bottom: 20px;">
        {hot_leads_items}
    </div>

    {render_section_title(intake_label, f"{len(display_leads)} Deals · {intake_subtext}")}
    <div style="margin-bottom: 18px;">
        {new_leads_items}
    </div>

    {render_cta_button("Open CRM Dashboard", "https://crm.cogculture.agency/dashboard")}
    {render_footer()}
    """

    html = wrap_email_document(subject, preheader, body)
    return subject, html

# ---------------------------------------------------------------------------
# Template 2: Daily Proposals & Follow-up Action Alert (Minimalist)
# ---------------------------------------------------------------------------

def build_proposals_followup_alert_html(data: Dict[str, Any], recipients: List[str], is_test_mode: bool) -> Tuple[str, str]:
    today = data["today"]
    today_str = today.strftime("%d %b %Y")
    recipients_str = ", ".join(recipients)

    proposals_to_send = data["proposals_to_send"]
    unassigned_count = data["unassigned_proposals_count"]
    followups_due = data["followups_due"]
    followups_overdue_all = data["followups_overdue_all"]
    total_val_at_risk = data["total_val_at_risk"]

    preheader = f"{len(proposals_to_send)} proposals queued · {len(followups_due)} due · {len(followups_overdue_all)} overdue · {format_inr_compact(total_val_at_risk)} value at risk"
    subject = f"[Cog CRM] Action Alert · {today.strftime('%d %b')} · {len(followups_overdue_all)} overdue follow-ups, {len(proposals_to_send)} to send"

    # KPI Strip
    kpis = [
        {"label": "Proposals To Send", "value": f"{len(proposals_to_send)} Deals", "subtext": f"{unassigned_count} unassigned", "value_color": "#d97706" if unassigned_count > 0 else "#0f172a"},
        {"label": "Follow-ups Due", "value": f"{len(followups_due)} Deals", "subtext": "Day 2 & Day 5 cadence", "value_color": "#059669"},
        {"label": "Overdue Reminders", "value": f"{len(followups_overdue_all)} Deals", "subtext": "Day 6+ stale cadence", "value_color": "#dc2626"},
        {"label": "Value at Risk", "value": format_inr_compact(total_val_at_risk), "subtext": "Sum on due & overdue", "value_color": "#0f172a"},
    ]

    # Executive Summary: 3 dynamic bottleneck bullets
    summary_items = [
        {
            "color": "#d97706",
            "lead": f"{unassigned_count} of {len(proposals_to_send)} proposals to send have no owner:",
            "text": "Requires immediate leadership assignment before delivery."
        }
    ]

    if followups_overdue_all:
        top_overdue = followups_overdue_all[0]
        top_overdue_comp = top_overdue["row"].get("Company", "Lead")
        top_overdue_val_str = format_inr_compact(top_overdue["value"])
        top_overdue_days = top_overdue["days_ago"]
        top_overdue_poc = (top_overdue["row"].get("Cog POC") or "Unassigned").strip()
        top_overdue_note = (top_overdue["row"].get("Remarks /Updates") or top_overdue["row"].get("Last Update") or "").strip()
        summary_items.append({
            "color": "#dc2626",
            "lead": f"{top_overdue_comp} ({top_overdue_val_str}) · {top_overdue_days}d overdue · {top_overdue_poc}:",
            "text": f'"{top_overdue_note}"' if top_overdue_note else "Oldest high-value proposal pending client response."
        })

    summary_items.append({
        "color": "#2563eb",
        "lead": f"Pipeline Ageing Overview ({len(followups_overdue_all)} Overdue Deals):",
        "text": f"6–10 days: {data['ageing_6_10']} deals · 11–20 days: {data['ageing_11_20']} deals · 21+ days: {data['ageing_21_plus']} stale deals."
    })

    # Part 1: Proposals To Be Sent List (Minimalist 2-row layout)
    to_send_items = ""
    for idx, item in enumerate(proposals_to_send, 1):
        r = item["row"]
        td = item.get("target_date")
        comp = (r.get("Company") or "Deal").strip()
        poc = (r.get("Cog POC") or "").strip()
        req = (r.get("Requirement") or "Proposal").strip()
        notes = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        v = parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value"))
        v_str = format_inr_compact(v)

        if not td:
            chip_html = render_chip("Scheduled", "scheduled")
        else:
            diff_days = (today - td).days
            if diff_days > 0:
                chip_html = render_chip(f"Overdue ({diff_days}d late)", "overdue")
            elif diff_days == 0:
                chip_html = render_chip("Due Today", "due_today")
            else:
                chip_html = render_chip("Scheduled", "scheduled")

        to_send_items += f"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #f1f5f9; padding: 8px 0; table-layout: fixed;">
            <tr>
                <td valign="top" style="font-family:{FONT_STACK};">
                    <span style="font-size:13px; font-weight:700; color:#0f172a;">{idx}. {comp}</span>
                    {f'<span style="font-size:12px; font-weight:700; color:#0f172a; margin-left:6px;">({v_str})</span>' if v > 0 else ''}
                </td>
                <td align="right" valign="top" style="font-family:{FONT_STACK}; white-space:nowrap; padding-left:8px;">
                    {chip_html}
                </td>
            </tr>
            <tr>
                <td colspan="2" style="font-family:{FONT_STACK}; font-size:11px; color:#475569; padding-top:2px; line-height:1.4;">
                    {render_owner_tag(poc)} {f'&middot; {req}' if req else ''} {f'&middot; <span style="color:#64748b;">{notes}</span>' if notes else ''}
                </td>
            </tr>
        </table>
        """

    # Part 2: Top Overdue Follow-ups (Top 10)
    top_overdue_list = followups_overdue_all[:10]
    overdue_items = ""
    for idx, item in enumerate(top_overdue_list, 1):
        r = item["row"]
        comp = (r.get("Company") or "Deal").strip()
        poc = (r.get("Cog POC") or "").strip()
        req = (r.get("Requirement") or "").strip()
        notes = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        days_ago = item.get("days_ago", 0)
        v = item.get("value", 0.0)
        v_str = format_inr_compact(v)

        c_phone = r.get("Contact No.") or r.get("Phone") or ""
        c_email = r.get("Email Id") or r.get("Email") or ""
        contact_links = []
        if c_phone: contact_links.append(f'<a href="tel:{c_phone}" style="color:#2563eb;font-weight:700;">Call</a>')
        if c_email: contact_links.append(f'<a href="mailto:{c_email}" style="color:#2563eb;font-weight:700;">Email</a>')
        contact_html = f"&middot; {' / '.join(contact_links)}" if contact_links else ""

        overdue_items += f"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #f1f5f9; padding: 8px 0; table-layout: fixed;">
            <tr>
                <td valign="top" style="font-family:{FONT_STACK};">
                    <span style="font-size:13px; font-weight:700; color:#0f172a;">{idx}. {comp}</span>
                    {f'<span style="font-size:12px; font-weight:700; color:#0f172a; margin-left:6px;">({v_str})</span>' if v > 0 else ''}
                </td>
                <td align="right" valign="top" style="font-family:{FONT_STACK}; white-space:nowrap; padding-left:8px;">
                    {render_chip(f"{days_ago}d overdue", "overdue")}
                </td>
            </tr>
            <tr>
                <td colspan="2" style="font-family:{FONT_STACK}; font-size:11px; color:#475569; padding-top:2px; line-height:1.4;">
                    {render_owner_tag(poc)} {f'&middot; {req}' if req else ''} {contact_html} {f'&middot; <span style="color:#64748b;">{notes}</span>' if notes else ''}
                </td>
            </tr>
        </table>
        """

    body = f"""
    {render_test_mode_banner(recipients_str) if is_test_mode else ''}
    {render_header("Proposals & Follow-up Action Alert", today_str)}
    {render_kpi_strip(kpis)}
    {render_executive_summary_box("Executive Summary · Bottleneck Watch", summary_items)}

    {render_section_title("Part 1: Proposals To Be Sent", f"{len(proposals_to_send)} Deals · {unassigned_count} Unassigned")}
    <div style="margin-bottom: 20px;">
        {to_send_items}
    </div>

    {render_section_title("Part 2: Overdue Follow-ups", f"Top 10 of {len(followups_overdue_all)} · {format_inr_compact(total_val_at_risk)} at Risk")}
    <div style="margin-bottom: 16px;">
        {overdue_items}
    </div>

    <div style="text-align: center; font-family: {FONT_STACK}; font-size: 11px; color: #64748b; margin-bottom: 20px;">
        Showing top 10 overdue deals &bull; <a href="https://crm.cogculture.agency/dashboard?tab=follow_ups" target="_blank" style="color: #2563eb; font-weight: 600;">View all {len(followups_overdue_all)} overdue deals in CRM &rarr;</a>
    </div>

    {render_cta_button("Open Proposal Tracker", "https://crm.cogculture.agency/dashboard?tab=proposals")}
    {render_footer()}
    """

    html = wrap_email_document(subject, preheader, body)
    return subject, html

# ---------------------------------------------------------------------------
# Dispatch & Preview Operations
# ---------------------------------------------------------------------------

def dispatch_daily_leads_digest(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    recipients, is_test_mode = get_email_recipients(override_recipient)
    data = fetch_pipeline_digest_data()
    subject, html_content = build_daily_leads_digest_html(data, recipients, is_test_mode)
    success = send_email(recipients, subject, html_content)
    return {
        "success": success,
        "subject": subject,
        "recipients": recipients,
        "is_test_mode": is_test_mode,
        "hot_deals_count": len(data["hot_leads"]),
        "hot_pipeline_value": data["hot_pipeline_value"],
        "displayed_leads_count": len(data["display_leads"])
    }

def dispatch_proposals_followup_alert(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    recipients, is_test_mode = get_email_recipients(override_recipient)
    data = fetch_pipeline_digest_data()
    subject, html_content = build_proposals_followup_alert_html(data, recipients, is_test_mode)
    success = send_email(recipients, subject, html_content)
    return {
        "success": success,
        "subject": subject,
        "recipients": recipients,
        "is_test_mode": is_test_mode,
        "proposals_to_send_count": len(data["proposals_to_send"]),
        "unassigned_proposals_count": data["unassigned_proposals_count"],
        "followups_due_count": len(data["followups_due"]),
        "followups_overdue_count": len(data["followups_overdue_all"]),
        "total_val_at_risk": data["total_val_at_risk"]
    }

def preview_daily_leads_digest(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    recipients, is_test_mode = get_email_recipients(override_recipient)
    data = fetch_pipeline_digest_data()
    subject, html_content = build_daily_leads_digest_html(data, recipients, is_test_mode)
    return {
        "subject": subject,
        "html": html_content,
        "recipients": recipients,
        "is_test_mode": is_test_mode,
        "hot_deals_count": len(data["hot_leads"]),
        "hot_pipeline_value": data["hot_pipeline_value"],
        "displayed_leads_count": len(data["display_leads"])
    }

def preview_proposals_followup_alert(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    recipients, is_test_mode = get_email_recipients(override_recipient)
    data = fetch_pipeline_digest_data()
    subject, html_content = build_proposals_followup_alert_html(data, recipients, is_test_mode)
    return {
        "subject": subject,
        "html": html_content,
        "recipients": recipients,
        "is_test_mode": is_test_mode,
        "proposals_to_send_count": len(data["proposals_to_send"]),
        "unassigned_proposals_count": data["unassigned_proposals_count"],
        "followups_overdue_count": len(data["followups_overdue_all"]),
        "total_val_at_risk": data["total_val_at_risk"]
    }

def send_deadline_reminder(to_email: str, poc_name: str, company: str, deadline: str, stage: str) -> bool:
    subject = f"Urgent Action Required: Deadline Approaching for {company}"
    html = f"<p>Hi {poc_name}, deadline approaching for {company}: {deadline}</p>"
    return send_email(to_email, subject, html)

def send_followup_reminder(to_email: str, poc_name: str, company: str, followup_date: str, stage: str) -> bool:
    subject = f"Action Required: Follow-up Scheduled for {company}"
    html = f"<p>Hi {poc_name}, follow-up scheduled for {company} on {followup_date}</p>"
    return send_email(to_email, subject, html)
