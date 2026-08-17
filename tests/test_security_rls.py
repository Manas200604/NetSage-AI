"""
Security & RLS Authorization Tests for NetSage AI
Verifies that admin-only operations enforce server-side role validation and block unauthorized users.
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from main import app

client = TestClient(app)

def test_missing_admin_id_returns_401():
    """Verify that calling admin endpoint without admin_id returns 401 Unauthorized."""
    response = client.post("/api/admin/approve-correction", json={
        "correction_id": "test-id-123",
        "admin_id": "",
        "approved": True
    })
    assert response.status_code == 401
    assert "Authentication admin_id is required" in response.json()["detail"]

def test_non_admin_user_returns_403():
    """Verify that a standard non-admin user cannot approve dataset corrections."""
    # Assuming user_id for regular user 'user@netsage.lab' or a fake non-admin UUID
    response = client.post("/api/admin/approve-correction", json={
        "correction_id": "test-id-123",
        "admin_id": "00000000-0000-0000-0000-000000000000",
        "approved": True
    })
    assert response.status_code == 403
    assert "Unauthorized: User does not have administrator privileges" in response.json()["detail"]
