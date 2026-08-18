import os
import json
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Body, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

from rule_engine import RuleChecker
from retrieval_engine import CaseRetrievalEngine
from gemini_service import GeminiService
from log_cleaner import CiscoLogCleaner
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from pkt_parser import PktParser

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://twnhwhdjuudienrxdbsp.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(
    title="NetSage AI Phase 1 Backend Engine",
    description="Iterative CLI-Based Cisco Troubleshooting Engine powered by Python Rules, TF-IDF Retrieval, and Gemini AI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rule_checker = RuleChecker()
retrieval_engine = CaseRetrievalEngine(supabase)

# Phase 1 Request Models
class StartSessionRequest(BaseModel):
    user_id: Optional[str] = None
    problem_text: str

class AnalyzeImageRequest(BaseModel):
    session_id: str
    image_base64: str
    problem_text: str

class SubmitIterationRequest(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    iteration_number: int = 1
    device: str = "Router0"
    command: str = "show ip interface brief"
    raw_output: str

class SubmitReviewRequest(BaseModel):
    session_id: str
    iteration_number: int = 1
    ai_response_id: str
    user_id: Optional[str] = None
    decision: str  # ACCEPT, EDIT, REJECT
    feedback: Optional[str] = None
    corrected_root_cause: Optional[str] = None
    corrected_osi_layer: Optional[str] = None

class CorrectionApprovalRequest(BaseModel):
    correction_id: str
    admin_id: str
    approved: bool

@app.get("/api/health")
def health_check():
    return {"status": "online", "service": "NetSage AI Phase 1 CLI Troubleshooting Engine"}

@app.post("/api/troubleshoot/start-session")
async def start_session(req: StartSessionRequest):
    """Creates a new troubleshooting session in Supabase."""
    try:
        res = supabase.table("troubleshooting_sessions").insert({
            "user_id": req.user_id if req.user_id else None,
            "problem_text": req.problem_text,
            "current_iteration": 1,
            "status": "in_progress"
        }).execute()
        
        session = res.data[0]
        return {"session_id": session["id"], "session": session}
    except Exception as e:
        import uuid
        mock_id = str(uuid.uuid4())
        return {
            "session_id": mock_id, 
            "session": {
                "id": mock_id, 
                "problem_text": req.problem_text, 
                "current_iteration": 1, 
                "status": "in_progress"
            }
        }
        
@app.post("/api/troubleshoot/analyze-image")
async def analyze_image(req: AnalyzeImageRequest):
    """
    Sends base64 topology image to Gemini to extract devices, connections, and command paths.
    """
    try:
        understanding = await GeminiService.analyze_topology_image(req.problem_text, req.image_base64)
        
        # Save topology context into Supabase troubleshooting_sessions table
        try:
            supabase.table("troubleshooting_sessions").update({
                "normalized_problem": {
                    "image_base64": req.image_base64,
                    "topology_understanding": understanding
                }
            }).eq("id", req.session_id).execute()
        except Exception as e:
            print(f"Supabase session update warning: {e}")
            
        return understanding
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/troubleshoot/submit-iteration")
async def submit_iteration(req: SubmitIterationRequest):
    """
    Phase 1 Iterative Troubleshooting Endpoint:
    1. Saves log & device info to Supabase.
    2. Runs Python Log Cleaner & Rule Checker.
    3. Retrieves top dataset cases from 255+ Supabase knowledge base.
    4. Fetches complete session history.
    5. Calls Gemini AI for Phase 1 structured beginner guidance.
    6. Saves AI response to Supabase.
    """
    try:
        # 1. Fetch Session Info
        sess_res = supabase.table("troubleshooting_sessions").select("*").eq("id", req.session_id).execute()
        problem_text = sess_res.data[0]["problem_text"] if sess_res.data else "PC cannot ping destination."

        # 2. Clean Log & Extract Structured Facts
        cleaned_output = CiscoLogCleaner.clean_terminal_noise(req.raw_output)
        cleaned_facts = CiscoLogCleaner.extract_structured_facts(req.raw_output, problem_text)

        # 3. Save Log Record to Supabase
        log_id = "test-log-id"
        try:
            log_res = supabase.table("troubleshooting_logs").insert({
                "session_id": req.session_id,
                "iteration_number": req.iteration_number,
                "device_name": req.device,
                "command": req.command,
                "raw_output": req.raw_output,
                "cleaned_output": cleaned_output,
                "structured_facts": cleaned_facts
            }).execute()
            if log_res.data:
                log_id = log_res.data[0]["id"]
        except Exception:
            pass

        # 4. Run Python Rule Checker with Findings Array & SEV-1/2/3
        rule_results = rule_checker.run_all_checks(req.raw_output, problem_text, req.device)

        # 5. Save Rule Results to Supabase
        try:
            for r in rule_results:
                supabase.table("rule_checker_results").insert({
                    "session_id": req.session_id,
                    "log_id": log_id,
                    "iteration_number": req.iteration_number,
                    "rule_name": r["rule_name"],
                    "status": r["status"],
                    "finding": r["finding"],
                    "evidence": r["evidence"],
                    "severity": r["severity"]
                }).execute()
        except Exception:
            pass

        # 6. Retrieve Relevant Cases from 255+ Dataset
        retrieved_cases = await retrieval_engine.search_cases(problem_text, req.raw_output, top_k=3)

        # 7. Fetch Previous Session Iterations
        previous_history = []
        try:
            prev_logs_res = supabase.table("troubleshooting_logs").select("*").eq("session_id", req.session_id).lt("iteration_number", req.iteration_number).execute()
            prev_ai_res = supabase.table("ai_responses").select("*").eq("session_id", req.session_id).lt("iteration_number", req.iteration_number).execute()
            for i in range(1, req.iteration_number):
                p_log = next((l for l in (prev_logs_res.data or []) if l.get("iteration_number") == i), None)
                p_ai = next((a for a in (prev_ai_res.data or []) if a.get("iteration_number") == i), None)
                previous_history.append({
                    "iteration": i,
                    "device": p_log.get("device_name") if p_log else "",
                    "command": p_log.get("command") if p_log else "",
                    "log": p_log.get("raw_output") if p_log else "",
                    "ai_explanation": p_ai.get("explanation") if p_ai else "",
                    "fix": p_ai.get("recommended_fix") if p_ai else ""
                })
        except Exception:
            pass

        # 7.1 Parse all previous logs & current logs & PKT configuration files for verified interfaces
        verified_interfaces = []
        try:
            # 1. Interfaces from previous logs
            prev_logs = supabase.table("troubleshooting_logs").select("structured_facts").eq("session_id", req.session_id).execute()
            if prev_logs.data:
                for log in prev_logs.data:
                    facts = log.get("structured_facts") or {}
                    if "interfaces" in facts and isinstance(facts["interfaces"], list):
                        for iface in facts["interfaces"]:
                            if "name" in iface:
                                verified_interfaces.append(iface["name"])
        except Exception:
            pass

        # 2. Interfaces from current output
        if cleaned_facts and "interfaces" in cleaned_facts and isinstance(cleaned_facts["interfaces"], list):
            for iface in cleaned_facts["interfaces"]:
                if "name" in iface:
                    verified_interfaces.append(iface["name"])

        # 3. Interfaces from PKT Checker upload (if session is linked)
        try:
            pkt_res = supabase.table("pkt_analyses").select("network_json").eq("session_id", req.session_id).execute()
            if pkt_res.data:
                net_json = pkt_res.data[0].get("network_json") or {}
                # Extract interfaces from network_json
                for iface in net_json.get("interfaces", []):
                    if "interface" in iface:
                        verified_interfaces.append(iface["interface"])
        except Exception:
            pass

        verified_interfaces = list(set(verified_interfaces))

        # 7.2 Check raw output for Cisco console errors
        error_keywords = [
            "% Invalid input detected",
            "% Invalid command",
            "% Invalid interface type and number",
            "% Incomplete command",
            "% Ambiguous command",
            "% Unknown command"
        ]
        detected_error = None
        for kw in error_keywords:
            if kw.lower() in req.raw_output.lower():
                detected_error = kw
                break

        if detected_error:
            if "interface type" in detected_error.lower():
                explanation = "The interface name I asked you to use does not exist on this router. Let's find your router's actual interfaces."
                commands = ["show ip interface brief"]
                next_evidence = "show ip interface brief"
                expected_output = "List of physical interfaces configured on the router."
            elif "invalid input" in detected_error.lower():
                explanation = "You're currently in configuration mode, but the verification command was run here. Let's return to the main router mode first."
                commands = ["end"]
                next_evidence = "end"
                expected_output = "Router# privileged exec mode prompt."
            else:
                explanation = "Something didn't match what we expected. That's okay — don't type anything else yet."
                commands = ["end"]
                next_evidence = "show ip interface brief"
                expected_output = "Show interface list and reset prompt state."

            ai_guidance = {
                "status": "ERROR_DETECTED",
                "root_cause": f"Cisco CLI Warning: {detected_error}",
                "osi_layer": "Layer 3",
                "confidence": "High",
                "evidence": [f"Console Error: {detected_error}"],
                "explanation": explanation,
                "recommended_fix": "Follow the CLI recovery step to realign the terminal prompt.",
                "commands": commands,
                "expected_output": expected_output,
                "verification_steps": [
                    f"1. Run the recovery command in Packet Tracer.",
                    f"2. Copy and paste new prompt output below."
                ],
                "next_evidence_required": next_evidence,
                "alternative_causes": ["Cisco CLI mode desynchronization."]
            }
        else:
            # 8. Call Gemini AI Guidance Engine
            ai_guidance = await GeminiService.generate_guided_diagnosis(
                problem_text=problem_text,
                current_logs=req.raw_output,
                cleaned_facts=cleaned_facts,
                rule_results=rule_results,
                retrieved_cases=retrieved_cases,
                previous_iterations=previous_history,
                device=req.device,
                command=req.command,
                verified_interfaces=verified_interfaces
            )

        # 9. Save AI Response to Supabase
        ai_response_id = "test-ai-id"
        try:
            ai_res = supabase.table("ai_responses").insert({
                "session_id": req.session_id,
                "iteration_number": req.iteration_number,
                "prompt_context": {"facts": cleaned_facts, "retrieved_count": len(retrieved_cases)},
                "status": ai_guidance.get("status", "FIX_RECOMMENDED"),
                "root_cause": ai_guidance.get("root_cause"),
                "osi_layer": ai_guidance.get("osi_layer", "Layer 3"),
                "confidence": ai_guidance.get("confidence", "High"),
                "evidence": ai_guidance.get("evidence", []),
                "what_i_found": ai_guidance.get("explanation", ""),
                "next_command": ai_guidance.get("next_evidence_required", req.command),
                "why_this_command": ai_guidance.get("explanation", ""),
                "expected_output": ai_guidance.get("expected_output", ""),
                "fix_steps": ai_guidance.get("commands", []),
                "test_steps": ai_guidance.get("verification_steps", []),
                "what_to_submit_next": ai_guidance.get("next_evidence_required", "")
            }).execute()
            if ai_res.data:
                ai_response_id = ai_res.data[0]["id"]
        except Exception:
            pass

        # 10. Update Session State
        new_status = "need_more_data" if ai_guidance.get("status") == "NEED_MORE_DATA" else "fix_recommended"
        try:
            supabase.table("troubleshooting_sessions").update({
                "current_iteration": req.iteration_number,
                "status": new_status
            }).eq("id", req.session_id).execute()
        except Exception:
            pass

        return {
            "session_id": req.session_id,
            "iteration_number": req.iteration_number,
            "device": req.device,
            "command": req.command,
            "log_id": log_id,
            "ai_response_id": ai_response_id,
            "cleaned_facts": cleaned_facts,
            "rule_results": rule_results,
            "retrieved_cases": retrieved_cases,
            "ai_guidance": ai_guidance
        }
    except Exception as e:
        cleaned_facts = CiscoLogCleaner.extract_structured_facts(req.raw_output)
        rule_results = rule_checker.run_all_checks(req.raw_output, device=req.device)
        ai_guidance = GeminiService._fallback_guidance(req.raw_output, req.raw_output, rule_results, str(e), req.device, req.command)
        return {
            "session_id": req.session_id,
            "iteration_number": req.iteration_number,
            "device": req.device,
            "command": req.command,
            "log_id": "test-log-id",
            "ai_response_id": "test-ai-id",
            "cleaned_facts": cleaned_facts,
            "rule_results": rule_results,
            "retrieved_cases": [],
            "ai_guidance": ai_guidance
        }

@app.post("/api/troubleshoot/submit-review")
async def submit_review(req: SubmitReviewRequest):
    """Submits human review (ACCEPT, EDIT, REJECT) for an iteration."""
    try:
        rev_res = supabase.table("human_reviews").insert({
            "session_id": req.session_id,
            "iteration_number": req.iteration_number,
            "ai_response_id": req.ai_response_id,
            "user_id": req.user_id if req.user_id else None,
            "decision": req.decision,
            "feedback": req.feedback,
            "corrected_root_cause": req.corrected_root_cause,
            "corrected_osi_layer": req.corrected_osi_layer
        }).execute()

        sess_status = "ready_for_verification" if req.decision == "ACCEPT" else "in_progress"
        try:
            supabase.table("troubleshooting_sessions").update({
                "status": sess_status
            }).eq("id", req.session_id).execute()
        except Exception:
            pass

        return {"status": "success", "review": rev_res.data[0] if rev_res.data else {}}
    except Exception as e:
        return {"status": "success", "review": {"decision": req.decision}}

@app.post("/api/admin/approve-correction")
async def approve_correction(req: CorrectionApprovalRequest):
    """Admin approves or rejects a dataset correction proposal with server-side admin check."""
    if not req.admin_id:
        raise HTTPException(status_code=401, detail="Authentication admin_id is required.")
        
    prof_res = supabase.table("profiles").select("role").eq("id", req.admin_id).execute()
    if not prof_res.data or prof_res.data[0].get("role") != "admin":
        raise HTTPException(
            status_code=403, 
            detail="Unauthorized: User does not have administrator privileges required to approve or modify dataset cases."
        )

    try:
        corr_res = supabase.table("dataset_corrections").select("*").eq("id", req.correction_id).execute()
        if not corr_res.data:
            raise HTTPException(status_code=404, detail="Correction proposal not found.")

        correction = corr_res.data[0]
        status_str = "APPROVED" if req.approved else "REJECTED"

        supabase.table("dataset_corrections").update({
            "status": status_str,
            "reviewed_by": req.admin_id
        }).eq("id", req.correction_id).execute()

        if req.approved:
            field_name = correction["field_name"]
            prop_val = correction["proposed_value"]
            case_id = correction["case_id"]
            supabase.table("cases").update({field_name: prop_val}).eq("case_id", case_id).execute()

        return {"status": status_str, "correction": correction}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pkt/analyze")
async def analyze_pkt(file: UploadFile = File(...), user_id: Optional[str] = None):
    """
    Parses an uploaded Cisco Packet Tracer .pkt file, converts it to structured Network JSON,
    runs the Rule Checker on it, and stores the results in Supabase.
    """
    import tempfile
    import shutil

    if not file.filename.endswith('.pkt'):
        raise HTTPException(status_code=400, detail="Only .pkt files are supported.")

    # Save file temporarily
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, file.filename)
    
    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Parse .pkt file
        network_json = PktParser.parse_pkt_file(temp_path)
        
        if isinstance(network_json, dict) and network_json.get("available") is False:
            return {
                "status": "FAILED",
                "message": network_json.get("reason", "We couldn't read enough information from this Packet Tracer project. Don't worry. You can still troubleshoot it using Packet Tracer CLI output.")
            }

        # Run Rule Checker against Network JSON
        rule_results = rule_checker.run_network_json_checks(network_json)

        # Save to Supabase (public.pkt_analyses table)
        extraction_status = "SUCCESS" if len(rule_results) == 0 else "PARTIAL"
        try:
            supabase.table("pkt_analyses").insert({
                "user_id": user_id if user_id else None,
                "file_name": file.filename,
                "file_reference": f"local_temp/{file.filename}",
                "extraction_status": extraction_status,
                "network_data": network_json,
                "rule_results": rule_results
            }).execute()
        except Exception as db_err:
            print("DB Save Warning:", db_err)

        return {
            "status": "SUCCESS",
            "file_name": file.filename,
            "network_data": network_json,
            "rule_results": rule_results
        }
    except Exception as e:
        return {
            "status": "FAILED",
            "message": f"We couldn't read enough information from this Packet Tracer project: {str(e)}. Don't worry. You can still troubleshoot it using Packet Tracer CLI output."
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/api/pkt/history")
async def get_pkt_history(user_id: Optional[str] = None):
    """Fetches user's Packet Tracer analysis history."""
    try:
        query = supabase.table("pkt_analyses").select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        res = query.order("uploaded_at", desc=True).execute()
        return res.data or []
    except Exception:
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
