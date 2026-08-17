import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { BrainCircuit, ShieldCheck, CheckCircle2, History, AlertTriangle, FileText } from 'lucide-react';

export const AdminResponsibleAIPage: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });
      setAuditLogs(data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-emerald-400" />
          Responsible AI & Verification Audit Log (Section 34)
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Documented examples of AI diagnosis, human corrections, mandatory feedback verification, and audit trails in Supabase.
        </p>
      </div>

      {/* Principles Callout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="text-emerald-400 font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Human-Supervised Learning Loop
          </div>
          <p className="text-slate-400 leading-relaxed font-sans">
            Gemini AI does NOT autonomously overwrite database records. AI proposes corrections, human administrators decide.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="text-cyan-400 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Mandatory Feedback Enforcement
          </div>
          <p className="text-slate-400 leading-relaxed font-sans">
            Human EDIT or REJECT choices require mandatory explanation feedback, triggering evidence verification pass.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="text-amber-400 font-bold flex items-center gap-2">
            <History className="w-4 h-4" />
            Dataset Evolution History
          </div>
          <p className="text-slate-400 leading-relaxed font-sans">
            Every approved correction increments case versioning and maintains audit history of original vs new values.
          </p>
        </div>
      </div>

      {/* Responsible AI Audit Records */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-4 shadow-2xl">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          Documented AI Correction & Verification Logs (Supabase Audit Table)
        </h2>

        <div className="divide-y divide-slate-800">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">
              No audit logs recorded yet.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="py-4 space-y-2 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold border border-indigo-500/30">
                      {log.action}
                    </span>
                    <span className="text-slate-400">Entity: {log.entity}</span>
                  </div>

                  <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-sans text-xs text-slate-300">
                  <pre className="font-mono text-[11px] text-cyan-300 overflow-x-auto">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
