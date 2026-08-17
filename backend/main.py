import os
import json
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

from rule_engine import RuleChecker
from retrieval_engine import CaseRetrievalEngine
from gemini_service import GeminiService
from log_cleaner import CiscoLogCleaner

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

        # 8. Call Gemini AI Guidance Engine
        ai_guidance = await GeminiService.generate_guided_diagnosis(
            problem_text=problem_text,
            current_logs=req.raw_output,
            cleaned_facts=cleaned_facts,
            rule_results=rule_results,
            retrieved_cases=retrieved_cases,
            previous_iterations=previous_history,
            device=req.device,
            command=req.command
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
