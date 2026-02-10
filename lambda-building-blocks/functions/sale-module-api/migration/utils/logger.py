"""
Logging utilities for migration process
"""

import logging
import sys
from pathlib import Path
from pythonjsonlogger import jsonlogger


def setup_logger(config):
    """
    Set up logger with console and file outputs

    Args:
        config: Logging configuration dict

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger('migration')
    logger.setLevel(getattr(logging, config.get('level', 'INFO')))

    # Remove existing handlers
    logger.handlers = []

    # Console handler with colored output
    if config.get('console', True):
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)

        # Format: [TIMESTAMP] [LEVEL] Message
        console_format = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(console_format)
        logger.addHandler(console_handler)

    # File handler with JSON format
    if config.get('file'):
        log_file = config['file']
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)

        # JSON formatter for structured logging
        json_format = jsonlogger.JsonFormatter(
            '%(asctime)s %(levelname)s %(name)s %(message)s'
        )
        file_handler.setFormatter(json_format)
        logger.addHandler(file_handler)

    # CloudWatch handler (if configured)
    if config.get('cloudWatch', False):
        try:
            import watchtower
            cw_handler = watchtower.CloudWatchLogHandler(
                log_group=config['cloudWatchGroup']
            )
            logger.addHandler(cw_handler)
        except ImportError:
            logger.warning("watchtower not installed - CloudWatch logging disabled")

    return logger
