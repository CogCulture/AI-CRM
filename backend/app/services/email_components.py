"""
Executive-grade email components for Cog Culture CRM.
Clean, minimalist design with generous whitespace and clear typographic hierarchy.
580px fixed container, zero horizontal overflow, mobile-first.
"""

from typing import List, Dict, Any, Optional

FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica Neue, Arial, sans-serif"
ACCENT = "#111827"
BORDER = "#e5e7eb"
BG_LIGHT = "#f9fafb"
TEXT_MUTED = "#6b7280"
TEXT_BODY = "#374151"
TEXT_HEADING = "#111827"

def render_preheader(text: str) -> str:
    """Hidden preview snippet for email client inboxes."""
    clean_text = text.replace("&bull;", "·")
    return f"""
    <!--[if !mso]><!-- -->
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
        {clean_text}
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    <!--<![endif]-->
    """

def render_test_mode_banner(recipients_str: str) -> str:
    """Slim, muted test-mode notice at the very top."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
        <tr>
            <td style="background-color:#fef9c3; border-radius:6px; padding:8px 14px; font-family:{FONT_STACK}; font-size:11px; font-weight:600; color:#854d0e; text-align:center; letter-spacing:0.2px;">
                TEST MODE &mdash; sent to {recipients_str}
            </td>
        </tr>
    </table>
    """

def render_header(report_title: str, date_str: str, subtitle: str = "Prepared for: Director &amp; CMO") -> str:
    """Boardroom header: wordmark + report title + date line."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-bottom:24px; margin-bottom:24px; border-bottom:2px solid {BORDER};">
        <tr>
            <td>
                <div style="font-family:{FONT_STACK}; font-size:11px; font-weight:800; letter-spacing:2px; color:{TEXT_MUTED}; text-transform:uppercase; margin-bottom:10px;">
                    COG CULTURE &nbsp;<span style="background:{BORDER}; color:{TEXT_MUTED}; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:700; letter-spacing:1px;">CRM</span>
                </div>
                <h1 style="margin:0 0 8px 0; font-family:{FONT_STACK}; font-size:22px; font-weight:700; color:{TEXT_HEADING}; line-height:1.2; letter-spacing:-0.5px;">
                    {report_title}
                </h1>
                <div style="font-family:{FONT_STACK}; font-size:12px; color:{TEXT_MUTED}; line-height:1.4;">
                    {date_str} &nbsp;&middot;&nbsp; <span style="color:{TEXT_BODY}; font-weight:500;">{subtitle}</span>
                </div>
            </td>
        </tr>
    </table>
    """

def render_kpi_strip(kpis: List[Dict[str, str]]) -> str:
    """
    2×2 grid of KPI cards using a safe table approach.
    Renders 2 cards per row, with proper spacing between them.
    """
    card_style = (
        f"padding:16px 14px; background-color:{BG_LIGHT}; border:1px solid {BORDER}; "
        f"border-radius:8px; vertical-align:top;"
    )

    def make_card(kpi: Dict[str, str]) -> str:
        val_color = kpi.get("value_color", TEXT_HEADING)
        return f"""
        <td style="{card_style}">
            <div style="font-family:{FONT_STACK}; font-size:9px; font-weight:700; color:{TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">
                {kpi['label']}
            </div>
            <div style="font-family:{FONT_STACK}; font-size:20px; font-weight:800; color:{val_color}; line-height:1; margin-bottom:6px;">
                {kpi['value']}
            </div>
            <div style="font-family:{FONT_STACK}; font-size:10px; color:{TEXT_MUTED}; line-height:1.3;">
                {kpi.get('subtext', '')}
            </div>
        </td>"""

    # Build row 1 (first 2 KPIs)
    row1 = ""
    row2 = ""
    for i, kpi in enumerate(kpis[:4]):
        if i < 2:
            if i == 1:
                row1 += '<td style="width:10px;"></td>'
            row1 += make_card(kpi)
        else:
            if i == 3:
                row2 += '<td style="width:10px;"></td>'
            row2 += make_card(kpi)

    second_row = ""
    if len(kpis) > 2:
        second_row = f"""
        <tr><td colspan="3" style="height:10px;"></td></tr>
        <tr>{row2}</tr>"""

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px; table-layout:fixed;">
        <tr>{row1}</tr>
        {second_row}
    </table>
    """

def render_executive_summary_box(title: str, bullet_items: List[Dict[str, str]]) -> str:
    """Subtle bordered summary block with clean dot bullets and good line height."""
    rows = ""
    for item in bullet_items:
        color = item.get("color", "#2563eb")
        rows += f"""
        <tr>
            <td valign="top" style="padding:0 10px 0 0; width:16px;">
                <div style="width:7px; height:7px; border-radius:50%; background-color:{color}; margin-top:4px;"></div>
            </td>
            <td valign="top" style="font-family:{FONT_STACK}; font-size:12px; line-height:1.6; color:{TEXT_BODY}; padding-bottom:10px; word-break:break-word;">
                <strong style="color:{TEXT_HEADING};">{item.get('lead', '')}</strong>
                {(' ' + item.get('text', '')) if item.get('text') else ''}
            </td>
        </tr>
        """

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px; background-color:{BG_LIGHT}; border:1px solid {BORDER}; border-left:4px solid {ACCENT}; border-radius:8px;">
        <tr>
            <td style="padding:16px 18px;">
                <div style="font-family:{FONT_STACK}; font-size:10px; font-weight:700; color:{TEXT_MUTED}; text-transform:uppercase; letter-spacing:1px; margin-bottom:14px;">
                    {title}
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    {rows}
                </table>
            </td>
        </tr>
    </table>
    """

