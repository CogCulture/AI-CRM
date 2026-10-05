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
    """Background task to dispatch daily lead digests and proposal follow-up alerts at 10:00 AM IST."""
    # Let server boot fully first (wait 10 seconds)
    await asyncio.sleep(10)
    print("Background daily scheduler started (polls every 60 seconds)...")
    while True:
        try:
            from datetime import datetime, timedelta
            # local time (UTC+5:30)
            local_now = datetime.utcnow() + timedelta(hours=5, minutes=30)
            
            # Daily 10:00 AM IST automation trigger
            if local_now.hour == 10 and local_now.minute == 0:
                print(f"Daily 10:00 AM IST scheduler trigger: processing daily digests and alerts...")
                
                # 1. Dispatch Daily Leads & New Intake Digest (Leads added yesterday, status, follow-up, source, hot leads)
                from app.services.email_service import dispatch_daily_leads_digest, dispatch_proposals_followup_alert
                dispatch_daily_leads_digest()
                
                # 2. Dispatch Daily Proposals & Follow-up Action Alert (Proposals today, Day 2/5/overdue cadence)
                dispatch_proposals_followup_alert()
                
                # 3. Check deadlines
                check_and_send_alerts()

            # Optional 11:30 AM metrics snapshot
            elif local_now.hour == 11 and local_now.minute == 30:
                from app.services.report_service import send_daily_metrics_report
                send_daily_metrics_report()

        except Exception as e:
            print(f"Error in scheduled daily tasks: {e}")
        # Poll every 60 seconds
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

