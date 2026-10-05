"""
Reusable email components for executive-grade CRM digests.
Built strictly with HTML tables, inline styles, and MSO fallbacks.
Designed for 640px max-width, mobile responsiveness, and dark-mode safety.
"""

from typing import List, Dict, Any, Optional

FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

def render_preheader(text: str) -> str:
    """Hidden preheader snippet for inbox preview."""
    return f"""
    <!--[if !mso]><!-- -->
    <div style="display:none;font-size:1px;color:#f8fafc;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
        {text}
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    <!--<![endif]-->
    """

def render_test_mode_banner(recipients_str: str) -> str:
    """Minimal, boardroom-safe test pill (only shown in test mode)."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
        <tr>
            <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 20px;">
                    <tr>
                        <td style="padding: 4px 14px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 600; color: #92400e; letter-spacing: 0.3px;">
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:#d97706; margin-right:6px; vertical-align:middle;"></span>
                            TEST MODE DISPATCH &bull; Routed strictly to {recipients_str}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    """

def render_header(report_title: str, date_str: str, subtitle: str = "Prepared for: Director & CMO") -> str:
    """Executive header with wordmark and high-contrast typography."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 18px; margin-bottom: 22px;">
        <tr>
            <td valign="top" align="left">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="font-family: {FONT_STACK}; font-size: 13px; font-weight: 800; letter-spacing: 1.5px; color: #0f172a; text-transform: uppercase;">
                            COG CULTURE
                        </td>
                        <td style="padding-left: 8px;">
                            <span style="background-color: #f1f5f9; color: #475569; font-family: {FONT_STACK}; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">CRM</span>
                        </td>
                    </tr>
                </table>
                <h1 style="margin: 8px 0 3px 0; font-family: {FONT_STACK}; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.4px; line-height: 1.25;">
                    {report_title}
                </h1>
                <div style="font-family: {FONT_STACK}; font-size: 12px; color: #64748b;">
                    {date_str} &bull; <span style="color: #0f172a; font-weight: 600;">{subtitle}</span>
                </div>
            </td>
        </tr>
    </table>
    """

def render_kpi_strip(kpis: List[Dict[str, str]]) -> str:
    """
    Renders 4-column responsive KPI strip.
    Each KPI has: label, value, subtext.
    """
    cells = ""
    col_width = int(100 / max(len(kpis), 1))
    for kpi in kpis:
        val_color = kpi.get("value_color", "#0f172a")
        cells += f"""
        <td width="{col_width}%" valign="top" style="padding: 12px 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-family: {FONT_STACK}; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px;">
                {kpi['label']}
            </div>
            <div style="font-family: {FONT_STACK}; font-size: 20px; font-weight: 800; color: {val_color}; letter-spacing: -0.3px; line-height: 1.2;">
                {kpi['value']}
            </div>
            <div style="font-family: {FONT_STACK}; font-size: 10px; color: #94a3b8; margin-top: 3px; line-height: 1.25;">
                {kpi.get('subtext', '')}
            </div>
        </td>
        """
        # Spacer
        if kpi != kpis[-1]:
            cells += """<td width="8" style="width:8px;"></td>"""

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
        <tr>
            {cells}
        </tr>
    </table>
    """

def render_executive_summary_box(title: str, bullet_items: List[Dict[str, str]]) -> str:
    """
    Executive callout card: 'Needs Attention Today'.
    bullet_items: list of dicts with 'color' ('#dc2626'|'#d97706'|'#2563eb'), 'lead' (bold subject), 'text' (body).
    """
    rows = ""
    for item in bullet_items:
        color = item.get("color", "#2563eb")
        rows += f"""
        <tr>
            <td valign="top" style="padding: 5px 0 5px 0; width: 16px;">
                <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background-color:{color}; margin-top:5px;"></span>
            </td>
            <td valign="top" style="padding: 5px 0 5px 4px; font-family: {FONT_STACK}; font-size: 13px; line-height: 1.45; color: #1e293b;">
                <strong>{item.get('lead', '')}</strong> {item.get('text', '')}
            </td>
        </tr>
        """

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 26px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #0f172a; border-radius: 8px;">
        <tr>
            <td style="padding: 14px 18px;">
                <div style="font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
                    {title}
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    {rows}
                </table>
            </td>
        </tr>
    </table>
    """

