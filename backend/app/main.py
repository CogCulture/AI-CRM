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

async def schedule_daily_alerts_check():
    """Background task to check deadlines daily."""
    # Let server boot fully first (wait 10 seconds)
    await asyncio.sleep(10)
    while True:
        try:
            print("Running scheduled lead deadline alert checks...")
            check_and_send_alerts()
        except Exception as e:
            print(f"Error in scheduled alerts task: {e}")
        # Sleep for 24 hours
        await asyncio.sleep(86400)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(schedule_daily_alerts_check())

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

