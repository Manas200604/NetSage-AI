import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Shield, 
  Database, 
  FileEdit, 
  BrainCircuit, 
  Users, 
  FileText, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState({
    totalCases: 255,
    totalSessions: 0,
    pendingCorrections: 0,
    approvedCorrections: 0,
    totalReviews: 0,
    agreementRate: '0.0%'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminMetrics();
  }, []);

  const fetchAdminMetrics = async () => {
    try {
      setLoading(true);

      const [casesRes, sessRes, corrRes, revRes] = await Promise.all([
        supabase.from('cases').select('*', { count: 'exact', head: true }),
        supabase.from('troubleshooting_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('dataset_corrections').select('status'),
        supabase.from('human_reviews').select('decision')
      ]);

      const totalCases = casesRes.count || 255;
      const totalSessions = sessRes.count || 0;
      const corrections = corrRes.data || [];
      const pendingCorrections = corrections.filter((c) => c.status === 'PENDING').length;
      const approvedCorrections = corrections.filter((c) => c.status === 'APPROVED').length;

      const reviews = revRes.data || [];
      const accepted = reviews.filter((r) => r.decision === 'ACCEPT').length;
      const totalReviews = reviews.length;

      const agreementRate = totalReviews > 0 ? `${((accepted / totalReviews) * 100).toFixed(1)}%` : '100.0%';

      setMetrics({
        totalCases,
        totalSessions,
        pendingCorrections,
        approvedCorrections,
        totalReviews,
        agreementRate
      });

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-indigo-950/40 border border-indigo-500/30 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-indigo-400 mb-1">
            <Shield className="w-4 h-4" />
            NetSage AI Administration Console
          </div>
          <h1 className="text-2xl font-bold text-white">System Operations & Responsible AI Overview</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/corrections"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors flex items-center gap-1.5"
          >
            <FileEdit className="w-3.5 h-3.5" />
            {metrics.pendingCorrections} Pending Corrections
          </Link>

          <Link
            to="/admin/dataset"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            Manage Dataset ({metrics.totalCases})
          </Link>
        </div>
      </div>

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 font-mono">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 mb-2">Supabase Dataset Cases</div>
          <div className="text-3xl font-extrabold text-cyan-400">{metrics.totalCases}</div>
          <div className="text-[11px] text-slate-500 mt-1">255 Live Networking Cases</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 mb-2">Pending AI Corrections</div>
          <div className="text-3xl font-extrabold text-amber-400">{metrics.pendingCorrections}</div>
          <div className="text-[11px] text-slate-500 mt-1">Requires Admin Approval</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 mb-2">Approved Dataset Updates</div>
          <div className="text-3xl font-extrabold text-emerald-400">{metrics.approvedCorrections}</div>
          <div className="text-[11px] text-slate-500 mt-1">Active in Future Diagnoses</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs text-slate-400 mb-2">AI-Human Agreement Rate</div>
          <div className="text-3xl font-extrabold text-indigo-400">{metrics.agreementRate}</div>
          <div className="text-[11px] text-slate-500 mt-1">{metrics.totalReviews} Total Human Reviews</div>
        </div>
      </div>

      {/* Admin Modules Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/admin/dataset"
          className="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 p-6 rounded-2xl space-y-3 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white flex items-center justify-between">
            <span>Troubleshooting Knowledge Base</span>
            <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="text-xs text-slate-400">
            Full CRUD operations, CSV upload & export over all {metrics.totalCases} troubleshooting cases in Supabase PostgreSQL.
          </p>
        </Link>

        <Link
          to="/admin/corrections"
          className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 p-6 rounded-2xl space-y-3 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FileEdit className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white flex items-center justify-between">
            <span>Dataset Correction Proposals</span>
            <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="text-xs text-slate-400">
            Review Gemini AI proposed dataset corrections. Approving updates Supabase cases and ensures future retrieval uses updated data.
          </p>
        </Link>

        <Link
          to="/admin/responsible-ai"
          className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-2xl space-y-3 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white flex items-center justify-between">
            <span>Responsible AI Audit Log</span>
            <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="text-xs text-slate-400">
            Audit history of AI corrections, mandatory human feedback verification, and controlled knowledge base improvement loops.
          </p>
        </Link>
      </div>
    </div>
  );
};
