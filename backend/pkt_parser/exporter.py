from typing import Dict, Any, List

class NetworkExporter:
    @staticmethod
    def export_to_json(
        file_name: str,
        devices: List[Dict[str, Any]],
        connections: List[Dict[str, Any]],
        interfaces: List[Dict[str, Any]],
        configs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Assembles extracted network topologies and configurations into a unified Network JSON."""
        return {
            "project": {
                "file_name": file_name
            },
            "devices": devices,
            "connections": connections,
            "interfaces": interfaces,
            "ip_configuration": configs.get("ip_configuration", []),
            "vlans": configs.get("vlans", []),
            "routing": configs.get("routing", []),
            "dhcp": configs.get("dhcp", []),
            "nat": configs.get("nat", []),
            "acl": configs.get("acl", []),
            "other_configuration": configs.get("other_configuration", [])
        }
