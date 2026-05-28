import re
import os
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials as ServiceAccountCredentials
from google.oauth2.credentials import Credentials as OAuthCredentials
from google.auth.transport.requests import Request
from cachetools import TTLCache
from app.config import settings

_cache = TTLCache(maxsize=10, ttl=settings.cache_ttl_seconds)

MOCK_HEADERS = ["No.", "Campaign", "Visitors", "Contacts", "Companies", "Leads", "Value"]
MOCK_ROWS = [
    {"No.": "1", "Campaign": "ROQ\nSearch/brand", "Visitors": "1,181", "Contacts": "217", "Companies": "150", "Leads": "28.9", "Value": "$78.29"},
    {"No.": "2", "Campaign": "Website Ads\nRetargeting", "Visitors": "998", "Contacts": "182", "Companies": "121", "Leads": "20.1", "Value": "$63.21"},
    {"No.": "3", "Campaign": "Demo\nRequest", "Visitors": "891", "Contacts": "145", "Companies": "81", "Leads": "14.2", "Value": "$48.39"},
    {"No.": "4", "Campaign": "Global\nTool", "Visitors": "541", "Contacts": "98", "Companies": "67", "Leads": "10.7", "Value": "$35.71"}
]

def _extract_sheet_id(url: str) -> str:
    """Extract Google Sheet ID from URL."""
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
    if not match:
        raise ValueError(f"Cannot extract Sheet ID from URL: {url}")
    return match.group(1)

def _get_token_path():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, "token.json")

def _get_service():
    token_path = _get_token_path()
    if os.path.exists(token_path):
        creds = OAuthCredentials.from_authorized_user_file(
            token_path, 
            scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
        )
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(token_path, "w") as f:
                f.write(creds.to_json())
        return build("sheets", "v4", credentials=creds, cache_discovery=False)
        
    if settings.google_credentials_json and re.match(r'.*\.json$', settings.google_credentials_json):
        creds = ServiceAccountCredentials.from_service_account_file(
            settings.google_credentials_json,
            scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
        )
        return build("sheets", "v4", credentials=creds, cache_discovery=False)
    elif settings.google_api_key:
        return build("sheets", "v4", developerKey=settings.google_api_key, cache_discovery=False)
    raise RuntimeError("No Google credentials or OAuth token configured. Please sign in with Google.")

def fetch_sheet_data(sheet_url: str, range_name: str = "Sheet1") -> dict:
    """Returns { headers: [...], rows: [[...], ...], total: int }"""
    if not sheet_url or sheet_url.strip() == "" or sheet_url == "mock":
        return {"headers": MOCK_HEADERS, "rows": MOCK_ROWS, "total": len(MOCK_ROWS), "is_mock": True}

    cache_key = f"{sheet_url}:{range_name}"
    if cache_key in _cache:
        return _cache[cache_key]

    try:
        sheet_id = _extract_sheet_id(sheet_url)
        service = _get_service()
        result = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=sheet_id, range=range_name)
            .execute()
        )

        values = result.get("values", [])
        if not values:
            return {"headers": [], "rows": [], "total": 0, "is_mock": False}

        headers = values[0]
        rows = values[1:]

        # Normalize rows to match header length
        normalized = [
            {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}
            for row in rows
        ]

        data = {"headers": headers, "rows": normalized, "total": len(normalized), "is_mock": False}
        _cache[cache_key] = data
        return data
    except Exception as e:
        # Fallback to mock data with details of the exception
        print(f"Sheets fetch failed, falling back to mock: {e}")
        return {"headers": MOCK_HEADERS, "rows": MOCK_ROWS, "total": len(MOCK_ROWS), "is_mock": True, "error": str(e)}
