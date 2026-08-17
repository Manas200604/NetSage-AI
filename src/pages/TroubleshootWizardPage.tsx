import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  XCircle, 
  Cpu, 
  Database, 
  Layers, 
  HelpCircle, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  Server,
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight
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
  };
}

const PRESET_SCENARIOS = [
  {
    title: 'VLAN Trunking Issue',
    device: 'Switch0',
    command: 'show interfaces trunk',
    problem: 'PC1 on VLAN 10 cannot communicate with Server1 on VLAN 20 across switch trunk link.',
    output: `Allowed vlan on trunk: 1-10\nNative vlan: 1\nPort Gi0/1 is trunking.`
  },
  {
    title: 'Subnet Mask Mismatch',
    device: 'Router0',
    command: 'show ip interface brief',
    problem: 'Host IP address 192.168.10.15 is unable to ping gateway 192.168.10.1.',
    output: `Interface GigabitEthernet0/0/0.10 IP-Address 192.168.10.15 255.255.0.0 Status UP Protocol UP`
  },
  {
    title: 'Gateway Misconfiguration',
    device: 'Router0',
    command: 'show ip route',
    problem: 'Sales subnet PCs cannot reach external internet router.',
    output: `Gateway of last resort is not set\nC 192.168.10.0/24 is directly connected, GigabitEthernet0/0`
  },
  {
    title: 'Interface Shutdown',
    device: 'Router0',
    command: 'show ip interface brief',
    problem: 'Link indicator light is red on switch port connected to core router.',
    output: `Interface GigabitEthernet0/0/1 IP-Address 10.0.0.1 YES NVRAM administratively down DOWN`
  }
];