def render_section_title(title: str, subtitle: Optional[str] = None) -> str:
    """Standardized clean section title."""
    sub_html = f"<span style='font-weight:400; color:#64748b; font-size:12px; margin-left:6px;'>&bull; {subtitle}</span>" if subtitle else ""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 22px 0 12px 0;">
        <tr>
            <td style="font-family: {FONT_STACK}; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.7px;">
                {title}{sub_html}
            </td>
        </tr>
    </table>
    """

def render_horizontal_bar_chart(title: str, items: List[Dict[str, Any]], max_val: Optional[float] = None) -> str:
    """
    Bulletproof table-based horizontal bar chart.
    items: list of {'label': str, 'value': float, 'value_str': str, 'color': str (optional)}
    """
    if not items:
        return ""
    if max_val is None:
        max_val = max(x['value'] for x in items) if items else 1.0
    if max_val <= 0:
        max_val = 1.0

    rows = ""
    for it in items:
        pct = max(min(int((it['value'] / max_val) * 100), 100), 4) if it['value'] > 0 else 2
        bar_color = it.get('color', '#3b82f6')
        rows += f"""
        <tr>
            <td width="150" style="font-family: {FONT_STACK}; font-size: 12px; color: #334155; padding: 4px 10px 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">
                {it['label']}
            </td>
            <td style="padding: 4px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; border-radius: 4px; overflow: hidden; height: 12px;">
                    <tr>
                        <td width="{pct}%" style="background-color: {bar_color}; height: 12px; border-radius: 4px;"></td>
                        <td width="{100 - pct}%" style="height: 12px;"></td>
                    </tr>
                </table>
            </td>
            <td width="70" align="right" style="font-family: {FONT_STACK}; font-size: 12px; font-weight: 700; color: #0f172a; padding: 4px 0 4px 10px; white-space: nowrap;">
                {it['value_str']}
            </td>
        </tr>
        """

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
        <tr>
            <td style="font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; padding-bottom: 10px;">
                {title}
            </td>
        </tr>
        <tr>
            <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    {rows}
                </table>
            </td>
        </tr>
    </table>
    """