def render_section_title(title: str, count_badge: Optional[str] = None) -> str:
    """Section heading with an optional muted badge."""
    badge_html = (
        f"<span style='font-family:{FONT_STACK}; font-size:11px; font-weight:500; "
        f"color:{TEXT_MUTED}; margin-left:6px;'>{count_badge}</span>"
    ) if count_badge else ""

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid {BORDER};">
        <tr>
            <td style="font-family:{FONT_STACK}; font-size:11px; font-weight:700; color:{TEXT_HEADING}; text-transform:uppercase; letter-spacing:0.8px;">
                {title} {badge_html}
            </td>
        </tr>
    </table>
    """

def render_status_badge(label: str, style_type: str = "neutral") -> str:
    """
    Inline status pill for status tags on list rows.
    Minimal, clean, rounded pill — not a chip.
    """
    styles = {
        "hot":        ("#dc2626", "#fef2f2"),
        "warm":       ("#d97706", "#fffbeb"),
        "cold":       ("#6b7280", "#f3f4f6"),
        "won":        ("#059669", "#ecfdf5"),
        "overdue":    ("#dc2626", "#fef2f2"),
        "due_today":  ("#ea580c", "#fff7ed"),
        "scheduled":  ("#2563eb", "#eff6ff"),
        "unassigned": ("#d97706", "#fffbeb"),
        "neutral":    ("#6b7280", "#f3f4f6"),
    }
    tc, bc = styles.get(style_type, styles["neutral"])
    return (
        f'<span style="display:inline-block; font-family:{FONT_STACK}; '
        f'font-size:10px; font-weight:600; color:{tc}; background-color:{bc}; '
        f'padding:3px 8px; border-radius:20px; white-space:nowrap;">{label}</span>'
    )

# Keep legacy render_chip as alias
def render_chip(label: str, style_type: str = "neutral") -> str:
    return render_status_badge(label, style_type)

def render_owner_tag(owner_name: str) -> str:
    """Owner label: normal text if set, amber if unassigned."""
    clean = (owner_name or "").strip()
    if not clean or clean.lower() in ["unassigned", "none", "—", "not set", ""]:
        return render_status_badge("No Owner", "unassigned")
    return f'<span style="font-family:{FONT_STACK}; font-size:11px; color:{TEXT_MUTED}; font-weight:500;">{clean}</span>'

def render_lead_card(
    index: int,
    company: str,
    value_str: str = "",
    badge_html: str = "",
    meta_line: str = "",
    note: str = "",
    border_left_color: str = "",
) -> str:
    """
    A clean card for a single lead/deal row.
    - Line 1: Index + Company name (bold) | right-aligned value or badge
    - Line 2: Meta info (owner, source, requirement) in muted text
    - Line 3: Note (if any) in even lighter muted text
    Generous vertical padding and a visible bottom border for separation.
    """
    border_left = f"border-left:3px solid {border_left_color}; padding-left:10px;" if border_left_color else ""

    value_html = ""
    if value_str and value_str != "Not set":
        value_html = f'<span style="font-family:{FONT_STACK}; font-size:13px; font-weight:700; color:{TEXT_HEADING};">{value_str}</span>'
    elif badge_html:
        value_html = badge_html

    note_row = ""
    if note:
        truncated = note[:120] + "…" if len(note) > 120 else note
        note_row = f"""
        <tr>
            <td colspan="2" style="font-family:{FONT_STACK}; font-size:11px; color:#9ca3af; line-height:1.5; padding-top:4px; word-break:break-word;">
                {truncated}
            </td>
        </tr>"""

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-bottom:2px; padding:14px 0 14px 0; border-bottom:1px solid {BORDER}; table-layout:fixed;">
        <tr>
            <td valign="middle" style="font-family:{FONT_STACK}; {border_left}">
                <span style="font-size:11px; color:{TEXT_MUTED}; font-weight:500; margin-right:4px;">{index}.</span>
                <span style="font-size:14px; font-weight:700; color:{TEXT_HEADING};">{company}</span>
            </td>
            <td align="right" valign="middle" style="font-family:{FONT_STACK}; white-space:nowrap; padding-left:12px; min-width:80px;">
                {value_html}
            </td>
        </tr>
        <tr>
            <td colspan="2" style="font-family:{FONT_STACK}; font-size:11px; color:{TEXT_MUTED}; line-height:1.5; padding-top:5px; word-break:break-word;">
                {meta_line}
            </td>
        </tr>
        {note_row}
    </table>
    """

