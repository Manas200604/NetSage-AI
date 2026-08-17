import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FileCode, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  History,
  ShieldAlert
} from 'lucide-react';

interface Problem {
  rule_name: string;
  status: 'FAIL' | 'PASS';
  type: string;
  device: string;
  interface: string;
  finding: string;
  result: string;
  evidence: string;
  severity: string;
}

export const PythonCheckerPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStateIndex, setLoadingStateIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Results states
  const [results, setResults] = useState<{
    file_name: string;
    network_data: any;
    rule_results: Problem[];
  } | null>(null);

  // History state
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);

  // Detailed modal/expand state
  const [activeDetailsIndex, setActiveDetailsIndex] = useState<number | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const loadingStates = [
    '✓ Reading Packet Tracer project...',
    '✓ Finding connected devices...',
    '✓ Checking interface states...',
    '✓ Extracting network topologies...',
    '→ Running Rule Checker algorithms...'
  ];

  // Fetch upload history
  useEffect(() => {
    fetchHistory();
  }, []);

  // Loading animation simulation
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStateIndex((prev) => (prev < loadingStates.length - 1 ? prev + 1 : prev));
      }, 700);
    } else {
      setLoadingStateIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/pkt/history?user_id=${user?.id || ''}`);
      if (res.ok) {
        const data = await res.json();
        setAnalysisHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.pkt')) {
        setErrorMessage("Invalid file format. Only Cisco Packet Tracer .pkt files are supported.");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
      setResults(null);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (user?.id) {
      formData.append('user_id', user.id);
    }

    try {
      const res = await fetch('http://localhost:8000/api/pkt/analyze', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.status === 'FAILED') {
        setErrorMessage(data.message);
      } else {
        setResults(data);
        fetchHistory(); // Refresh upload history list
      }
    } catch (err) {
      setErrorMessage("Network connection to Python Checker failed. Make sure the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleFixRedirect = (prob: Problem) => {
    // Generate preset values to guide the user inside the troubleshooting wizard
    let nextCmd = 'show ip interface brief';
    let mockShowOutput = '';
    
    if (prob.type === 'ADMINISTRATIVELY_DOWN') {
      nextCmd = 'show ip interface brief';
      mockShowOutput = `Interface ${prob.interface} IP-Address 10.0.0.1 YES NVRAM administratively down DOWN`;
    } else if (prob.type === 'DUPLICATE_IP') {
      nextCmd = 'show ip interface brief';
      mockShowOutput = `Duplicate IP address conflict detected for Vlan10`;
    } else if (prob.type === 'GATEWAY_MISMATCH') {
      nextCmd = 'show ip route';
      mockShowOutput = `Gateway of last resort is not set\nC 192.168.1.0/24 is directly connected`;
    }

    // Redirect to Troubleshoot Wizard Page passing state
    navigate('/troubleshoot', {
      state: {
        problemText: `Cisco configuration error: ${prob.finding}`,
        deviceName: prob.device,
        command: nextCmd,
        rawOutput: mockShowOutput
      }
    });
  };

  const getSymptomExplanation = (prob: Problem) => {
    switch (prob.type) {
      case 'GATEWAY_MISMATCH':
        return {
          wrong: `${prob.device} is using an incorrect default gateway IP address that lies on a different subnet block.`,
          why: "A PC cannot communicate outside its own local subnet if its default gateway address belongs to a different network subnet prefix.",
          todo: "Double-click PC in Packet Tracer, open IP Configuration, and set default gateway to match the router's local IP address."
        };
      case 'ADMINISTRATIVELY_DOWN':
        return {
          wrong: `${prob.device}'s interface ${prob.interface} is currently switched off or shut down in config.`,
          why: "An interface must be enabled or turned on using Cisco IOS commands to allow electrical signals and traffic protocol traversal.",
          todo: `Open ${prob.device} CLI console, enter configuration mode, select interface ${prob.interface}, and type the command: 'no shutdown'.`
        };
      case 'DUPLICATE_IP':
        return {
          wrong: `Duplicate IP Address: ${prob.device} has the same IP configured as another device.`,
          why: "Every device on a local area network segment must have a unique IP address to resolve ARP requests and route packets correctly.",
          todo: `Open the interface configuration on ${prob.device} and change the IP address to a unique address.`
        };
      default:
        return {
          wrong: prob.finding,
          why: "This represents an inconsistent network config that violates standard routing guidelines.",
          todo: "Verify the configuration of this device in Packet Tracer."
        };
    }
  };

  const failedProblems = results?.rule_results.filter(r => r.status === 'FAIL') || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8 font-sans">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">Automatic Parser Extractor</div>
            <h1 className="text-2xl font-bold text-white">Python Packet Tracer Checker</h1>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Upload your .pkt project file to extract configuration topologies and detect CCNA routing and interface inconsistencies automatically.
        </p>
      </div>

      {/* Main Checker Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Upload card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" />
              Upload .pkt Project
            </h2>

            {!selectedFile ? (
              <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center hover:border-cyan-500/50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".pkt"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileCode className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <span className="text-sm font-semibold text-slate-300 block">Choose Packet Tracer File</span>
                <span className="text-xs text-slate-500 mt-1 block">Accepts only .pkt files</span>
              </div>
            ) : (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-855 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-300 font-mono">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Packet Tracer file uploaded</span>
                  </div>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-rose-400 font-bold hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="text-xs text-cyan-300 font-mono bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                  File: {selectedFile.name}
                </div>

                <button
                  type="button"
                  onClick={handleUploadAndAnalyze}
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  Analyze Network
                </button>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs space-y-3 font-sans leading-relaxed">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Cisco Extraction Interrupted</span>
                </div>
                <p>{errorMessage}</p>
                <button
                  onClick={() => navigate('/troubleshoot')}
                  className="px-4 py-2 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-bold text-[11px] block transition-all"
                >
                  Continue With CLI Troubleshooting
                </button>
              </div>
            )}
          </div>

          {/* Loading checker state */}
          {loading && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <h3 className="text-sm font-bold text-white font-mono">Analyzing your Packet Tracer project...</h3>
              <div className="text-xs text-slate-500 space-y-1 font-mono text-left max-w-xs mx-auto pt-2">
                {loadingStates.slice(0, loadingStateIndex + 1).map((s, idx) => (
                  <p key={idx}>{s}</p>
                ))}
              </div>
            </div>
          )}

          {/* Results Summary and Problems */}
          {results && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                    Network Check Complete
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    failedProblems.length > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {failedProblems.length} Problems Found
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                    <span className="text-slate-500 text-[10px] uppercase font-mono">Devices Extracted</span>
                    <div className="text-lg font-bold text-white mt-0.5">
                      {results.network_data.devices?.length || 0}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                    <span className="text-slate-500 text-[10px] uppercase font-mono">Topology Connections</span>
                    <div className="text-lg font-bold text-white mt-0.5">
                      {results.network_data.connections?.length || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Problems list */}
              {failedProblems.length > 0 && (
                <div className="space-y-4">
                  {failedProblems.map((prob, idx) => {
                    const expl = getSymptomExplanation(prob);
                    const isExpanded = activeDetailsIndex === idx;

                    return (
                      <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px] font-mono font-bold">
                              {prob.rule_name}
                            </span>
                            <h4 className="text-sm font-bold text-white mt-2 leading-snug">{prob.finding}</h4>
                          </div>

                          <div className="text-right text-[10px] font-mono text-slate-500">
                            <div>Affected: {prob.device}</div>
                            <div>Layer: {prob.severity === 'SEV-1' ? 'Layer 3' : 'Layer 2'}</div>
                          </div>
                        </div>

                        {/* Collapsible Details */}
                        {isExpanded && (
                          <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-3.5 text-xs text-slate-300">
                            <div>
                              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] font-mono">What is wrong?</div>
                              <p className="mt-0.5 leading-relaxed">{expl.wrong}</p>
                            </div>
                            <div>
                              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] font-mono">Why does this matter?</div>
                              <p className="mt-0.5 leading-relaxed">{expl.why}</p>
                            </div>
                            <div>
                              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] font-mono">What should you do?</div>
                              <p className="mt-0.5 leading-relaxed">{expl.todo}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleFixRedirect(prob)}
                              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                            >
                              Fix This Problem <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveDetailsIndex(isExpanded ? null : idx)}
                          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 focus:outline-none"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Advanced Technical Details Collapsible */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="text-xs font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1"
                >
                  {showTechnicalDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Advanced Technical Details
                </button>

                {showTechnicalDetails && (
                  <div className="mt-4 bg-slate-950 p-4 rounded-lg border border-slate-855 space-y-4 font-mono text-[10px] text-slate-400 max-h-72 overflow-y-auto">
                    <div>
                      <span className="text-cyan-400 font-bold">Extracted Network JSON Structure:</span>
                      <pre className="mt-1 text-slate-300 overflow-x-auto">{JSON.stringify(results.network_data, null, 2)}</pre>
                    </div>
                    <div>
                      <span className="text-cyan-400 font-bold">Rule Checker Diffs:</span>
                      <pre className="mt-1 text-slate-300 overflow-x-auto">{JSON.stringify(results.rule_results, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Upload history list */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <History className="w-4 h-4 text-cyan-400" />
              Upload History
            </h3>

            <div className="space-y-3 font-mono max-h-96 overflow-y-auto">
              {analysisHistory.length === 0 ? (
                <div className="text-center text-xs text-slate-600 py-6">
                  No files uploaded yet.
                </div>
              ) : (
                analysisHistory.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setResults({
                        file_name: item.file_name,
                        network_data: item.network_data,
                        rule_results: item.rule_results
                      });
                      setSelectedFile(new File([], item.file_name));
                    }}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-855 hover:border-cyan-500/50 cursor-pointer transition-all space-y-1 text-left"
                  >
                    <div className="text-xs font-bold text-cyan-300 truncate">{item.file_name}</div>
                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1">
                      <span>Status: {item.extraction_status}</span>
                      <span>{new Date(item.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
