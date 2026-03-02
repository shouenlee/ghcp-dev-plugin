"""
Django REST Framework viewset template.
Adapt to project conventions before use.
"""
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response

from .models import {Resource}
from .serializers import {Resource}Serializer


class {Resource}ViewSet(viewsets.ModelViewSet):
    """{Resource} API endpoint."""

    queryset = {Resource}.objects.all()
    serializer_class = {Resource}Serializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(
            # TODO: add filtering logic
        )
