"""
Minimalist, executive-grade email components for Cog Culture CRM.
Designed for 580px container, strict mobile responsiveness, zero horizontal overflow,
and clean Stripe/Linear/Notion-inspired visual hierarchy.
"""

from typing import List, Dict, Any, Optional

FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

def render_preheader(text: str) -> str:
    """Hidden preview snippet for email client inboxes."""
    clean_text = text.replace("&bull;", "·")
    return f"""
    <!--[if !mso]><!-- -->
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
        {clean_text}
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    <!--<![endif]-->
    """

def render_test_mode_banner(recipients_str: str) -> str:
    """Minimal muted test pill."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
        <tr>
            <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 12px;">
                    <tr>
                        <td style="padding: 4px 12px; font-family: {FONT_STACK}; font-size: 11px; font-weight: 600; color: #92400e;">
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:#d97706; margin-right:5px; vertical-align:middle;"></span>
                            Test Mode: routed strictly to {recipients_str}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    """

def render_header(report_title: str, date_str: str, subtitle: str = "Prepared for: Director & CMO") -> str:
    """Clean boardroom header with brand wordmark and sharp contrast."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 18px;">
        <tr>
            <td valign="top" align="left">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 6px;">
                    <tr>
                        <td style="font-family: {FONT_STACK}; font-size: 12px; font-weight: 800; letter-spacing: 1.2px; color: #0f172a; text-transform: uppercase;">
                            COG CULTURE
                        </td>
                        <td style="padding-left: 6px;">
                            <span style="background-color: #f1f5f9; color: #475569; font-family: {FONT_STACK}; font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 3px; text-transform: uppercase;">CRM</span>
                        </td>
                    </tr>
                </table>
                <h1 style="margin: 0 0 4px 0; font-family: {FONT_STACK}; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; line-height: 1.25;">
                    {report_title}
                </h1>
                <div style="font-family: {FONT_STACK}; font-size: 12px; color: #64748b;">
                    {date_str} &middot; <span style="color: #0f172a; font-weight: 600;">{subtitle}</span>
                </div>
            </td>
        </tr>
    </table>
    """

def render_kpi_strip(kpis: List[Dict[str, str]]) -> str:
    """
    Minimal 4-column KPI strip with strict percentage widths and mobile stack fallback.
    """
    cells = ""
    col_width = int(100 / max(len(kpis), 1))
    for idx, kpi in enumerate(kpis):
        val_color = kpi.get("value_color", "#0f172a")
        cells += f"""
        <td width="{col_width}%" valign="top" style="padding: 10px 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
            <div style="font-family: {FONT_STACK}; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">
                {kpi['label']}
            </div>
            <div style="font-family: {FONT_STACK}; font-size: 18px; font-weight: 800; color: {val_color}; line-height: 1.15;">
                {kpi['value']}
            </div>
            <div style="font-family: {FONT_STACK}; font-size: 9px; color: #94a3b8; margin-top: 3px; line-height: 1.2;">
                {kpi.get('subtext', '')}
            </div>
        </td>
        """
        if idx < len(kpis) - 1:
            cells += """<td width="6" style="width:6px;"></td>"""

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; table-layout: fixed;">
        <tr>
            {cells}
        </tr>
    </table>
    """

def render_executive_summary_box(title: str, bullet_items: List[Dict[str, str]]) -> str:
    """
    Clean, minimalist executive summary block with status dots (●).
    """
    rows = ""
    for item in bullet_items:
        color = item.get("color", "#2563eb")
        rows += f"""
        <tr>
            <td valign="top" style="padding: 4px 0; width: 14px;">
                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:{color}; margin-top:5px;"></span>
            </td>
            <td valign="top" style="padding: 4px 0 4px 6px; font-family: {FONT_STACK}; font-size: 12px; line-height: 1.45; color: #1e293b; word-break: break-word;">
                <strong style="color:#0f172a;">{item.get('lead', '')}</strong> {item.get('text', '')}
            </td>
        </tr>
        """

    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #0f172a; border-radius: 6px;">
        <tr>
            <td style="padding: 12px 14px;">
                <div style="font-family: {FONT_STACK}; font-size: 10px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 6px;">
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
    """Minimal section divider."""
    badge_html = f"<span style='font-family:{FONT_STACK}; font-size:11px; font-weight:600; color:#64748b; margin-left:6px;'>({count_badge})</span>" if count_badge else ""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 18px 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
        <tr>
            <td style="font-family: {FONT_STACK}; font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.6px;">
                {title} {badge_html}
            </td>
        </tr>
    </table>
    """

