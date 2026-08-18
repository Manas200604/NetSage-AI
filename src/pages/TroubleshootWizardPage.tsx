import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  ChevronRight,
  Upload
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
  const location = useLocation();

  // Prefill troubleshooting wizard state if redirecting from Python Checker
  useEffect(() => {
    if (location.state && location.state.problemText) {
      const state = location.state;
      setProblemText(state.problemText);
      setDeviceName(state.deviceName);
      const type = state.deviceName.startsWith('Router') ? 'Router' : state.deviceName.startsWith('Switch') ? 'Switch' : 'PC';
      setDeviceType(type);
      setCommandToRun(state.command);
      setRawOutput(state.rawOutput || '');
      setWizardState('NAV_TAB');
    }
  }, [location.state]);

  // Wizard Navigation States
  const [wizardState, setWizardState] = useState<'WELCOME' | 'UPLOAD_IMAGE' | 'DEVICE_SELECT' | 'NAV_TAB' | 'IDENTIFY_PROMPT' | 'GUIDE_MODE' | 'COMMAND_INPUT' | 'CHECKING' | 'DIAGNOSIS' | 'APPLY_FIX' | 'VERIFY' | 'RESOLVED' | 'ERROR_RECOVERY'>('WELCOME');
  
  // Image-First Context
  const [topologyImageBase64, setTopologyImageBase64] = useState<string | null>(null);
  const [topologyUnderstanding, setTopologyUnderstanding] = useState<any>(null);
  const [suggestedCommands, setSuggestedCommands] = useState<any[]>([]);
  const [currentCommandIdx, setCurrentCommandIdx] = useState(0);

  // Troubleshooting Context
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problemText, setProblemText] = useState('');
  const [deviceType, setDeviceType] = useState<'PC' | 'Router' | 'Switch'>('PC');
  const [deviceName, setDeviceName] = useState('PC1');
  const [currentPrompt, setCurrentPrompt] = useState('Router>');
  const [commandToRun, setCommandToRun] = useState('ipconfig');
  const [rawOutput, setRawOutput] = useState('');

  // Mode guide sequence tracking
  const [modeGuideSteps, setModeGuideSteps] = useState<{ command: string; expected: string; label: string }[]>([]);
  const [currentModeGuideIndex, setCurrentModeGuideIndex] = useState(0);

  // History & AI output
  const [currentIteration, setCurrentIteration] = useState(1);
  const [iterationsHistory, setIterationsHistory] = useState<IterationState[]>([]);
  const [currentAiResponse, setCurrentAiResponse] = useState<any>(null);
  const [currentRuleResults, setCurrentRuleResults] = useState<any[]>([]);
  const [currentCleanedFacts, setCurrentCleanedFacts] = useState<any>(null);

  // Fix step loop state
  const [fixCommands, setFixCommands] = useState<string[]>([]);
  const [currentFixIndex, setCurrentFixIndex] = useState(0);

  // Review states
  const [reviewDecision, setReviewDecision] = useState<'ACCEPT' | 'EDIT' | 'REJECT' | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  // Discovers device names dynamically from problem descriptions
  const getDiscoveredDevices = (text: string): string[] => {
    const matches = text.match(/\b(PC\d+|Router\d+|Switch\d+|Server\d+|pc\d+|router\d+|switch\d+|server\d+)\b/g);
    if (matches) {
      const mapped = matches.map(m => {
        const clean = m.trim();
        if (clean.toLowerCase().startsWith('pc')) return 'PC' + clean.slice(2);
        if (clean.toLowerCase().startsWith('router')) return 'Router' + clean.slice(6);
        if (clean.toLowerCase().startsWith('switch')) return 'Switch' + clean.slice(6);
        if (clean.toLowerCase().startsWith('server')) return 'Server' + clean.slice(6);
        return clean;
      });
      return Array.from(new Set(mapped));
    }
    return [];
  };

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
      setWizardState('UPLOAD_IMAGE');
    } catch (err) {
      console.error(err);
      setSessionId('sess-' + Date.now());
      setWizardState('UPLOAD_IMAGE');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        setTopologyImageBase64(base64Data);

        const res = await fetch('http://localhost:8000/api/troubleshoot/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId || 'mock-session-id',
            image_base64: base64Data,
            problem_text: problemText
          })
        });
        const data = await res.json();
        setTopologyUnderstanding(data);
        setSuggestedCommands(data.suggested_commands || []);
        setCurrentCommandIdx(0);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error uploading image:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Set Device Type & Nav tab instructions
  const handleSelectDevice = (type: 'PC' | 'Router' | 'Switch', name: string) => {
    setDeviceType(type);
    setDeviceName(name);
    setWizardState('NAV_TAB');
  };

  // 3. Formulate mode guide commands based on user's current prompt
  const handleIdentifyPrompt = (prompt: string) => {
    setCurrentPrompt(prompt);
    
    if (deviceType === 'PC') {
      if (prompt !== 'C:\\>') {
        // Warning: PC Command Prompt check
        setCurrentPrompt('C:\\>');
      }
      setCommandToRun('ipconfig');
      setWizardState('COMMAND_INPUT');
      return;
    }

    // Cisco IOS Router/Switch Mode Transitions
    const prefix = deviceType === 'Router' ? 'Router' : 'Switch';
    const steps: { command: string; expected: string; label: string }[] = [];

    if (prompt === `${prefix}>`) {
      steps.push({ command: 'enable', expected: `${prefix}#`, label: 'Enter Privileged Exec Mode' });
    }
    
    // We want to run show commands at Privileged Exec Mode (e.g. Router#)
    if (prompt.includes('(config')) {
      steps.push({ command: 'end', expected: `${prefix}#`, label: 'Return to Privileged Mode' });
    }

    if (steps.length > 0) {
      setModeGuideSteps(steps);
      setCurrentModeGuideIndex(0);
      setWizardState('GUIDE_MODE');
    } else {
      // Already in correct show command mode (Router#)
      const initialCmd = deviceType === 'Router' ? 'show ip interface brief' : 'show interfaces trunk';
      setCommandToRun(initialCmd);
      setWizardState('COMMAND_INPUT');
    }
  };

  // 4. Handle checking logs with Python Rule Checker & Gemini
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

      // Add to history
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
      setRawOutput('');

      setTimeout(() => {
        if (aiResponse?.status === 'RESOLVED') {
          setWizardState('RESOLVED');
        } else if (aiResponse?.status === 'ERROR_DETECTED') {
          setWizardState('ERROR_RECOVERY');
        } else {
          setWizardState('DIAGNOSIS');
        }
        setLoading(false);
      }, 1500);

    } catch (err) {
      console.error(err);
      setWizardState('DIAGNOSIS');
      setLoading(false);
    }
  };

  // 5. Handle Human Review
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
      // Build step-by-step mode transitions for the actual config fix
      const prefix = deviceType === 'Router' ? 'Router' : 'Switch';
      const steps: { command: string; expected: string; label: string }[] = [];

      // Transition to config mode: enable -> configure terminal -> interface -> config-if
      steps.push({ command: 'enable', expected: `${prefix}#`, label: 'Enter Privileged Exec Mode' });
      steps.push({ command: 'configure terminal', expected: `${prefix}(config)#`, label: 'Enter Global Configuration Mode' });
      
      const rawFixCmds = currentAiResponse?.commands || [];
      const interfaceCmd = rawFixCmds.find((c: string) => c.toLowerCase().startsWith('interface '));
      const configCmds = rawFixCmds.filter((c: string) => !c.toLowerCase().startsWith('interface '));

      if (interfaceCmd) {
        steps.push({ command: interfaceCmd, expected: `${prefix}(config-if)#`, label: 'Select Network Interface' });
      }

      setModeGuideSteps(steps);
      setCurrentModeGuideIndex(0);
      setFixCommands(configCmds.length > 0 ? configCmds : ['no shutdown']);
      setCurrentFixIndex(0);
      setWizardState('GUIDE_MODE');
    } else {
      setWizardState('VERIFY');
    }
  };

  // 6. Mode guide next button
  const handleAdvanceModeGuide = () => {
    if (currentModeGuideIndex < modeGuideSteps.length - 1) {
      setCurrentModeGuideIndex((prev) => prev + 1);
    } else {
      // All mode transitions completed! Go to action stage
      if (reviewDecision === 'ACCEPT') {
        setWizardState('APPLY_FIX');
      } else {
        setWizardState('COMMAND_INPUT');
      }
    }
  };

  // 7. Verify Re-test logs
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
        setCurrentAiResponse(aiResponse);
        setCurrentRuleResults(data.rule_results || []);
        setCurrentCleanedFacts(data.cleaned_facts || {});
        setRawOutput('');
        setCurrentIteration((prev) => prev + 1);
        setReviewDecision(null);
        setReviewFeedback('');
        
        setTimeout(() => {
          if (aiResponse?.status === 'ERROR_DETECTED') {
            setWizardState('ERROR_RECOVERY');
          } else {
            setWizardState('DIAGNOSIS');
          }
          setLoading(false);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setWizardState('RESOLVED');
      setLoading(false);
    }
  };

  // 8. Realign prompt state if user clicks "Something Went Wrong"
  const handleRealignPrompt = (prompt: string) => {
    setWizardState('WELCOME');
    setProblemText('');
    setRawOutput('');
    setReviewDecision(null);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-8 font-sans">
      {/* Visual Progress Timeline */}
      <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-500 border-b border-slate-800 pb-4">
        <span className={`${wizardState === 'WELCOME' ? 'text-cyan-400 font-bold' : 'text-emerald-500'}`}>● Problem</span>
        <ChevronRight className="w-3 h-3" />
        <span className={`${['DEVICE_SELECT', 'NAV_TAB', 'IDENTIFY_PROMPT', 'GUIDE_MODE', 'COMMAND_INPUT', 'CHECKING'].includes(wizardState) ? 'text-cyan-400 font-bold' : ['DIAGNOSIS', 'APPLY_FIX', 'VERIFY', 'RESOLVED'].includes(wizardState) ? 'text-emerald-500' : 'text-slate-700'}`}>● Check</span>
        <ChevronRight className="w-3 h-3" />
        <span className={`${wizardState === 'APPLY_FIX' ? 'text-cyan-400 font-bold' : ['VERIFY', 'RESOLVED'].includes(wizardState) ? 'text-emerald-500' : 'text-slate-700'}`}>● Fix</span>
        <ChevronRight className="w-3 h-3" />
        <span className={`${wizardState === 'VERIFY' ? 'text-cyan-400 font-bold' : wizardState === 'RESOLVED' ? 'text-emerald-500' : 'text-slate-700'}`}>● Test</span>
        <ChevronRight className="w-3 h-3" />
        <span className={`${wizardState === 'RESOLVED' ? 'text-emerald-400 font-bold' : 'text-slate-700'}`}>● Done</span>
      </div>

      {/* STATE 1: WELCOME SCREEN */}
      {wizardState === 'WELCOME' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 p-[1px] mx-auto mb-3 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-[#0b0f19] rounded-[11px] flex items-center justify-center text-cyan-400">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white">Let's fix your network together.</h2>
            <p className="text-sm text-slate-400">You don't need to know Cisco commands. Just follow exactly what I tell you.</p>
          </div>

          <form onSubmit={handleStartSession} className="space-y-4">
            <textarea
              required
              rows={3}
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              placeholder="Describe your network problem..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
            />

            {/* Presets */}
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-mono font-bold">Or click to load a Packet Tracer case:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-850 hover:border-cyan-500/50 hover:bg-slate-950 text-left transition-all text-xs"
                  >
                    <div className="font-bold text-cyan-400">{t.title}</div>
                    <div className="text-slate-500 line-clamp-1 mt-0.5">{t.problem}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !problemText.trim()}
              className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              Start Troubleshooting <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* STATE: UPLOAD TOPOLOGY IMAGE */}
      {wizardState === 'UPLOAD_IMAGE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white">Let's understand your network first.</h2>
            <p className="text-sm text-slate-400">Upload a screenshot of your Cisco Packet Tracer topology diagram.</p>
          </div>

          {!topologyImageBase64 ? (
            <div className="border-2 border-dashed border-slate-800 rounded-2xl p-8 hover:border-cyan-500/50 transition-colors flex flex-col items-center justify-center gap-3 bg-slate-950/40 text-center">
              <Upload className="w-10 h-10 text-slate-500" />
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold block">Drag & drop or browse image</span>
                <span className="text-[10px] text-slate-600 block">Supports PNG, JPG, JPEG</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadImage(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="file-upload-topology"
              />
              <label
                htmlFor="file-upload-topology"
                className="mt-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white cursor-pointer rounded-lg text-xs font-bold text-slate-300 transition-all"
              >
                Choose Screenshot File
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 border border-emerald-950/50 bg-emerald-950/20 px-3.5 py-2.5 rounded-xl">
                <span>✓ Screenshot uploaded successfully</span>
              </div>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center p-6 space-y-3">
                  <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-mono text-cyan-400 animate-pulse">Analyzing network topology screenshot...</span>
                </div>
              ) : topologyUnderstanding ? (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 text-xs font-mono text-slate-400">
                    <div className="text-slate-200 font-bold">Topology Overview:</div>
                    <div>
                      <strong>Discovered Devices:</strong>{' '}
                      {topologyUnderstanding.devices?.map((d: any) => d.name).join(', ') || 'None'}
                    </div>
                    <div>
                      <strong>Suggested CLI Command Checklist:</strong>
                      <div className="space-y-1.5 mt-2">
                        {suggestedCommands.map((c: any, index: number) => (
                          <div key={index} className="flex items-center gap-1.5 text-slate-300">
                            <span className="text-cyan-400">→</span>
                            <span>On <strong className="text-white">{c.device}</strong> run <code className="text-cyan-400 bg-slate-900 px-1 py-0.5 rounded">{c.command}</code>: {c.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (suggestedCommands.length > 0) {
                        const firstCmd = suggestedCommands[0];
                        const type = firstCmd.device.toLowerCase().startsWith('router') ? 'Router' : firstCmd.device.toLowerCase().startsWith('switch') ? 'Switch' : 'PC';
                        setDeviceType(type);
                        setDeviceName(firstCmd.device);
                        setCommandToRun(firstCmd.command);
                        setWizardState('NAV_TAB');
                      } else {
                        setWizardState('DEVICE_SELECT');
                      }
                    }}
                    className="w-full py-3 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    Proceed to Check <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* STATE 2: DEVICE SELECTION CARD */}
      {wizardState === 'DEVICE_SELECT' && (() => {
        const discovered = getDiscoveredDevices(problemText);
        const availableDevices = discovered.length > 0 ? discovered : ['PC0', 'Router0', 'PC1'];
        
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-white">Which device are we inspecting?</h2>
              <p className="text-xs text-slate-400">Select the device you are troubleshooting from your network setup.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableDevices.map((dname) => {
                const type = dname.toLowerCase().startsWith('router') ? 'Router' : dname.toLowerCase().startsWith('switch') ? 'Switch' : 'PC';
                return (
                  <button
                    key={dname}
                    type="button"
                    onClick={() => handleSelectDevice(type, dname)}
                    className="p-5 rounded-xl bg-slate-950 border border-slate-850 hover:border-cyan-500 hover:bg-slate-900 transition-all flex flex-col items-center justify-center gap-3"
                  >
                    {type === 'PC' ? (
                      <Server className="w-5 h-5 text-cyan-400" />
                    ) : type === 'Router' ? (
                      <Layers className="w-5 h-5 text-blue-400" />
                    ) : (
                      <Cpu className="w-5 h-5 text-indigo-400" />
                    )}
                    <span className="text-sm font-bold text-slate-200">{dname}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* STATE 3: NAVIGATION TAB INSTRUCTIONS */}
      {wizardState === 'NAV_TAB' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          {deviceType === 'PC' ? (
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">STEP 1 — OPEN YOUR DEVICE</div>
              <h2 className="text-xl font-bold text-white">Find <span className="text-cyan-400 font-mono">{deviceName}</span> in your Packet Tracer workspace.</h2>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">STEP 1 — OPEN YOUR {deviceType.toUpperCase()}</div>
              <h2 className="text-xl font-bold text-white">Find <span className="text-cyan-400 font-mono">{deviceName}</span> in your Packet Tracer workspace.</h2>
            </div>
          )}

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-3 text-sm text-slate-300 font-sans">
            {deviceType === 'PC' ? (
              <>
                <p>1. Look at the network diagram in Cisco Packet Tracer.</p>
                <p>2. Find the device named **{deviceName}**.</p>
                <p>3. Click on it.</p>
                <p>4. Open the **Desktop** tab at the top.</p>
                <p>5. Click on **Command Prompt**.</p>
              </>
            ) : (
              <>
                <p>1. Look at the network diagram in Cisco Packet Tracer.</p>
                <p>2. Click **{deviceName}**.</p>
                <p>3. Open the **CLI** tab at the top.</p>
                <p>4. Press **Enter** to active the console prompt.</p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setWizardState('IDENTIFY_PROMPT')}
            className="w-full py-3.5 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            I'm there <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STATE 4: IDENTIFY CURRENT CLI PROMPT */}
      {wizardState === 'IDENTIFY_PROMPT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 font-sans">
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">Step 2 — Identify CLI State</div>
            <h2 className="text-xl font-bold text-white">What do you see at the start of your line?</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {deviceType === 'PC' ? (
              <button
                type="button"
                onClick={() => handleIdentifyPrompt('C:\\>')}
                className="p-4 rounded-xl bg-slate-950 border border-slate-850 hover:border-cyan-500 text-left font-mono text-xs text-cyan-300 transition-all"
              >
                {"C:\\>"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleIdentifyPrompt('Router>')}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-850 hover:border-cyan-500 text-left font-mono text-xs text-cyan-300 transition-all"
                >
                  Router&gt; (Basic)
                </button>
                <button
                  type="button"
                  onClick={() => handleIdentifyPrompt('Router#')}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-850 hover:border-cyan-500 text-left font-mono text-xs text-cyan-300 transition-all"
                >
                  Router# (Privileged)
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* STATE 5: MODE GUIDES (enable, configure terminal, select interface) */}
      {wizardState === 'GUIDE_MODE' && modeGuideSteps.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-bold">
              {modeGuideSteps[currentModeGuideIndex].label}
            </div>
            <h2 className="text-xl font-bold text-white">Let's enter the correct CLI mode.</h2>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-3 font-mono">
            <div>
              <span className="text-xs text-slate-500">What you type:</span>
              <div className="bg-slate-900 px-3.5 py-2.5 rounded-lg text-sm text-cyan-300 border border-slate-800 select-all font-bold">
                {modeGuideSteps[currentModeGuideIndex].command}
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500">What you should see after pressing Enter:</span>
              <div className="text-xs text-emerald-400 font-bold mt-1">
                {modeGuideSteps[currentModeGuideIndex].expected}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center gap-4">
            <button
              type="button"
              onClick={() => setWizardState('ERROR_RECOVERY')}
              className="text-xs text-rose-400 font-bold hover:underline"
            >
              Something Went Wrong
            </button>

            <button
              type="button"
              onClick={handleAdvanceModeGuide}
              className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              I See {modeGuideSteps[currentModeGuideIndex].expected}
            </button>
          </div>
        </div>
      )}

      {/* STATE 6: COMMAND INPUT */}
      {wizardState === 'COMMAND_INPUT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-bold">Gathering Evidence</div>
            <h2 className="text-xl font-bold text-white">Let's run our verification check.</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 font-mono text-xs">
              <span className="text-slate-500">Type this command:</span>
              <div className="bg-slate-900 px-3.5 py-2.5 rounded-lg text-sm text-cyan-300 border border-slate-800 font-bold select-all">
                {commandToRun}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-mono font-bold mb-2">
                Paste the terminal logs below:
              </label>
              <textarea
                rows={5}
                value={rawOutput}
                onChange={(e) => setRawOutput(e.target.value)}
                placeholder="Paste command output here..."
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-cyan-300 font-mono focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleCheckLogs}
              disabled={loading || !rawOutput.trim()}
              className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white shadow-lg transition-all"
            >
              Check My Result
            </button>
          </div>
        </div>
      )}

      {/* STATE 7: CHECKING LOADING ANIMATION */}
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

      {/* STATE 8: DIAGNOSIS & REVIEWS */}
      {wizardState === 'DIAGNOSIS' && currentAiResponse && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              I found the problem.
            </div>
            <h2 className="text-xl font-bold text-white">
              {currentAiResponse.root_cause || 'Cisco configuration issue detected.'}
            </h2>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 text-sm text-slate-300 font-sans">
            <p>{currentAiResponse.explanation || currentAiResponse.what_i_found}</p>
          </div>

          {/* Human Review buttons */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4 font-mono">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Verify Diagnosis:</div>
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
                  className="w-full bg-slate-900 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white"
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
      )}

      {/* STATE 9: APPLY INDIVIDUAL FIX CONFIG COMMANDS (one by one) */}
      {wizardState === 'APPLY_FIX' && fixCommands.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 font-sans">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-widest text-emerald-400 font-mono font-bold">Step 3 — Execute configuration command</div>
            <h2 className="text-xl font-bold text-white">We're ready to fix the connection.</h2>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4 font-mono">
            <div>
              <span className="text-xs text-slate-500">Type this configuration command:</span>
              <div className="bg-slate-900 px-4 py-3 rounded-lg text-sm text-cyan-300 border border-slate-800 select-all font-bold mt-1">
                {fixCommands[currentFixIndex]}
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Type the command above and press **Enter** in the Packet Tracer console terminal.
            </p>
          </div>

          <div className="flex justify-between items-center gap-4">
            <span className="text-xs text-slate-500 font-mono">
              Step {currentFixIndex + 1} of {fixCommands.length}
            </span>

            {currentFixIndex < fixCommands.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentFixIndex((prev) => prev + 1)}
                className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                I Entered It <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setWizardState('VERIFY')}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                Finished Typing Fix <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* STATE 10: TEST VERIFICATION */}
      {wizardState === 'VERIFY' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Let's check whether it actually worked.</h2>
            <p className="text-xs text-slate-400 font-mono">We need to run the verification test command:</p>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 font-mono text-xs">
              <span className="text-slate-500 font-bold">Type this command:</span>
              <div className="bg-slate-900 px-3.5 py-2.5 rounded-lg text-sm text-cyan-300 border border-slate-800 font-bold select-all">
                {currentAiResponse?.next_evidence_required || 'show ip interface brief'}
              </div>
              <p className="text-slate-400 font-sans mt-1">Copy and paste the new terminal result below.</p>
            </div>

            <div>
              <textarea
                rows={5}
                value={rawOutput}
                onChange={(e) => setRawOutput(e.target.value)}
                placeholder="Paste command verification output here..."
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-cyan-300 font-mono focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleVerifyResolution}
              disabled={loading || !rawOutput.trim()}
              className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white shadow-lg transition-all"
            >
              Verify My Result
            </button>
          </div>
        </div>
      )}

      {/* STATE 11: RESOLVED SUCCESS CARD */}
      {wizardState === 'RESOLVED' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 shadow-2xl text-center space-y-6 font-sans">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Your network is working!</h2>
            <p className="text-sm text-slate-400">The latest Packet Tracer evidence confirms the fault has been corrected.</p>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-3 text-left text-xs font-mono">
            <div>
              <span className="text-slate-500">● Problem:</span>
              <div className="text-slate-200 font-sans mt-0.5">{problemText}</div>
            </div>
            <div>
              <span className="text-slate-500">● Cause:</span>
              <div className="text-slate-200 mt-0.5">{currentAiResponse?.root_cause || 'Interface down.'}</div>
            </div>
            <div>
              <span className="text-slate-500">● Fix:</span>
              <div className="text-emerald-400 mt-0.5">Cisco IOS commands successfully applied.</div>
            </div>
            <div>
              <span className="text-slate-500">● Test:</span>
              <div className="text-emerald-400 mt-0.5">Verification results checked and passed.</div>
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

      {/* STATE 12: ERROR RECOVERY / REALIGNMENT */}
      {wizardState === 'ERROR_RECOVERY' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Something didn't match what we expected.</h2>
            <p className="text-xs text-slate-400">That's okay — don't type anything else yet.</p>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4">
            <div className="text-xs text-rose-450 font-bold uppercase tracking-wider font-mono">
              Error Diagnosis:
            </div>
            <p className="text-sm text-slate-300 font-sans leading-relaxed">
              {currentAiResponse?.explanation || "We detected a Cisco console command input syntax mismatch or prompt synchronization warning."}
            </p>

            {currentAiResponse?.commands && currentAiResponse.commands.length > 0 && (
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-slate-500">Run this recovery command:</span>
                  <div className="bg-slate-900 px-3.5 py-2.5 rounded-lg text-sm text-cyan-300 border border-slate-800 font-bold select-all mt-1">
                    {currentAiResponse.commands[0]}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Expected Output:</span>
                  <div className="text-slate-350 mt-0.5">
                    {currentAiResponse.expected_output}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <textarea
              rows={4}
              value={rawOutput}
              onChange={(e) => setRawOutput(e.target.value)}
              placeholder="Paste CLI console output after running recovery command..."
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-cyan-300 font-mono focus:outline-none"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCheckLogs}
                disabled={loading || !rawOutput.trim()}
                className="flex-1 py-3 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg transition-all"
              >
                Submit Output
              </button>
              
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
                className="px-5 py-3 rounded-xl font-bold bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 transition-all text-xs"
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
