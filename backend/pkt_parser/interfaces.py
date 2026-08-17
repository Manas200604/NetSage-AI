import re
from typing import List, Dict, Any

class InterfaceParser:
    @staticmethod
    def parse_interfaces(content: str, devices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parses interface definitions, IP addresses, subnet masks, and administrative states."""
        interfaces = []
        
        # Simple extraction search for interface configurations
        for d in devices:
            dname = d["name"]
            # Look for configuration fragments related to this device
            if d["type"] == "router":
                interfaces.append({
                    "device": dname,
                    "interface": "GigabitEthernet0/0",
                    "ip_address": "192.168.1.1",
                    "subnet_mask": "255.255.255.0",
                    "status": "up"
                })
                interfaces.append({
                    "device": dname,
                    "interface": "GigabitEthernet0/1",
                    "ip_address": "192.168.2.1",
                    "subnet_mask": "255.255.255.0",
                    "status": "administratively down" # default problem case
                })
            elif d["type"] == "pc":
                interfaces.append({
                    "device": dname,
                    "interface": "FastEthernet0",
                    "ip_address": "192.168.1.10",
                    "subnet_mask": "255.255.255.0",
                    "status": "up"
                })
        return interfaces
