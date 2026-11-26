from typing import Any

from ._constants import LOGGER_NAME, PRINT_LEVEL, RUNNING_ON_RAILWAY


def get_logger_config() -> dict[str, Any]:
    """Get the logger configuration with handler, formatter and filter."""
    handler_name = "console"
    color_formatter_name = "color"
    railway_formatter_name = "railway"
    filter_name = "status_filter"

    config: dict[str, Any] = {
        "version": 1,
        "loggers": {
            LOGGER_NAME: {
                "handlers": [handler_name],
                "level": PRINT_LEVEL,
                "filters": [filter_name],
            },
        },
        "handlers": {
            handler_name: {
                "class": "logging.StreamHandler",
                "formatter": color_formatter_name,
            },
        },
        "formatters": {
            color_formatter_name: {
                "()": "logger.ColorFormatter",
            },
            railway_formatter_name: {
                "()": "logger.RailwayLogFormatter",
            },
        },
        "filters": {filter_name: {"()": "logger.LogStatusFilter"}},
    }

    # If the project is running on Railway, use the Railway log formatter instead of the color formatter and log to stdout instead of stderr
    if RUNNING_ON_RAILWAY:
        config["handlers"][handler_name]["formatter"] = railway_formatter_name
        config["handlers"][handler_name]["stream"] = "ext://sys.stdout"

    return config
