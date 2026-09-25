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

def _extract_gid(url: str) -> str:
    """Extract gid from URL, defaulting to '0' if not present."""
    match = re.search(r'[#&?]gid=([0-9]+)', url)
    if match:
        return match.group(1)
    return "0"

def _get_token_path():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, "token.json")

def _get_service():
    token_path = _get_token_path()
    if os.path.exists(token_path):
        try:
            creds = OAuthCredentials.from_authorized_user_file(token_path)
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                with open(token_path, "w") as f:
                    f.write(creds.to_json())
            return build("sheets", "v4", credentials=creds, cache_discovery=False)
        except Exception as refresh_err:
            print(f"Failed to refresh Google token: {refresh_err}. Removing invalid token.json")
            if os.path.exists(token_path):
                try:
                    os.remove(token_path)
                except Exception:
                    pass
            raise RuntimeError(
                "Google Sheets authentication expired or was revoked. Please log in again in the settings page."
            )
        
    if settings.google_credentials_json and re.match(r'.*\.json$', settings.google_credentials_json):
        creds = ServiceAccountCredentials.from_service_account_file(
            settings.google_credentials_json,
            scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
        return build("sheets", "v4", credentials=creds, cache_discovery=False)
    elif settings.google_api_key:
        return build("sheets", "v4", developerKey=settings.google_api_key, cache_discovery=False)
    raise RuntimeError("No Google credentials configured")

def _deduplicate_headers(headers: list) -> list:
    """Deduplicate header lists by adding a suffix to duplicates (e.g. Status, Status (1), Status (2))."""
    seen = {}
    deduped = []
    for h in headers:
        h = h.strip()
        if not h:
            h = "Unnamed"
        if h in seen:
            seen[h] += 1
            deduped.append(f"{h} ({seen[h]})")
        else:
            seen[h] = 0
            deduped.append(h)
    return deduped

def _get_column_letter(col_num: int) -> str:
    """Convert a 1-based column number to a Google Sheets column letter (e.g. 1 -> A, 27 -> AA)."""
    letter = ""
    while col_num > 0:
        col_num, remainder = divmod(col_num - 1, 26)
        letter = chr(65 + remainder) + letter
    return letter

def _fetch_public_csv(sheet_url: str) -> dict:
    """Fetch public sheet as CSV directly and parse."""
    import httpx
    import csv
    import io
    
    sheet_id = _extract_sheet_id(sheet_url)
    gid = _extract_gid(sheet_url)
    
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    
    try:
        response = httpx.get(csv_url, follow_redirects=True, timeout=10.0)
    except Exception as e:
        raise RuntimeError(f"Network error trying to fetch Google Sheet: {e}")
        
    if response.status_code in [401, 403]:
        raise RuntimeError(
            "This Google Sheet is private (401/403 Unauthorized). "
            "To link it, click 'Share' in the top-right of your Google Sheet, "
            "and set General Access to 'Anyone with the link' as 'Viewer'."
        )
    elif response.status_code != 200:
        raise RuntimeError(f"Google Sheet fetch returned status code {response.status_code}.")
        
    content = response.text
    # Detect if Google redirected us to a login page instead of giving CSV
    if "<html" in content.lower() and "google.com" in content.lower() and "signin" in content.lower():
        raise RuntimeError(
            "This Google Sheet is private (Redirected to Google Sign-in). "
            "To link it, click 'Share' in the top-right of your Google Sheet, "
            "and set General Access to 'Anyone with the link' as 'Viewer'."
        )
        
    reader = csv.reader(io.StringIO(content))
    rows_list = list(reader)
    if not rows_list:
        return {"headers": [], "rows": [], "total": 0, "is_mock": False}
        
    headers = _deduplicate_headers(rows_list[0])
    rows = rows_list[1:]
    
    # Normalize rows to match header length and filter out empty rows/headers
    normalized = []
    for idx, row in enumerate(rows):
        row_dict = {}
        row_has_data = False
        for i in range(len(headers)):
            val = row[i].strip() if i < len(row) else ""
            row_dict[headers[i]] = val
            if val != "":
                row_has_data = True
        
        if row_has_data:
            non_empty_cols = [k for k, v in row_dict.items() if v != ""]
            # Exclude single-cell section header divider rows (e.g. 'OCTOBER LEADS (GOOGLE ADS)')
            if len(non_empty_cols) == 1:
                continue
            # Require at least 2 non-empty columns to be considered a real data row
            if len(non_empty_cols) < 2:
                continue
            
            # Store the 1-indexed Excel row number
            row_dict["_row_num"] = idx + 2
            normalized.append(row_dict)
        
    return {"headers": headers, "rows": normalized, "total": len(normalized), "is_mock": False}

def fetch_sheet_data(sheet_url: str, range_name: str = "Sheet1", bypass_cache: bool = False) -> dict:
    """Returns { headers: [...], rows: [[...], ...], total: int }"""
    if not sheet_url or sheet_url.strip() in ["", "mock", "local_db"]:
        from app.services import leads_service
        return leads_service.get_all_leads()

    cache_key = f"{sheet_url}:{range_name}"
    if not bypass_cache and cache_key in _cache:
        return _cache[cache_key]

    # Try Google Sheets API v4 first
    try:
        sheet_id = _extract_sheet_id(sheet_url)
        gid = _extract_gid(sheet_url)
        service = _get_service()

        # 1. Fetch spreadsheet metadata to discover sheet tabs
        sheet_title_map = {}
        first_sheet_title = range_name
        try:
            metadata = service.spreadsheets().get(
                spreadsheetId=sheet_id,
                fields="sheets.properties(title,sheetId)"
            ).execute()
            
            sheets = metadata.get("sheets", [])
            target_sheet = None
            
            if sheets:
                first_sheet_title = sheets[0].get("properties", {}).get("title") or "Sheet1"
                sheet_title_map = {
                    s.get("properties", {}).get("title", "").strip().lower(): s.get("properties", {}).get("title")
                    for s in sheets if s.get("properties", {}).get("title")
                }
            
            # Match requested range_name against existing sheet titles
            if range_name and range_name.strip().lower() in sheet_title_map:
                actual_title = sheet_title_map[range_name.strip().lower()]
                for s in sheets:
                    if s.get("properties", {}).get("title") == actual_title:
                        target_sheet = s
                        break
            elif gid:
                for s in sheets:
                    props = s.get("properties", {})
                    if str(props.get("sheetId")) == str(gid):
                        target_sheet = s
                        break
            
            if not target_sheet and sheets:
                target_sheet = sheets[0]
                
            final_range = target_sheet.get("properties", {}).get("title") if target_sheet else range_name
        except Exception as meta_err:
            print(f"Failed to fetch sheet metadata (falling back to range '{range_name}'): {meta_err}")
            final_range = range_name

        # 2. Fetch values with fallback if specified range does not exist
        try:
            result = (
                service.spreadsheets()
                .values()
                .get(spreadsheetId=sheet_id, range=final_range)
                .execute()
            )
        except Exception as range_err:
            print(f"Failed to fetch range '{final_range}': {range_err}. Retrying with default sheet '{first_sheet_title}'...")
            result = (
                service.spreadsheets()
                .values()
                .get(spreadsheetId=sheet_id, range=first_sheet_title)
                .execute()
            )

        values = result.get("values", [])
        if not values:
            data = {"headers": [], "rows": [], "total": 0, "is_mock": False}
        else:
            raw_headers = values[0]
            headers = _deduplicate_headers(raw_headers)
            has_lead_id = "Lead ID" in headers
            if not has_lead_id:
                headers = ["Lead ID"] + headers
            
            rows = values[1:]
            normalized = []
            for idx, row in enumerate(rows):
                # Data row is at index idx + 1 in the spreadsheet grid (row 1 is headers)
                grid_row_idx = idx + 1
                row_dict = {}
                row_has_data = False
                
                for new_idx, h in enumerate(raw_headers):
                    val = row[new_idx].strip() if new_idx < len(row) else ""
                    header_key = headers[new_idx + (1 if not has_lead_id else 0)]
                    row_dict[header_key] = val
                    if val != "":
                        row_has_data = True
                
                if row_has_data:
                    non_empty_cols = [k for k, v in row_dict.items() if v != ""]
                    # Exclude single-cell section header divider rows (e.g. 'OCTOBER LEADS (GOOGLE ADS)')
                    if len(non_empty_cols) <= 1:
                        continue
                    # Require at least 2 non-empty columns to be a real data row
                    if len(non_empty_cols) < 2:
                        continue
                    row_dict["_row_num"] = grid_row_idx + 1
                    
                    # Backfill/inject Lead ID
                    if not row_dict.get("Lead ID"):
                        row_dict["Lead ID"] = f"COG-{1000 + row_dict['_row_num']}"
                    
                    normalized.append(row_dict)
            data = _apply_local_overrides({"headers": headers, "rows": normalized, "total": len(normalized), "is_mock": False})
            
        _cache[cache_key] = data
        return data
        
    except Exception as api_err:
        print(f"Sheets API fetch failed: {api_err}. Trying public CSV export fallback...")
        try:
            data = _apply_local_overrides(_fetch_public_csv(sheet_url))
            _cache[cache_key] = data
            return data
        except Exception as csv_err:
            print(f"Public CSV fallback failed: {csv_err}")
            raise RuntimeError(f"Google Sheets API Error: {api_err}. Fallback Error: {csv_err}")

import json as _json_mod

def _get_overrides_path() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, "local_overrides.json")

