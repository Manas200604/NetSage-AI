"""
NetSage AI - Iterative Guided Troubleshooting Integration Tests
Verifies the multi-iteration loop: Python Log Cleaner, Fact Normalization, Rule Engine, and FastAPI Iterative Endpoints.
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from main import app
from log_cleaner import CiscoLogCleaner
from rule_engine import RuleChecker

client = TestClient(app)

def test_cisco_log_cleaner_facts():
    """Verify structured facts extraction from Cisco CLI outputs."""
    raw_output = """
    Interface GigabitEthernet0/0/0.10 IP-Address 192.168.10.1 YES NVRAM UP UP
    Interface GigabitEthernet0/0/0.20 IP-Address unassigned YES NVRAM administratively down DOWN
    Gateway of last resort is 192.168.10.1
    """
    facts = CiscoLogCleaner.extract_structured_facts(raw_output)
    assert len(facts["interfaces"]) == 2
    assert facts["interfaces"][0]["name"] == "GigabitEthernet0/0/0.10"
    assert facts["interfaces"][0]["status"] == "up"
    assert facts["interfaces"][1]["status"] == "administratively down"
    assert "192.168.10.1" in facts["gateways"]

def test_rule_checker_severity_classification():
    """Verify RuleChecker outputs SEV-1, SEV-2, SEV-3 severity checks."""
    checker = RuleChecker()
    raw_output = "Interface GigabitEthernet0/0/1 is administratively down DOWN"
    problem = "PC cannot connect to network."
    results = checker.run_all_checks(raw_output, problem)
    
    assert len(results) >= 6
    if_fail = next((r for r in results if r["rule_name"] == "Interface Status Check"), None)
    assert if_fail is not None
    assert if_fail["status"] == "FAIL"
    assert if_fail["severity"] == "SEV-1"

def test_iterative_session_api_flow():
    """Verify start-session and submit-iteration API endpoints."""
    # 1. Start Session
    start_res = client.post("/api/troubleshoot/start-session", json={
        "user_id": None,
        "problem_text": "PC1 on VLAN 10 cannot communicate with Server1 on VLAN 20."
    })
    assert start_res.status_code == 200
    session_id = start_res.json()["session_id"]
    assert session_id is not None

    # 2. Submit Iteration 1
    iter_res = client.post("/api/troubleshoot/submit-iteration", json={
        "session_id": session_id,
        "user_id": None,
        "iteration_number": 1,
        "command": "show interfaces trunk",
        "raw_output": "Allowed vlan on trunk: 1-10\nNative vlan: 1\nPort Gi0/1 is trunking."
    })
    assert iter_res.status_code == 200
    data = iter_res.json()
    assert data["session_id"] == session_id
    assert data["iteration_number"] == 1
    assert "ai_guidance" in data
    assert "rule_results" in data
    assert len(data["rule_results"]) >= 6
