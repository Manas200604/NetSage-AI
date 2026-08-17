import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { History, Terminal, Search, Calendar, ChevronRight } from 'lucide-react';

export const SessionHistoryPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      let query = supabase.from('troubleshooting_sessions').select('*').order('created_at', { ascending: false });
      if (profile?.role !== 'admin' && user) {
        query = query.eq('user_id', user.id);
      }
      const { data } = await query;
      setSessions(data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.problem_text.toLowerCase().includes(search.toLowerCase()) ||
      s.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="w-6 h-6 text-cyan-400" />
          Troubleshooting Session History
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Complete audit trail of user sessions, rules triggered, and reviews in Supabase
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search problem text or status..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
        />
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="divide-y divide-slate-800">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">
              No matching troubleshooting sessions found.
            </div>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                className="p-5 hover:bg-slate-800/50 cursor-pointer transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-white text-sm leading-snug">{s.problem_text}</div>
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        {new Date(s.created_at).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>ID: {s.id.substring(0, 8)}...</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-lg font-mono text-xs uppercase font-bold ${
                        s.status === 'accepted'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : s.status === 'edited'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : s.status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {s.status}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${selectedSession?.id === s.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {selectedSession?.id === s.id && (
                  <div className="mt-4 pt-4 border-t border-slate-800 text-xs font-mono space-y-3 bg-slate-950 p-4 rounded-xl">
                    {s.show_output && (
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">CLI Evidence Output</div>
                        <pre className="bg-[#070a12] p-3 rounded-lg text-cyan-300 text-[11px] overflow-x-auto">
                          {s.show_output}
                        </pre>
                      </div>
                    )}

                    {s.normalized_problem && (
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Normalized Concepts</div>
                        <div className="flex flex-wrap gap-1">
                          {s.normalized_problem.possible_concepts?.map((c: string, idx: number) => (
                            <span key={idx} className="bg-slate-900 px-2 py-0.5 rounded text-blue-400 border border-slate-800">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
