import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Network, 
  Terminal, 
  ShieldCheck, 
  Cpu, 
  Database, 
  CheckCircle2, 
  BrainCircuit, 
  ArrowRight, 
  Activity, 
  Layers, 
  FileSearch,
  Sparkles,
  UserCheck
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="relative overflow-hidden bg-[#0b0f19] text-slate-100">
      {/* Background Grid Accent */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero Section */}
      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          AI-Assisted Cisco Networking Troubleshooting Platform
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight mb-6">
          Diagnose Complex Cisco Network Problems with{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Deterministic Rules & Gemini AI
          </span>
        </h1>

        <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto font-sans leading-relaxed mb-10">
          Combines Cisco <code className="font-mono text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">show</code> command evidence, deterministic Python rule verification, TF-IDF knowledge base retrieval over 255+ Packet Tracer cases, and mandatory human review.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/troubleshoot"
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 group transition-all hover:scale-105"
          >
            Launch Troubleshooting Wizard
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-center gap-2 transition-all"
          >
            Sign In to Dashboard
          </Link>
        </div>

        {/* Live Architecture Flow Banner */}
        <div className="mt-16 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-2xl backdrop-blur-sm max-w-5xl mx-auto text-left">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
              <Activity className="w-4 h-4 text-cyan-400" />
              NetSage Troubleshooting Architecture Pipeline
            </div>
            <span className="text-xs font-mono text-slate-500">Supabase Single Source of Truth</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 font-bold mb-1">1. User Problem</div>
              <div className="text-[10px] text-cyan-400">Cisco Show CLI</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 font-bold mb-1">2. Retrieval</div>
              <div className="text-[10px] text-blue-400">TF-IDF Top 3-5</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 font-bold mb-1">3. Rule Engine</div>
              <div className="text-[10px] text-emerald-400">Python 6 Checks</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 font-bold mb-1">4. Gemini AI</div>
              <div className="text-[10px] text-indigo-400">Evidence Diagnosis</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 font-bold mb-1">5. Human Review</div>
              <div className="text-[10px] text-amber-400">Accept/Edit/Reject</div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 font-bold mb-1">6. Supabase</div>
              <div className="text-[10px] text-rose-400">Audit & Updates</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 border-t border-slate-800/80">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
          Engineered for Cisco Network Labs & Enterprise Certification
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-white">Deterministic Python Rules</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Independently validates Cisco evidence for Duplicate IPs, Subnet Mask Mismatches, Gateway Misconfigurations, Interface Down states, Missing VLANs, and Routing Table gaps.
            </p>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 hover:border-blue-500/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-white">30+ Case Supabase Knowledge Base</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Covers VLANs, Default Gateways, DHCP pools, DNS, Routing protocols (OSPF/RIP), ACLs, NAT, and Wireless configurations across 8 dedicated categories.
            </p>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-white">Human Review & AI Verification</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Mandatory Accept, Edit, or Reject choices. Requires feedback for edits or rejections, triggering a secondary AI verification pass to ensure evidence accuracy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