def _load_overrides() -> dict:
    p = _get_overrides_path()
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return _json_mod.load(f)
        except Exception:
            pass
    return {"updated": {}, "added": [], "deleted": []}

def _save_overrides(overrides: dict):
    p = _get_overrides_path()
    try:
        with open(p, "w", encoding="utf-8") as f:
            _json_mod.dump(overrides, f, indent=2)
    except Exception as e:
        print(f"Failed to save local overrides: {e}")

def _clean_lead_payload(lead_data: dict) -> dict:
    return {k: str(v).strip() if v is not None else "" for k, v in lead_data.items() if not k.startswith("_")}

def _apply_local_overrides(data: dict) -> dict:
    overrides = _load_overrides()
    updated_map = overrides.get("updated", {})
    added_list = overrides.get("added", [])
    deleted_set = set(int(x) for x in overrides.get("deleted", []) if str(x).isdigit())

    headers = list(data.get("headers", []))
    rows = data.get("rows", [])

    for _, u_row in updated_map.items():
        for k in u_row.keys():
            if not k.startswith("_") and k not in headers:
                headers.append(k)
    for a_row in added_list:
        for k in a_row.keys():
            if not k.startswith("_") and k not in headers:
                headers.append(k)

    final_rows = []
    for r in rows:
        r_num = r.get("_row_num")
        if r_num in deleted_set:
            continue
        row_copy = dict(r)
        if str(r_num) in updated_map:
            for k, v in updated_map[str(r_num)].items():
                if not k.startswith("_"):
                    row_copy[k] = v
        for h in headers:
            if h not in row_copy:
                row_copy[h] = ""
        final_rows.append(row_copy)

    for a_row in added_list:
        r_num = a_row.get("_row_num")
        if r_num in deleted_set:
            continue
        row_copy = dict(a_row)
        if str(r_num) in updated_map:
            for k, v in updated_map[str(r_num)].items():
                if not k.startswith("_"):
                    row_copy[k] = v
        for h in headers:
            if h not in row_copy:
                row_copy[h] = ""
        final_rows.append(row_copy)

    return {
        "headers": headers,
        "rows": final_rows,
        "total": len(final_rows),
        "is_mock": data.get("is_mock", False)
    }

