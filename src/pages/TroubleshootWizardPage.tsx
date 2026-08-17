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
  Send,
  Server
} from 'lucide-react';

interface IterationState {
  iteration_number: number;
  device: string;
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

const DEVICE_OPTIONS = ['Router0', 'Switch0', 'Switch1', 'PC1', 'Server1', 'Other'];
const COMMAND_OPTIONS = [
  'show ip interface brief',
  'show running-config',
  'show vlan brief',
  'show interfaces trunk',
  'show ip route',
  'show ip arp',
  'show access-lists',
  'show ip nat translations'
];

const PRESET_LOG_TEMPLATES = [
  {
    title: 'VLAN Trunking Issue (Layer 2)',
    device: 'Switch0',
    command: 'show interfaces trunk',
    problem: 'PC1 on VLAN 10 cannot communicate with Server1 on VLAN 20 across switch trunk link.',
    output: `Allowed vlan on trunk: 1-10\nNative vlan: 1\nPort Gi0/1 is trunking.`
  },
  {
    title: 'Subnet Mask Mismatch (Layer 3)',
    device: 'Router0',
    command: 'show ip interface brief',
    problem: 'Host IP address 192.168.10.15 is unable to ping gateway 192.168.10.1.',
    output: `Interface GigabitEthernet0/0/0.10 IP-Address 192.168.10.15 255.255.0.0 Status UP Protocol UP`
  },
  {
    title: 'Gateway Misconfiguration (Layer 3)',
    device: 'Router0',
    command: 'show ip route',
    problem: 'Sales subnet PCs cannot reach external internet router.',
    output: `Gateway of last resort is not set\nC 192.168.10.0/24 is directly connected, GigabitEthernet0/0`
  },
  {
    title: 'Interface Shutdown (Layer 1/2)',
    device: 'Router0',
    command: 'show ip interface brief',
    problem: 'Link indicator light is red on switch port connected to core router.',
    output: `Interface GigabitEthernet0/0/1 IP-Address 10.0.0.1 YES NVRAM administratively down DOWN`
  }
];

export const TroubleshootWizardPage: React.FC = () => {
  const { user } = useAuth();
  
  // Session & Phase 1 Form State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problemText, setProblemText] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('Router0');
  const [selectedCommand, setSelectedCommand] = useState('show ip interface brief');
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

  // 1. Start Session
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

  // 2. Submit Iteration CLI Output (Python Checker -> Dataset -> Gemini API)
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
          device: selectedDevice,
          command: selectedCommand,
          raw_output: currentLogs
        })
      });
      const data = await res.json();

      const newIter: IterationState = {
        iteration_number: currentIteration,
        device: selectedDevice,
        command: selectedCommand,
        raw_output: currentLogs,
        cleaned_facts: data.cleaned_facts,
        rule_results: data.rule_results,
        retrieved_cases: data.retrieved_cases,
        ai_guidance: data.ai_guidance
      };

      setIterationsHistory((prev) => [...prev, newIter]);
      
      if (data.ai_guidance?.status === 'RESOLVED') {
        setIsResolved(true);
      }
      
      setActiveStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Human Review Decision
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

  // 4. Start Next Iteration for Packet Tracer Verification
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
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Phase 1 Implementation</div>
            <h1 className="text-2xl font-bold text-white">Cisco CLI-Based Iterative Troubleshooter</h1>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Python Checker parses CLI evidence → TF-IDF retrieves 255+ Supabase cases → Gemini AI provides guided Packet Tracer fixes.
        </p>
      </div>

      {/* 11-Step Session Visual Timeline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 font-mono">
        {[
          { step: 1, title: 'Problem', desc: 'Describe Issue' },
          { step: 2, title: 'CLI Evidence', desc: 'Paste Logs' },
          { step: 3, title: 'Python Checker', desc: 'SEV Findings' },
          { step: 4, title: 'Gemini AI', desc: 'Diagnosis' },
          { step: 5, title: 'Human Review', desc: 'Accept/Edit' },
          { step: 6, title: 'Packet Tracer', desc: 'Retest & Verify' }
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
            <div className="text-xs font-bold flex items-center justify-between">
              <span>{s.title}</span>
              {activeStep > s.step && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* STEP 1: PROBLEM DESCRIPTION SECTION */}
      {activeStep === 1 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Describe Networking Problem
          </h2>

          <form onSubmit={handleStartSession} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Problem Statement / Symptom
              </label>
              <textarea
                required
                rows={3}
                value={problemText}
                onChange={(e) => setProblemText(e.target.value)}
                placeholder="e.g. PC1 cannot ping Server1 on VLAN 20..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Presets */}
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                Or Click to Load a Packet Tracer Scenario:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_LOG_TEMPLATES.map((t, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      setProblemText(t.problem);
                      setSelectedDevice(t.device);
                      setSelectedCommand(t.command);
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
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all"
            >
              Start Troubleshooting Session <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* STEP 2: CLI EVIDENCE SECTION (Device + Command + Output) */}
      {activeStep === 2 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-400" />
              CLI Evidence Collection (Iteration {currentIteration})
            </h2>
            <span className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
              Session ID: {sessionId?.slice(0, 8)}...
            </span>
          </div>

          <div className="space-y-4 font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Device Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-cyan-400" /> Device Name:
                </label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {DEVICE_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Command Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-cyan-400" /> Cisco CLI Command:
                </label>
                <select
                  value={selectedCommand}
                  onChange={(e) => setSelectedCommand(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {COMMAND_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* CLI Output Area */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Paste Cisco CLI Output from Packet Tracer:
              </label>
              <textarea
                rows={6}
                value={currentLogs}
                onChange={(e) => setCurrentLogs(e.target.value)}
                placeholder="Paste command output here (e.g., show ip interface brief / show running-config)..."
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
                  Running Python Checker & Gemini AI...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  Analyze Evidence with Python & Gemini AI
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4, 5, 6: AI DIAGNOSIS, HUMAN REVIEW, & PACKET TRACER FIX */}
      {(activeStep === 4 || activeStep === 5 || activeStep === 6) && currentIterData && (
        <div className="space-y-6">
          {/* Phase 1 AI Guidance Box */}
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-6 lg:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 font-mono">
              <div>
                <span className="text-xs uppercase tracking-widest text-cyan-400 flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Iteration {currentIterData.iteration_number} Diagnosis ({currentIterData.device})
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  {currentIterData.ai_guidance?.root_cause || 'CLI Analysis Complete'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
                  {currentIterData.ai_guidance?.osi_layer || 'Layer 3'}
                </span>
                <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                  {currentIterData.ai_guidance?.confidence || 'High'} Confidence
                </span>
              </div>
            </div>

            {/* Explanation & Fix */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                1. AI Explanation:
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                {currentIterData.ai_guidance?.explanation || currentIterData.ai_guidance?.what_i_found}
              </p>
            </div>

            {/* Python Checker Findings Table */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
                <span>2. Python Checker Structured Findings:</span>
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="space-y-2">
                {currentIterData.rule_results?.map((r: any, idx: number) => (
                  <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-slate-200">{r.rule_name} ({r.type || 'CHECK'})</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{r.finding}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-bold">{r.severity}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === 'PASS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Fix & Packet Tracer Configuration Commands */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
              {/* Fix Instructions */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Recommended Fix:
                </div>
                <p className="text-xs text-slate-300 font-sans">
                  {currentIterData.ai_guidance?.recommended_fix}
                </p>
                <div className="mt-2 space-y-1">
                  {currentIterData.ai_guidance?.commands?.map((cmd: string, idx: number) => (
                    <div key={idx} className="bg-slate-900 px-3 py-1.5 rounded text-xs text-cyan-300 border border-slate-800 font-mono">
                      {cmd}
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Steps */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" /> Next Command Required:
                </div>
                <div className="bg-slate-900 px-3 py-2 rounded-lg text-xs text-cyan-300 font-mono border border-slate-800 font-bold">
                  {currentIterData.ai_guidance?.next_evidence_required || currentIterData.ai_guidance?.next_command}
                </div>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  {currentIterData.ai_guidance?.expected_output}
                </p>
              </div>
            </div>

            {/* MANDATORY HUMAN REVIEW SECTION (Step 5) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 font-mono">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  Mandatory Human Review (Step 5)
                </div>
                {reviewDecision && (
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    Reviewed: {reviewDecision}
                  </span>
                )}
              </div>

              {!reviewDecision ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 font-sans">
                    Verify the AI diagnosis before applying configuration in Packet Tracer:
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleSubmitReview('ACCEPT')}
                      className="px-5 py-2.5 rounded-xl font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewDecision('EDIT')}
                      className="px-5 py-2.5 rounded-xl font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Edit3 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewDecision('REJECT')}
                      className="px-5 py-2.5 rounded-xl font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Step 6: Apply Fix in Packet Tracer & Retest */}
                  <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-5 space-y-4">
                    <div className="text-xs uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      Step 6: Apply Fix in Packet Tracer & Retest (Iteration {currentIteration + 1})
                    </div>

                    <div className="text-xs text-slate-300 font-sans space-y-2">
                      <p>1. Open your workspace in Cisco Packet Tracer.</p>
                      <p>2. Execute the recommended fix configuration on <code className="text-cyan-300 bg-slate-950 px-2 py-0.5 rounded font-mono">{currentIterData.device}</code>.</p>
                      <p>3. Run verification command: <code className="text-cyan-300 bg-slate-950 px-2 py-0.5 rounded font-mono">{currentIterData.ai_guidance?.next_evidence_required}</code></p>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartNextIteration}
                      className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white shadow-lg text-xs flex items-center gap-2 transition-all"
                    >
                      <Send className="w-4 h-4" />
                      Submit NEW CLI Evidence for Verification
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Session Iteration Timeline */}
      {iterationsHistory.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Troubleshooting Session Timeline ({iterationsHistory.length} Iterations)
          </h3>

          <div className="space-y-3 font-mono">
            {iterationsHistory.map((item, idx) => (
              <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cyan-400 font-bold">Iteration {item.iteration_number} ({item.device})</span>
                  <span className="text-slate-500">Command: {item.command}</span>
                </div>
                <div className="text-xs text-slate-300 line-clamp-2">
                  {item.ai_guidance?.root_cause || item.ai_guidance?.explanation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