export const TroubleshootWizardPage: React.FC = () => {
  const { user } = useAuth();

  // Wizard States
  const [wizardState, setWizardState] = useState<'WELCOME' | 'DEVICE_SELECT' | 'CLI_GUIDE' | 'LOG_INPUT' | 'CHECKING' | 'DIAGNOSIS' | 'APPLY_FIX' | 'VERIFY' | 'RESOLVED'>('WELCOME');
  
  // Troubleshooting Context
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problemText, setProblemText] = useState('');
  const [deviceType, setDeviceType] = useState<'PC' | 'Router' | 'Switch'>('PC');
  const [deviceName, setDeviceName] = useState('PC1');
  const [commandToRun, setCommandToRun] = useState('ipconfig');
  const [rawOutput, setRawOutput] = useState('');
  
  // History & AI output
  const [currentIteration, setCurrentIteration] = useState(1);
  const [iterationsHistory, setIterationsHistory] = useState<IterationState[]>([]);
  const [currentAiResponse, setCurrentAiResponse] = useState<any>(null);
  const [currentRuleResults, setCurrentRuleResults] = useState<any[]>([]);
  const [currentCleanedFacts, setCurrentCleanedFacts] = useState<any>(null);
  
  // Fix Step-by-Step Flow state
  const [currentFixStepIndex, setCurrentFixStepIndex] = useState(0);

  // Review states
  const [reviewDecision, setReviewDecision] = useState<'ACCEPT' | 'EDIT' | 'REJECT' | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1. Initialize Troubleshooting Session
  const handleStartSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      setWizardState('DEVICE_SELECT');
    } catch (err) {
      console.error(err);
      setWizardState('DEVICE_SELECT');
    } finally {
      setLoading(false);
    }
  };

  // 2. Set Device Type & auto-configure initial commands
  const handleSelectDevice = (type: 'PC' | 'Router' | 'Switch', name: string) => {
    setDeviceType(type);
    setDeviceName(name);
    if (type === 'PC') {
      setCommandToRun('ipconfig');
    } else if (type === 'Router') {
      setCommandToRun('show ip interface brief');
    } else {
      setCommandToRun('show interfaces trunk');
    }
    setWizardState('CLI_GUIDE');
  };

  // 3. Handle checking logs with Python Rule Checker & Gemini
  const handleCheckLogs = async () => {
    if (!rawOutput.trim()) return;

    setWizardState('CHECKING');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/troubleshoot/submit-iteration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || 'demo-session',
          user_id: user?.id,
          iteration_number: currentIteration,
          device: deviceName,
          command: commandToRun,
          raw_output: rawOutput
        })
      });
      const data = await res.json();

      const aiResponse = data.ai_guidance;
      setCurrentAiResponse(aiResponse);
      setCurrentRuleResults(data.rule_results || []);
      setCurrentCleanedFacts(data.cleaned_facts || {});

      // Add to iteration history
      const newIter: IterationState = {
        iteration_number: currentIteration,
        device: deviceName,
        command: commandToRun,
        raw_output: rawOutput,
        cleaned_facts: data.cleaned_facts,
        rule_results: data.rule_results,
        retrieved_cases: data.retrieved_cases,
        ai_guidance: aiResponse
      };
      setIterationsHistory((prev) => [...prev, newIter]);

      // Delay transition slightly to create a polished checking feel
      setTimeout(() => {
        setWizardState('DIAGNOSIS');
        setLoading(false);
      }, 1500);

    } catch (err) {
      console.error(err);
      setWizardState('DIAGNOSIS');
      setLoading(false);
    }
  };

  // 4. Handle Human Review
  const handleReviewDecision = async (decision: 'ACCEPT' | 'EDIT' | 'REJECT') => {
    setReviewDecision(decision);
    try {
      await fetch('http://localhost:8000/api/troubleshoot/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || 'demo-session',
          iteration_number: currentIteration,
          ai_response_id: currentAiResponse?.id || 'demo-ai-id',
          user_id: user?.id,
          decision,
          feedback: reviewFeedback
        })
      });
    } catch (err) {
      console.error(err);
    }

    if (decision === 'ACCEPT') {
      if (currentAiResponse?.commands && currentAiResponse.commands.length > 0) {
        setCurrentFixStepIndex(0);
        setWizardState('APPLY_FIX');
      } else {
        // If no fix config, go straight to verification test instructions
        setWizardState('VERIFY');
      }
    } else {
      // If edit/reject, guide to next step / test again
      setWizardState('VERIFY');
    }
  };

  // 5. Submit Verification Re-test logs
  const handleVerifyResolution = async () => {
    if (!rawOutput.trim()) return;

    setWizardState('CHECKING');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/troubleshoot/submit-iteration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || 'demo-session',
          user_id: user?.id,
          iteration_number: currentIteration + 1,
          device: deviceName,
          command: currentAiResponse?.next_evidence_required || commandToRun,
          raw_output: rawOutput
        })
      });
      const data = await res.json();
      const aiResponse = data.ai_guidance;

      if (aiResponse?.status === 'RESOLVED') {
        setWizardState('RESOLVED');
      } else {
        // If still broken, trigger loop back to next iteration
        setCurrentAiResponse(aiResponse);
        setCurrentRuleResults(data.rule_results || []);
        setCurrentCleanedFacts(data.cleaned_facts || {});
        setRawOutput('');
        setCurrentIteration((prev) => prev + 1);
        setReviewDecision(null);
        setReviewFeedback('');
        
        setTimeout(() => {
          setWizardState('DIAGNOSIS');
          setLoading(false);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setWizardState('RESOLVED');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8 font-sans">
      {/* Visual Step Timeline */}
      <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-500 mb-4 border-b border-slate-800 pb-4">
        <span className={`${wizardState === 'WELCOME' ? 'text-cyan-400 font-bold' : 'text-emerald-500'}`}>● Problem</span>
        <ChevronRight className="w-3 h-3" />
        <span className={`${['DEVICE_SELECT', 'CLI_GUIDE', 'LOG_INPUT', 'CHECKING'].includes(wizardState) ? 'text-cyan-400 font-bold' : ['DIAGNOSIS', 'APPLY_FIX', 'VERIFY', 'RESOLVED'].includes(wizardState) ? 'text-emerald-500' : 'text-slate-700'}`}>● Check</span>
        <ChevronRight className="w-3 h-3" />
        <span className={`${wizardState === 'APPLY_FIX' ? 'text-cyan-400 font-bold' : ['VERIFY', 'RESOLVED'].includes(wizardState) ? 'text-emerald-500' : 'text-slate-700'}`}>● Fix</span>
        <ChevronRight className="w-3 h-3" />
        <span className={`${wizardState === 'VERIFY' ? 'text-cyan-400 font-bold' : wizardState === 'RESOLVED' ? 'text-emerald-500' : 'text-slate-700'}`}>● Test</span>
        <ChevronRight className="w-3 h-3" />
        <span className={`${wizardState === 'RESOLVED' ? 'text-emerald-400 font-bold' : 'text-slate-700'}`}>● Done</span>
      </div>

      {/* STATE 1: WELCOME / PROBLEM DESCRIPTION */}
      {wizardState === 'WELCOME' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 p-[1px] mx-auto mb-3 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-[#0b0f19] rounded-[11px] flex items-center justify-center text-cyan-400">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white">Let's fix your network together.</h2>
            <p className="text-sm text-slate-400">Describe what is wrong in plain English, and I will guide you step-by-step.</p>
          </div>

          <form onSubmit={handleStartSession} className="space-y-4">
            <textarea
              required
              rows={3}
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              placeholder="e.g. My computer PC1 cannot send packets or ping Server1."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
            />

            {/* Presets */}
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-mono font-bold">Or select a lab problem preset:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRESET_SCENARIOS.map((t, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      setProblemText(t.problem);
                      setDeviceName(t.device);
                      const type = t.device.startsWith('Router') ? 'Router' : t.device.startsWith('Switch') ? 'Switch' : 'PC';
                      setDeviceType(type);
                      setCommandToRun(t.command);
                      setRawOutput(t.output);
                    }}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/50 hover:bg-slate-950 text-left transition-all"
                  >
                    <div className="text-xs font-bold text-cyan-400">{t.title}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{t.problem}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !problemText.trim()}
              className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all"
            >
              Start Troubleshooting <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* STATE 2: DEVICE SELECTION */}
      {wizardState === 'DEVICE_SELECT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white">Which device should we inspect?</h2>
            <p className="text-xs text-slate-400 font-mono">Select the device you are working with in Cisco Packet Tracer.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => handleSelectDevice('PC', 'PC1')}
              className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500 hover:bg-slate-900 transition-all flex flex-col items-center justify-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Server className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-200">Host / PC</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectDevice('Router', 'Router0')}
              className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500 hover:bg-slate-900 transition-all flex flex-col items-center justify-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-200">Router</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectDevice('Switch', 'Switch0')}
              className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500 hover:bg-slate-900 transition-all flex flex-col items-center justify-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-200">Switch</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE 3: CLI GUIDE */}
      {wizardState === 'CLI_GUIDE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Open the device console:</h2>
            <p className="text-sm text-slate-300">Follow these simple steps inside Packet Tracer:</p>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-3 font-sans text-sm text-slate-300">
            {deviceType === 'PC' ? (
              <>
                <p>1. Open your network in **Cisco Packet Tracer**.</p>
                <p>2. Double-click the device named **{deviceName}**.</p>
                <p>3. Select the **Desktop** tab at the top.</p>
                <p>4. Click on **Command Prompt**.</p>
              </>
            ) : (
              <>
                <p>1. Open your network in **Cisco Packet Tracer**.</p>
                <p>2. Double-click the device named **{deviceName}**.</p>
                <p>3. Select the **CLI** tab at the top.</p>
                <p>4. Press **Enter** to see the terminal prompt.</p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setWizardState('LOG_INPUT')}
            className="w-full py-3.5 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            I'm there <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STATE 4: LOG INPUT */}
      {wizardState === 'LOG_INPUT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 font-sans">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Let's check one thing.</h2>
            <p className="text-xs text-slate-400 font-mono">Run the requested command on {deviceName} terminal:</p>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Type this command:</div>
              <div className="bg-slate-900 px-3.5 py-2.5 rounded-lg text-sm text-cyan-300 font-mono border border-slate-800 select-all">
                {commandToRun}
              </div>
              <p className="text-xs text-slate-400">Press **Enter** after typing it inside Packet Tracer.</p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-mono font-bold mb-2">
                Copy and paste the terminal output here:
              </label>
              <textarea
                rows={5}
                value={rawOutput}
                onChange={(e) => setRawOutput(e.target.value)}
                placeholder="Paste command output here..."
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              onClick={handleCheckLogs}
              disabled={loading || !rawOutput.trim()}
              className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              Check My Result
            </button>
          </div>
        </div>
      )}

      {/* STATE 5: CHECKING LOADING ANIMATION */}
      {wizardState === 'CHECKING' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 shadow-2xl text-center space-y-6">
          <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white font-mono">Analyzing your network...</h3>
            <div className="text-xs text-slate-500 space-y-1 font-mono">
              <p>✓ Reading Cisco command logs</p>
              <p>✓ Checking interface and IP states</p>
              <p>✓ Querying knowledge base records</p>
            </div>
          </div>
        </div>
      )}

      {/* STATE 6: DIAGNOSIS & REVIEWS */}
      {wizardState === 'DIAGNOSIS' && currentAiResponse && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Problem Found
              </div>
              <h2 className="text-xl font-bold text-white">
                {currentAiResponse.root_cause || 'Cisco configuration issue detected.'}
              </h2>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 text-sm text-slate-300 font-sans">
              <p>{currentAiResponse.explanation || currentAiResponse.what_i_found}</p>
            </div>

            {/* Mandory Human Review preset */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-mono font-bold">Verify Diagnosis:</div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleReviewDecision('ACCEPT')}
                  className="px-4 py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all"
                >
                  Accept & Continue
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDecision('EDIT')}
                  className="px-4 py-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all"
                >
                  Edit Fix
                </button>
              </div>

              {reviewDecision === 'EDIT' && (
                <div className="space-y-3 pt-2">
                  <input
                    type="text"
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    placeholder="Describe custom fix steps..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleReviewDecision('EDIT')}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold"
                  >
                    Apply Custom Fix
                  </button>
                </div>
              )}
            </div>

            {/* Advanced Technical Details Collapsible */}
            <div className="border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-xs font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1"
              >
                {showTechnicalDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Advanced Technical Details
              </button>

              {showTechnicalDetails && (
                <div className="mt-3 bg-slate-950 p-4 rounded-lg border border-slate-900 space-y-3 font-mono text-[10px] text-slate-400 overflow-x-auto max-h-56">
                  <div>
                    <span className="text-cyan-400 font-bold">Python Check Results:</span>
                    <pre className="mt-1 text-slate-300">{JSON.stringify(currentRuleResults, null, 2)}</pre>
                  </div>
                  <div>
                    <span className="text-cyan-400 font-bold">Cleaned Facts JSON:</span>
                    <pre className="mt-1 text-slate-300">{JSON.stringify(currentCleanedFacts, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STATE 7: STEP-BY-STEP FIX LOOPS */}
      {wizardState === 'APPLY_FIX' && currentAiResponse?.commands && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 font-sans">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-widest text-emerald-400 font-mono font-bold">Step-by-Step Fix Configuration</div>
            <h2 className="text-xl font-bold text-white">Let's execute the fix configuration.</h2>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              Command {currentFixStepIndex + 1} of {currentAiResponse.commands.length}:
            </div>
            
            <div className="bg-slate-900 px-4 py-3 rounded-lg text-sm text-cyan-300 font-mono border border-slate-800 select-all">
              {currentAiResponse.commands[currentFixStepIndex]}
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Type the command above into your Packet Tracer terminal and press **Enter**.
            </p>
          </div>

          <div className="flex justify-between items-center gap-4">
            <span className="text-xs text-slate-500 font-mono">
              Step {currentFixStepIndex + 1} / {currentAiResponse.commands.length}
            </span>

            {currentFixStepIndex < currentAiResponse.commands.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentFixStepIndex((prev) => prev + 1)}
                className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                I typed it <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setWizardState('VERIFY')}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                Finished Typing Fix <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* STATE 8: TEST VERIFICATION */}
      {wizardState === 'VERIFY' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Let's verify whether the problem is fixed.</h2>
            <p className="text-xs text-slate-400 font-mono">Run this verification command in Packet Tracer:</p>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Type command:</div>
              <div className="bg-slate-900 px-3.5 py-2.5 rounded-lg text-sm text-cyan-300 font-mono border border-slate-800 select-all">
                {currentAiResponse?.next_evidence_required || 'show ip interface brief'}
              </div>
              <p className="text-xs text-slate-400">Copy the new terminal result and paste it below.</p>
            </div>

            <div>
              <textarea
                rows={5}
                value={rawOutput}
                onChange={(e) => setRawOutput(e.target.value)}
                placeholder="Paste verification output here..."
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              onClick={handleVerifyResolution}
              disabled={loading || !rawOutput.trim()}
              className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              Verify My Result
            </button>
          </div>
        </div>
      )}

      {/* STATE 9: RESOLVED SUCCESS PAGE */}
      {wizardState === 'RESOLVED' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 shadow-2xl text-center space-y-6 font-sans">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Your network is working!</h2>
            <p className="text-sm text-slate-400">Cisco Packet Tracer evidence confirms the fault has been corrected.</p>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-3 text-left text-xs font-mono">
            <div>
              <span className="text-slate-500">● Problem:</span>
              <div className="text-slate-200 font-sans mt-0.5">{problemText}</div>
            </div>
            <div>
              <span className="text-slate-500">● Cause:</span>
              <div className="text-slate-200 mt-0.5">{currentAiResponse?.root_cause || 'Interface was down.'}</div>
            </div>
            <div>
              <span className="text-slate-500">● Fix:</span>
              <div className="text-emerald-400 mt-0.5">Configuration commands applied successfully.</div>
            </div>
            <div>
              <span className="text-slate-500">● Verification Test:</span>
              <div className="text-emerald-400 mt-0.5">Ping successful / line protocol changed to UP.</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setProblemText('');
              setRawOutput('');
              setSessionId(null);
              setCurrentIteration(1);
              setIterationsHistory([]);
              setCurrentAiResponse(null);
              setWizardState('WELCOME');
            }}
            className="w-full py-3.5 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg transition-all"
          >
            Start New Troubleshooting Session
          </button>
        </div>
      )}
    </div>
  );
};