def append_lead_row(sheet_url: str, range_name: str, lead_data: dict) -> dict:
    """Appends a new lead row to the Google Sheet (with local fallback if sheet is Viewer-only). Clears cache."""
    if not sheet_url or sheet_url.strip() in ["", "mock", "local_db"]:
        from app.services import leads_service
        return leads_service.add_lead(lead_data)
    
    clean_data = _clean_lead_payload(lead_data)

    # Auto-generate next Lead ID if not present in clean_data
    max_num = 1000
    max_row_num = 500
    try:
        all_leads_dict = fetch_sheet_data(sheet_url, range_name, bypass_cache=True)
        for row in all_leads_dict.get("rows", []):
            r_num = int(row.get("_row_num") or 0)
            if r_num > max_row_num:
                max_row_num = r_num
            lid = row.get("Lead ID") or ""
            if lid.startswith("COG-"):
                try:
                    num = int(lid.split("-")[1])
                    if num > max_num:
                        max_num = num
                except Exception:
                    pass
    except Exception:
        pass

    if not clean_data.get("Lead ID"):
        clean_data["Lead ID"] = f"COG-{max_num + 1}"

    try:
        service = _get_service()
        sheet_id = _extract_sheet_id(sheet_url)
        gid = _extract_gid(sheet_url)
        
        # 1. Fetch spreadsheet metadata to map gid to title
        metadata = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
        sheets = metadata.get("sheets", [])
        target_title = None
        if gid:
            for s in sheets:
                props = s.get("properties", {})
                if str(props.get("sheetId")) == str(gid):
                    target_title = props.get("title")
                    break
        if not target_title and sheets:
            target_title = sheets[0].get("properties", {}).get("title")
        final_range = target_title if target_title else range_name
        
        # 2. Fetch headers to order cell values correctly
        result = service.spreadsheets().values().get(spreadsheetId=sheet_id, range=f"'{final_range}'!A1:ZZ1").execute()
        values = result.get("values", [])
        if not values:
            raise ValueError("Target sheet headers could not be found.")
        headers = [h.strip() for h in values[0]]
        deduped_headers = _deduplicate_headers(headers)
        
        # 2c. Ensure the spreadsheet has any new columns present in clean_data (including 'Lead ID' or Tender fields)
        new_cols = [k for k, v in clean_data.items() if k not in deduped_headers and v != ""]
        if "Lead ID" not in deduped_headers and "Lead ID" not in new_cols:
            new_cols.append("Lead ID")
        if new_cols:
            try:
                updated_headers = headers + new_cols
                service.spreadsheets().values().update(
                    spreadsheetId=sheet_id,
                    range=f"'{final_range}'!A1",
                    valueInputOption="USER_ENTERED",
                    body={"values": [updated_headers]}
                ).execute()
                deduped_headers.extend(new_cols)
            except Exception as header_err:
                print(f"Failed to append new headers to sheet: {header_err}")

        # 3. Format row data to match header ordering
        row_values = []
        for dh in deduped_headers:
            row_values.append(str(clean_data.get(dh, "")).strip())
            
        # 4. Append to sheet
        body = {
            "values": [row_values]
        }
        last_col_letter = _get_column_letter(len(deduped_headers))
        service.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range=f"'{final_range}'!A:{last_col_letter}",
            valueInputOption="USER_ENTERED",
            body=body
        ).execute()
        
        _cache.clear()
        return {"ok": True}
    except Exception as e:
        if "403" in str(e) or "permission" in str(e).lower():
            overrides = _load_overrides()
            new_row = dict(clean_data)
            new_row["_row_num"] = max_row_num + 1
            overrides.setdefault("added", []).append(new_row)
            _save_overrides(overrides)
            _cache.clear()
            return {"ok": True, "local_fallback": True}
        raise e

