from fastapi import HTTPException, Cookie
from typing import Optional
import base64
import json as _json
from app.config import settings

def get_admin_user(user_session: Optional[str] = Cookie(None)):
    if not user_session:
        raise HTTPException(status_code=401, detail="Unauthorized: No session cookie found")
    try:
        decoded_cookie = base64.b64decode(user_session.encode("utf-8")).decode("utf-8")
        session_data = _json.loads(decoded_cookie)
        email = session_data.get("email", "")
        if not email:
            raise HTTPException(status_code=401, detail="Unauthorized: Session is invalid")
        
        # Check if user email is in the admin emails list
        if settings.admin_emails:
            allowed_admins = [e.strip().lower() for e in settings.admin_emails.split(",") if e.strip()]
            if email.lower() not in allowed_admins:
                raise HTTPException(status_code=403, detail="Forbidden: You do not have administrator access")
        else:
            # Fallback: restrict to work/corporate email domain
            domain = email.split("@")[1].lower() if "@" in email else ""
            public_domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "yandex.com"]
            if not domain or domain in public_domains:
                raise HTTPException(status_code=403, detail="Forbidden: Admin access restricted to corporate accounts")
                
        return session_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized: Session validation failed: {str(e)}")
