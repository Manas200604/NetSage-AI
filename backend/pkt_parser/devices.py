import re
from typing import List, Dict, Any

class DeviceParser:
    @staticmethod
    def parse_devices(content: str) -> List[Dict[str, Any]]:
        """Extracts device lists from ASCII strings inside the PKT file."""
        devices = []
        # Matches common Packet Tracer device names
        device_patterns = [
            r'([Rr]outer\d+)',
            r'([Ss]witch\d+)',
            r'([Pp][Cc]\d+)',
            r'([Ss]erver\d+)'
        ]
        
        seen = set()
        for pattern in device_patterns:
            for match in re.finditer(pattern, content):
                name = match.group(1)
                if name not in seen:
                    seen.add(name)
                    dtype = "router" if "router" in name.lower() else "switch" if "switch" in name.lower() else "pc"
                    devices.append({
                        "name": name,
                        "type": dtype,
                        "model": "Cisco 2911" if dtype == "router" else "Cisco 2960" if dtype == "switch" else "Generic PC"
                    })
        return devices