def update_lead_row(sheet_url: str, range_name: str, row_num: int, lead_data: dict) -> dict:
    """Updates a specific row index in the Google Sheet (with local fallback if sheet is Viewer-only). Clears cache."""
    if not sheet_url or sheet_url.strip() in ["", "mock", "local_db"]:
        from app.services import leads_service
        return leads_service.update_lead(row_num, lead_data)
    
    clean_data = _clean_lead_payload(lead_data)

    try:
        service = _get_service()
        sheet_id = _extract_sheet_id(sheet_url)
        gid = _extract_gid(sheet_url)
        
        metadata = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
        sheets = metadata.get("sheets", [])
        target_title = None
        if gid:
            for s in sheets:
                props = s.get("properties", {})
                if str(props.get("sheetId")) == str(gid):
                    target_title = props.get("title")
                    break
        if not target_title and sheets:
            target_title = sheets[0].get("properties", {}).get("title")
        final_range = target_title if target_title else range_name
        
        result = service.spreadsheets().values().get(spreadsheetId=sheet_id, range=f"'{final_range}'!A1:ZZ1").execute()
        values = result.get("values", [])
        if not values:
            raise ValueError("Target sheet headers could not be found.")
        headers = [h.strip() for h in values[0]]
        deduped_headers = _deduplicate_headers(headers)
        
        # Auto-add any new non-empty columns (e.g. Tender Detail fields) to sheet headers
        new_cols = [k for k, v in clean_data.items() if k not in deduped_headers and v != ""]
        if new_cols:
            try:
                updated_headers = headers + new_cols
                service.spreadsheets().values().update(
                    spreadsheetId=sheet_id,
                    range=f"'{final_range}'!A1",
                    valueInputOption="USER_ENTERED",
                    body={"values": [updated_headers]}
                ).execute()
                deduped_headers.extend(new_cols)
            except Exception as header_err:
                print(f"Failed to append new headers on update: {header_err}")

        row_values = []
        for dh in deduped_headers:
            row_values.append(str(clean_data.get(dh, "")).strip())
            
        range_to_update = f"'{final_range}'!A{row_num}"
        body = {
            "values": [row_values]
        }
        service.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range=range_to_update,
            valueInputOption="USER_ENTERED",
            body=body
        ).execute()
        
        _cache.clear()
        return {"ok": True}
    except Exception as e:
        if "403" in str(e) or "permission" in str(e).lower():
            overrides = _load_overrides()
            existing = overrides.setdefault("updated", {}).get(str(row_num), {})
            existing.update(clean_data)
            overrides["updated"][str(row_num)] = existing
            _save_overrides(overrides)
            _cache.clear()
            return {"ok": True, "local_fallback": True}
        raise e

