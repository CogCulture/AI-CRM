import json, os
from app.config import settings

DEFAULT_CONFIG = {
    "sheet_url": "",
    "sheet_id": "",
    "sheet_range": "Sheet1",
    "visible_columns": [],      # [] = all visible
    "column_order": [],
    "graphs": [],                # [{ id, type, x_col, y_col, title }]
    "report_recipients": []      # List of emails to receive daily summary at 11:30 am
}

def _path(): return settings.config_store_path

def load_config() -> dict:
    if not os.path.exists(_path()):
        save_config(DEFAULT_CONFIG)
    try:
        with open(_path(), "r") as f:
            return json.load(f)
    except Exception:
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG

def save_config(config: dict):
    with open(_path(), "w") as f:
        json.dump(config, f, indent=2)

def update_config(partial: dict) -> dict:
    cfg = load_config()
    cfg.update(partial)
    save_config(cfg)
    return cfg
