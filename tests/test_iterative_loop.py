"""
NetSage AI - Phase 1 CLI-Based Troubleshooting Integration Tests
Verifies Python Rule Checker Phase 1 findings, SEV-1/2/3 severities, and FastAPI iteration flow with Device & Command parameters.
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

def test_phase1_cisco_log_cleaner_facts():
    """Verify structured facts extraction from Cisco CLI outputs."""
    raw_output = """
    GigabitEthernet0/0/0.10 192.168.10.1 YES NVRAM UP UP
    GigabitEthernet0/0/0.20 unassigned YES NVRAM administratively down DOWN
    Gateway of last resort is 192.168.10.1
    """
    facts = CiscoLogCleaner.extract_structured_facts(raw_output)
    assert len(facts["interfaces"]) == 2
    assert facts["interfaces"][0]["name"] == "GigabitEthernet0/0/0.10"
    assert facts["interfaces"][0]["status"] == "up"
    assert facts["interfaces"][1]["status"] == "administratively down"
    assert "192.168.10.1" in facts["gateways"]

def test_phase1_rule_checker_findings():
    """Verify RuleChecker outputs Phase 1 findings array with check types and SEV-1/2/3 severities."""
    checker = RuleChecker()
    raw_output = "Interface GigabitEthernet0/0/1 is administratively down DOWN"
    problem = "PC cannot connect to network."
    results = checker.run_all_checks(raw_output, problem, device="Router0")
    
    assert len(results) >= 6
    if_fail = next((r for r in results if r["rule_name"] == "Interface Status Check"), None)
    assert if_fail is not None
    assert if_fail["status"] == "FAIL"
    assert if_fail["type"] == "ADMINISTRATIVELY_DOWN"
    assert if_fail["device"] == "Router0"
    assert if_fail["severity"] == "SEV-2"

def test_phase1_iterative_session_api_flow():
    """Verify start-session and submit-iteration API endpoints with Device & Command parameters."""
    # 1. Start Session
    start_res = client.post("/api/troubleshoot/start-session", json={
        "user_id": None,
        "problem_text": "PC1 on VLAN 10 cannot communicate with Server1 on VLAN 20."
    })
    assert start_res.status_code == 200
    session_id = start_res.json()["session_id"]
    assert session_id is not None

    # 2. Submit Iteration 1 with Device & Command
    iter_res = client.post("/api/troubleshoot/submit-iteration", json={
        "session_id": session_id,
        "user_id": None,
        "iteration_number": 1,
        "device": "Switch0",
        "command": "show interfaces trunk",
        "raw_output": "Allowed vlan on trunk: 1-10\nNative vlan: 1\nPort Gi0/1 is trunking."
    })
    assert iter_res.status_code == 200
    data = iter_res.json()
    assert data["session_id"] == session_id
    assert data["iteration_number"] == 1
    assert data["device"] == "Switch0"
    assert data["command"] == "show interfaces trunk"
    assert "ai_guidance" in data
    assert "rule_results" in data
    assert len(data["rule_results"]) >= 6
