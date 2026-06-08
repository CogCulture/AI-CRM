from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.services import config_service

router = APIRouter()

class ConfigUpdate(BaseModel):
    sheet_url: Optional[str] = None
    sheet_range: Optional[str] = None
    visible_columns: Optional[List[str]] = None
    column_order: Optional[List[str]] = None
    graphs: Optional[List[dict]] = None
    report_recipients: Optional[List[str]] = None

@router.get("/")
def get_config():
    return config_service.load_config()

@router.patch("/")
def update_config(body: ConfigUpdate):
    updates = body.model_dump(exclude_none=True)
    return config_service.update_config(updates)

@router.post("/test-connection")
def test_connection(body: dict):
    """Test if a sheet URL is accessible before saving."""
    from app.services.sheets_service import fetch_sheet_data
    try:
        url = body.get("sheet_url", "")
        range_name = body.get("sheet_range", "Sheet1")
        data = fetch_sheet_data(url, range_name)
        if data.get("error") and data.get("is_mock"):
            # If Google Sheets returned error and fell back to mock, test-connection should show error
            raise Exception(data.get("error"))
        return {"ok": True, "headers": data["headers"], "row_count": data["total"], "is_mock": data.get("is_mock", False)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
