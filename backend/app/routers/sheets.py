from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from app.services import config_service, sheets_service
from app.config import settings
from google_auth_oauthlib.flow import Flow
import os
import urllib.parse

# Relax oauthlib's strict scope check since Google adds openid/profile/email automatically
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"


router = APIRouter()

def _get_token_path():
    # Store token.json in the backend root directory
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, "token.json")

@router.get("/data")
def get_sheet_data():
    cfg = config_service.load_config()
    sheet_url = cfg.get("sheet_url")
    range_name = cfg.get("sheet_range", "Sheet1")
    
    # If not configured, we fetch mock data and flag configured as False
    is_configured = bool(sheet_url)
    
    try:
        data = sheets_service.fetch_sheet_data(sheet_url or "mock", range_name)
        data["configured"] = is_configured
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/auth")
def oauth_auth(redirect_url: str = "http://localhost:3001/admin"):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=400,
            detail="Google Client ID and Client Secret are not configured in your backend/.env file."
        )
    
    flow = Flow.from_client_config(
        client_config={
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
        redirect_uri="http://localhost:8000/api/sheets/callback"
    )
    
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        state=redirect_url,
        prompt="consent"
    )
    
    return RedirectResponse(authorization_url)

@router.get("/callback")
def oauth_callback(code: str, state: str):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=400,
            detail="Google Client ID and Client Secret are not configured."
        )

    flow = Flow.from_client_config(
        client_config={
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
        redirect_uri="http://localhost:8000/api/sheets/callback"
    )
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        with open(_get_token_path(), "w") as f:
            f.write(credentials.to_json())
            
        frontend_url = state if state else "http://localhost:3001/admin"
        separator = "&" if "?" in frontend_url else "?"
        return RedirectResponse(f"{frontend_url}{separator}auth=success")
    except Exception as e:
        frontend_url = state if state else "http://localhost:3001/admin"
        separator = "&" if "?" in frontend_url else "?"
        err_msg = urllib.parse.quote(str(e))
        return RedirectResponse(f"{frontend_url}{separator}auth=failure&error={err_msg}")

@router.post("/signout")
def signout():
    token_path = _get_token_path()
    if os.path.exists(token_path):
        try:
            os.remove(token_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to sign out: {e}")
    return {"ok": True}

@router.get("/auth-status")
def auth_status():
    token_path = _get_token_path()
    if not os.path.exists(token_path):
        return {"authenticated": False}
    try:
        from google.oauth2.credentials import Credentials
        creds = Credentials.from_authorized_user_file(token_path, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
        return {"authenticated": True, "expired": creds.expired}
    except Exception:
        return {"authenticated": False}

