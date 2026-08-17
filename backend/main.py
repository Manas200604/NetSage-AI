import os
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://twnhwhdjuudienrxdbsp.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="NetSage AI API Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Input Schemas
class NormalizeRequest(BaseModel):
    problem_text: str
    topology_note: Optional[str] = ""

class DiagnoseRequest(BaseModel):
    problem_text: str
    show_output: Optional[str] = ""
    topology_note: Optional[str] = ""
    session_id: Optional[str] = None
    user_id: Optional[str] = None

class VerifyFeedbackRequest(BaseModel):
    problem_text: str
    original_diagnosis: Dict[str, Any]
    decision: str
    feedback: str
    show_output: Optional[str] = ""
    rule_results: List[Dict[str, Any]] = []

class CorrectionApprovalRequest(BaseModel):
    correction_id: str
    admin_id: str
    approved: bool
    modified_value: Optional[str] = None

@app.get("/api/health")
def health_check():
    return {"status": "online", "service": "NetSage AI Backend Engine"}

@app.post("/api/troubleshoot/normalize")
async def normalize_problem(req: NormalizeRequest):
    if not req.problem_text.strip():
        raise HTTPException(status_code=400, detail="Problem text is required.")
    normalized = await GeminiService.normalize_problem(req.problem_text, req.topology_note)
    return normalized

@app.post("/api/troubleshoot/diagnose")
async def generate_diagnosis(req: DiagnoseRequest):
    if not req.problem_text.strip():
        raise HTTPException(status_code=400, detail="Problem text is required.")

    show_output = req.show_output or ""
    
    # 1. Normalize Problem
    normalized = await GeminiService.normalize_problem(req.problem_text, req.topology_note)

    # 2. Run Deterministic Python Rule Engine
    rule_results = RuleChecker.run_all_rules(show_output, req.problem_text)

    # 3. Retrieve Top 3-5 Relevant Cases from Supabase Database
    try:
        cases_res = supabase.table("cases").select("*").execute()
        all_cases = cases_res.data or []
    except Exception as e:
        print(f"Supabase cases fetch warning: {e}")
        all_cases = []

    retrieval_engine = CaseRetrievalEngine(all_cases)
    relevant_cases = retrieval_engine.retrieve_relevant_cases(
        problem_text=req.problem_text,
        search_terms=normalized.get("search_terms", []),
        possible_concepts=normalized.get("possible_concepts", []),
        top_k=5
    )

    # 4. Call Gemini AI for Evidence-Based Diagnosis
    diagnosis = await GeminiService.generate_diagnosis(
        problem_text=req.problem_text,
        normalized_problem=normalized,
        show_output=show_output,
        rule_results=rule_results,
        relevant_cases=relevant_cases,
        topology_note=req.topology_note
    )
    
    # Attach retrieved case IDs
    retrieved_case_ids = [c.get("case_id") for c in relevant_cases if c.get("case_id")]
    diagnosis["retrieved_case_ids"] = retrieved_case_ids

    # 5. Check for Potential Dataset Inconsistencies & Create Correction Proposal
    inconsistency_check = await GeminiService.detect_dataset_inconsistency(
        retrieved_cases=relevant_cases,
        show_output=show_output,
        actual_diagnosis=diagnosis
    )
    
    correction_proposal = None
    if inconsistency_check.get("dataset_issue_detected"):
        try:
            correction_payload = {
                "case_id": inconsistency_check.get("case_id"),
                "field_name": inconsistency_check.get("field", "expected_fault"),
                "original_value": inconsistency_check.get("current_value", ""),
                "proposed_value": inconsistency_check.get("proposed_value", ""),
                "reason": inconsistency_check.get("reason", "AI detected inconsistency between CLI evidence and case dataset record."),
                "ai_confidence": inconsistency_check.get("confidence", "High"),
                "status": "PENDING",
                "proposed_by": "Gemini AI"
            }
            inserted = supabase.table("dataset_corrections").insert(correction_payload).execute()
            if inserted.data:
                correction_proposal = inserted.data[0]
        except Exception as e:
            print(f"Dataset correction insertion warning: {e}")

    return {
        "normalized_problem": normalized,
        "rule_results": rule_results,
        "relevant_cases": relevant_cases,
        "diagnosis": diagnosis,
        "dataset_correction_proposal": correction_proposal
    }

@app.post("/api/troubleshoot/verify-feedback")
async def verify_feedback(req: VerifyFeedbackRequest):
    if not req.feedback.strip():
        raise HTTPException(status_code=400, detail="Mandatory feedback is required for EDIT and REJECT decisions.")
        
    verification = await GeminiService.verify_human_feedback(
        problem_text=req.problem_text,
        original_diagnosis=req.original_diagnosis,
        decision=req.decision,
        feedback=req.feedback,
        show_output=req.show_output or "",
        rule_results=req.rule_results
    )
    
    return verification

@app.post("/api/admin/approve-correction")
async def approve_correction(req: CorrectionApprovalRequest):
    """Admin approves or rejects a dataset correction proposal. If approved, updates cases table in Supabase."""
    try:
        corr_res = supabase.table("dataset_corrections").select("*").eq("id", req.correction_id).execute()
        if not corr_res.data:
            raise HTTPException(status_code=404, detail="Correction proposal not found.")
            
        correction = corr_res.data[0]
        case_id = correction["case_id"]
        field_name = correction["field_name"]
        new_val = req.modified_value if req.modified_value else correction["proposed_value"]
        
        if req.approved:
            # 1. Fetch current case version
            case_fetch = supabase.table("cases").select("*").eq("case_id", case_id).execute()
            if case_fetch.data:
                current_case = case_fetch.data[0]
                new_version = (current_case.get("version") or 1) + 1
                
                # 2. Update cases table in Supabase
                supabase.table("cases").update({
                    field_name: new_val,
                    "version": new_version,
                    "updated_at": "now()"
                }).eq("case_id", case_id).execute()
                
            # 3. Update correction record status
            supabase.table("dataset_corrections").update({
                "status": "APPROVED",
                "proposed_value": new_val,
                "reviewed_by": req.admin_id,
                "reviewed_at": "now()"
            }).eq("id", req.correction_id).execute()
            
            # 4. Log Audit Trail
            supabase.table("audit_logs").insert({
                "user_id": req.admin_id,
                "action": "DATASET_CORRECTION_APPROVED",
                "entity": "cases",
                "entity_id": case_id,
                "payload": {
                    "field_name": field_name,
                    "original_value": correction["original_value"],
                    "new_value": new_val,
                    "reason": correction["reason"]
                }
            }).execute()
            
            return {"status": "success", "message": f"Dataset case {case_id} updated to version {new_version}."}
        else:
            # Reject correction
            supabase.table("dataset_corrections").update({
                "status": "REJECTED",
                "reviewed_by": req.admin_id,
                "reviewed_at": "now()"
            }).eq("id", req.correction_id).execute()
            
            supabase.table("audit_logs").insert({
                "user_id": req.admin_id,
                "action": "DATASET_CORRECTION_REJECTED",
                "entity": "cases",
                "entity_id": case_id,
                "payload": {"correction_id": req.correction_id}
            }).execute()
            
            return {"status": "success", "message": f"Correction proposal for {case_id} rejected."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
