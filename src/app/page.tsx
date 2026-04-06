'use client';

import Link from 'next/link';
import { Shield, Users, BarChart3, Lock, Zap, TrendingUp, ChevronRight, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen banking-gradient text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <span className="text-teal-400 font-bold text-lg">N</span>
            </div>
            <div>
              <span className="font-bold text-xl text-white tracking-tight">Nexus Financial</span>
              <div className="text-xs text-teal-400 font-medium tracking-wider uppercase">AI Customer Service Platform</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 relative">
              <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75"></div>
            </div>
            <span>System Operational</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium mb-8">
          <Zap className="w-4 h-4" />
          <span>Powered by Claude AI with Adaptive Thinking</span>
        </div>
        <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
          Financial Services<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
            AI Customer Service
          </span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-4">
          The only customer service platform built for commercial banking — with regulatory compliance intelligence,
          transaction-aware AI, and seamless human escalation.
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500 mb-16">
          {['UDAAP Aware', 'CFPB Compliant', 'Reg E Ready', 'SCRA Enabled', 'BSA/AML Flagging'].map(badge => (
            <span key={badge} className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-teal-500" />
              {badge}
            </span>
          ))}
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Customer Portal */}
          <Link href="/customer" className="group">
            <div className="relative p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-teal-500/40 transition-all duration-300 card-hover text-left overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full bg-teal-500/5 group-hover:bg-teal-500/10 transition-colors"></div>
              <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-7 h-7 text-teal-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">Customer Portal</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Secure banking chat with AI-powered support. Get instant help with balances, transactions, cards, and more.
              </p>
              <div className="space-y-2 mb-8">
                {['Balance & Transaction inquiries', 'Card activation & freezing', 'Bill payment status', 'Branch & ATM locator'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-teal-400 font-semibold group-hover:gap-3 transition-all">
                <span>Launch Customer Chat</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>

          {/* Agent Dashboard */}
          <Link href="/agent" className="group">
            <div className="relative p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/40 transition-all duration-300 card-hover text-left overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">Agent Dashboard</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Real-time queue management with AI coaching. Handle escalated cases with full context, no customer re-explanation.
              </p>
              <div className="space-y-2 mb-8">
                {['Live conversation queue', 'AI-generated case briefs', 'Tag & annotation tools', 'Compliance flag alerts'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-blue-400 font-semibold group-hover:gap-3 transition-all">
                <span>Open Agent Dashboard</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>

          {/* Admin Panel */}
          <Link href="/admin" className="group">
            <div className="relative p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/40 transition-all duration-300 card-hover text-left overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors"></div>
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-7 h-7 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">Admin Panel</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Platform analytics, tag management, and audit logs. Track AI performance and compliance metrics in real time.
              </p>
              <div className="space-y-2 mb-8">
                {['Resolution analytics', 'Tag taxonomy management', 'Immutable audit trail', 'Escalation rule config'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <CheckCircle className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-purple-400 font-semibold group-hover:gap-3 transition-all">
                <span>View Admin Panel</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Feature highlights strip */}
      <div className="border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: <Lock className="w-5 h-5" />, label: 'Bank-Grade Security', value: 'SOC 2 Type II' },
              { icon: <Zap className="w-5 h-5" />, label: 'AI Resolution Rate', value: '~73% avg' },
              { icon: <TrendingUp className="w-5 h-5" />, label: 'Handle Time Reduction', value: '45% faster' },
              { icon: <Shield className="w-5 h-5" />, label: 'Compliance Flags', value: 'Real-time' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="flex justify-center mb-2 text-teal-400">{stat.icon}</div>
                <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            © 2024 Nexus Financial Bank. All rights reserved. FDIC Insured.
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Terms of Service</span>
            <span>•</span>
            <span>Security</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
