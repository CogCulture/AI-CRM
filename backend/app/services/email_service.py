import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import settings

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send an HTML email using SMTP configuration in settings."""
    if not settings.smtp_user or not settings.smtp_password:
        print("SMTP user or password not configured. Skipping email dispatch.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_user
    msg["To"] = to_email

    msg.attach(MIMEText(html_content, "html"))

    try:
        # Connect to SMTP server
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_user, to_email, msg.as_string())
        server.quit()
        print(f"Successfully sent email to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")
        return False

def send_deadline_reminder(to_email: str, poc_name: str, company: str, deadline: str, amount: str) -> bool:
    """Dispatch a professional email reminder for an upcoming lead deadline."""
    subject = f"Urgent Action Required: Deadline Approaching for {company}"
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f7f9fa;
            margin: 0;
            padding: 0;
            color: #333333;
        }}
        .container {{
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border: 1px solid #e1e8ed;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }}
        .header {{
            background: #1e3a8a;
            color: #ffffff;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }}
        .content {{
            padding: 35px;
            line-height: 1.6;
        }}
        .greeting {{
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 20px;
        }}
        .details-box {{
            background-color: #f8fafc;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            border-radius: 0 8px 8px 0;
            margin: 25px 0;
        }}
        .details-row {{
            display: flex;
            margin-bottom: 8px;
        }}
        .details-row:last-child {{
            margin-bottom: 0;
        }}
        .label {{
            font-weight: 600;
            width: 130px;
            color: #475569;
        }}
        .value {{
            color: #0f172a;
        }}
        .cta-btn {{
            display: inline-block;
            background-color: #10b981;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 14px;
            margin: 20px 0;
            text-align: center;
        }}
        .footer {{
            background-color: #f1f5f9;
            color: #64748b;
            padding: 20px;
            text-align: center;
            font-size: 11px;
            border-top: 1px solid #e2e8f0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Deadline Reminder Alert</h1>
        </div>
        <div class="content">
            <div class="greeting">Hi {poc_name},</div>
            <p>This is an automated reminder that the deadline for one of your assigned leads is approaching in <strong>24 hours</strong>. Please review the details below and take the next necessary actionable steps.</p>
            
            <div class="details-box">
                <div class="details-row">
                    <span class="label">Company:</span>
                    <span class="value"><strong>{company}</strong></span>
                </div>
                <div class="details-row">
                    <span class="label">Deadline:</span>
                    <span class="value" style="color: #ef4444; font-weight: bold;">{deadline}</span>
                </div>
                {f'''<div class="details-row">
                    <span class="label">Est. Revenue:</span>
                    <span class="value" style="color: #10b981; font-weight: bold;">{amount}</span>
                </div>''' if amount else ''}
            </div>

            <p style="margin-top: 25px;">You can view and manage all lead status records directly via the Live CRM Dashboard.</p>
            
            <div style="text-align: center;">
                <a href="http://localhost:3000/dashboard" class="cta-btn">Open CRM Dashboard</a>
            </div>
            
            <p style="font-size: 12px; color: #64748b; margin-top: 30px;">Thanks,<br>Obsidian CRM Automated Alerts</p>
        </div>
        <div class="footer">
            This is an automated system email from aryan@cogculture.agency. Please do not reply directly to this message.
        </div>
    </div>
</body>
</html>
"""
    return send_email(to_email, subject, html_content)
