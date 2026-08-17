import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { 
  Terminal, 
  Search, 
  Cpu, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Layers, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Edit3, 
  X, 
  Sparkles, 
  Database, 
  ShieldCheck, 
  Upload, 
  RefreshCw,
  FileCode,
  AlertCircle
} from 'lucide-react';

const EXAMPLE_SHOW_OUTPUTS = {
  "VLAN Issue": `R1# show ip interface brief
Gi0/0/0.10  192.168.10.1  YES manual UP  UP
Gi0/0/0.20  unassigned    YES unset  DOWN DOWN
S1# show switchport interface gi0/1
Switchport: Enabled, Administrative Mode: trunk, Operational Mode: trunk`,
  "Gateway Mismatch": `HostA Configuration: IP 192.168.1.45, Mask 255.255.255.0, Default Gateway 192.168.1.254
R1# show ip interface brief
GigabitEthernet0/0  192.168.1.1  YES manual UP UP`,
  "Missing Route": `R1# show ip route
Codes: C - connected, S - static
Gateway of last resort is not set
C       10.0.0.0 is directly connected, Serial0/0/0
C    192.168.1.0/24 is directly connected, GigabitEthernet0/0`,
  "DHCP Exhaustion": `R1# show ip dhcp binding
Pool LAN_POOL: 254 addresses total, 254 allocated
R1# show ip dhcp pool
Pool LAN_POOL : Total addresses 254, Leased 254, Excluded 0`,
  "Duplicate IP": `S1# show log
%SYS-4-CONFIG_I: %IP-4-DUPADDR: Duplicate address 172.16.10.1 on Vlan10, sourced by mac 0002.4a11.88bc`
};

