import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Database, Plus, Search, Upload, Download, Trash2, Edit3, X, Check, Filter } from 'lucide-react';

export const AdminDatasetPage: React.FC = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCase, setEditingCase] = useState<any | null>(null);

  // Form fields for Add/Edit
  const [formData, setFormData] = useState({
    case_id: '',
    title: '',
    symptom: '',
    topology_note: '',
    show_output: '',
    expected_fault: '',
    osi_layer: 'Layer 3',
    concept: 'VLAN',
    severity: 'High',
    next_command: 'show ip route',
    recommended_fix: ''
  });

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('cases').select('*').order('case_id', { ascending: true });
      if (data) setCases(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingCase(null);
    setFormData({
      case_id: `CASE-0${cases.length + 1}`,
      title: '',
      symptom: '',
      topology_note: '',
      show_output: '',
      expected_fault: '',
      osi_layer: 'Layer 3',
      concept: 'VLAN',
      severity: 'High',
      next_command: 'show ip route',
      recommended_fix: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (c: any) => {
    setEditingCase(c);
    setFormData({
      case_id: c.case_id,
      title: c.title,
      symptom: c.symptom,
      topology_note: c.topology_note || '',
      show_output: c.show_output,
      expected_fault: c.expected_fault,
      osi_layer: c.osi_layer,
      concept: c.concept,
      severity: c.severity,
      next_command: c.next_command,
      recommended_fix: c.recommended_fix
    });
    setShowModal(true);
  };

  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCase) {
        // Update case in Supabase
        await supabase
          .from('cases')
          .update({
            ...formData,
            version: (editingCase.version || 1) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCase.id);
      } else {
        // Insert new case in Supabase
        await supabase.from('cases').insert(formData);
      }

      setShowModal(false);
      fetchCases();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCase = async (id: string) => {
    if (confirm('Are you sure you want to delete this case from Supabase?')) {
      await supabase.from('cases').delete().eq('id', id);
      fetchCases();
    }
  };

  // CSV Export
  const exportCSV = () => {
    const headers = ['case_id', 'title', 'symptom', 'expected_fault', 'osi_layer', 'concept', 'severity', 'next_command', 'recommended_fix'];
    const rows = cases.map((c) =>
      headers.map((h) => `"${(c[h] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `netsage_cases_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.case_id.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.symptom.toLowerCase().includes(search.toLowerCase());
    const matchesConcept = selectedConcept === 'ALL' || c.concept === selectedConcept;
    return matchesSearch && matchesConcept;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-cyan-400" />
            Troubleshooting Knowledge Base Cases ({cases.length})
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Stored in Supabase PostgreSQL — Full CRUD, Search, & CSV Operations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportCSV}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            Export CSV
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Add New Case
          </button>
        </div>
      </div>

      {/* Search & Concept Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Case ID, title, or fault..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'VLAN', 'Gateway', 'DHCP', 'DNS', 'Routing', 'ACL', 'NAT', 'Wireless'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedConcept(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
                selectedConcept === cat
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="p-4">Case ID</th>
                <th className="p-4">Title / Symptom</th>
                <th className="p-4">Concept</th>
                <th className="p-4">OSI Layer</th>
                <th className="p-4">Expected Fault</th>
                <th className="p-4 text-center">Version</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                    No troubleshooting cases found in Supabase database.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-cyan-400">{c.case_id}</td>
                    <td className="p-4 max-w-xs">
                      <div className="font-semibold text-white truncate">{c.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{c.symptom}</div>
                    </td>
                    <td className="p-4">
                      <span className="bg-slate-950 border border-slate-800 text-cyan-300 font-mono px-2 py-0.5 rounded text-[11px]">
                        {c.concept}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-300">{c.osi_layer}</td>
                    <td className="p-4 text-slate-300 font-mono truncate max-w-xs">{c.expected_fault}</td>
                    <td className="p-4 text-center font-mono text-cyan-400 font-bold">v{c.version || 1}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Edit Case"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteCase(c.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Delete Case"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Case Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingCase ? `Edit ${editingCase.case_id}` : 'Add New Troubleshooting Case'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCase} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Case ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.case_id}
                    onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Concept Category *</label>
                  <select
                    value={formData.concept}
                    onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  >
                    {['VLAN', 'Gateway', 'DHCP', 'DNS', 'Routing', 'ACL', 'NAT', 'Wireless'].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Inter-VLAN Communication Failure"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Symptom *</label>
                <textarea
                  rows={2}
                  required
                  value={formData.symptom}
                  onChange={(e) => setFormData({ ...formData, symptom: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">OSI Layer *</label>
                  <select
                    value={formData.osi_layer}
                    onChange={(e) => setFormData({ ...formData, osi_layer: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  >
                    <option value="Layer 1">Layer 1</option>
                    <option value="Layer 2">Layer 2</option>
                    <option value="Layer 3">Layer 3</option>
                    <option value="Layer 4">Layer 4</option>
                    <option value="Layer 7">Layer 7</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Severity *</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cisco Show Output *</label>
                <textarea
                  rows={3}
                  required
                  value={formData.show_output}
                  onChange={(e) => setFormData({ ...formData, show_output: e.target.value })}
                  className="w-full bg-[#070a12] border border-slate-800 rounded-xl p-2.5 font-mono text-cyan-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Expected Fault *</label>
                <input
                  type="text"
                  required
                  value={formData.expected_fault}
                  onChange={(e) => setFormData({ ...formData, expected_fault: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Recommended Fix *</label>
                <textarea
                  rows={2}
                  required
                  value={formData.recommended_fix}
                  onChange={(e) => setFormData({ ...formData, recommended_fix: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                >
                  Save to Supabase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
