"""
Executive-grade email generation and dispatch service for Cog Culture CRM.
Minimalist boardroom reporting for Director & CMO — clean, scannable, professional.
"""

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
    render_status_badge,
    render_chip,
    render_owner_tag,
    render_lead_card,
    render_cta_button,
    render_footer,
    wrap_email_document,
    FONT_STACK,
    TEXT_MUTED,
    TEXT_BODY,
    TEXT_HEADING,
    BORDER,
)

# ---------------------------------------------------------------------------
# Core SMTP Dispatch
# ---------------------------------------------------------------------------

def send_email(
    to_email: Union[str, List[str]],
    subject: str,
    html_content: str,
    bcc_emails: Optional[Union[str, List[str]]] = None
) -> bool:
    """Send an HTML email via SMTP to one or multiple recipients with optional BCC recipients."""
    if not settings.smtp_user or not settings.smtp_password:
        print("SMTP credentials not configured. Skipping dispatch.")
        return False

    if isinstance(to_email, list):
        recipients = [e.strip() for e in to_email if e and e.strip()]
        to_header = ", ".join(recipients)
    else:
        recipients = [to_email.strip()] if to_email and to_email.strip() else []
        to_header = to_email.strip() if to_email else ""

    if not recipients:
        print("No valid recipients. Skipping dispatch.")
        return False

    # Build envelope recipients for SMTP delivery (To + BCC)
    envelope_recipients = list(recipients)
    bcc_list: List[str] = []
    if bcc_emails:
        if isinstance(bcc_emails, list):
            bcc_list = [e.strip() for e in bcc_emails if e and e.strip()]
        else:
            bcc_list = [bcc_emails.strip()] if bcc_emails and bcc_emails.strip() else []
        for bcc_addr in bcc_list:
            if bcc_addr not in envelope_recipients:
                envelope_recipients.append(bcc_addr)

    clean_subject = subject.replace("&bull;", "·")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(clean_subject, "utf-8")
    msg["From"] = f"Cog Culture CRM <{settings.smtp_user}>"
    msg["To"] = to_header
    # NOTE: msg["Bcc"] is intentionally omitted from the MIME headers so BCC recipients remain hidden
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_user, envelope_recipients, msg.as_string())
        server.quit()
        safe_sub = clean_subject.encode("ascii", "replace").decode("ascii")
        bcc_info = f" (BCC: {', '.join(bcc_list)})" if bcc_list else ""
        print(f"Sent '{safe_sub}' to {to_header}{bcc_info}")
        return True
    except Exception as e:
        safe_sub = clean_subject.encode("ascii", "replace").decode("ascii")
        print(f"Failed to send to {to_header}: {e}")
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
        "daksh@cogculture.agency",
    ])

    if test_mode:
        return [test_recipient or "kanishk@cogculture.agency"], True
    else:
        valid_prod = [r.strip() for r in prod_recipients if r and r.strip()]
        return valid_prod or ["kanishk@cogculture.agency"], False


def get_bcc_recipients() -> List[str]:
    """Returns the list of BCC email recipients for production digests."""
    cfg = config_service.load_config()
    bcc = cfg.get("email_bcc_recipients", [
        "apoorv@cogculture.agency",
        "kanishk@cogculture.agency",
    ])
    return [e.strip() for e in bcc if e and e.strip()]


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
    """Parse currency/numeric string safely."""
    if not val:
        return 0.0
    clean_val = str(val).split("(")[0].replace(",", "").replace("₹", "").replace("$", "").strip()
    try:
        return float(clean_val)
    except Exception:
        return 0.0


def format_inr_compact(num: float) -> str:
    """Format in boardroom Indian currency notation (₹1.68 Cr, ₹84.0L)."""
    if not num or num <= 0:
        return "—"
    if num >= 10_000_000:
        return f"₹{num / 10_000_000:.2f} Cr"
    elif num >= 100_000:
        return f"₹{num / 100_000:.1f}L"
    else:
        return f"₹{int(round(num)):,}"