export const TroubleshootWizardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<number>(1);
  const [problemText, setProblemText] = useState<string>('');
  const [topologyNote, setTopologyNote] = useState<string>('');
  const [showOutput, setShowOutput] = useState<string>('');
  const [topologyImage, setTopologyImage] = useState<File | null>(null);

  // Diagnostic State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [normalized, setNormalized] = useState<any>(null);
  const [ruleResults, setRuleResults] = useState<any[]>([]);
  const [relevantCases, setRelevantCases] = useState<any[]>([]);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Review & Verification State
  const [humanDecision, setHumanDecision] = useState<'ACCEPT' | 'EDIT' | 'REJECT' | null>(null);
  const [humanFeedback, setHumanFeedback] = useState<string>('');
  const [correctedRootCause, setCorrectedRootCause] = useState<string>('');
  const [correctedOsiLayer, setCorrectedOsiLayer] = useState<string>('Layer 3');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [datasetProposal, setDatasetProposal] = useState<any>(null);

  // Step 3 Execution: Run Normalization, Rule Checks, Retrieval, Gemini Diagnosis
  const runDiagnosticPipeline = async () => {
    if (!problemText.trim()) {
      setError('Please provide a description of the networking problem.');
      return;
    }

    setError(null);
    setLoading(true);
    setStep(3);

    try {
      // 1. Upload topology image if present
      let topologyImagePath = '';
      if (topologyImage && user) {
        const fileExt = topologyImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('topology_images')
          .upload(fileName, topologyImage);
        if (uploadData) topologyImagePath = uploadData.path;
      }

      // 2. Call FastAPI backend diagnosis pipeline endpoint
      const res = await fetch('/api/troubleshoot/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_text: problemText,
          show_output: showOutput,
          topology_note: topologyNote,
          user_id: user?.id
        })
      });

      if (!res.ok) {
        throw new Error(`API Diagnosis failed (${res.status})`);
      }

      const data = await res.json();
      setNormalized(data.normalized_problem);
      setRuleResults(data.rule_results || []);
      setRelevantCases(data.relevant_cases || []);
      setDiagnosis(data.diagnosis);
      setDatasetProposal(data.dataset_correction_proposal);

      // 3. Save Troubleshooting Session to Supabase PostgreSQL
      if (user) {
        const { data: sessionData } = await supabase
          .from('troubleshooting_sessions')
          .insert({
            user_id: user.id,
            problem_text: problemText,
            normalized_problem: data.normalized_problem,
            show_output: showOutput,
            topology_data: topologyNote,
            topology_image_path: topologyImagePath,
            status: 'diagnosed'
          })
          .select()
          .single();

        if (sessionData) {
          setSessionId(sessionData.id);

          // Save rule checker results
          if (data.rule_results && data.rule_results.length > 0) {
            const ruleInserts = data.rule_results.map((r: any) => ({
              session_id: sessionData.id,
              rule_name: r.rule,
              status: r.status,
              result: r.result,
              evidence: r.evidence,
              severity: r.severity
            }));
            await supabase.from('rule_checker_results').insert(ruleInserts);
          }

          // Save diagnosis
          if (data.diagnosis) {
            await supabase.from('diagnoses').insert({
              session_id: sessionData.id,
              user_id: user.id,
              root_cause: data.diagnosis.root_cause,
              confidence: data.diagnosis.confidence,
              osi_layer: data.diagnosis.osi_layer,
              evidence: data.diagnosis.evidence,
              next_command: data.diagnosis.next_command,
              fix_steps: data.diagnosis.fix_steps,
              alternative_causes: data.diagnosis.alternative_causes,
              missing_evidence: data.diagnosis.missing_evidence,
              retrieved_case_ids: data.diagnosis.retrieved_case_ids
            });
          }
        }
      }

      setLoading(false);
      setStep(4);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error occurred during diagnostic pipeline.');
      setLoading(false);
    }
  };

  // Step 5 Execution: Human Review Submission (ACCEPT, EDIT, REJECT)
  const handleHumanReviewSubmit = async () => {
    if (!humanDecision) {
      setError('Please select a review decision (ACCEPT, EDIT, or REJECT).');
      return;
    }

    if ((humanDecision === 'EDIT' || humanDecision === 'REJECT') && !humanFeedback.trim()) {
      setError(`Mandatory explanation feedback is required when choosing ${humanDecision}.`);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // If EDIT or REJECT, run AI Verification
      let verification = null;
      if (humanDecision === 'EDIT' || humanDecision === 'REJECT') {
        const vRes = await fetch('/api/troubleshoot/verify-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problem_text: problemText,
            original_diagnosis: diagnosis,
            decision: humanDecision,
            feedback: humanFeedback,
            show_output: showOutput,
            rule_results: ruleResults
          })
        });

        if (vRes.ok) {
          verification = await vRes.json();
          setVerificationResult(verification);
        }
      }

      // Persist Review & Verification to Supabase
      if (user && sessionId) {
        // Fetch diagnosis ID
        const { data: diagFetch } = await supabase
          .from('diagnoses')
          .select('id')
          .eq('session_id', sessionId)
          .single();

        if (diagFetch) {
          const { data: revData } = await supabase
            .from('human_reviews')
            .insert({
              diagnosis_id: diagFetch.id,
              user_id: user.id,
              decision: humanDecision,
              feedback: humanFeedback,
              corrected_root_cause: correctedRootCause || null,
              corrected_osi_layer: correctedOsiLayer || null
            })
            .select()
            .single();

          if (revData && verification) {
            await supabase.from('verification_results').insert({
              review_id: revData.id,
              original_ai_correct: verification.original_ai_correct,
              final_diagnosis: verification.final_diagnosis,
              evidence: verification.evidence,
              verification_reason: verification.verification_reason,
              confidence: verification.confidence
            });
          }

          // Update session status in Supabase
          await supabase
            .from('troubleshooting_sessions')
            .update({ status: humanDecision.toLowerCase() })
            .eq('id', sessionId);
        }
      }

      setLoading(false);
      setStep(6);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit review.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10">
      {/* Wizard Progress Bar Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Terminal className="w-6 h-6 text-cyan-400" />
              Cisco Troubleshooting Wizard
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              6-Step AI + Deterministic Rule Analysis Engine
            </p>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 rounded-xl">
            <Sparkles className="w-3.5 h-3.5" />
            STEP {step} OF 6
          </div>
        </div>

        {/* Step Indicator Badges */}
        <div className="grid grid-cols-6 gap-2">
          {[
            { num: 1, label: 'Problem' },
            { num: 2, label: 'Evidence' },
            { num: 3, label: 'Analysis' },
            { num: 4, label: 'Diagnosis' },
            { num: 5, label: 'Review' },
            { num: 6, label: 'Verification' }
          ].map((s) => (
            <div
              key={s.num}
              className={`h-2 rounded-full transition-all ${
                step >= s.num
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800'
              }`}
              title={`Step ${s.num}: ${s.label}`}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: PROBLEM INPUT */}
      {step === 1 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Step 1: Problem Description & Topology</h2>
            <p className="text-xs text-slate-400">Describe the Cisco network issue or select a preset scenario.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Problem Description *
            </label>
            <textarea
              rows={4}
              required
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              placeholder="e.g. PC1 in VLAN 10 (192.168.10.10) receives an IP address but cannot communicate with Server1 on VLAN 20 (192.168.20.50). Default gateway 192.168.10.1 responds."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-sans transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Topology Description (Optional)
              </label>
              <textarea
                rows={3}
                value={topologyNote}
                onChange={(e) => setTopologyNote(e.target.value)}
                placeholder="e.g. Router-on-a-stick topology connected via switch trunk port Gi0/1."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Topology Image (Optional)
              </label>
              <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-950">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => setTopologyImage(e.target.files?.[0] || null)}
                  className="hidden"
                  id="topology-upload"
                />
                <label htmlFor="topology-upload" className="cursor-pointer flex flex-col items-center gap-1">
                  <Upload className="w-6 h-6 text-slate-500 mb-1" />
                  <span className="text-xs text-slate-300 font-medium">
                    {topologyImage ? topologyImage.name : 'Upload Packet Tracer Screenshot'}
                  </span>
                  <span className="text-[10px] text-slate-500">PNG, JPG, WEBP up to 5MB</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                if (!problemText.trim()) {
                  setError('Problem description is required.');
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all"
            >
              Continue to Evidence Input
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: EVIDENCE & SHOW COMMAND OUTPUT */}
      {step === 2 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Step 2: Cisco Show Command Evidence</h2>
              <p className="text-xs text-slate-400">Paste CLI output or load sample networking evidence templates.</p>
            </div>

            {/* Quick Load Example Templates */}
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(EXAMPLE_SHOW_OUTPUTS).map((key) => (
                <button
                  key={key}
                  onClick={() => setShowOutput(EXAMPLE_SHOW_OUTPUTS[key as keyof typeof EXAMPLE_SHOW_OUTPUTS])}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-400 border border-slate-700 transition-colors"
                >
                  + {key}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
              <span>Cisco CLI Show Command Output</span>
              <span className="font-mono text-[10px] text-slate-500">show ip route, show ip int brief, show vlan</span>
            </label>
            <textarea
              rows={10}
              value={showOutput}
              onChange={(e) => setShowOutput(e.target.value)}
              placeholder="R1# show ip interface brief&#10;Gi0/0/0.10  192.168.10.1  YES manual UP  UP&#10;Gi0/0/0.20  unassigned    YES unset  DOWN DOWN"
              className="w-full bg-[#070a12] border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 leading-relaxed transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-xl font-semibold bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={runDiagnosticPipeline}
              className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-xl shadow-cyan-500/25 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Cpu className="w-4 h-4 animate-pulse text-cyan-300" />
              Execute Diagnostic Pipeline
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: ANALYSIS IN PROGRESS */}
      {step === 3 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto animate-bounce">
            <Cpu className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Running NetSage AI Pipeline...</h2>
          <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
            Normalizing problem → Executing 6 Deterministic Python Rules → TF-IDF Cosine Retrieval from 30+ Supabase Cases → Gemini AI Evidence Reasoning
          </p>
          <div className="w-48 h-1.5 bg-slate-800 rounded-full mx-auto overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-cyan-500 to-blue-500 animate-pulse" />
          </div>
        </div>
      )}

      {/* STEP 4: AI DIAGNOSIS PRESENTATION */}
      {step === 4 && diagnosis && (
        <div className="space-y-8">
          {/* Main Diagnosis Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">
                  AI Root Cause Diagnosis
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">{diagnosis.root_cause}</h2>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 font-mono text-xs border border-blue-500/30 font-semibold">
                  {diagnosis.osi_layer}
                </span>

                <span
                  className={`px-3 py-1 rounded-xl font-mono text-xs border font-bold ${
                    diagnosis.confidence === 'High'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : diagnosis.confidence === 'Medium'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}
                >
                  Confidence: {diagnosis.confidence}
                </span>
              </div>
            </div>

            {/* Rule Checker Results Table */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Deterministic Python Rule Engine Results (6 Checks)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                {ruleResults.map((r: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-start justify-between ${
                      r.status === 'FAIL'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{r.rule}</div>
                      <div className="text-[11px] opacity-80 mt-0.5">{r.result}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === 'FAIL'
                          ? 'bg-rose-500 text-white'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Cisco Command Terminal Block */}
            {diagnosis.next_command && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Recommended Next Cisco CLI Command
                </h3>
                <div className="bg-[#070a12] border border-cyan-500/30 rounded-xl p-4 font-mono text-sm text-cyan-400 shadow-inner flex items-center justify-between">
                  <code>{diagnosis.next_command}</code>
                  <span className="text-[10px] text-slate-500">Run in Packet Tracer CLI</span>
                </div>
              </div>
            )}

            {/* Fix Steps & Evidence Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
                  Actionable Fix Steps
                </h3>
                <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {diagnosis.fix_steps?.map((step: string, i: number) => (
                    <li key={i} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
                  Supporting CLI Evidence
                </h3>
                <ul className="space-y-2 text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
                  {diagnosis.evidence?.map((ev: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-cyan-300">
                      <span className="text-cyan-500">•</span>
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Retrieved Supabase Cases Context */}
            {relevantCases.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  Retrieved Supabase Knowledge Base Reference Cases (TF-IDF Cosine Similarity)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {relevantCases.slice(0, 3).map((c: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                      <div className="flex items-center justify-between mb-1 font-mono text-[10px] text-blue-400">
                        <span>{c.case_id}</span>
                        <span>Score: {c.similarity_score}</span>
                      </div>
                      <div className="font-semibold text-slate-200 line-clamp-1">{c.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{c.symptom}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(5)}
              className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-xl shadow-cyan-500/25 flex items-center gap-2 transition-all hover:scale-105"
            >
              Proceed to Mandatory Human Review
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: MANDATORY HUMAN REVIEW */}
      {step === 5 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6 shadow-2xl">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Step 5: Mandatory Human Review</h2>
            <p className="text-xs text-slate-400">
              Select ACCEPT, EDIT, or REJECT. Section 23 of PS requires mandatory feedback explanation for EDIT and REJECT decisions.
            </p>
          </div>

          {/* Decision Buttons */}
          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setHumanDecision('ACCEPT')}
              className={`p-4 rounded-xl border font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all ${
                humanDecision === 'ACCEPT'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-emerald-500/50'
              }`}
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              [ ACCEPT ]
              <span className="text-[10px] font-normal text-slate-400">AI Diagnosis is Accurate</span>
            </button>

            <button
              type="button"
              onClick={() => setHumanDecision('EDIT')}
              className={`p-4 rounded-xl border font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all ${
                humanDecision === 'EDIT'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-amber-500/50'
              }`}
            >
              <Edit3 className="w-6 h-6 text-amber-400" />
              [ EDIT ]
              <span className="text-[10px] font-normal text-slate-400">Modify Root Cause & Feedback</span>
            </button>

            <button
              type="button"
              onClick={() => setHumanDecision('REJECT')}
              className={`p-4 rounded-xl border font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all ${
                humanDecision === 'REJECT'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/20 ring-2 ring-rose-500'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-rose-500/50'
              }`}
            >
              <XCircle className="w-6 h-6 text-rose-400" />
              [ REJECT ]
              <span className="text-[10px] font-normal text-slate-400">AI Diagnosis is Inaccurate</span>
            </button>
          </div>

          {/* Mandatory Feedback Form for EDIT and REJECT */}
          {(humanDecision === 'EDIT' || humanDecision === 'REJECT') && (
            <div className="p-6 rounded-xl bg-slate-950 border border-amber-500/30 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Mandatory Feedback Explanation Required</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Human Explanation Feedback *
                </label>
                <textarea
                  rows={3}
                  required
                  value={humanFeedback}
                  onChange={(e) => setHumanFeedback(e.target.value)}
                  placeholder="e.g. The AI identified routing as the problem, but the actual issue is an ACL blocking traffic from VLAN 10 to VLAN 20."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {humanDecision === 'EDIT' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Corrected Root Cause
                    </label>
                    <input
                      type="text"
                      value={correctedRootCause}
                      onChange={(e) => setCorrectedRootCause(e.target.value)}
                      placeholder="e.g. ACL Extended 101 Blocking Port 80"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Corrected OSI Layer
                    </label>
                    <select
                      value={correctedOsiLayer}
                      onChange={(e) => setCorrectedOsiLayer(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="Layer 1">Layer 1 — Physical</option>
                      <option value="Layer 2">Layer 2 — Data Link</option>
                      <option value="Layer 3">Layer 3 — Network</option>
                      <option value="Layer 4">Layer 4 — Transport</option>
                      <option value="Layer 7">Layer 7 — Application</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setStep(4)}
              className="px-5 py-2.5 rounded-xl font-semibold bg-slate-800 text-slate-300 hover:text-white"
            >
              Back to Diagnosis
            </button>

            <button
              onClick={handleHumanReviewSubmit}
              disabled={loading || !humanDecision}
              className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-xl shadow-cyan-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying Review...' : 'Submit Review & Verify'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: VERIFICATION & FINAL RESULT */}
      {step === 6 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6 shadow-2xl">
          <div className="text-center pb-4 border-b border-slate-800">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white">Troubleshooting Session Complete</h2>
            <p className="text-xs text-slate-400 font-mono mt-1">Saved persistently in Supabase Database</p>
          </div>

          {/* Human Decision Badge */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-400">Human Decision: </span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-xs ml-2 ${
                  humanDecision === 'ACCEPT'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : humanDecision === 'EDIT'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {humanDecision}
              </span>
            </div>

            {humanFeedback && (
              <div className="text-xs text-slate-300 font-mono italic max-w-md truncate">
                "{humanFeedback}"
              </div>
            )}
          </div>

          {/* AI Verification Results Box (If EDIT or REJECT) */}
          {verificationResult && (
            <div className="p-6 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Verification Engine Result
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Original AI Correct: {verificationResult.original_ai_correct ? 'Yes' : 'No'}
                </span>
              </div>

              <div className="text-sm font-bold text-white">{verificationResult.final_diagnosis}</div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">{verificationResult.verification_reason}</p>
            </div>
          )}

          {/* Dataset Inconsistency Notice (If AI detected wrong dataset case) */}
          {datasetProposal && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
              <div className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Dataset Error Correction Proposal Generated ({datasetProposal.case_id})</span>
              </div>
              <p className="text-slate-300">
                Gemini detected potential inconsistency in case <code className="font-mono text-amber-300">{datasetProposal.case_id}</code>. A correction proposal has been submitted to the Admin Panel for review.
              </p>
            </div>
          )}

          <div className="flex justify-center gap-4 pt-4">
            <button
              onClick={() => {
                setStep(1);
                setProblemText('');
                setShowOutput('');
                setHumanDecision(null);
                setHumanFeedback('');
                setDiagnosis(null);
              }}
              className="px-6 py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Start New Troubleshooting Session
            </button>

            <button
              onClick={() => navigate('/history')}
              className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
            >
              View Session History
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
