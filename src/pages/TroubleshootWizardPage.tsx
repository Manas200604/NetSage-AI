import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  XCircle, 
  ChevronRight, 
  Cpu, 
  Database, 
  Layers, 
  HelpCircle, 
  ArrowRight,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  FileCode,
  Activity,
  Check,
  Send
} from 'lucide-react';

interface IterationState {
  iteration_number: number;
  command: string;
  raw_output: string;
  cleaned_facts: any;
  rule_results: any[];
  retrieved_cases: any[];
  ai_guidance: any;
  human_review?: {
    decision: 'ACCEPT' | 'EDIT' | 'REJECT';
    feedback?: string;
    corrected_root_cause?: string;
    corrected_osi_layer?: string;
  };
}

const PRESET_LOG_TEMPLATES = [
  {
    title: 'VLAN 20 Missing on Trunk (Layer 2)',
    problem: 'PC1 on VLAN 10 cannot communicate with Server1 on VLAN 20 across the trunk link.',
    command: 'show interfaces trunk',
    output: `Allowed vlan on trunk: 1-10\nNative vlan: 1\nPort Gi0/1 is trunking.`
  },
  {
    title: 'Subnet Mask Mismatch (Layer 3)',
    problem: 'Host IP address 192.168.10.15 is unable to ping gateway 192.168.10.1.',
    command: 'show ip interface brief',
    output: `Interface GigabitEthernet0/0/0.10 IP-Address 192.168.10.15 255.255.0.0 Status UP Protocol UP`
  },
  {
    title: 'Gateway Misconfiguration (Layer 3)',
    problem: 'Sales subnet PCs cannot reach external internet router.',
    command: 'show ip route',
    output: `Gateway of last resort is not set\nC 192.168.10.0/24 is directly connected, GigabitEthernet0/0`
  },
  {
    title: 'Interface Shutdown (Layer 1/2)',
    problem: 'Link indicator light is red on switch port connected to core router.',
    command: 'show ip interface brief',
    output: `Interface GigabitEthernet0/0/1 IP-Address 10.0.0.1 YES NVRAM administratively down DOWN`
  }
];

