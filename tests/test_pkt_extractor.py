import sys
import os
import pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from main import app
from pkt_parser import PktParser
from rule_engine import RuleChecker

client = TestClient(app)

def test_pkt_parser_validation():
    """Verify that only .pkt extensions are allowed."""
    res = PktParser.parse_pkt_file("test.txt")
    assert res["available"] is False
    assert "Invalid file format" in res["reason"]

def test_rule_checker_network_json_duplicate_ip():
    """Verify RuleChecker correctly detects duplicate IP addresses in Network JSON."""
    network_json = {
        "interfaces": [
            {"device": "Router0", "interface": "GigabitEthernet0/0", "ip_address": "192.168.1.1", "status": "up"},
            {"device": "PC1", "interface": "FastEthernet0", "ip_address": "192.168.1.1", "status": "up"}
        ]
    }
    checker = RuleChecker()
    results = checker.run_network_json_checks(network_json)
    
    dup_fail = next((r for r in results if r["type"] == "DUPLICATE_IP" and r["status"] == "FAIL"), None)
    assert dup_fail is not None
    assert "Duplicate IP address conflict detected" in dup_fail["finding"]

def test_rule_checker_network_json_gateway_mismatch():
    """Verify RuleChecker correctly detects gateway/subnet mismatch in Network JSON."""
    network_json = {
        "ip_configuration": [
            {"device": "PC1", "ip_address": "192.168.1.10", "subnet": "255.255.255.0", "default_gateway": "192.168.2.1"}
        ]
    }
    checker = RuleChecker()
    results = checker.run_network_json_checks(network_json)
    
    gw_fail = next((r for r in results if r["type"] == "GATEWAY_MISMATCH" and r["status"] == "FAIL"), None)
    assert gw_fail is not None
    assert "Wrong Default Gateway" in gw_fail["finding"]

def test_rule_checker_network_json_interface_disabled():
    """Verify RuleChecker correctly detects disabled/administratively down interfaces in Network JSON."""
    network_json = {
        "interfaces": [
            {"device": "Router0", "interface": "GigabitEthernet0/1", "ip_address": "192.168.2.1", "status": "administratively down"}
        ]
    }
    checker = RuleChecker()
    results = checker.run_network_json_checks(network_json)
    
    admin_fail = next((r for r in results if r["type"] == "ADMINISTRATIVELY_DOWN" and r["status"] == "FAIL"), None)
    assert admin_fail is not None
    assert "Interface is Disabled" in admin_fail["finding"]

def test_pkt_analyze_api_endpoint(tmp_path):
    """Verify /api/pkt/analyze route handles upload and runs extraction flow."""
    dummy_file = tmp_path / "network_test.pkt"
    # Write some mock ASCII contents to simulate readable PKT config
    dummy_file.write_text("PC1 Router0 Switch0 FastEthernet0/1 GigabitEthernet0/0")
    
    with open(dummy_file, "rb") as f:
        response = client.post(
            "/api/pkt/analyze",
            files={"file": ("network_test.pkt", f, "application/octet-stream")}
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["file_name"] == "network_test.pkt"
    assert "network_data" in data
    assert "rule_results" in data
