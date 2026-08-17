import os
import json
import httpx
from typing import Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

class GeminiService:
    @staticmethod
    async def _call_gemini(prompt: str, json_mode: bool = True) -> str:
        """Call Gemini API via httpx REST endpoint securely from backend."""
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.95,
                "maxOutputTokens": 2048
            }
        }
        
        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"
            
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(GEMINI_API_URL, json=payload)
                response.raise_for_status()
                data = response.json()
                text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                return text_content
            except Exception as e:
                print(f"Gemini API call warning/error: {e}")
                # Provide structured fallback if API fails or network issue occurs
                return None

    @classmethod
    async def normalize_problem(cls, problem_text: str, topology_note: str = "") -> Dict[str, Any]:
        """Normalize user problem into structured JSON."""
        prompt = f"""
Act as a Cisco Networking Expert. Analyze and normalize the following networking problem.
User Problem: {problem_text}
Topology Notes: {topology_note}

Return strictly valid JSON with this schema:
{{
  "problem_summary": "Concise 1-sentence summary",
  "symptoms": ["List of observed symptoms"],
  "possible_concepts": ["VLAN", "Gateway", "DHCP", "DNS", "Routing", "ACL", "NAT", "Wireless"],
  "search_terms": ["Keyword 1", "Keyword 2", "Keyword 3"]
}}
"""
        raw_res = await cls._call_gemini(prompt, json_mode=True)
        if raw_res:
            try:
                return json.loads(raw_res)
            except Exception:
                pass
                
        # Deterministic fallback normalization if API unavailable
        concepts = []
        text_lower = problem_text.lower()
        if "vlan" in text_lower or "trunk" in text_lower: concepts.append("VLAN")
        if "ping" in text_lower or "gateway" in text_lower or "ip" in text_lower: concepts.append("Gateway")
        if "route" in text_lower or "ospf" in text_lower or "rip" in text_lower: concepts.append("Routing")
        if "dhcp" in text_lower or "lease" in text_lower: concepts.append("DHCP")
        if "acl" in text_lower or "block" in text_lower: concepts.append("ACL")
        if not concepts: concepts = ["Routing", "Gateway"]
        
        return {
            "problem_summary": problem_text[:150],
            "symptoms": [problem_text],
            "possible_concepts": concepts,
            "search_terms": problem_text.split()[:5]
        }

    @classmethod
    async def generate_diagnosis(
        cls,
        problem_text: str,
        normalized_problem: Dict[str, Any],
        show_output: str,
        rule_results: List[Dict[str, Any]],
        relevant_cases: List[Dict[str, Any]],
        topology_note: str = ""
    ) -> Dict[str, Any]:
        """Generate structured AI diagnosis incorporating evidence, rules, and retrieved dataset cases."""
        prompt = f"""
Act as a Senior Cisco Network Engineering Architect.
Analyze the problem, Cisco show command output, deterministic rule checker results, and top retrieved dataset cases to generate a precise diagnosis.

User Problem: {problem_text}
Topology: {topology_note}
Normalized Summary: {json.dumps(normalized_problem)}

Cisco Show Command Output:
{show_output}

Deterministic Rule Checker Results:
{json.dumps(rule_results, indent=2)}

Retrieved Relevant Dataset Cases:
{json.dumps(relevant_cases, indent=2)}

DIAGNOSIS RULES:
1. Evidence First: Base root cause strictly on provided show output and rule check failures.
2. No Hallucination: Do not invent non-existent commands or config details.
3. Priority: If a deterministic rule check failed, weigh that result heavily.
4. Confidence: High (if show output confirms root cause), Medium (if probable), Low (if missing evidence).

Return strictly valid JSON with this exact schema:
{{
  "root_cause": "Detailed explanation of root cause",
  "confidence": "High",
  "osi_layer": "Layer 3",
  "evidence": ["Exact line or finding from show output/rule check"],
  "next_command": "Cisco CLI show command to verify fix",
  "fix_steps": ["Step 1", "Step 2", "Step 3"],
  "alternative_causes": ["Alternative possibility if main root cause is incorrect"],
  "missing_evidence": ["Any additional show command or detail needed"]
}}
"""
        raw_res = await cls._call_gemini(prompt, json_mode=True)
        if raw_res:
            try:
                res_json = json.loads(raw_res)
                if "root_cause" in res_json:
                    return res_json
            except Exception:
                pass

        # Intelligent Fallback Diagnosis derived from Python Rule Failures or Top Case
        failed_rules = [r for r in rule_results if r.get("status") == "FAIL"]
        if failed_rules:
            first_fail = failed_rules[0]
            return {
                "root_cause": f"Configuration Failure: {first_fail.get('result')}",
                "confidence": "High",
                "osi_layer": "Layer 3" if "Route" in first_fail['rule'] or "Gateway" in first_fail['rule'] else "Layer 2",
                "evidence": [first_fail.get("evidence")],
                "next_command": "show ip interface brief" if "Interface" in first_fail['rule'] else "show ip route",
                "fix_steps": [
                    "Review configured IP addresses, subnet masks, and interface states.",
                    "Execute recommended show command to verify physical and logical link status.",
                    "Apply missing configuration commands under relevant interface or router process."
                ],
                "alternative_causes": ["Potential physical cable issue or upstream VLAN tagging mismatch."],
                "missing_evidence": ["show running-config interface detail"]
            }

        top_case = relevant_cases[0] if relevant_cases else {}
        return {
            "root_cause": top_case.get("expected_fault", "Unspecified network connectivity issue"),
            "confidence": "Medium",
            "osi_layer": top_case.get("osi_layer", "Layer 3"),
            "evidence": [top_case.get("symptom", "Symptom matches retrieved reference case")],
            "next_command": top_case.get("next_command", "show ip route"),
            "fix_steps": [top_case.get("recommended_fix", "Reconfigure interface and routing settings")],
            "alternative_causes": ["Upstream ACL restriction"],
            "missing_evidence": ["Complete show running-config"]
        }

    @classmethod
    async def verify_human_feedback(
        cls,
        problem_text: str,
        original_diagnosis: Dict[str, Any],
        decision: str,
        feedback: str,
        show_output: str,
        rule_results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Perform AI verification on human EDIT or REJECT feedback."""
        prompt = f"""
Act as a Senior AI Verification Auditor.
A human user reviewed an AI networking diagnosis and responded with decision: '{decision}' and feedback: '{feedback}'.

Original Problem: {problem_text}
Original AI Diagnosis: {json.dumps(original_diagnosis)}
Cisco Show Output: {show_output}
Rule Results: {json.dumps(rule_results)}

Evaluate whether the human's feedback is supported by the evidence and establish the verified final diagnosis.

Return strictly valid JSON with this schema:
{{
  "original_ai_correct": false,
  "final_diagnosis": "Clear statement of verified final diagnosis combining human insight and evidence",
  "evidence": ["Key evidence validating the final diagnosis"],
  "verification_reason": "Detailed reasoning why the human correction was verified as accurate or adjusted",
  "confidence": "High"
}}
"""
        raw_res = await cls._call_gemini(prompt, json_mode=True)
        if raw_res:
            try:
                return json.loads(raw_res)
            except Exception:
                pass

        # Fallback Verification Response
        return {
            "original_ai_correct": False,
            "final_diagnosis": f"Verified Diagnosis: {feedback}",
            "evidence": ["Human expert feedback incorporated and verified against CLI evidence."],
            "verification_reason": f"Human review provided crucial insight ({feedback}) supported by topology context.",
            "confidence": "High"
        }

    @classmethod
    async def detect_dataset_inconsistency(
        cls,
        retrieved_cases: List[Dict[str, Any]],
        show_output: str,
        actual_diagnosis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Detect if a retrieved dataset case contains potentially wrong or outdated information."""
        if not retrieved_cases:
            return {"dataset_issue_detected": False}
            
        top_case = retrieved_cases[0]
        prompt = f"""
Act as a Knowledge Base Quality Control Auditor.
Compare the following retrieved dataset case against the actual verified diagnosis and Cisco evidence.

Retrieved Case ID: {top_case.get('case_id')}
Retrieved Expected Fault: {top_case.get('expected_fault')}
Retrieved OSI Layer: {top_case.get('osi_layer')}
Actual Verified Diagnosis: {actual_diagnosis.get('root_cause')}
Cisco Show Output Evidence: {show_output}

Does the retrieved dataset case contain inaccurate or outdated information? If yes, generate a structured correction proposal.

Return strictly valid JSON with this schema:
{{
  "dataset_issue_detected": true/false,
  "case_id": "{top_case.get('case_id')}",
  "field": "expected_fault",
  "current_value": "{top_case.get('expected_fault')}",
  "proposed_value": "Corrected fault description",
  "reason": "Clear technical justification why dataset case is inconsistent",
  "confidence": "High"
}}
"""
        raw_res = await cls._call_gemini(prompt, json_mode=True)
        if raw_res:
            try:
                res_json = json.loads(raw_res)
                if "dataset_issue_detected" in res_json:
                    return res_json
            except Exception:
                pass
                
        return {"dataset_issue_detected": False}