def delete_lead_row(sheet_url: str, range_name: str, row_num: int) -> dict:
    """Deletes a specific row index in the Google Sheet (with local fallback if sheet is Viewer-only). Clears cache."""
    if not sheet_url or sheet_url.strip() in ["", "mock", "local_db"]:
        from app.services import leads_service
        return leads_service.delete_lead(row_num)
    try:
        service = _get_service()
        sheet_id = _extract_sheet_id(sheet_url)
        gid = _extract_gid(sheet_url)
        
        # Resolve sheet metadata to get correct sheetId of target tab
        metadata = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
        sheets = metadata.get("sheets", [])
        target_sheet_id = None
        if gid:
            for s in sheets:
                props = s.get("properties", {})
                if str(props.get("sheetId")) == str(gid):
                    target_sheet_id = props.get("sheetId")
                    break
        if target_sheet_id is None and sheets:
            target_sheet_id = sheets[0].get("properties", {}).get("sheetId")
            
        if target_sheet_id is None:
            raise ValueError("Could not resolve target Google Sheet tab ID.")
            
        # Excel rows are 1-indexed, start/end indices in deleteDimension are 0-indexed.
        body = {
            "requests": [
                {
                    "deleteDimension": {
                        "range": {
                            "sheetId": int(target_sheet_id),
                            "dimension": "ROWS",
                            "startIndex": row_num - 1,
                            "endIndex": row_num
                        }
                    }
                }
            ]
        }
        service.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id,
            body=body
        ).execute()
        
        _cache.clear()
        return {"ok": True}
    except Exception as e:
        if "403" in str(e) or "permission" in str(e).lower():
            overrides = _load_overrides()
            deleted = overrides.setdefault("deleted", [])
            if row_num not in deleted:
                deleted.append(row_num)
            _save_overrides(overrides)
            _cache.clear()
            return {"ok": True, "local_fallback": True}
        raise e

