import os
import json
import httpx
from typing import Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

class GeminiService:
    @classmethod
    async def generate_guided_diagnosis(
        cls,
        problem_text: str,
        current_logs: str,
        cleaned_facts: Dict[str, Any],
        rule_results: List[Dict[str, Any]],
        retrieved_cases: List[Dict[str, Any]],
        previous_iterations: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Sends the complete iterative session context to Google Gemini AI and returns structured beginner guidance.
        """
        previous_iterations = previous_iterations or []

        prompt = f"""
You are NetSage AI, an expert Cisco Networking & CCNA/CCNP Troubleshooting Assistant.
You guide beginner networking students step-by-step to troubleshoot Packet Tracer lab problems.

=== CURRENT TROUBLESHOOTING SESSION CONTEXT ===
Original Problem Description:
{problem_text}

Latest Submitted Cisco CLI Output:
{current_logs if current_logs.strip() else "[No CLI output submitted yet]"}

Python Cleaned Facts Extracted:
{json.dumps(cleaned_facts, indent=2)}

Python Deterministic Rule Engine Results:
{json.dumps(rule_results, indent=2)}

Relevant Knowledge Base Cases (from 255+ Dataset):
{json.dumps(retrieved_cases, indent=2)}

Previous Session History (Past Iterations & User Actions):
{json.dumps(previous_iterations, indent=2)}

=== GUIDANCE INSTRUCTIONS ===
Analyze the combined evidence above.
You MUST output ONLY a single valid JSON object with NO additional Markdown formatting or raw text outside JSON.
Use this EXACT JSON structure:

{{
  "status": "NEED_MORE_DATA | LIKELY_CAUSE_FOUND | FIX_RECOMMENDED | READY_FOR_VERIFICATION | RESOLVED",
  "root_cause": "Clear root cause statement or null if NEED_MORE_DATA",
  "osi_layer": "Layer 1 | Layer 2 | Layer 3 | Layer 4 | Layer 7",
  "confidence": "High | Medium | Low",
  "evidence": [
    "Specific evidence point 1 from CLI output or Python rule results",
    "Specific evidence point 2"
  ],
  "what_i_found": "Beginner-friendly, step-by-step breakdown of what was discovered.",
  "next_command": "Recommended Cisco CLI show command to run next (e.g., 'show interfaces trunk')",
  "why_this_command": "Explanation of why this specific command is required.",
  "expected_output": "What the student should look for in the CLI output.",
  "fix_steps": [
    "Exact Cisco IOS configuration command to execute in Packet Tracer (e.g. 'interface Gi0/0/0.20')",
    "Next configuration command (e.g. 'encapsulation dot1Q 20')"
  ],
  "test_steps": [
    "Verification test step in Packet Tracer (e.g. 'ping 192.168.20.1 from PC1')"
  ],
  "what_to_submit_next": "Explicit instruction on what command output to copy & paste into NetSage next."
}}
"""

        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
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
                    return cls._fallback_guidance(problem_text, current_logs, rule_results, f"Gemini API returned status {response.status_code}")
        except Exception as e:
            return cls._fallback_guidance(problem_text, current_logs, rule_results, str(e))

    @classmethod
    def _fallback_guidance(cls, problem: str, logs: str, rules: List[Dict[str, Any]], err_msg: str) -> Dict[str, Any]:
        """Deterministic fallback guidance if Gemini API is unreachable or rate limited."""
        failed_rules = [r for r in rules if r.get("status") == "FAIL"]
        
        if failed_rules:
            first_fail = failed_rules[0]
            return {
                "status": "FIX_RECOMMENDED",
                "root_cause": first_fail["finding"],
                "osi_layer": "Layer 3" if "IP" in first_fail["rule_name"] else "Layer 2",
                "confidence": "High",
                "evidence": [first_fail["evidence"], f"Deterministic Rule: {first_fail['rule_name']}"],
                "what_i_found": f"Python rule checker detected a deterministic issue: {first_fail['finding']}",
                "next_command": "show ip interface brief",
                "why_this_command": "To verify interface state and IP address assignment.",
                "expected_output": "Status UP / UP and correct IP address assigned.",
                "fix_steps": ["Verify physical cable connections and sub-interface configuration in Packet Tracer."],
                "test_steps": ["Run ping test to default gateway."],
                "what_to_submit_next": "Run 'show ip interface brief' in Packet Tracer and paste the new output here."
            }
        
        return {
            "status": "NEED_MORE_DATA",
            "root_cause": None,
            "osi_layer": "Layer 3",
            "confidence": "Low",
            "evidence": ["Initial evidence insufficient to diagnose root cause."],
            "what_i_found": "Additional CLI command evidence is required to identify the root cause.",
            "next_command": "show ip route",
            "why_this_command": "Required to inspect the routing table for target network routes.",
            "expected_output": "A valid route entry for the destination network.",
            "fix_steps": [],
            "test_steps": [],
            "what_to_submit_next": "Execute 'show ip route' on your router and paste the output below."
        }