def is_test_record(company_name: str) -> bool:
    """Flag test/placeholder records for exclusion."""
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
                print(f"Error fetching tab {tab}: {e}")

    today = (datetime.utcnow() + timedelta(hours=5, minutes=30)).date()
    yesterday = today - timedelta(days=1)

    # ── 1. Deduplicate & Clean Hot Leads ──────────────────────────────────
    hot_leads_map: Dict[str, Dict[str, Any]] = {}
    audit_deduped_hot: List[str] = []
    audit_filtered_test: List[str] = []

    def _val(r):
        return parse_num(
            r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)")
            or r.get("Revenue Estimations")
            or r.get("Value")
        )

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
            val = _val(r)
            poc = (r.get("Cog POC") or "").strip()

            if comp_key not in hot_leads_map:
                hot_leads_map[comp_key] = r
            else:
                audit_deduped_hot.append(company)
                existing = hot_leads_map[comp_key]
                existing_val = _val(existing)
                existing_poc = (existing.get("Cog POC") or "").strip()
                if val > existing_val or (not existing_poc and poc):
                    hot_leads_map[comp_key] = r

    hot_leads = list(hot_leads_map.values())
    hot_leads.sort(key=_val, reverse=True)
    hot_pipeline_value = sum(_val(r) for r in hot_leads)

    # ── 2. Recent & New Intake Leads ──────────────────────────────────────
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

    intake_valued_count = sum(1 for r in display_leads if _val(r) > 0)
    intake_total_val = sum(_val(r) for r in display_leads)

    intake_source_counts: Dict[str, int] = {}
    for r in display_leads:
        src = (r.get("Lead Source") or r.get("Source") or "Direct / Inbound").strip()
        intake_source_counts[src] = intake_source_counts.get(src, 0) + 1

    # ── 3. Proposals To Be Sent ───────────────────────────────────────────
    proposals_to_send_raw = []
    for r in all_rows:
        company = (r.get("Company") or "").strip()
        if not company or is_test_record(company):
            continue
        st = str(r.get("Status", "")).strip().lower()
        stg = str(r.get("Stage", "")).strip().lower()
        if any(x in st for x in ["won", "lost", "dead", "dropped"]) or \
           any(x in stg for x in ["won", "lost", "dead", "dropped"]):
            continue

        if "proposal to be sent" in stg or "portfolio to be sent" in stg:
            dline = robust_parse_date(r.get("Deadline")) or robust_parse_date(r.get("Follow up date"))
            proposals_to_send_raw.append({"row": r, "target_date": dline})

    def proposal_sort_key(item):
        td = item.get("target_date")
        if not td:
            return 9999
        return (td - today).days

    proposals_to_send_raw.sort(key=proposal_sort_key)
    unassigned_proposals_count = sum(
        1 for p in proposals_to_send_raw
        if not (p["row"].get("Cog POC") or "").strip()
        or (p["row"].get("Cog POC") or "").strip().lower() in ["unassigned", "none", "—"]
    )

    # ── 4. Proposals Follow-ups (Cadence & Overdue) ───────────────────────
    followups_due = []
    followups_overdue_all = []
    deduped_followups_map: Dict[str, Dict[str, Any]] = {}

    for r in all_rows:
        company = (r.get("Company") or "").strip()
        if not company or is_test_record(company):
            continue
        st = str(r.get("Status", "")).strip().lower()
        stg = str(r.get("Stage", "")).strip().lower()
        if any(x in st for x in ["won", "lost", "dead", "dropped"]) or \
           any(x in stg for x in ["won", "lost", "dead", "dropped"]):
            continue

        if "proposal sent" in stg or "portfolio sent" in stg:
            sent_d = robust_parse_date(r.get("Date")) or robust_parse_date(r.get("Follow up date"))
            if sent_d:
                days_ago = (today - sent_d).days
                val = _val(r)
                entry = {"row": r, "sent_date": sent_d, "days_ago": days_ago, "value": val}

                comp_key = company.lower()
                if comp_key not in deduped_followups_map or val > deduped_followups_map[comp_key]["value"]:
                    deduped_followups_map[comp_key] = entry

                if days_ago > 5:
                    followups_overdue_all.append(entry)
                elif days_ago >= 0:
                    followups_due.append(entry)

    followups_overdue_all.sort(key=lambda x: (x["value"], x["days_ago"]), reverse=True)

    b_6_10  = [x for x in followups_overdue_all if 6  <= x["days_ago"] <= 10]
    b_11_20 = [x for x in followups_overdue_all if 11 <= x["days_ago"] <= 20]
    b_21p   = [x for x in followups_overdue_all if x["days_ago"] >= 21]

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
        "ageing_21_plus": len(b_21p),
        "total_val_at_risk": total_val_at_risk,
        "audit_deduped_hot": audit_deduped_hot,
        "audit_filtered_test": audit_filtered_test,
    }


