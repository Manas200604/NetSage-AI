"""
NetSage AI - Deterministic Python Networking Rule Engine
Independent, rule-based validation of Cisco network evidence.
"""

import re
from typing import List, Dict, Any

class RuleChecker:
    @staticmethod
    def check_duplicate_ip(show_output: str, problem_text: str = "") -> Dict[str, Any]:
        """Check for duplicate IP address conflicts in syslog, show output, or problem text."""
        combined_text = f"{problem_text}\n{show_output}"
        
        dup_pattern = r"(%IP-4-DUPADDR|Duplicate address|duplicate IP|IP conflict|conflict with IP)"
        mac_pattern = r"sourced by mac ([0-9a-fA-F\.]+)"
        ip_pattern = r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
        
        match = re.search(dup_pattern, combined_text, re.IGNORECASE)
        if match:
            mac_match = re.search(mac_pattern, combined_text)
            ip_match = re.search(r"Duplicate address " + ip_pattern, combined_text, re.IGNORECASE) or re.search(ip_pattern, combined_text)
            
            ip_addr = ip_match.group(1) if ip_match else "Detected"
            mac_addr = mac_match.group(1) if mac_match else "Unknown"
            
            return {
                "rule": "Duplicate IP Check",
                "status": "FAIL",
                "result": f"Duplicate IP address conflict detected for {ip_addr}.",
                "evidence": f"Syslog/output warning found: Duplicate IP {ip_addr} (Source MAC: {mac_addr})",
                "severity": "Critical"
            }
        
        return {
            "rule": "Duplicate IP Check",
            "status": "PASS",
            "result": "No duplicate IP address conflict detected.",
            "evidence": "No duplicate IP warnings found in show output.",
            "severity": "Low"
        }

    @staticmethod
    def check_wrong_subnet_mask(show_output: str, problem_text: str = "") -> Dict[str, Any]:
        """Check for subnet mask mismatch between gateway and host or subnets."""
        combined_text = f"{problem_text}\n{show_output}"
        
        if re.search(r"(/28|255\.255\.255\.240).*(/24|255\.255\.255\.0)", combined_text, re.DOTALL) or \
           re.search(r"subnet mask mismatch|mask mismatch|invalid mask", combined_text, re.IGNORECASE):
            return {
                "rule": "Subnet Mask Check",
                "status": "FAIL",
                "result": "Subnet mask mismatch detected between gateway and client network.",
                "evidence": "Gateway or interface mask restricts subnet range preventing client reachability.",
                "severity": "High"
            }
        
        return {
            "rule": "Subnet Mask Check",
            "status": "PASS",
            "result": "Subnet masks appear consistent.",
            "evidence": "No subnet mask mismatch found.",
            "severity": "Low"
        }

    @staticmethod
    def check_gateway_mismatch(show_output: str, problem_text: str = "") -> Dict[str, Any]:
        """Check if configured default gateway matches actual interface/SVI IP."""
        combined_text = f"{problem_text}\n{show_output}"
        
        gw_mis_match = re.search(r"default gateway.*?\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b", combined_text, re.IGNORECASE)
        int_match = re.search(r"\b(Gi[0-9/\.]+|Fa[0-9/\.]+|Vlan\d+|GigabitEthernet[0-9/\.]+)\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b", combined_text)
        
        if re.search(r"gateway mismatch|wrong gateway|gateway unreachable|does not match", combined_text, re.IGNORECASE):
            return {
                "rule": "Gateway Mismatch Check",
                "status": "FAIL",
                "result": "Host default gateway configuration does not match router/SVI gateway IP.",
                "evidence": "Host default gateway points to an incorrect or non-existent gateway IP.",
                "severity": "High"
            }
            
        if gw_mis_match and int_match:
            gw_ip = gw_mis_match.group(1)
            int_ip = int_match.group(2)
            if gw_ip != int_ip and not int_ip.startswith("unassigned"):
                return {
                    "rule": "Gateway Mismatch Check",
                    "status": "FAIL",
                    "result": f"Default gateway {gw_ip} does not match interface IP {int_ip}.",
                    "evidence": f"Host gateway: {gw_ip}, Router interface IP: {int_ip}",
                    "severity": "High"
                }

        return {
            "rule": "Gateway Mismatch Check",
            "status": "PASS",
            "result": "Default gateway configuration matches active interface.",
            "evidence": "Gateway IP aligns with network configuration.",
            "severity": "Low"
        }

    @staticmethod
    def check_interface_down(show_output: str, problem_text: str = "") -> Dict[str, Any]:
        """Check for interfaces that are down or administratively down."""
        combined_text = f"{problem_text}\n{show_output}"
        
        # Parse line by line to accurately capture interface name
        down_interfaces = []
        for line in combined_text.splitlines():
            line_str = line.strip()
            if re.search(r"\b(administratively down|DOWN DOWN|down\s+down)\b", line_str, re.IGNORECASE):
                # Extract first word representing interface name e.g. Gi0/0/1 or Gi0/0/0.20
                match_int = re.search(r"\b(Gi[0-9/\.]+|Fa[0-9/\.]+|Se[0-9/\.]+|GigabitEthernet[0-9/\.]+|FastEthernet[0-9/\.]+)\b", line_str, re.IGNORECASE)
                if match_int:
                    down_interfaces.append(match_int.group(1))
                    
        if down_interfaces:
            return {
                "rule": "Interface Status Check",
                "status": "FAIL",
                "result": f"Interface(s) down detected: {', '.join(set(down_interfaces))}.",
                "evidence": f"Interfaces reported as down/administratively down: {', '.join(set(down_interfaces))}",
                "severity": "High"
            }
            
        return {
            "rule": "Interface Status Check",
            "status": "PASS",
            "result": "All checked interfaces are operational (UP/UP).",
            "evidence": "No administratively down or inactive interfaces found.",
            "severity": "Low"
        }

    @staticmethod
    def check_missing_vlan(show_output: str, problem_text: str = "") -> Dict[str, Any]:
        """Check if VLAN is missing from switch database or allowed trunk list."""
        combined_text = f"{problem_text}\n{show_output}"
        
        vlan_issue = re.search(r"(VLAN \d+ is missing|vlan mismatch|allowed vlan|Native vlan mismatch|VLAN.*not present)", combined_text, re.IGNORECASE)
        
        if vlan_issue:
            return {
                "rule": "VLAN Configuration Check",
                "status": "FAIL",
                "result": "VLAN configuration issue detected (missing VLAN, native mismatch, or allowed list restriction).",
                "evidence": f"VLAN anomaly identified: '{vlan_issue.group(1)}'",
                "severity": "High"
            }
            
        return {
            "rule": "VLAN Configuration Check",
            "status": "PASS",
            "result": "VLAN assignments and trunk configurations are valid.",
            "evidence": "No VLAN database or trunk allowed list mismatches detected.",
            "severity": "Low"
        }

    @staticmethod
    def check_missing_route(show_output: str, problem_text: str = "") -> Dict[str, Any]:
        """Check for missing static or dynamic routing table entries."""
        combined_text = f"{problem_text}\n{show_output}"
        
        route_issue = re.search(r"(Gateway of last resort is not set|is not present|missing route|unreachable|no route to host)", combined_text, re.IGNORECASE)
        
        if route_issue or ("show ip route" in combined_text.lower() and "Codes:" in combined_text and not re.search(r"S\*\s+0\.0\.0\.0/0|O\s+|D\s+|S\s+", combined_text)):
            return {
                "rule": "Routing Table Check",
                "status": "FAIL",
                "result": "Missing destination subnet route or default gateway of last resort.",
                "evidence": "Routing table output shows missing route to destination network.",
                "severity": "High"
            }
            
        return {
            "rule": "Routing Table Check",
            "status": "PASS",
            "result": "Routing table contains required routes.",
            "evidence": "Routes present for destination subnets.",
            "severity": "Low"
        }

    @classmethod
    def run_all_rules(cls, show_output: str, problem_text: str = "") -> List[Dict[str, Any]]:
        """Run all 6 required deterministic networking rule checks."""
        return [
            cls.check_duplicate_ip(show_output, problem_text),
            cls.check_wrong_subnet_mask(show_output, problem_text),
            cls.check_gateway_mismatch(show_output, problem_text),
            cls.check_interface_down(show_output, problem_text),
            cls.check_missing_vlan(show_output, problem_text),
            cls.check_missing_route(show_output, problem_text),
        ]