def render_heatmap_strip(title: str, buckets: List[Dict[str, Any]]) -> str:
    """
    Renders overdue ageing buckets (6-10d, 11-20d, 21+d).
    buckets: list of {'label': str, 'count': int, 'color_bg': str, 'color_text': str, 'subtext': str}
    """
    cells = ""
    col_width = int(100 / max(len(buckets), 1))
    for b in buckets:
        cells += f"""
        <td width="{col_width}%" valign="top" style="padding: 10px 12px; background-color: {b['color_bg']}; border-radius: 6px; text-align: center;">
            <div style="font-family: {FONT_STACK}; font-size: 10px; font-weight: 700; color: {b['color_text']}; text-transform: uppercase; letter-spacing: 0.5px;">
                {b['label']}
            </div>
            <div style="font-family: {FONT_STACK}; font-size: 18px; font-weight: 800; color: {b['color_text']}; margin: 2px 0;">
                {b['count']} Deals
            </div>
            <div style="font-family: {FONT_STACK}; font-size: 10px; color: {b['color_text']}; opacity: 0.85;">
                {b.get('subtext', '')}
            </div>
        </td>
        """
        if b != buckets[-1]:
            cells += """<td width="8" style="width:8px;"></td>"""

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px;">
        <tr>
            <td style="font-family: {FONT_STACK}; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; padding-bottom: 10px;">
                {title}
            </td>
        </tr>
        <tr>
            <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        {cells}
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    """

def render_chip(label: str, style_type: str = "neutral") -> str:
    """
    Renders a status chip.
    style_type: 'hot', 'warm', 'cold', 'won', 'overdue', 'due_today', 'scheduled', 'unassigned', 'neutral'
    """
    styles = {
        "hot": ("#dc2626", "#fee2e2", "#fecaca"),
        "warm": ("#d97706", "#fef3c7", "#fde68a"),
        "cold": ("#475569", "#f1f5f9", "#e2e8f0"),
        "won": ("#059669", "#d1fae5", "#a7f3d0"),
        "overdue": ("#b91c1c", "#fee2e2", "#fca5a5"),
        "due_today": ("#ea580c", "#ffedd5", "#fed7aa"),
        "scheduled": ("#2563eb", "#eff6ff", "#bfdbfe"),
        "unassigned": ("#b45309", "#fef3c7", "#fde68a"), # amber warning
        "neutral": ("#475569", "#f1f5f9", "#e2e8f0"),
    }
    tc, bc, bdc = styles.get(style_type, styles["neutral"])
    return f"""<span style="display:inline-block; font-family:{FONT_STACK}; font-size:10px; font-weight:700; color:{tc}; background-color:{bc}; border:1px solid {bdc}; padding:2px 7px; border-radius:4px; text-transform:uppercase; letter-spacing:0.4px;">{label}</span>"""

def render_owner_badge(owner_name: str) -> str:
    """Renders owner with initials badge or amber warning if unassigned."""
    clean = (owner_name or "").strip()
    if not clean or clean.lower() in ["unassigned", "none", "—", "not set", ""]:
        return render_chip("Owner Not set", "unassigned")

    # Generate 2-letter initials
    parts = clean.split()
    initials = (parts[0][0] + (parts[1][0] if len(parts) > 1 else ""))[:2].upper()
    return f"""
    <span style="font-family:{FONT_STACK}; font-size:12px; color:#1e293b; font-weight:600; white-space:nowrap;">
        <span style="display:inline-block; width:18px; height:18px; line-height:18px; text-align:center; border-radius:50%; background-color:#e2e8f0; color:#334155; font-size:9px; font-weight:700; margin-right:5px; vertical-align:middle;">{initials}</span>{clean}
    </span>
    """

def render_cta_buttons(primary_text: str, primary_url: str, secondary_text: str, secondary_url: str) -> str:
    """Bulletproof button row."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 16px 0;">
        <tr>
            <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td align="center" style="border-radius: 6px; background-color: #0f172a;">
                            <a href="{primary_url}" target="_blank" style="display: inline-block; padding: 11px 22px; font-family: {FONT_STACK}; font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 6px; letter-spacing: 0.2px;">
                                {primary_text}
                            </a>
                        </td>
                        <td width="10" style="width:10px;"></td>
                        <td align="center" style="border-radius: 6px; background-color: #ffffff; border: 1px solid #cbd5e1;">
                            <a href="{secondary_url}" target="_blank" style="display: inline-block; padding: 10px 20px; font-family: {FONT_STACK}; font-size: 13px; font-weight: 600; color: #334155; text-decoration: none; border-radius: 6px;">
                                {secondary_text}
                            </a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    """

def render_footer() -> str:
    """Standardized executive dispatch footnote."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 18px;">
        <tr>
            <td align="center" style="font-family: {FONT_STACK}; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                Automated boardroom dispatch generated by <strong>Cog Culture CRM</strong>.<br>
                Dispatched daily at 10:00 AM IST &bull; Queries: <strong>aryan@cogculture.agency</strong>
            </td>
        </tr>
    </table>
    """

def wrap_email_document(subject: str, preheader_text: str, inner_body: str) -> str:
    """Wraps body in an executive 640px table container."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>{subject}</title>
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
        body {{ margin: 0; padding: 0; background-color: #f1f5f9; -webkit-font-smoothing: antialiased; }}
        table {{ border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
        td, th {{ border-collapse: collapse; }}
        a {{ color: inherit; text-decoration: underline; }}
        @media only screen and (max-width: 620px) {{
            .wrapper {{ width: 100% !important; padding: 12px 8px !important; }}
            .container {{ width: 100% !important; }}
            .stack-cell {{ display: block !important; width: 100% !important; margin-bottom: 8px !important; }}
        }}
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: {FONT_STACK};">
    {render_preheader(preheader_text)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 24px 0;">
        <tr>
            <td align="center" class="wrapper" style="padding: 0 12px;">
                <!--[if (gte mso 9)|(IE)]>
                <table width="640" align="center" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td>
                <![endif]-->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="container" style="max-width: 640px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); overflow: hidden; padding: 28px 24px;">
                    <tr>
                        <td>
                            {inner_body}
                        </td>
                    </tr>
                </table>
                <!--[if (gte mso 9)|(IE)]>
                        </td>
                    </tr>
                </table>
                <![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>
"""
