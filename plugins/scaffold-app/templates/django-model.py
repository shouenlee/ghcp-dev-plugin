"""
Django model template.
Adapt to project conventions before use.
"""
from django.db import models


class {Resource}(models.Model):
    """Model representing a {resource}."""

    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "{resource}"
        verbose_name_plural = "{resource_plural}"

    def __str__(self):
        return self.name