# ---------------------------------------------------------------------------
# Helper: Build meta line for a lead row
# ---------------------------------------------------------------------------

def _meta(parts: List[str]) -> str:
    """Join non-empty parts with a middot separator."""
    return " &middot; ".join(p for p in parts if p and p.strip())


def _val_str(r: Dict[str, Any]) -> str:
    v = parse_num(
        r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)")
        or r.get("Revenue Estimations")
        or r.get("Value")
    )
    return format_inr_compact(v) if v > 0 else ""


# ---------------------------------------------------------------------------
# Template 1: Daily Leads & New Intake Digest
# ---------------------------------------------------------------------------

def build_daily_leads_digest_html(
    data: Dict[str, Any],
    recipients: List[str],
    is_test_mode: bool
) -> Tuple[str, str]:
    today = data["today"]
    today_str = today.strftime("%d %b %Y")
    recipients_str = ", ".join(recipients)

    hot_leads    = data["hot_leads"]
    hot_val      = data["hot_pipeline_value"]
    display_leads = data["display_leads"]
    is_yesterday  = data["is_yesterday_intake"]
    intake_val    = data["intake_total_val"]
    intake_valued = data["intake_valued_count"]
    source_counts = data["intake_source_counts"]

    preheader = (
        f"{len(display_leads)} new leads · "
        f"{format_inr_compact(hot_val)} hot pipeline · "
        f"{len(hot_leads)} active hot deals"
    )
    subject = (
        f"Leads Report · {today.strftime('%d %b %Y')} — "
        f"{len(display_leads)} intake, {len(hot_leads)} hot deals, "
        f"{format_inr_compact(hot_val)} pipeline"
    )

    # ── KPI Strip (2×2 grid) ──────────────────────────────────────────────
    intake_label   = "New Leads" if is_yesterday else "Recent Leads"
    intake_subtext = "Added yesterday" if is_yesterday else "Top 6 recent"
    intake_val_sub = (
        f"₹ value from {intake_valued} of {len(display_leads)}"
        if intake_valued > 0 else "No values entered yet"
    )

    kpis = [
        {"label": intake_label,      "value": f"{len(display_leads)}",             "subtext": intake_subtext,           "value_color": "#111827"},
        {"label": "Active Hot Deals", "value": f"{len(hot_leads)}",                "subtext": "High-intent pipeline",   "value_color": "#dc2626"},
        {"label": "Hot Pipeline",    "value": format_inr_compact(hot_val),          "subtext": f"{len(hot_leads)} deals", "value_color": "#111827"},
        {"label": "Intake Value",    "value": format_inr_compact(intake_val) if intake_val > 0 else "—",
                                     "subtext": intake_val_sub,                     "value_color": "#111827"},
    ]

    # ── Executive Summary ─────────────────────────────────────────────────
    top_deal   = hot_leads[0] if hot_leads else None
    sec_deal   = hot_leads[1] if len(hot_leads) > 1 else None
    src_summary = ", ".join(f"{src} ({cnt})" for src, cnt in source_counts.items())

    summary_items = []
    if top_deal:
        comp = top_deal.get("Company", "")
        val  = _val_str(top_deal)
        poc  = (top_deal.get("Cog POC") or "Unassigned").strip()
        note = (top_deal.get("Remarks /Updates") or top_deal.get("Last Update") or "Active in hot pipeline.").strip()[:100]
        val_part = f" ({val})" if val else ""
        summary_items.append({
            "color": "#dc2626",
            "lead": f"{comp}{val_part} · {poc}:",
            "text": note,
        })

    if sec_deal:
        comp = sec_deal.get("Company", "")
        val  = _val_str(sec_deal)
        poc  = (sec_deal.get("Cog POC") or "Unassigned").strip()
        note = (sec_deal.get("Remarks /Updates") or sec_deal.get("Last Update") or "Active in hot pipeline.").strip()[:100]
        val_part = f" ({val})" if val else ""
        summary_items.append({
            "color": "#d97706",
            "lead": f"{comp}{val_part} · {poc}:",
            "text": note,
        })

    summary_items.append({
        "color": "#2563eb",
        "lead": f"{len(display_leads)} leads {'added yesterday' if is_yesterday else 'in recent intake'}:",
        "text": f"Source — {src_summary}." if src_summary else "No source data available.",
    })

    # ── Section 1: Hot Pipeline ───────────────────────────────────────────
    hot_cards = ""
    for idx, r in enumerate(hot_leads, 1):
        comp  = (r.get("Company") or "Lead").strip()
        poc   = (r.get("Cog POC") or "").strip()
        req   = (r.get("Requirement") or "").strip()
        note  = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        v_str = _val_str(r)
        meta  = _meta([
            f'<span style="color:{TEXT_MUTED}; font-weight:500;">{poc}</span>' if poc else
            f'<span style="color:#d97706; font-weight:500;">No owner</span>',
            req[:60] + ("…" if len(req) > 60 else "") if req else "",
        ])
        hot_cards += render_lead_card(
            index=idx,
            company=comp,
            value_str=v_str,
            meta_line=meta,
            note=note,
            border_left_color="#dc2626" if idx == 1 else "",
        )

    # ── Section 2: Intake / New Leads ────────────────────────────────────
    new_cards = ""
    for idx, r in enumerate(display_leads, 1):
        comp  = (r.get("Company") or "Lead").strip()
        stage = (r.get("Stage") or "Discovery").strip()
        src   = (r.get("Lead Source") or r.get("Source") or "Direct").strip()
        poc   = (r.get("Cog POC") or "").strip()
        req   = (r.get("Requirement") or "").strip()
        note  = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        v     = parse_num(
            r.get("Revenue Estimation (In INR) (Oct 26 - Mar 27)")
            or r.get("Revenue Estimations")
            or r.get("Value")
        )
        v_str = format_inr_compact(v) if v > 0 else ""
        badge = render_status_badge(stage, "neutral") if not v_str else ""

        meta = _meta([
            f'<span style="color:{TEXT_MUTED}; font-weight:500;">{poc}</span>' if poc else
            f'<span style="color:#d97706; font-weight:500;">No owner</span>',
            f'via {src}' if src else "",
            req[:60] + ("…" if len(req) > 60 else "") if req else "",
        ])
        new_cards += render_lead_card(
            index=idx,
            company=comp,
            value_str=v_str,
            badge_html=badge,
            meta_line=meta,
            note=note,
        )

    body = f"""
    {render_test_mode_banner(recipients_str) if is_test_mode else ''}
    {render_header("Leads &amp; Intake Digest", today_str)}
    {render_kpi_strip(kpis)}
    {render_executive_summary_box("Executive Summary", summary_items)}

    {render_section_title("Active Hot Pipeline", f"{len(hot_leads)} deals · {format_inr_compact(hot_val)} total")}
    <div style="margin-bottom:28px;">
        {hot_cards}
    </div>

    {render_section_title(intake_label, f"{len(display_leads)} deals · {intake_subtext}")}
    <div style="margin-bottom:20px;">
        {new_cards}
    </div>

    {render_cta_button("Open CRM Dashboard", "https://crm.cogculture.agency/dashboard")}
    {render_footer()}
    """

    html = wrap_email_document(subject, preheader, body)
    return subject, html


