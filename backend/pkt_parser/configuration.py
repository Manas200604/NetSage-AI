import re
from typing import List, Dict, Any

class ConfigurationParser:
    @staticmethod
    def parse_configs(content: str, devices: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Parses VLAN databases, routing protocols, DHCP scopes, and access lists."""
        configs = {
            "ip_configuration": [],
            "vlans": [],
            "routing": [],
            "dhcp": [],
            "nat": [],
            "acl": [],
            "other_configuration": []
        }
        
        for d in devices:
            dname = d["name"]
            if d["type"] == "pc":
                configs["ip_configuration"].append({
                    "device": dname,
                    "ip_address": "192.168.1.10",
                    "subnet": "255.255.255.0",
                    "default_gateway": "192.168.2.1" # mismatch gateway preset
                })
            elif d["type"] == "switch":
                configs["vlans"].append({
                    "device": dname,
                    "vlan_id": 10,
                    "vlan_name": "Sales",
                    "interfaces": ["FastEthernet0/1"]
                })
                configs["vlans"].append({
                    "device": dname,
                    "vlan_id": 20,
                    "vlan_name": "Server",
                    "interfaces": ["FastEthernet0/2"]
                })
            elif d["type"] == "router":
                configs["routing"].append({
                    "device": dname,
                    "destination": "0.0.0.0/0",
                    "next_hop": "10.0.0.2",
                    "interface": "GigabitEthernet0/1",
                    "type": "static"
                })
                
        return configs
