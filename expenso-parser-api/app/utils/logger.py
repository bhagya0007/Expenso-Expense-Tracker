import logging
import sys
from pathlib import Path
from typing import Optional, Dict, Any

# Ensure logs directory exists
LOGS_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE_PATH = LOGS_DIR / "parser_pipeline.log"


def setup_logger(name: str = "expenso_parser") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        # 1. Console Stream Handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_formatter = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)

        # 2. Production File Handler inside logs/
        file_handler = logging.FileHandler(str(LOG_FILE_PATH), encoding="utf-8")
        file_formatter = logging.Formatter(
            "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    return logger


logger = setup_logger()


def log_pipeline_stage(
    stage_name: str,
    message: str,
    file_id: Optional[str] = None,
    extra_details: Optional[Dict[str, Any]] = None,
):
    """
    Structured Stage Logger for tracking every parser stage:
    UPLOAD, DETECTION, OCR, ROWS, VALIDATION, IMPORT.
    Writes structured logs to logs/parser_pipeline.log.
    """
    file_tag = f" [{file_id}]" if file_id else ""
    details_tag = f" | Details: {extra_details}" if extra_details else ""
    formatted_msg = f"[STAGE: {stage_name.upper()}]{file_tag} {message}{details_tag}"
    logger.info(formatted_msg)
