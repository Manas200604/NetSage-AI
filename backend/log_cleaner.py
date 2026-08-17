"""
NetSage AI - Python Cisco Log Cleaner & Fact Normalizer
Extracts structured facts from Cisco CLI command outputs prior to sending evidence to Gemini.
"""

import re
from typing import Dict, Any, List

class CiscoLogCleaner:
    @staticmethod
    def clean_terminal_noise(raw_output: str) -> str:
        """Strip prompt headers, trailing prompts, and unnecessary control characters."""
        if not raw_output:
            return ""
        lines = raw_output.splitlines()
        cleaned_lines = []
        for line in lines:
            line_str = line.strip()
            if line_str and not line_str.startswith("--More--"):
                cleaned_lines.append(line_str)
        return "\n".join(cleaned_lines)

    @classmethod
    def extract_structured_facts(cls, raw_output: str, problem_text: str = "") -> Dict[str, Any]:
        """Parse raw Cisco CLI output into normalized JSON facts."""
        text = cls.clean_terminal_noise(f"{problem_text}\n{raw_output}")
        
        interfaces = []
        vlans = []
        routes = []
        ip_addresses = []
        gateways = []
        acl_entries = []
        warnings = []

        # 1. Extract IP Addresses
        ips = re.findall(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b", text)
        ip_addresses = sorted(list(set(ips)))

        # 2. Extract Interfaces & Status from "show ip interface brief"
        int_lines = text.splitlines()
        for line in int_lines:
            line_str = line.strip()
            if not line_str or line_str.lower().startswith("interface ip-address") or "protocol" in line_str.lower() and "status" in line_str.lower():
                continue
            
            # Match interface status row
            match = re.search(
                r"(?:Interface\s+)?([A-Za-z0-9/\.\-]+)\s+(?:IP-Address\s+)?((?:[0-9]{1,3}\.){3}[0-9]{1,3}|unassigned)\s+YES\s+[A-Za-z0-9\-]+\s+(UP|DOWN|administratively down)\s+(UP|DOWN)",
                line_str,
                re.IGNORECASE
            )
            if match:
                name, ip, status, proto = match.groups()
                if name.lower() not in ["interface", "ip-address", "name", "port"]:
                    interfaces.append({
                        "name": name,
                        "ip": ip,
                        "status": status.lower(),
                        "protocol": proto.lower()
                    })
                    if "down" in status.lower() or "down" in proto.lower():
                        warnings.append(f"Interface {name} is down (Status: {status}, Protocol: {proto}).")

        # 3. Extract VLANs from "show vlan brief"
        vlan_matches = re.findall(r"^(\d+)\s+([A-Za-z0-9_\-]+)\s+(active|act/unsuspend|suspend)", text, re.IGNORECASE | re.MULTILINE)
        for v_id, v_name, v_stat in vlan_matches:
            vlans.append({
                "vlan_id": int(v_id),
                "name": v_name,
                "status": v_stat
            })

        # 4. Extract Routes from "show ip route"
        route_matches = re.findall(r"([CSODR]\*?)\s+((?:[0-9]{1,3}\.){3}[0-9]{1,3}(?:/\d+)?)\s+(?:\[\d+/\d+\]\s+via\s+((?:[0-9]{1,3}\.){3}[0-9]{1,3})|is directly connected)", text)
        for proto, net, via in route_matches:
            routes.append({
                "protocol": proto.strip(),
                "network": net.strip(),
                "via": via.strip() if via else "directly connected"
            })

        # 5. Extract Default Gateway
        gw_match = re.search(r"Gateway of last resort is\s+((?:[0-9]{1,3}\.){3}[0-9]{1,3})", text, re.IGNORECASE) or \
                   re.search(r"Default Gateway\s+((?:[0-9]{1,3}\.){3}[0-9]{1,3})", text, re.IGNORECASE)
        if gw_match:
            gateways.append(gw_match.group(1))

        # 6. Extract Warnings
        if re.search(r"%IP-4-DUPADDR|Duplicate address", text, re.IGNORECASE):
            warnings.append("Duplicate IP address conflict detected in syslog/output.")
        if "Gateway of last resort is not set" in text:
            warnings.append("Gateway of last resort is not set in routing table.")

        return {
            "interfaces": interfaces,
            "vlans": vlans,
            "routes": routes,
            "ip_addresses": ip_addresses,
            "gateways": gateways,
            "acl_entries": acl_entries,
            "warnings": warnings,
            "cleaned_text": text
        }
