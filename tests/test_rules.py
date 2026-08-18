"""
Unit tests for NetSage AI Deterministic Python Rule Engine
"""

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from rule_engine import RuleChecker

def test_check_duplicate_ip():
    show_output = "S1# show log\n%SYS-4-CONFIG_I: %IP-4-DUPADDR: Duplicate address 172.16.10.1 on Vlan10, sourced by mac 0002.4a11.88bc"
    res = RuleChecker.check_duplicate_ip(show_output)
    assert res["status"] == "FAIL"
    assert "Duplicate IP address conflict" in res["result"]
    assert res["severity"] in ["SEV-1", "Critical"]

def test_check_wrong_subnet_mask():
    show_output = "R1# show interface gi0/0\nInternet address is 192.168.50.1/28\nClient is /24"
    res = RuleChecker.check_wrong_subnet_mask(show_output)
    assert res["status"] == "FAIL"
    assert "Subnet mask mismatch" in res["result"]

def test_check_gateway_mismatch():
    problem_text = "Host default gateway set to 192.168.1.254"
    show_output = "R1# show ip interface brief\nGigabitEthernet0/0  192.168.1.1  YES manual UP UP"
    res = RuleChecker.check_gateway_mismatch(show_output, problem_text)
    assert res["status"] == "FAIL"

def test_check_interface_down():
    show_output = "R2# show ip interface brief\nGi0/0/1  10.2.0.1 YES manual administratively down DOWN"
    res = RuleChecker.check_interface_down(show_output)
    assert res["status"] == "FAIL"
    assert "Gi0/0/1" in res["result"]

def test_check_missing_vlan():
    show_output = "VLAN 20 is missing from switch database"
    res = RuleChecker.check_missing_vlan(show_output)
    assert res["status"] == "FAIL"

def test_check_missing_route():
    show_output = "R1# show ip route\nGateway of last resort is not set\nC 192.168.1.0/24 is directly connected"
    res = RuleChecker.check_missing_route(show_output)
    assert res["status"] == "FAIL"

def test_check_interface_down_triple_zero():
    show_output = "R1# show ip interface brief\nGigabitEthernet0/0/0  unassigned YES NVRAM administratively down down"
    res = RuleChecker.check_interface_down(show_output)
    assert res["status"] == "FAIL"
    assert res["interface"] == "GigabitEthernet0/0/0"

def test_validate_proposed_command():
    # 1. Reject if verified_interfaces is empty
    res1 = RuleChecker.validate_proposed_command("Router0", "interface GigabitEthernet0/1", "Router(config)#", [])
    assert res1["valid"] is False
    assert "has not been verified" in res1["reason"]

    # 2. Reject if interface is mismatch
    res2 = RuleChecker.validate_proposed_command("Router0", "interface GigabitEthernet0/1", "Router(config)#", ["GigabitEthernet0/0/1"])
    assert res2["valid"] is False
    assert "does not exist" in res2["reason"]

    # 3. Allow if interface is matched
    res3 = RuleChecker.validate_proposed_command("Router0", "interface GigabitEthernet0/0/1", "Router(config)#", ["GigabitEthernet0/0/1"])
    assert res3["valid"] is True


