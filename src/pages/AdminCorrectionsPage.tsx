import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { FileEdit, CheckCircle2, XCircle, AlertTriangle, ArrowRight, ShieldCheck, Edit3 } from 'lucide-react';

export const AdminCorrectionsPage: React.FC = () => {
  const { user } = useAuth();
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedVal, setEditedVal] = useState<string>('');

  useEffect(() => {
    fetchCorrections();
  }, []);

  const fetchCorrections = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('dataset_corrections').select('*').order('created_at', { ascending: false });
      setCorrections(data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleApprove = async (corrId: string, customVal?: string) => {
    setActionLoading(corrId);
    try {
      const res = await fetch('/api/admin/approve-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correction_id: corrId,
          admin_id: user?.id,
          approved: true,
          modified_value: customVal || null
        })
      });

      if (res.ok) {
        fetchCorrections();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
      setEditingId(null);
    }
  };

  const handleReject = async (corrId: string) => {
    setActionLoading(corrId);
    try {
      const res = await fetch('/api/admin/approve-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correction_id: corrId,
          admin_id: user?.id,
          approved: false
        })
      });

      if (res.ok) {
        fetchCorrections();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileEdit className="w-6 h-6 text-amber-400" />
          Dataset Correction Proposals (Human-in-the-Loop)
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Gemini AI proposes corrections for faulty/outdated cases. Approved corrections update Supabase and future diagnoses use updated data.
        </p>
      </div>

      <div className="space-y-4">
        {corrections.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-xs font-mono text-slate-500">
            No dataset correction proposals recorded yet.
          </div>
        ) : (
          corrections.map((corr) => (
            <div
              key={corr.id}
              className={`bg-slate-900/90 border rounded-2xl p-6 shadow-xl space-y-4 transition-colors ${
                corr.status === 'PENDING'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : corr.status === 'APPROVED'
                  ? 'border-emerald-500/30'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-cyan-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                    {corr.case_id}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Target Field: <strong className="text-white">{corr.field_name}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-400">
                    AI Confidence: <strong className="text-cyan-400">{corr.ai_confidence}</strong>
                  </span>

                  <span
                    className={`px-3 py-1 rounded-lg font-mono text-xs uppercase font-bold ${
                      corr.status === 'PENDING'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                        : corr.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {corr.status}
                  </span>
                </div>
              </div>

              {/* Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Current Active Dataset Value</div>
                  <div className="text-slate-300 font-semibold">{corr.original_value}</div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30">
                  <div className="text-[10px] text-cyan-400 uppercase font-bold mb-1">AI Proposed Corrected Value</div>
                  {editingId === corr.id ? (
                    <input
                      type="text"
                      value={editedVal}
                      onChange={(e) => setEditedVal(e.target.value)}
                      className="w-full bg-slate-900 border border-cyan-500 rounded-lg p-2 text-white text-xs font-mono"
                    />
                  ) : (
                    <div className="text-cyan-300 font-bold">{corr.proposed_value}</div>
                  )}
                </div>
              </div>

              {/* AI Justification */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 font-mono">AI Inconsistency Reason</div>
                <p className="text-slate-300 leading-relaxed font-sans">{corr.reason}</p>
              </div>

              {/* Action Buttons for Pending Proposals */}
              {corr.status === 'PENDING' && (
                <div className="flex items-center justify-end gap-3 pt-2">
                  {editingId === corr.id ? (
                    <button
                      onClick={() => handleApprove(corr.id, editedVal)}
                      disabled={actionLoading === corr.id}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                    >
                      Save Custom & Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(corr.id);
                        setEditedVal(corr.proposed_value);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Proposal
                    </button>
                  )}

                  <button
                    onClick={() => handleReject(corr.id)}
                    disabled={actionLoading === corr.id}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    [ REJECT ]
                  </button>

                  <button
                    onClick={() => handleApprove(corr.id)}
                    disabled={actionLoading === corr.id}
                    className="px-6 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all hover:scale-105"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    [ APPROVE & UPDATE SUPABASE ]
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