def render_cta_button(text: str, url: str) -> str:
    """Single clean primary CTA button."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 18px 0;">
        <tr>
            <td align="center">
                <a href="{url}" target="_blank"
                   style="display:inline-block; padding:12px 28px; font-family:{FONT_STACK}; font-size:13px; font-weight:600; color:#ffffff; background-color:{ACCENT}; border-radius:8px; text-decoration:none; letter-spacing:0.2px;">
                    {text} &rarr;
                </a>
            </td>
        </tr>
    </table>
    """

def render_footer() -> str:
    """Subtle automated dispatch footer."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid {BORDER}; margin-top:24px; padding-top:16px;">
        <tr>
            <td align="center" style="font-family:{FONT_STACK}; font-size:11px; color:#9ca3af; line-height:1.6;">
                Automated digest &nbsp;&middot;&nbsp; <strong style="color:{TEXT_MUTED};">Cog Culture CRM</strong> &nbsp;&middot;&nbsp; Daily 10:00 AM IST
            </td>
        </tr>
    </table>
    """

def wrap_email_document(subject: str, preheader_text: str, inner_body: str) -> str:
    """
    Wraps body in a clean 580px fixed-width container.
    White card on light grey background. Zero horizontal overflow.
    """
    clean_sub = subject.replace("&bull;", "·")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>{clean_sub}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        body {{ margin:0; padding:0; background-color:#f3f4f6; -webkit-font-smoothing:antialiased; }}
        table {{ border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }}
        td, th {{ border-collapse:collapse; word-break:break-word; overflow-wrap:break-word; }}
        a {{ color:inherit; text-decoration:none; }}
        img {{ border:0; display:block; }}
        @media only screen and (max-width:620px) {{
            .email-wrapper {{ padding:12px 8px !important; }}
            .email-card {{ padding:24px 18px !important; }}
        }}
    </style>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:{FONT_STACK};">
    {render_preheader(preheader_text)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:#f3f4f6; padding:28px 16px;" class="email-wrapper">
        <tr>
            <td align="center">
                <!--[if (gte mso 9)|(IE)]>
                <table width="580" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
                <![endif]-->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                       style="max-width:580px; width:100%; background-color:#ffffff; border-radius:12px;
                              border:1px solid #e5e7eb; table-layout:fixed;"
                       class="email-card">
                    <tr>
                        <td style="padding:32px 28px; word-break:break-word; overflow-wrap:break-word;">
                            {inner_body}
                        </td>
                    </tr>
                </table>
                <!--[if (gte mso 9)|(IE)]>
                </td></tr></table>
                <![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>
"""