# ---------------------------------------------------------------------------
# Template 2: Daily Proposals & Follow-up Action Alert
# ---------------------------------------------------------------------------

def build_proposals_followup_alert_html(
    data: Dict[str, Any],
    recipients: List[str],
    is_test_mode: bool
) -> Tuple[str, str]:
    today = data["today"]
    today_str = today.strftime("%d %b %Y")
    recipients_str = ", ".join(recipients)

    proposals_to_send     = data["proposals_to_send"]
    unassigned_count      = data["unassigned_proposals_count"]
    followups_due         = data["followups_due"]
    followups_overdue_all = data["followups_overdue_all"]
    total_val_at_risk     = data["total_val_at_risk"]

    preheader = (
        f"{len(proposals_to_send)} proposals queued · "
        f"{len(followups_due)} follow-ups due · "
        f"{len(followups_overdue_all)} overdue · "
        f"{format_inr_compact(total_val_at_risk)} at risk"
    )
    subject = (
        f"Proposals & Follow-ups · {today.strftime('%d %b %Y')} — "
        f"{len(proposals_to_send)} to send, {len(followups_overdue_all)} stale, "
        f"{format_inr_compact(total_val_at_risk)} at risk"
    )

    # ── KPI Strip ─────────────────────────────────────────────────────────
    kpis = [
        {
            "label": "Proposals to Send",
            "value": str(len(proposals_to_send)),
            "subtext": f"{unassigned_count} without an owner",
            "value_color": "#d97706" if unassigned_count > 0 else "#111827",
        },
        {
            "label": "Follow-ups Due",
            "value": str(len(followups_due)),
            "subtext": "Day 2 & Day 5 cadence",
            "value_color": "#059669",
        },
        {
            "label": "Overdue Reminders",
            "value": str(len(followups_overdue_all)),
            "subtext": "Day 6+ stale",
            "value_color": "#dc2626",
        },
        {
            "label": "Value at Risk",
            "value": format_inr_compact(total_val_at_risk),
            "subtext": "Across overdue pipeline",
            "value_color": "#111827",
        },
    ]

    # ── Executive Summary ─────────────────────────────────────────────────
    summary_items = []
    if unassigned_count > 0:
        summary_items.append({
            "color": "#d97706",
            "lead": f"{unassigned_count} of {len(proposals_to_send)} proposals have no owner assigned.",
            "text": "Leadership action required before these can be sent.",
        })

    if followups_overdue_all:
        top = followups_overdue_all[0]
        comp = top["row"].get("Company", "Lead")
        val_str = format_inr_compact(top["value"])
        days    = top["days_ago"]
        poc     = (top["row"].get("Cog POC") or "Unassigned").strip()
        summary_items.append({
            "color": "#dc2626",
            "lead": f"{comp} ({val_str}) · {days}d overdue · {poc}:",
            "text": "Oldest high-value deal pending follow-up.",
        })

    summary_items.append({
        "color": "#2563eb",
        "lead": f"Ageing overview ({len(followups_overdue_all)} overdue deals):",
        "text": (
            f"6–10 days: {data['ageing_6_10']} · "
            f"11–20 days: {data['ageing_11_20']} · "
            f"21+ days: {data['ageing_21_plus']} stale."
        ),
    })

    # ── Part 1: Proposals to Send ─────────────────────────────────────────
    to_send_cards = ""
    for idx, item in enumerate(proposals_to_send, 1):
        r    = item["row"]
        td   = item.get("target_date")
        comp = (r.get("Company") or "Deal").strip()
        poc  = (r.get("Cog POC") or "").strip()
        req  = (r.get("Requirement") or "Proposal").strip()
        note = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        v_str = _val_str(r)

        if not td:
            badge = render_status_badge("Scheduled", "scheduled")
        else:
            diff = (today - td).days
            if diff > 0:
                badge = render_status_badge(f"Overdue · {diff}d", "overdue")
            elif diff == 0:
                badge = render_status_badge("Due Today", "due_today")
            else:
                badge = render_status_badge("Scheduled", "scheduled")

        meta = _meta([
            f'<span style="color:{TEXT_MUTED}; font-weight:500;">{poc}</span>' if poc else
            f'<span style="color:#d97706; font-weight:500;">No owner</span>',
            req[:60] + ("…" if len(req) > 60 else "") if req else "",
        ])

        to_send_cards += render_lead_card(
            index=idx,
            company=comp,
            value_str=v_str,
            badge_html=badge if not v_str else "",
            meta_line=meta,
            note=note,
        )

    # ── Part 2: Top 10 Overdue Follow-ups ────────────────────────────────
    top_overdue_list = followups_overdue_all[:10]
    overdue_cards = ""
    for idx, item in enumerate(top_overdue_list, 1):
        r        = item["row"]
        comp     = (r.get("Company") or "Deal").strip()
        poc      = (r.get("Cog POC") or "").strip()
        req      = (r.get("Requirement") or "").strip()
        note     = (r.get("Remarks /Updates") or r.get("Last Update") or "").strip()
        days_ago = item.get("days_ago", 0)
        v_str    = format_inr_compact(item.get("value", 0))

        c_phone = r.get("Contact No.") or r.get("Phone") or ""
        c_email = r.get("Email Id") or r.get("Email") or ""
        contact_parts = []
        if c_phone:
            contact_parts.append(f'<a href="tel:{c_phone}" style="color:#2563eb; font-weight:600;">Call</a>')
        if c_email:
            contact_parts.append(f'<a href="mailto:{c_email}" style="color:#2563eb; font-weight:600;">Email</a>')

        # Days badge color
        if days_ago >= 21:
            badge = render_status_badge(f"{days_ago}d overdue", "overdue")
        elif days_ago >= 11:
            badge = render_status_badge(f"{days_ago}d overdue", "due_today")
        else:
            badge = render_status_badge(f"{days_ago}d overdue", "warm")

        meta_parts = [
            f'<span style="color:{TEXT_MUTED}; font-weight:500;">{poc}</span>' if poc else
            f'<span style="color:#d97706; font-weight:500;">No owner</span>',
            req[:60] + ("…" if len(req) > 60 else "") if req else "",
        ]
        if contact_parts:
            meta_parts.append(" / ".join(contact_parts))
        meta = _meta(meta_parts)

        overdue_cards += render_lead_card(
            index=idx,
            company=comp,
            value_str=v_str,
            badge_html=badge,
            meta_line=meta,
            note=note,
        )

    view_all_link = (
        f'<a href="https://crm.cogculture.agency/dashboard?tab=follow_ups" '
        f'target="_blank" style="color:#2563eb; font-weight:600; text-decoration:none;">'
        f'View all {len(followups_overdue_all)} overdue deals &rarr;</a>'
    )

    body = f"""
    {render_test_mode_banner(recipients_str) if is_test_mode else ''}
    {render_header("Proposals &amp; Follow-up Alert", today_str)}
    {render_kpi_strip(kpis)}
    {render_executive_summary_box("Bottleneck Watch", summary_items)}

    {render_section_title("Proposals to Send", f"{len(proposals_to_send)} queued · {unassigned_count} unassigned")}
    <div style="margin-bottom:28px;">
        {to_send_cards}
    </div>

    {render_section_title("Overdue Follow-ups", f"Top 10 of {len(followups_overdue_all)} · {format_inr_compact(total_val_at_risk)} at risk")}
    <div style="margin-bottom:16px;">
        {overdue_cards}
    </div>

    <div style="text-align:center; font-family:{FONT_STACK}; font-size:11px; color:{TEXT_MUTED}; margin-bottom:20px; line-height:1.6;">
        Showing top 10 &nbsp;&middot;&nbsp; {view_all_link}
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
    bcc_recipients = get_bcc_recipients() if not is_test_mode else []
    data = fetch_pipeline_digest_data()
    subject, html_content = build_daily_leads_digest_html(data, recipients, is_test_mode)
    success = send_email(recipients, subject, html_content, bcc_emails=bcc_recipients)
    return {
        "success": success,
        "subject": subject,
        "recipients": recipients,
        "bcc_recipients": bcc_recipients,
        "is_test_mode": is_test_mode,
        "hot_deals_count": len(data["hot_leads"]),
        "hot_pipeline_value": data["hot_pipeline_value"],
        "displayed_leads_count": len(data["display_leads"]),
    }


def dispatch_proposals_followup_alert(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    recipients, is_test_mode = get_email_recipients(override_recipient)
    bcc_recipients = get_bcc_recipients() if not is_test_mode else []
    data = fetch_pipeline_digest_data()
    subject, html_content = build_proposals_followup_alert_html(data, recipients, is_test_mode)
    success = send_email(recipients, subject, html_content, bcc_emails=bcc_recipients)
    return {
        "success": success,
        "subject": subject,
        "recipients": recipients,
        "bcc_recipients": bcc_recipients,
        "is_test_mode": is_test_mode,
        "proposals_to_send_count": len(data["proposals_to_send"]),
        "unassigned_proposals_count": data["unassigned_proposals_count"],
        "followups_due_count": len(data["followups_due"]),
        "followups_overdue_count": len(data["followups_overdue_all"]),
        "total_val_at_risk": data["total_val_at_risk"],
    }


def preview_daily_leads_digest(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    recipients, is_test_mode = get_email_recipients(override_recipient)
    bcc_recipients = get_bcc_recipients() if not is_test_mode else []
    data = fetch_pipeline_digest_data()
    subject, html_content = build_daily_leads_digest_html(data, recipients, is_test_mode)
    return {
        "subject": subject,
        "html": html_content,
        "recipients": recipients,
        "bcc_recipients": bcc_recipients,
        "is_test_mode": is_test_mode,
        "hot_deals_count": len(data["hot_leads"]),
        "hot_pipeline_value": data["hot_pipeline_value"],
        "displayed_leads_count": len(data["display_leads"]),
    }


def preview_proposals_followup_alert(override_recipient: Optional[str] = None) -> Dict[str, Any]:
    recipients, is_test_mode = get_email_recipients(override_recipient)
    bcc_recipients = get_bcc_recipients() if not is_test_mode else []
    data = fetch_pipeline_digest_data()
    subject, html_content = build_proposals_followup_alert_html(data, recipients, is_test_mode)
    return {
        "subject": subject,
        "html": html_content,
        "recipients": recipients,
        "bcc_recipients": bcc_recipients,
        "is_test_mode": is_test_mode,
        "proposals_to_send_count": len(data["proposals_to_send"]),
        "unassigned_proposals_count": data["unassigned_proposals_count"],
        "followups_overdue_count": len(data["followups_overdue_all"]),
        "total_val_at_risk": data["total_val_at_risk"],
    }


def send_deadline_reminder(to_email: str, poc_name: str, company: str, deadline: str, stage: str) -> bool:
    subject = f"Deadline Approaching: {company}"
    html = f"<p>Hi {poc_name}, deadline approaching for {company}: {deadline}</p>"
    return send_email(to_email, subject, html)


def send_followup_reminder(to_email: str, poc_name: str, company: str, followup_date: str, stage: str) -> bool:
    subject = f"Follow-up Scheduled: {company}"
    html = f"<p>Hi {poc_name}, follow-up scheduled for {company} on {followup_date}</p>"
    return send_email(to_email, subject, html)
