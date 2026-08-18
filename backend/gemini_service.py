import os
import json
import re
import httpx
from typing import Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

class GeminiService:
    @classmethod
    async def _call_gemini_text_prompt(cls, text_prompt: str) -> Dict[str, Any]:
        """Helper to invoke Gemini API with a text prompt and return parsed JSON."""
        payload = {
            "contents": [
                {
                    "parts": [{"text": text_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "response_mime_type": "application/json"
            }
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(GEMINI_API_URL, json=payload)
            if response.status_code == 200:
                data = response.json()
                res_text = data["candidates"][0]["content"]["parts"][0]["text"]
                cleaned_json = res_text.strip()
                if cleaned_json.startswith("```"):
                    cleaned_json = re.sub(r"^```json?\s*", "", cleaned_json)
                    cleaned_json = re.sub(r"```$", "", cleaned_json).strip()
                return json.loads(cleaned_json)
            else:
                raise Exception(f"Gemini API returned status {response.status_code}")

    @classmethod
    async def generate_guided_diagnosis(
        cls,
        problem_text: str,
        current_logs: str,
        cleaned_facts: Dict[str, Any],
        rule_results: List[Dict[str, Any]],
        retrieved_cases: List[Dict[str, Any]],
        previous_iterations: List[Dict[str, Any]] = None,
        device: str = "Router0",
        command: str = "show ip interface brief",
        verified_interfaces: List[str] = None
    ) -> Dict[str, Any]:
        """
        Phase 1 Gemini AI Integration Service.
        Generates structured beginner guidance and diagnosis conforming strictly to Phase 1 JSON schema.
        Integrates validation safety gate and feedback correction loops.
        """
        previous_iterations = previous_iterations or []
        verified_interfaces = verified_interfaces or []

        prompt = f"""
You are NetSage AI, an expert Cisco Networking & CCNA/CCNP Troubleshooting Assistant.
You guide beginner networking students step-by-step to troubleshoot Cisco Packet Tracer lab problems based strictly on submitted CLI evidence.

=== PHASE 1 TROUBLESHOOTING CONTEXT ===
Target Device: {device}
Executed Command: {command}
User Problem Description:
{problem_text}

Latest Submitted Cisco CLI Output:
{current_logs if current_logs.strip() else "[No CLI output submitted yet]"}

Python Cleaned Facts:
{json.dumps(cleaned_facts, indent=2)}

Python Rule Engine Findings (Deterministic Checks):
{json.dumps(rule_results, indent=2)}

Relevant Knowledge Base Cases (from 255+ Dataset):
{json.dumps(retrieved_cases, indent=2)}

Previous Session History:
{json.dumps(previous_iterations, indent=2)}

=== RESPONSE RULES ===
1. Analyze the evidence above.
2. If evidence is incomplete or insufficient, DO NOT guess or hallucinate. Set "status": "NEED_MORE_DATA" and specify "next_evidence_required" (e.g. "show ip route").
3. DO NOT invent or guess interface names (e.g. GigabitEthernet0/1 or FastEthernet0/0). You MUST inspect the exact interface name present in the Python Rule Engine Findings (e.g. GigabitEthernet0/0/0) and use that exact interface name in your config 'commands' and 'recommended_fix' fields.
4. You MUST output ONLY a single valid JSON object with NO markdown or outside text.

JSON Schema:
{{
  "status": "FIX_RECOMMENDED | NEED_MORE_DATA | READY_FOR_VERIFICATION | RESOLVED | UNRESOLVED",
  "root_cause": "Clear root cause statement or null if NEED_MORE_DATA",
  "osi_layer": "Layer 1 | Layer 2 | Layer 3 | Layer 4 | Layer 7",
  "confidence": "High | Medium | Low",
  "evidence": [
    "Specific evidence point 1 from CLI output or Python rule results"
  ],
  "explanation": "Beginner-friendly explanation of why this fault causes the network problem.",
  "recommended_fix": "Exact instructions to fix in Cisco Packet Tracer.",
  "commands": [
    "Exact Cisco IOS CLI command line 1 (e.g. 'interface GigabitEthernet0/1')",
    "Exact Cisco IOS CLI command line 2 (e.g. 'no shutdown')"
  ],
  "expected_output": "What the user should look for after running verification command.",
  "verification_steps": [
    "Step 1: Apply fix in Packet Tracer.",
    "Step 2: Run verification command (e.g. 'show ip interface brief').",
    "Step 3: Copy and paste new CLI output into NetSage AI."
  ],
  "next_evidence_required": "Exact Cisco show command required next (e.g. 'show ip interface brief')",
  "alternative_causes": [
    "Possible secondary cause if primary fix does not resolve issue"
  ]
}}
"""

        try:
            # Generate initial response from Gemini
            response_json = await cls._call_gemini_text_prompt(prompt)
            
            # Validation safety loop (up to 3 retries)
            from rule_engine import RuleChecker
            current_prompt = cleaned_facts.get("prompt", "Router#")
            
            for attempt in range(3):
                validation_errors = []
                if "commands" in response_json and isinstance(response_json["commands"], list):
                    for cmd in response_json["commands"]:
                        val_res = RuleChecker.validate_proposed_command(
                            device=device,
                            command=cmd,
                            current_prompt=current_prompt,
                            verified_interfaces=verified_interfaces
                        )
                        if not val_res["valid"]:
                            validation_errors.append(f"Command '{cmd}': {val_res['reason']}")
                
                if not validation_errors:
                    break
                    
                # If we have validation errors, ask Gemini to correct them!
                correction_prompt = f"""
THE PREVIOUS GENERATED COMMANDS FAILED SAFETY GATE VALIDATION:
{chr(10).join(validation_errors)}

Please correct the commands in your response. Ensure the interface names match the verified list exactly: {json.dumps(verified_interfaces)}.
Remember:
- Only recommend configuration commands (like interface or ip address) when in config mode.
- Only recommend show commands when in privileged exec mode (e.g. Router#). If currently in configuration mode, you must recommend 'end' first.
- Only recommend interface commands if the interface is confirmed to exist. If not, recommend 'show ip interface brief' first to discover interfaces.

Generate a single valid JSON object following the same schema.
"""
                response_json = await cls._call_gemini_text_prompt(prompt + "\n\n" + correction_prompt)
                
            return response_json
            
        except Exception as e:
            return cls._fallback_guidance(problem_text, current_logs, rule_results, str(e), device, command)

    @classmethod
    async def analyze_topology_image(cls, problem_text: str, image_base64: str) -> Dict[str, Any]:
        """
        Sends the uploaded topology screenshot to Gemini and parses the layout and suggested commands.
        """
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]
            
        prompt = f"""
You are NetSage AI, a Cisco Network Topology Analyzer.
Analyze this Cisco Packet Tracer topology screenshot and the user's problem description: "{problem_text}".
Return a single valid JSON object containing:
1. "devices": A list of identified devices with their "name" (e.g. Router0, PC1) and "type" (router, switch, pc, server). Only include device names that are visible. If a device name is not visible, use "Device name not clearly visible" as the name.
2. "connections": A list of connections/cables linking devices, each containing "from" and "to" (device names).
3. "suggested_commands": A list of CLI commands required to troubleshoot the network. For each command, provide "device" (the device name), "command" (e.g. show ip interface brief, show ip route, ipconfig), and "reason" (a beginner-friendly reason why this command is needed).
4. "possible_problems": A list of potential issues visible or suspected (e.g., interface status red links, IP mismatch).

You MUST output ONLY a valid JSON object matching the schema below, without any markdown formatting.

JSON Schema:
{{
  "devices": [
    {{"name": "string", "type": "router | switch | pc | server"}}
  ],
  "connections": [
    {{"from": "string", "to": "string"}}
  ],
  "suggested_commands": [
    {{"device": "string", "command": "string", "reason": "string"}}
  ],
  "possible_problems": [
    "string"
  ]
}}
"""
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                "mimeType": "image/png",
                                "data": image_base64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "response_mime_type": "application/json"
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(GEMINI_API_URL, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    res_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    cleaned_json = res_text.strip()
                    if cleaned_json.startswith("```"):
                        cleaned_json = re.sub(r"^```json?\s*", "", cleaned_json)
                        cleaned_json = re.sub(r"```$", "", cleaned_json).strip()
                    return json.loads(cleaned_json)
                else:
                    return cls._fallback_topology_understanding(problem_text)
        except Exception as e:
            return cls._fallback_topology_understanding(problem_text)

    @classmethod
    def _fallback_topology_understanding(cls, problem_text: str) -> Dict[str, Any]:
        """Provides default topology understanding in case of API failure."""
        return {
            "devices": [
                {"name": "PC0", "type": "pc"},
                {"name": "Router0", "type": "router"},
                {"name": "PC1", "type": "pc"}
            ],
            "connections": [
                {"from": "PC0", "to": "Router0"},
                {"from": "Router0", "to": "PC1"}
            ],
            "suggested_commands": [
                {"device": "Router0", "command": "show ip interface brief", "reason": "Verify status of configured interfaces."},
                {"device": "PC0", "command": "ipconfig", "reason": "Verify PC IP configuration and default gateway."}
            ],
            "possible_problems": [
                "Router0 interface might be disabled or misconfigured",
                "Default gateway mismatch"
            ]
        }


    @classmethod
    def _fallback_guidance(cls, problem: str, logs: str, rules: List[Dict[str, Any]], err_msg: str, device: str = "Router0", command: str = "show ip interface brief") -> Dict[str, Any]:
        """Deterministic fallback guidance conforming to Phase 1 JSON schema."""
        failed_rules = [r for r in rules if r.get("status") == "FAIL"]
        
        if failed_rules:
            first_fail = failed_rules[0]
            return {
                "status": "FIX_RECOMMENDED",
                "root_cause": first_fail["finding"],
                "osi_layer": "Layer 3" if "IP" in first_fail["rule_name"] else "Layer 2",
                "confidence": "High",
                "evidence": [first_fail["evidence"], f"Python Check: {first_fail['rule_name']} ({first_fail['severity']})"],
                "explanation": f"Python rule checker detected a deterministic configuration issue on {device}: {first_fail['finding']}",
                "recommended_fix": f"Configure {device} in Packet Tracer to correct the {first_fail['rule_name']}.",
                "commands": ["interface GigabitEthernet0/1", "no shutdown"],
                "expected_output": "Interface status should change to UP / UP.",
                "verification_steps": [
                  "1. Enter global configuration mode in Packet Tracer.",
                  "2. Execute the fix commands.",
                  "3. Run 'show ip interface brief' and paste new output into NetSage AI."
                ],
                "next_evidence_required": "show ip interface brief",
                "alternative_causes": ["Cable disconnected in Packet Tracer workspace."]
            }
        
        return {
            "status": "NEED_MORE_DATA",
            "root_cause": None,
            "osi_layer": "Layer 3",
            "confidence": "Low",
            "evidence": ["Submitted evidence is currently insufficient to determine root cause."],
            "explanation": "Additional Cisco CLI show command evidence is required to verify network routing and interface states.",
            "recommended_fix": "Run the requested Cisco show command in Packet Tracer and paste the output below.",
            "commands": ["show ip route"],
            "expected_output": "Valid routing table entries for target destination subnet.",
            "verification_steps": ["Paste output of 'show ip route' into NetSage AI."],
            "next_evidence_required": "show ip route",
            "alternative_causes": ["Missing static or dynamic OSPF/EIGRP route."]
        }
