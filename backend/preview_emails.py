"""
Generates static HTML files for both executive email templates using live data.
Outputs to:
  backend/preview/leads_digest.html
  backend/preview/proposals_alert.html
"""

import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


from app.services import email_service

def generate_previews():
    preview_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "preview")
    os.makedirs(preview_dir, exist_ok=True)

    print("Generating Email 1: Daily Leads & New Intake Digest...")
    p1 = email_service.preview_daily_leads_digest()
    p1_path = os.path.join(preview_dir, "leads_digest.html")
    with open(p1_path, "w", encoding="utf-8") as f:
        f.write(p1["html"])
    print(f"Saved Email 1 to {p1_path}")
    print(f"  Subject: {p1['subject']}")
    print(f"  Hot Deals Count: {p1.get('hot_deals_count')} | Value: ₹{p1.get('hot_pipeline_value'):,.0f}")
    print(f"  Displayed Intake Leads: {p1.get('displayed_leads_count')}")

    print("\nGenerating Email 2: Daily Proposals & Follow-up Action Alert...")
    p2 = email_service.preview_proposals_followup_alert()
    p2_path = os.path.join(preview_dir, "proposals_alert.html")
    with open(p2_path, "w", encoding="utf-8") as f:
        f.write(p2["html"])
    print(f"Saved Email 2 to {p2_path}")
    print(f"  Subject: {p2['subject']}")
    print(f"  Proposals to Send: {p2.get('proposals_to_send_count')} (Unassigned: {p2.get('unassigned_proposals_count')})")
    print(f"  Overdue Follow-ups: {p2.get('followups_overdue_count')}")
    print(f"  Total Value at Risk: ₹{p2.get('total_val_at_risk'):,.0f}")

    print("\nDone! Both executive previews successfully created.")

if __name__ == "__main__":
    generate_previews()