export const TroubleshootWizardPage: React.FC = () => {
  const { user } = useAuth();
  
  // Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problemText, setProblemText] = useState('');
  const [currentCommand, setCurrentCommand] = useState('show running-config');
  const [currentLogs, setCurrentLogs] = useState('');
  const [currentIteration, setCurrentIteration] = useState(1);
  const [iterationsHistory, setIterationsHistory] = useState<IterationState[]>([]);

  // UI Flow State
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [reviewDecision, setReviewDecision] = useState<'ACCEPT' | 'EDIT' | 'REJECT' | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [correctedCause, setCorrectedCause] = useState('');
  const [correctedLayer, setCorrectedLayer] = useState('Layer 3');
  const [isResolved, setIsResolved] = useState(false);

  // 1. Initialize Troubleshooting Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemText.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/troubleshoot/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, problem_text: problemText })
      });
      const data = await res.json();
      setSessionId(data.session_id);
      setActiveStep(2);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Logs & Execute Python Rule Engine + Gemini AI
  const handleSubmitIteration = async () => {
    if (!sessionId || !currentLogs.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/troubleshoot/submit-iteration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: user?.id,
          iteration_number: currentIteration,
          command: currentCommand,
          raw_output: currentLogs
        })
      });
      const data = await res.json();

      const newIter: IterationState = {
        iteration_number: currentIteration,
        command: currentCommand,
        raw_output: currentLogs,
        cleaned_facts: data.cleaned_facts,
        rule_results: data.rule_results,
        retrieved_cases: data.retrieved_cases,
        ai_guidance: data.ai_guidance
      };

      setIterationsHistory((prev) => [...prev, newIter]);
      
      if (data.ai_guidance.status === 'RESOLVED') {
        setIsResolved(true);
      }
      
      setActiveStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Human Review Decision (Accept / Edit / Reject)
  const handleSubmitReview = async (decision: 'ACCEPT' | 'EDIT' | 'REJECT') => {
    if (!sessionId || iterationsHistory.length === 0) return;

    const currentIterObj = iterationsHistory[iterationsHistory.length - 1];

    try {
      await fetch('http://localhost:8000/api/troubleshoot/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          iteration_number: currentIteration,
          ai_response_id: currentIterObj.ai_guidance?.id || 'demo-ai-id',
          user_id: user?.id,
          decision,
          feedback: reviewFeedback,
          corrected_root_cause: correctedCause,
          corrected_osi_layer: correctedLayer
        })
      });

      // Update local iteration record
      setIterationsHistory((prev) =>
        prev.map((item, idx) =>
          idx === prev.length - 1
            ? { ...item, human_review: { decision, feedback: reviewFeedback, corrected_root_cause: correctedCause, corrected_osi_layer: correctedLayer } }
            : item
        )
      );

      setReviewDecision(decision);
      setActiveStep(6);
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Advance to Next Iteration (After applying fix in Packet Tracer)
  const handleStartNextIteration = () => {
    setCurrentIteration((prev) => prev + 1);
    setCurrentLogs('');
    setReviewDecision(null);
    setReviewFeedback('');
    setActiveStep(2);
  };

  const currentIterData = iterationsHistory[iterationsHistory.length - 1];

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10 space-y-8">
      {/* Page Title & Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Iterative Guided Assistant</div>
            <h1 className="text-2xl font-bold text-white">Cisco Packet Tracer Guided Troubleshooter</h1>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Python Rule Engine verifies CLI logs → 255+ Supabase Cases retrieved → Gemini AI guides Packet Tracer fixes step-by-step.
        </p>
      </div>

      {/* Interactive 6-Step Workflow Timeline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { step: 1, title: '1. Problem', desc: 'Describe Issue' },
          { step: 2, title: '2. CLI Logs', desc: 'Paste Evidence' },
          { step: 3, title: '3. Python Check', desc: 'Fact & Rules' },
          { step: 4, title: '4. AI Guidance', desc: 'Step-by-Step' },
          { step: 5, title: '5. Human Review', desc: 'Accept / Edit' },
          { step: 6, title: '6. Packet Tracer', desc: 'Apply & Retest' }
        ].map((s) => (
          <div
            key={s.step}
            className={`p-3 rounded-xl border transition-all text-left ${
              activeStep === s.step
                ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-500/10'
                : activeStep > s.step
                ? 'bg-slate-900/80 border-slate-800 text-slate-300'
                : 'bg-slate-950/40 border-slate-900 text-slate-600'
            }`}
          >
            <div className="text-xs font-bold font-mono flex items-center justify-between">
              <span>{s.title}</span>
              {activeStep > s.step && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* STEP 1: PROBLEM FORM */}
      {activeStep === 1 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Step 1: Describe the Packet Tracer Problem
          </h2>

          <form onSubmit={handleStartSession} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Problem Description / Symptoms
              </label>
              <textarea
                required
                rows={3}
                value={problemText}
                onChange={(e) => setProblemText(e.target.value)}
                placeholder="e.g. PC1 on VLAN 10 cannot ping Server1 on VLAN 20 across the trunk interface..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Template Presets */}
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                Or Select a Preset Cisco Lab Scenario:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_LOG_TEMPLATES.map((t, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      setProblemText(t.problem);
                      setCurrentCommand(t.command);
                      setCurrentLogs(t.output);
                    }}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-left transition-all"
                  >
                    <div className="text-xs font-bold text-cyan-300">{t.title}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-1 mt-1">{t.problem}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all"
            >
              Start Troubleshooting Session <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* STEP 2: LOG COLLECTION FORM (Iteration N) */}
      {activeStep === 2 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-400" />
              Step 2: Submit Cisco CLI Command Output (Iteration {currentIteration})
            </h2>
            <span className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
              Session ID: {sessionId?.slice(0, 8)}...
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Executed Command Name
              </label>
              <input
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                placeholder="show running-config / show ip interface brief / show interfaces trunk"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Paste Command Output from Packet Tracer Terminal
              </label>
              <textarea
                rows={6}
                value={currentLogs}
                onChange={(e) => setCurrentLogs(e.target.value)}
                placeholder="Paste command output here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmitIteration}
              disabled={loading || !currentLogs.trim()}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Python Rules & Gemini AI...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  Analyze Evidence & Generate Guidance
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 & 5: GUIDANCE & HUMAN REVIEW (Iteration N) */}
      {(activeStep === 4 || activeStep === 5 || activeStep === 6) && currentIterData && (
        <div className="space-y-6">
          {/* AI Guidance Box */}
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-6 lg:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Iteration {currentIterData.iteration_number} — NetSage AI Guidance
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  {currentIterData.ai_guidance?.what_i_found || 'Diagnostic Guidance Ready'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold">
                  {currentIterData.ai_guidance?.osi_layer || 'Layer 3'}
                </span>
                <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold">
                  {currentIterData.ai_guidance?.confidence || 'High'} Confidence
                </span>
              </div>
            </div>

            {/* Beginner Explanation */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                1. What I Found:
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                {currentIterData.ai_guidance?.what_i_found}
              </p>
            </div>

            {/* Evidence & Python Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Evidence Points */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                  2. Evidence Points:
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside font-mono">
                  {currentIterData.ai_guidance?.evidence?.map((ev: string, idx: number) => (
                    <li key={idx}>{ev}</li>
                  ))}
                </ul>
              </div>

              {/* Python Deterministic Rule Results */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
                  <span>3. Python Rule Checker Results:</span>
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {currentIterData.rule_results?.map((r: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-mono py-1 border-b border-slate-900">
                      <span className="text-slate-300 truncate max-w-[180px]">{r.rule_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">{r.severity}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.status === 'PASS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommended Next Action & Packet Tracer Fix Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Next CLI Command to Run */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" /> Next Command to Run:
                </div>
                <div className="bg-slate-900 px-3 py-2 rounded-lg text-sm text-cyan-300 font-mono border border-slate-800">
                  {currentIterData.ai_guidance?.next_command}
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  {currentIterData.ai_guidance?.why_this_command}
                </p>
              </div>

              {/* Packet Tracer Fix Steps */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Recommended Packet Tracer Fix:
                </div>
                <ul className="text-xs text-slate-300 space-y-1 font-mono">
                  {currentIterData.ai_guidance?.fix_steps?.map((step: string, idx: number) => (
                    <li key={idx} className="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 text-emerald-300">
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* MANDATORY HUMAN REVIEW SECTION (Step 5) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  Mandatory Human Review (Step 5)
                </div>
                {reviewDecision && (
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                    Reviewed: {reviewDecision}
                  </span>
                )}
              </div>

              {!reviewDecision ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 font-sans">
                    As part of the Responsible AI workflow, verify the AI guidance before applying configuration in Packet Tracer:
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleSubmitReview('ACCEPT')}
                      className="px-5 py-2.5 rounded-xl font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Accept Guidance
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewDecision('EDIT')}
                      className="px-5 py-2.5 rounded-xl font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Edit3 className="w-4 h-4" /> Edit Diagnosis
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewDecision('REJECT')}
                      className="px-5 py-2.5 rounded-xl font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <XCircle className="w-4 h-4" /> Reject Guidance
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {(reviewDecision === 'EDIT' || reviewDecision === 'REJECT') && (
                    <div className="space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1 font-mono">Feedback Explanation</label>
                        <input
                          type="text"
                          value={reviewFeedback}
                          onChange={(e) => setReviewFeedback(e.target.value)}
                          placeholder="Explain why guidance requires modification..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 6: Packet Tracer Fix & Re-test */}
                  <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-2">
                        <Terminal className="w-4 h-4" />
                        Step 6: Apply Fix in Packet Tracer & Submit Verification Evidence
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 font-sans space-y-2">
                      <p>1. Open Packet Tracer and apply the recommended fix configuration.</p>
                      <p>2. Execute the verification command: <code className="text-cyan-300 bg-slate-950 px-2 py-0.5 rounded font-mono">{currentIterData.ai_guidance?.next_command}</code></p>
                      <p>3. Click below to paste your NEW CLI output for Iteration {currentIteration + 1} verification.</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartNextIteration}
                      className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white shadow-lg text-xs flex items-center gap-2 transition-all"
                    >
                      <Send className="w-4 h-4" />
                      Submit New Output for Iteration {currentIteration + 1} Retest
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complete Iteration History Timeline */}
      {iterationsHistory.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Session Troubleshooting History ({iterationsHistory.length} Iterations)
          </h3>

          <div className="space-y-3 font-mono">
            {iterationsHistory.map((item, idx) => (
              <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cyan-400 font-bold">Iteration {item.iteration_number}</span>
                  <span className="text-slate-500">Command: {item.command}</span>
                </div>
                <div className="text-xs text-slate-300 line-clamp-2">{item.ai_guidance?.what_i_found}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
