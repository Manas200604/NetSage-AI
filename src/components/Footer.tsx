import React from 'react';
import { Network, Shield, Cpu, Database } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/80 bg-[#070a12] text-slate-400 py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Network className="w-5 h-5 text-cyan-400" />
            NetSage AI
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            AI-assisted Cisco networking troubleshooting platform for Packet Tracer & laboratory problem diagnosis.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-cyan-400" /> Core Engine
          </h4>
          <ul className="text-xs space-y-2 text-slate-400 font-mono">
            <li>Google Gemini AI</li>
            <li>Deterministic Python Rules</li>
            <li>TF-IDF Retrieval System</li>
            <li>OSI Layer 1–7 Reasoning</li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-400" /> Supabase Storage
          </h4>
          <ul className="text-xs space-y-2 text-slate-400 font-mono">
            <li>255+ Cisco Lab Cases</li>
            <li>User Session Audit Trail</li>
            <li>Row Level Security (RLS)</li>
            <li>Dataset Corrections Audit</li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" /> Responsible AI
          </h4>
          <ul className="text-xs space-y-2 text-slate-400 font-mono">
            <li>Human Review Loop</li>
            <li>Mandatory Feedback Enforcement</li>
            <li>AI Feedback Verification</li>
            <li>Controlled Dataset Learning</li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono">
        <div>© 2026 NetSage AI. Cisco Packet Tracer Diagnostic Assistant.</div>
        <div className="flex gap-4 mt-2 sm:mt-0">
          <span>Gemini AI Enabled</span>
          <span>•</span>
          <span>Supabase Backend</span>
          <span>•</span>
          <span>Python Rule Engine</span>
        </div>
      </div>
    </footer>
  );
};
