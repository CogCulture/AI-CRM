"""
Executive-grade email generation and dispatch service for Cog Culture CRM.
Implements dynamic boardroom reporting for Director & CMO.
"""

import os
import re
import smtplib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union, Tuple
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings
from app.services import config_service, sheets_service
from app.services.email_components import (
    render_preheader,
    render_test_mode_banner,
    render_header,
    render_kpi_strip,
    render_executive_summary_box,
    render_section_title,
    render_horizontal_bar_chart,
    render_heatmap_strip,
    render_chip,
    render_owner_badge,
    render_cta_buttons,
    render_footer,
    wrap_email_document,
    FONT_STACK
)

from email.header import Header

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

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"Cog Culture CRM <{settings.smtp_user}>"
    msg["To"] = to_header

    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_user, recipients, msg.as_string())
        server.quit()
        safe_sub = subject.encode("ascii", "replace").decode("ascii")
        print(f"Successfully sent email '{safe_sub}' to {to_header}")
        return True
    except Exception as e:
        safe_sub = subject.encode("ascii", "replace").decode("ascii")
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
    """
    Gathers, dedupes, and analyzes live CRM data across all tabs.
    Returns dynamic metrics with full data integrity.
    """
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
    # Group by normalized company name, pick row with highest revenue or populated POC
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
                # Prefer row with value or POC
                if (val > existing_val) or (not existing_poc and poc):
                    hot_leads_map[comp_key] = r

    hot_leads = list(hot_leads_map.values())
    # Sort hot leads descending by deal value
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

    # Compute intake value & count of leads with value
    intake_valued_count = sum(1 for r in display_leads if parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value")) > 0)
    intake_total_val = sum(parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value")) for r in display_leads)

    # Compute source breakdown of displayed intake leads
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

    # Sort proposals to send: due/overdue first, then by date
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
                # Dedupe by company for total at risk
                if comp_key not in deduped_followups_map or val > deduped_followups_map[comp_key]["value"]:
                    deduped_followups_map[comp_key] = entry

                if days_ago > 5:
                    followups_overdue_all.append(entry)
                elif days_ago >= 0:
                    followups_due.append(entry)

    # Sort overdue by value descending, then age
    followups_overdue_all.sort(key=lambda x: (x["value"], x["days_ago"]), reverse=True)

    # Ageing buckets across all overdue follow-ups
    b_6_10 = [x for x in followups_overdue_all if 6 <= x["days_ago"] <= 10]
    b_11_20 = [x for x in followups_overdue_all if 11 <= x["days_ago"] <= 20]
    b_21_plus = [x for x in followups_overdue_all if x["days_ago"] >= 21]

    # Total value at risk = sum of distinct company values across due & overdue
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
# Template 1: Daily Leads & New Intake Digest
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

    preheader = f"{len(display_leads)} new leads &bull; {format_inr_compact(hot_val)} hot pipeline &bull; {len(hot_leads)} active hot deals"
    subject = f"[Cog CRM] Leads Digest &bull; {today.strftime('%d %b')} &bull; {len(display_leads)} new, {format_inr_compact(hot_val)} hot pipeline"

    # KPI Strip
    intake_label = "New Leads Intake" if is_yesterday else "Recent Intake"
    intake_subtext = "Added yesterday" if is_yesterday else "Past 7 days &bull; Top 6"
    intake_val_subtext = f"{intake_valued_count} of {len(display_leads)} leads with value" if intake_valued_count > 0 else "No values entered"

    kpis = [
        {"label": intake_label, "value": f"{len(display_leads)} Leads", "subtext": intake_subtext, "value_color": "#0f172a"},
        {"label": "Active Hot Deals", "value": f"{len(hot_leads)} Deals", "subtext": "High intent pipeline", "value_color": "#dc2626"},
        {"label": "Hot Pipeline Value", "value": format_inr_compact(hot_val), "subtext": f"{len(hot_leads)} qualified deals", "value_color": "#0f172a"},
        {"label": "Intake Value", "value": format_inr_compact(intake_val) if intake_val > 0 else "—", "subtext": intake_val_subtext, "value_color": "#0f172a"},
    ]

    # Executive Summary: Top 3 computed highlights
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
            "lead": f"{top_hot_comp} ({top_hot_val_str}) &bull; Owner: {top_hot_owner}:",
            "text": f'"{top_hot_note}"' if top_hot_note else "Top deal in hot pipeline."
        },
        {
            "color": "#d97706",
            "lead": f"{second_hot_comp} ({second_hot_val_str}) &bull; Owner: {second_hot_owner}:",
            "text": f'"{second_hot_note}"' if second_hot_note else "Active in proposal/negotiation."
        },
        {
            "color": "#2563eb",
            "lead": f"{len(display_leads)} Recent Inbound Leads:",
            "text": f"Current source breakdown across recent leads: {source_summary}."
        }
    ]

    # Visual Chart 1: Hot Deal Value by Company (Horizontal Bar Chart)
    chart_hot_items = []
    for h in hot_leads:
        v = parse_num(h.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or h.get("Revenue Estimations") or h.get("Value"))
        chart_hot_items.append({
            "label": h.get("Company", "Lead"),
            "value": v,
            "value_str": format_inr_compact(v),
            "color": "#dc2626" if v >= 2000000 else "#3b82f6"
        })

    # Visual Chart 2: Source Distribution
    chart_source_items = []
    for src, cnt in source_counts.items():
        chart_source_items.append({
            "label": src,
            "value": float(cnt),
            "value_str": f"{cnt} leads",
            "color": "#2563eb"
        })

    # Section 1: Recent / New Intake Leads
    new_leads_rows = ""
    for idx, r in enumerate(display_leads, 1):
        comp = r.get("Company") or "Lead"
        stage = (r.get("Stage") or "Discovery").strip()
        src = (r.get("Lead Source") or r.get("Source") or "Direct").strip()
        poc = (r.get("Cog POC") or "").strip()
        req = (r.get("Requirement") or "General Marketing").strip()
        note = (r.get("Remarks /Updates") or r.get("Last Update") or r.get("Follow-up") or "").strip()
        v = parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value"))
        v_str = format_inr_compact(v)

        c_name = r.get("POC Name") or r.get("Name") or ""
        c_phone = r.get("Contact No.") or r.get("Phone") or ""
        c_email = r.get("Email Id") or r.get("Email") or ""
        contact_links = []
        if c_phone: contact_links.append(f'<a href="tel:{c_phone}" style="color:#2563eb;text-decoration:none;font-weight:600;">{c_phone}</a>')
        if c_email: contact_links.append(f'<a href="mailto:{c_email}" style="color:#2563eb;text-decoration:none;">{c_email}</a>')
        contact_str = " &bull; ".join(contact_links) if contact_links else (c_name or '<span style="color:#94a3b8;">Not set</span>')

        new_leads_rows += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; vertical-align: top;">
                <div style="font-weight: 700; color: #0f172a; font-size: 13px;">{idx}. {comp}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">{src}</div>
            </td>
            <td style="padding: 10px 8px; vertical-align: top;">
                <div style="margin-bottom: 3px;">{render_chip(stage, 'scheduled')}</div>
                <div style="font-size: 11px; color: #475569;">{render_owner_badge(poc)}</div>
            </td>
            <td style="padding: 10px 8px; vertical-align: top; max-width: 170px;">
                <div style="font-size: 12px; color: #1e293b; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{req}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{note if note else '—'}</div>
            </td>
            <td style="padding: 10px 8px; vertical-align: top; text-align: right; white-space: nowrap;">
                <div style="font-weight: 700; color: #0f172a; font-size: 13px;">{v_str}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">{contact_str}</div>
            </td>
        </tr>
        """

    # Section 2: Hot Leads Table
    hot_leads_rows = ""
    for idx, r in enumerate(hot_leads, 1):
        comp = r.get("Company") or "Lead"
        poc = (r.get("Cog POC") or "").strip()
        req = (r.get("Requirement") or "—").strip()
        note = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        v = parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value"))

        hot_leads_rows += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; vertical-align: top; font-weight: 700; color: #0f172a; font-size: 13px; white-space: nowrap;">
                {idx}. {comp}
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-size: 12px; color: #334155;">
                {req}
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-weight: 700; color: #dc2626; font-size: 13px; white-space: nowrap;">
                {format_inr_compact(v)}
            </td>
            <td style="padding: 10px 8px; vertical-align: top; white-space: nowrap;">
                {render_owner_badge(poc)}
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-size: 11px; color: #475569; line-height: 1.35; max-width: 180px;">
                {note if note else '<span style="color:#94a3b8;">Not set</span>'}
            </td>
        </tr>
        """

    # Assembly
    body = f"""
    {render_test_mode_banner(recipients_str) if is_test_mode else ''}
    {render_header("Leads & Intake Digest", today_str)}
    {render_kpi_strip(kpis)}
    {render_executive_summary_box("Executive Summary &bull; Needs Attention Today", summary_items)}

    {render_horizontal_bar_chart("Hot Pipeline Value by Deal", chart_hot_items)}
    {render_horizontal_bar_chart(f"New Intake by Lead Source ({len(display_leads)} Leads)", chart_source_items)}

    {render_section_title(f"New Leads Intake ({len(display_leads)} Leads)", intake_subtext)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <tr>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Company & Source</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Stage & Owner</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Requirement & Note</th>
                <th align="right" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Est. Value & Contact</th>
            </tr>
        </thead>
        <tbody>
            {new_leads_rows}
        </tbody>
    </table>

    {render_section_title(f"Active Hot Pipeline ({len(hot_leads)} Deals)", f"Total Value: {format_inr_compact(hot_val)}")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 18px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <tr>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Company</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Requirement</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Value</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Owner</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Latest Update</th>
            </tr>
        </thead>
        <tbody>
            {hot_leads_rows}
        </tbody>
        <tfoot style="background-color: #f8fafc; border-top: 2px solid #e2e8f0;">
            <tr>
                <td colspan="2" style="padding: 10px 8px; font-family: {FONT_STACK}; font-size: 12px; font-weight: 700; color: #0f172a;">
                    Total Active Hot Pipeline Value
                </td>
                <td colspan="3" style="padding: 10px 8px; font-family: {FONT_STACK}; font-size: 14px; font-weight: 800; color: #dc2626;">
                    {format_inr_compact(hot_val)}
                </td>
            </tr>
        </tfoot>
    </table>

    {render_cta_buttons("Open CRM Dashboard", "https://crm.cogculture.agency/dashboard", "View Active Leads", "https://crm.cogculture.agency/dashboard?tab=internal_leads")}
    {render_footer()}
    """

    html = wrap_email_document(subject, preheader, body)
    return subject, html

