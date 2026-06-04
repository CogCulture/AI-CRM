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
def get_sheet_data(bypass_cache: bool = False):
    cfg = config_service.load_config()
    sheet_url = cfg.get("sheet_url")
    range_name = cfg.get("sheet_range", "Sheet1")
    
    # If not configured, we fetch mock data and flag configured as False
    is_configured = bool(sheet_url)
    
    try:
        data = sheets_service.fetch_sheet_data(sheet_url or "mock", range_name, bypass_cache=bypass_cache)
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
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets",
            "openid",
            "email",
            "profile"
        ],
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
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets",
            "openid",
            "email",
            "profile"
        ],
        redirect_uri="http://localhost:8000/api/sheets/callback"
    )
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        import json as _json
        creds_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes,
            "id_token": credentials.id_token
        }
        with open(_get_token_path(), "w") as f:
            _json.dump(creds_data, f)
            
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
        creds = Credentials.from_authorized_user_file(token_path)
        
        # If expired, attempt refresh
        if creds.expired and creds.refresh_token:
            try:
                from google.auth.transport.requests import Request
                creds.refresh(Request())
                with open(token_path, "w") as f:
                    f.write(creds.to_json())
            except Exception:
                pass

        import httpx
        # Call userinfo endpoint using access token
        headers = {"Authorization": f"Bearer {creds.token}"}
        res = httpx.get("https://www.googleapis.com/oauth2/v3/userinfo", headers=headers)
        if res.status_code == 200:
            user_data = res.json()
            return {
                "authenticated": True,
                "email": user_data.get("email", ""),
                "name": user_data.get("name", ""),
                "picture": user_data.get("picture", "")
            }

        # Fallback to id_token if API request fails
        import base64
        import json as _json
        account_info = {}
        with open(token_path, "r") as f:
            raw = _json.load(f)
        id_token = raw.get("id_token", "")
        if id_token:
            try:
                payload_b64 = id_token.split(".")[1]
                payload_b64 += "=" * (4 - len(payload_b64) % 4)
                payload = _json.loads(base64.urlsafe_b64decode(payload_b64))
                account_info = {
                    "email": payload.get("email", ""),
                    "name": payload.get("name", ""),
                    "picture": payload.get("picture", "")
                }
            except Exception:
                pass

        return {
            "authenticated": True,
            "expired": creds.expired,
            **account_info
        }
    except Exception:
        return {"authenticated": False}

@router.post("/lead")
def add_lead(body: dict):
    cfg = config_service.load_config()
    sheet_url = cfg.get("sheet_url")
    range_name = cfg.get("sheet_range", "Sheet1")
    if not sheet_url:
        raise HTTPException(status_code=400, detail="Sheet URL is not configured.")
    try:
        res = sheets_service.append_lead_row(sheet_url, range_name, body)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/lead/{row_num}")
def update_lead(row_num: int, body: dict):
    cfg = config_service.load_config()
    sheet_url = cfg.get("sheet_url")
    range_name = cfg.get("sheet_range", "Sheet1")
    if not sheet_url:
        raise HTTPException(status_code=400, detail="Sheet URL is not configured.")
    try:
        res = sheets_service.update_lead_row(sheet_url, range_name, row_num, body)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/lead/{row_num}")
def delete_lead(row_num: int):
    cfg = config_service.load_config()
    sheet_url = cfg.get("sheet_url")
    range_name = cfg.get("sheet_range", "Sheet1")
    if not sheet_url:
        raise HTTPException(status_code=400, detail="Sheet URL is not configured.")
    try:
        res = sheets_service.delete_lead_row(sheet_url, range_name, row_num)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
