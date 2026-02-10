"""
Error handling utilities for migration
"""


class MigrationError(Exception):
    """Base exception for migration errors"""
    pass


class ExtractionError(MigrationError):
    """Error during data extraction"""
    pass


class TransformationError(MigrationError):
    """Error during data transformation"""
    pass


class ValidationError(MigrationError):
    """Error during data validation"""
    pass


class LoadError(MigrationError):
    """Error during data loading"""
    pass


def handle_error(error, logger, continue_on_error=False):
    """
    Handle migration error

    Args:
        error: Exception that occurred
        logger: Logger instance
        continue_on_error: Whether to continue after error

    Raises:
        Re-raises error if continue_on_error is False
    """
    logger.error(f"Error occurred: {str(error)}", exc_info=True)

    if not continue_on_error:
        raise error

    logger.warning("Continuing despite error (continueOnError=True)")
