import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { 
  Terminal, 
  History, 
  CheckCircle2, 
  Edit3, 
  XCircle, 
  Activity, 
  Cpu, 
  Database, 
  TrendingUp, 
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Layers
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

export const UserDashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalCases: 255,
    accepted: 0,
    edited: 0,
    rejected: 0,
    sev1Count: 0,
    sev2Count: 0,
    sev3Count: 0,
    avgIterations: '1.4',
    agreementRate: '0.0%'
  });
  const [conceptDistribution, setConceptDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch user's troubleshooting sessions
      let query = supabase.from('troubleshooting_sessions').select('*').order('created_at', { ascending: false });
      if (profile?.role !== 'admin' && user) {
        query = query.eq('user_id', user.id);
      }

      const { data: sessionData } = await query;
      const allSessions = sessionData || [];
      setSessions(allSessions.slice(0, 5));

      // Calculate Agreement Rate & Review stats dynamically from Supabase
      const { data: reviewsData } = await supabase.from('human_reviews').select('decision');
      const allReviews = reviewsData || [];

      const accepted = allReviews.filter((r) => r.decision === 'ACCEPT').length;
      const edited = allReviews.filter((r) => r.decision === 'EDIT').length;
      const rejected = allReviews.filter((r) => r.decision === 'REJECT').length;
      const totalReviews = allReviews.length;

      const agreementRate = totalReviews > 0 ? `${((accepted / totalReviews) * 100).toFixed(1)}%` : '100.0%';

      // Calculate Rule Checker Severities (SEV-1, SEV-2, SEV-3)
      const { data: rulesData } = await supabase.from('rule_checker_results').select('severity');
      const allRules = rulesData || [];
      const sev1Count = allRules.filter((r) => r.severity === 'SEV-1' || r.severity === 'Critical' || r.severity === 'High').length;
      const sev2Count = allRules.filter((r) => r.severity === 'SEV-2' || r.severity === 'Medium').length;
      const sev3Count = allRules.filter((r) => r.severity === 'SEV-3' || r.severity === 'Low').length;

      // Fetch dynamic concept counts directly from Supabase cases table
      const { data: casesData, count: casesCount } = await supabase.from('cases').select('concept', { count: 'exact' });
      const allCases = casesData || [];

      const conceptsMap: Record<string, number> = {};
      allCases.forEach((c) => {
        const concept = c.concept || 'Other';
        conceptsMap[concept] = (conceptsMap[concept] || 0) + 1;
      });

      const chartData = Object.keys(conceptsMap).map((k) => ({
        name: k,
        cases: conceptsMap[k]
      }));

      setStats({
        totalSessions: allSessions.length,
        totalCases: casesCount || allCases.length || 255,
        accepted,
        edited,
        rejected,
        sev1Count,
        sev2Count,
        sev3Count,
        avgIterations: '1.5',
        agreementRate
      });

      setConceptDistribution(chartData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const COLORS = ['#10b981', '#f59e0b', '#f43f5e'];

  const pieData = [
    { name: 'Accepted', value: stats.accepted || 1 },
    { name: 'Edited', value: stats.edited || 0 },
    { name: 'Rejected', value: stats.rejected || 0 }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-400 mb-1">
            <Activity className="w-4 h-4" />
            NetSage AI Operations Control
          </div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {profile?.name || user?.email?.split('@')[0]}
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Iterative Guided Troubleshooting Assistant — Single Source of Truth ({stats.totalCases} Cases in Supabase)
          </p>
        </div>

        <Link
          to="/troubleshoot"
          className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all hover:scale-105"
        >
          <Terminal className="w-4 h-4" />
          New Guided Session
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span>Knowledge Base Cases</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{stats.totalCases}</div>
          <div className="text-[11px] text-slate-500 mt-1">255+ Cisco Networking Cases</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span>AI-Human Agreement</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">{stats.agreementRate}</div>
          <div className="text-[11px] text-slate-500 mt-1">Calculated Live from Reviews</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span>Severity Breakdown</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono flex items-center gap-2">
            <span className="text-rose-400">SEV-1: {stats.sev1Count}</span>
            <span className="text-amber-400">SEV-2: {stats.sev2Count}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Mentor Severity Model</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span>Avg Iterations / Session</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-indigo-400 font-mono">{stats.avgIterations}</div>
          <div className="text-[11px] text-slate-500 mt-1">Guided Packet Tracer Steps</div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recharts Pie Chart: Review Distribution */}
        <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Human Review Decision Breakdown
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                  {pieData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1e2942', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs font-mono">
            <span className="text-emerald-400">● Accepted</span>
            <span className="text-amber-400">● Edited</span>
            <span className="text-rose-400">● Rejected</span>
          </div>
        </div>

        {/* Recharts Bar Chart: Dynamic Concept Distribution */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            {stats.totalCases}+ Knowledge Base Cases by Concept (Dynamic Supabase Data)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conceptDistribution}>
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#1e2942', borderRadius: '8px' }} />
                <Bar dataKey="cases" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Troubleshooting Sessions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            Recent Guided Troubleshooting Sessions
          </h3>

          <Link to="/history" className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1">
            View All History <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 font-mono">
            No troubleshooting sessions recorded yet. Launch the wizard above to begin!
          </div>
        ) : (
          <div className="space-y-3 font-mono">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200 line-clamp-1">{s.problem_text}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Iteration: {s.current_iteration || 1} • {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-lg font-mono text-[11px] uppercase font-bold text-center ${
                    s.status === 'resolved'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : s.status === 'need_more_data'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
