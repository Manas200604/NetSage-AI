import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Network, 
  Terminal, 
  Shield, 
  Database, 
  LayoutDashboard, 
  History, 
  LogOut, 
  User, 
  FileEdit, 
  BrainCircuit,
  Activity
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 p-[1px] shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0b0f19] rounded-[11px] flex items-center justify-center">
              <Network className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
              NetSage<span className="text-cyan-400 font-mono">.AI</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
              Cisco Lab Intelligence
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
          <Link
            to="/troubleshoot"
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isActive('/troubleshoot')
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-4 h-4 text-cyan-400" />
            Troubleshoot
          </Link>

          {user && (
            <>
              <Link
                to="/dashboard"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive('/dashboard')
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>

              <Link
                to="/history"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive('/history')
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <History className="w-4 h-4" />
                History
              </Link>
            </>
          )}

          {/* Admin Navigation Portal */}
          {profile?.role === 'admin' && (
            <div className="flex items-center gap-1 border-l border-slate-700/60 ml-2 pl-2">
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  isActive('/admin') ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/30' : 'text-indigo-300 hover:text-indigo-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin Overview
              </Link>

              <Link
                to="/admin/dataset"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive('/admin/dataset') ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                Cases (255+)
              </Link>

              <Link
                to="/admin/corrections"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive('/admin/corrections') ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileEdit className="w-3.5 h-3.5 text-amber-400" />
                Corrections
              </Link>

              <Link
                to="/admin/responsible-ai"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive('/admin/responsible-ai') ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
                Responsible AI
              </Link>
            </div>
          )}
        </div>

        {/* User Auth Buttons */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-200 leading-tight">
                  {profile?.name || user.email?.split('@')[0]}
                </span>
                <span className="text-[11px] font-mono text-cyan-400 flex items-center justify-end gap-1">
                  {profile?.role === 'admin' ? (
                    <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border border-indigo-500/30">
                      ADMIN
                    </span>
                  ) : (
                    <span className="text-slate-400">Net Engineer</span>
                  )}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 border border-slate-800 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-105"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
