"""
Celery task template.
Adapt to project conventions before use.
"""
from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def {task_name}(self, *args, **kwargs):
    """
    {Task description}.

    Args:
        *args: Positional arguments.
        **kwargs: Keyword arguments.
    """
    try:
        logger.info("Starting {task_name}")
        # TODO: implement task logic
        logger.info("Completed {task_name}")
    except Exception as exc:
        logger.exception("Failed {task_name}")
        raise self.retry(exc=exc)