def render_chip(label: str, style_type: str = "neutral") -> str:
    """Clean, minimalist status tag."""
    styles = {
        "hot": ("#dc2626", "#fee2e2", "#fecaca"),
        "warm": ("#d97706", "#fef3c7", "#fde68a"),
        "cold": ("#475569", "#f1f5f9", "#e2e8f0"),
        "won": ("#059669", "#d1fae5", "#a7f3d0"),
        "overdue": ("#b91c1c", "#fee2e2", "#fca5a5"),
        "due_today": ("#c2410c", "#ffedd5", "#fed7aa"),
        "scheduled": ("#2563eb", "#eff6ff", "#bfdbfe"),
        "unassigned": ("#b45309", "#fef3c7", "#fde68a"),
        "neutral": ("#475569", "#f1f5f9", "#e2e8f0"),
    }
    tc, bc, bdc = styles.get(style_type, styles["neutral"])
    return f"""<span style="display:inline-block; font-family:{FONT_STACK}; font-size:9px; font-weight:700; color:{tc}; background-color:{bc}; border:1px solid {bdc}; padding:2px 6px; border-radius:3px; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">{label}</span>"""

def render_owner_tag(owner_name: str) -> str:
    """Muted owner label or amber pill if unassigned."""
    clean = (owner_name or "").strip()
    if not clean or clean.lower() in ["unassigned", "none", "—", "not set", ""]:
        return render_chip("Owner Not Set", "unassigned")
    return f"""<span style="font-family:{FONT_STACK}; font-size:11px; color:#475569; font-weight:600;">{clean}</span>"""

def render_cta_button(text: str, url: str) -> str:
    """Single, clean primary button."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 14px 0;">
        <tr>
            <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td align="center" style="border-radius: 6px; background-color: #0f172a;">
                            <a href="{url}" target="_blank" style="display: inline-block; padding: 10px 24px; font-family: {FONT_STACK}; font-size: 12px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 6px; letter-spacing: 0.3px;">
                                {text} &rarr;
                            </a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    """

def render_footer() -> str:
    """Subtle, muted dispatch footer."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #f1f5f9; margin-top: 18px; padding-top: 14px;">
        <tr>
            <td align="center" style="font-family: {FONT_STACK}; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                Automated boardroom digest &bull; <strong>Cog Culture CRM</strong> &bull; Daily 10:00 AM IST
            </td>
        </tr>
    </table>
    """

def wrap_email_document(subject: str, preheader_text: str, inner_body: str) -> str:
    """
    Wraps body in an executive 580px fixed-width container with zero horizontal overflow.
    Uses word-break: break-word everywhere so long titles never force horizontal scrollbars.
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
        body {{ margin: 0; padding: 0; background-color: #f8fafc; -webkit-font-smoothing: antialiased; }}
        table {{ border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
        td, th {{ border-collapse: collapse; word-break: break-word; overflow-wrap: break-word; }}
        a {{ color: inherit; text-decoration: none; }}
        @media only screen and (max-width: 600px) {{
            .wrapper {{ padding: 8px 4px !important; }}
            .container {{ width: 100% !important; max-width: 100% !important; padding: 18px 14px !important; }}
        }}
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: {FONT_STACK};">
    {render_preheader(preheader_text)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 18px 0;">
        <tr>
            <td align="center" class="wrapper" style="padding: 0 10px;">
                <!--[if (gte mso 9)|(IE)]>
                <table width="580" align="center" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td>
                <![endif]-->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="container" style="max-width: 580px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); table-layout: fixed; padding: 22px 20px;">
                    <tr>
                        <td style="word-break: break-word; overflow-wrap: break-word;">
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
