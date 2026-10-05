import socket
socket.setdefaulttimeout(15.0) # Prevent Google API from hanging the threadpool

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import sheets, config_router, dashboard

app = FastAPI(title="CRM Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in settings.cors_origins else settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sheets.router,        prefix="/api/sheets",    tags=["Sheets"])
app.include_router(config_router.router, prefix="/api/config",    tags=["Config"])
app.include_router(dashboard.router,     prefix="/api/dashboard", tags=["Dashboard"])

import asyncio
from app.services.alert_service import check_and_send_alerts

@app.get("/health")
def health(): return {"status": "ok"}

async def schedule_daily_tasks():
    """Background task: fires daily digests exactly once at 10:00 AM IST."""
    await asyncio.sleep(10)  # Let server boot fully
    print("Background daily scheduler started (polls every 60 seconds)...")

    last_fired_date = None  # Guard: fire only once per calendar day

    while True:
        try:
            from datetime import datetime, timedelta, date as date_type
            local_now = datetime.utcnow() + timedelta(hours=5, minutes=30)
            today = local_now.date()

            # Fire once at 10:00 AM IST — dedup by date so restarts are safe
            if local_now.hour == 10 and local_now.minute == 0 and last_fired_date != today:
                last_fired_date = today
                print(f"[{local_now.strftime('%d %b %Y %H:%M IST')}] Firing daily email digests...")

                from app.services.email_service import dispatch_daily_leads_digest, dispatch_proposals_followup_alert
                r1 = dispatch_daily_leads_digest()
                r2 = dispatch_proposals_followup_alert()
                print(f"  Leads digest sent: {r1.get('success')} → {r1.get('recipients')}")
                print(f"  Proposals alert sent: {r2.get('success')} → {r2.get('recipients')}")

                check_and_send_alerts()

        except Exception as e:
            print(f"[Scheduler error] {e}")

        await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    import anyio.to_thread
    # Increase threadpool to prevent exhaustion from concurrent Google Sheets API calls
    anyio.to_thread.current_default_thread_limiter().total_tokens = 200

    import os
    run_scheduler = os.environ.get("RUN_BACKGROUND_SCHEDULER", "true").lower() == "true"
    if run_scheduler:
        print("Starting background daily task loop...")
        asyncio.create_task(schedule_daily_tasks())
    else:
        print("Background task loop disabled (Production HTTP Scheduler target mode active).")

@app.get("/debug-cors")
def debug_cors():
    import os
    return {
        "origins_in_settings": settings.cors_origins,
        "env_var": os.environ.get("CORS_ORIGINS")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