# ---------------------------------------------------------------------------
# Template 2: Daily Proposals & Follow-up Action Alert
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

    total_pending_followups = len(followups_due) + len(followups_overdue_all)
    preheader = f"{len(proposals_to_send)} proposals queued &bull; {len(followups_due)} due &bull; {len(followups_overdue_all)} overdue &bull; {format_inr_compact(total_val_at_risk)} value at risk"
    subject = f"[Cog CRM] Action Alert &bull; {today.strftime('%d %b')} &bull; {len(followups_overdue_all)} overdue follow-ups, {len(proposals_to_send)} to send"

    # KPI Strip
    kpis = [
        {"label": "Proposals To Send", "value": f"{len(proposals_to_send)} Deals", "subtext": f"{unassigned_count} unassigned owners", "value_color": "#d97706" if unassigned_count > 0 else "#0f172a"},
        {"label": "Follow-ups Due", "value": f"{len(followups_due)} Deals", "subtext": "Day 2 & Day 5 cadence", "value_color": "#059669"},
        {"label": "Overdue Reminders", "value": f"{len(followups_overdue_all)} Deals", "subtext": "Day 6+ stale cadence", "value_color": "#dc2626"},
        {"label": "Value at Risk", "value": format_inr_compact(total_val_at_risk), "subtext": "Sum of est. value on follow-ups", "value_color": "#0f172a"},
    ]

    # Executive Summary: 3 dynamic bottleneck bullets
    summary_items = [
        {
            "color": "#d97706",
            "lead": f"{unassigned_count} of {len(proposals_to_send)} proposals queued have no owner:",
            "text": "Requires immediate leadership assignment before client delivery."
        }
    ]

    # Find highest value overdue deal
    if followups_overdue_all:
        top_overdue = followups_overdue_all[0]
        top_overdue_comp = top_overdue["row"].get("Company", "Lead")
        top_overdue_val_str = format_inr_compact(top_overdue["value"])
        top_overdue_days = top_overdue["days_ago"]
        top_overdue_poc = (top_overdue["row"].get("Cog POC") or "Unassigned").strip()
        top_overdue_note = (top_overdue["row"].get("Remarks /Updates") or top_overdue["row"].get("Last Update") or "").strip()
        summary_items.append({
            "color": "#dc2626",
            "lead": f"{top_overdue_comp} ({top_overdue_val_str}) &bull; {top_overdue_days}d overdue &bull; Owner: {top_overdue_poc}:",
            "text": f'"{top_overdue_note}"' if top_overdue_note else "Oldest high-value proposal pending client review."
        })

    # Due follow-up highlight
    if followups_due:
        summary_items.append({
            "color": "#059669",
            "lead": f"{len(followups_due)} active proposals reached Day 2/5 milestone:",
            "text": "Initial check-in required to confirm receipt and address client questions."
        })

    # Ageing Heatmap Strip
    ageing_buckets = [
        {"label": "6–10 Days", "count": data["ageing_6_10"], "color_bg": "#fef3c7", "color_text": "#92400e", "subtext": "Fresh overdue"},
        {"label": "11–20 Days", "count": data["ageing_11_20"], "color_bg": "#fee2e2", "color_text": "#b91c1c", "subtext": "Action required"},
        {"label": "21+ Days", "count": data["ageing_21_plus"], "color_bg": "#fecaca", "color_text": "#7f1d1d", "subtext": "Critical staleness"},
    ]

    # Part 1: Proposals To Be Sent Today / Queued Rows
    to_send_rows = ""
    for idx, item in enumerate(proposals_to_send, 1):
        r = item["row"]
        td = item.get("target_date")
        comp = r.get("Company") or "Deal"
        poc = (r.get("Cog POC") or "").strip()
        req = (r.get("Requirement") or "Proposal").strip()
        notes = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        v = parse_num(r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)") or r.get("Revenue Estimations") or r.get("Value"))
        v_str = format_inr_compact(v)

        # Chip determination
        if not td:
            chip_html = render_chip("Scheduled", "scheduled")
            date_display = "No date set"
        else:
            diff_days = (today - td).days
            if diff_days > 0:
                chip_html = render_chip(f"Overdue ({diff_days}d late)", "overdue")
                date_display = td.strftime("%d %b %Y")
            elif diff_days == 0:
                chip_html = render_chip("Due Today", "due_today")
                date_display = "Today"
            else:
                chip_html = render_chip("Scheduled", "scheduled")
                date_display = td.strftime("%d %b %Y")

        to_send_rows += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; vertical-align: top;">
                <div style="font-weight: 700; color: #0f172a; font-size: 13px;">{idx}. {comp}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Target: <strong>{date_display}</strong></div>
            </td>
            <td style="padding: 10px 8px; vertical-align: top;">
                <div style="margin-bottom: 3px;">{chip_html}</div>
                <div>{render_owner_badge(poc)}</div>
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-size: 12px; color: #334155;">
                <div style="font-weight: 600;">{req}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">{notes if notes else '—'}</div>
            </td>
            <td style="padding: 10px 8px; vertical-align: top; text-align: right; font-weight: 700; color: #0f172a; font-size: 13px; white-space: nowrap;">
                {v_str}
            </td>
        </tr>
        """

    # Part 2: Top 10 Overdue Follow-ups
    top_overdue_list = followups_overdue_all[:10]
    overdue_rows = ""
    for idx, item in enumerate(top_overdue_list, 1):
        r = item["row"]
        comp = r.get("Company") or "Deal"
        poc = (r.get("Cog POC") or "").strip()
        req = (r.get("Requirement") or "—").strip()
        notes = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        days_ago = item.get("days_ago", 0)
        v = item.get("value", 0.0)

        c_phone = r.get("Contact No.") or r.get("Phone") or ""
        c_email = r.get("Email Id") or r.get("Email") or ""
        contact_links = []
        if c_phone: contact_links.append(f'<a href="tel:{c_phone}" style="color:#2563eb;text-decoration:none;font-weight:700;">📞 Call</a>')
        if c_email: contact_links.append(f'<a href="mailto:{c_email}" style="color:#2563eb;text-decoration:none;font-weight:700;">✉️ Email</a>')
        contact_action = " &bull; ".join(contact_links) if contact_links else '<span style="color:#94a3b8;">No contact</span>'

        overdue_rows += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; vertical-align: top;">
                <div style="font-weight: 700; color: #0f172a; font-size: 13px;">{idx}. {comp}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">{format_inr_compact(v)}</div>
            </td>
            <td style="padding: 10px 8px; vertical-align: top; white-space: nowrap;">
                <div style="margin-bottom: 3px;">{render_chip(f"{days_ago}d overdue", "overdue")}</div>
                <div>{render_owner_badge(poc)}</div>
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-size: 11px; color: #334155; line-height: 1.35;">
                <div style="font-weight: 600; color: #0f172a;">{req}</div>
                <div style="color: #64748b; margin-top: 2px;">{notes if notes else '—'}</div>
            </td>
            <td style="padding: 10px 8px; vertical-align: top; text-align: right; white-space: nowrap; font-size: 11px;">
                {contact_action}
            </td>
        </tr>
        """

    body = f"""
    {render_test_mode_banner(recipients_str) if is_test_mode else ''}
    {render_header("Proposals & Follow-up Action Alert", today_str)}
    {render_kpi_strip(kpis)}
    {render_executive_summary_box("Executive Summary &bull; Bottleneck Watch", summary_items)}

    {render_heatmap_strip(f"Overdue Ageing Breakdown ({len(followups_overdue_all)} Total Overdue Deals)", ageing_buckets)}

    {render_section_title(f"Part 1: Proposals Scheduled To Be Sent ({len(proposals_to_send)} Deals)", f"{unassigned_count} unassigned")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <tr>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Company & Target</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Status & Owner</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Requirement & Scope</th>
                <th align="right" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Est. Value</th>
            </tr>
        </thead>
        <tbody>
            {to_send_rows}
        </tbody>
    </table>

    {render_section_title(f"Part 2: Overdue Follow-ups (Top 10 of {len(followups_overdue_all)})", f"Value at Risk: {format_inr_compact(total_val_at_risk)}")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <tr>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Company & Value</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Ageing & Owner</th>
                <th align="left" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Requirement & Note</th>
                <th align="right" style="padding: 8px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Quick Action</th>
            </tr>
        </thead>
        <tbody>
            {overdue_rows}
        </tbody>
    </table>

    <div style="text-align: center; font-family: {FONT_STACK}; font-size: 12px; color: #64748b; margin-bottom: 22px;">
        Showing top 10 overdue deals &bull; <a href="https://crm.cogculture.agency/dashboard?tab=follow_ups" target="_blank" style="color: #2563eb; font-weight: 600;">View all {len(followups_overdue_all)} overdue deals in CRM &rarr;</a>
    </div>

    {render_cta_buttons("Open Proposal Tracker", "https://crm.cogculture.agency/dashboard?tab=proposals", "View Follow-up Dashboard", "https://crm.cogculture.agency/dashboard?tab=follow_ups")}
    {render_footer()}
    """

    html = wrap_email_document(subject, preheader, body)
    return subject, html

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
        "hot_deals_count": len(data["hot_leads"]),
        "hot_pipeline_value": data["hot_pipeline_value"],
        "displayed_leads_count": len(data["display_leads"])
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

# Legacy stubs retained for compatibility
def send_deadline_reminder(to_email: str, poc_name: str, company: str, deadline: str, stage: str) -> bool:
    subject = f"Urgent Action Required: Deadline Approaching for {company}"
    html = f"<p>Hi {poc_name}, deadline approaching for {company}: {deadline}</p>"
    return send_email(to_email, subject, html)

def send_followup_reminder(to_email: str, poc_name: str, company: str, followup_date: str, stage: str) -> bool:
    subject = f"Action Required: Follow-up Scheduled for {company}"
    html = f"<p>Hi {poc_name}, follow-up scheduled for {company} on {followup_date}</p>"
    return send_email(to_email, subject, html)
