import json
import logging
import sys
from typing import Any, Dict, Optional


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter for production observability."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt or "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if hasattr(record, "claim_id") and record.claim_id:
            log_data["claim_id"] = record.claim_id
        if hasattr(record, "duration_ms") and record.duration_ms is not None:
            log_data["duration_ms"] = record.duration_ms
        if hasattr(record, "decision_status") and record.decision_status:
            log_data["decision_status"] = record.decision_status
        if hasattr(record, "total_cost") and record.total_cost is not None:
            log_data["total_cost"] = record.total_cost
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            log_data.update(record.extra_data)

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def setup_logger(name: str = "orchestrator", level: str = "INFO") -> logging.Logger:
    """Configures and returns a structured logger instance."""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
        logger.propagate = False

    return logger


logger = setup_logger()
