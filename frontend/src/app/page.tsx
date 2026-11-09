'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare, Shield, BookOpen, FileText, Send, Upload,
  ChevronRight, CheckCircle2, AlertTriangle, XCircle, Loader2,
  Info, Zap, Database, Network, Search, FileUp, RefreshCw,
  Eye, ArrowRight, ExternalLink, Hash, Tag, Clock, DollarSign,
  BarChart3, PieChart, Bot, Sparkles, ChevronDown, ChevronUp,
  Menu, X
} from 'lucide-react';
import {
  chatWithAgent, fetchDocuments, uploadDocument, fetchFrameworks,
  evaluateCompliance, fetchVaultNotes, fetchVaultNote, fetchVaultGraph,
  fetchMcpTools,
  type ChatResponse, type DocumentItem, type ComplianceFinding,
  type FrameworkReport, type VaultNote, type GraphData, type GraphNode,
  type TraceStep, type Citation
} from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function formatPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return '—';
  return `${(value <= 1 ? value * 100 : value).toFixed(0)}%`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="font-medium underline hover:no-underline">Retry</button>}
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'COVERED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'PARTIALLY_COVERED': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'MISSING': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'COVERED': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case 'PARTIALLY_COVERED': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    case 'MISSING': return <XCircle className="w-4 h-4 text-red-600" />;
    default: return <Info className="w-4 h-4 text-slate-500" />;
  }
}

// ─── Tab Data ──────────────────────────────────────────────────────
const TABS = [
  { id: 'chat', label: 'Agent Chat', icon: MessageSquare },
  { id: 'compliance', label: 'Compliance Audit', icon: Shield },
  { id: 'vault', label: 'Knowledge Vault', icon: BookOpen },
  { id: 'documents', label: 'Documents', icon: FileText },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Chat Message Types ───────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  response?: ChatResponse;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ─── Sidebar ───────────────────────────────── */}
      <aside className={cn(
        'flex flex-col bg-white border-r border-slate-200 transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded-lg hover:bg-slate-100">
            {sidebarOpen ? <X className="w-5 h-5 text-slate-500" /> : <Menu className="w-5 h-5 text-slate-500" />}
          </button>
          {sidebarOpen && (
            <div>
              <h1 className="font-bold text-lg text-brand-700 tracking-tight">VEGAH</h1>
              <p className="text-[10px] text-slate-400 leading-none">Document Intelligence</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 space-y-1 px-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-brand-50 text-brand-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className={cn('w-5 h-5 flex-shrink-0', active ? 'text-brand-600' : 'text-slate-400')} />
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              <span>Near-Zero Cost · MCP Powered</span>
            </div>
          </div>
        )}
      </aside>

      {/* ─── Main Content ──────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'compliance' && <ComplianceTab />}
        {activeTab === 'vault' && <VaultTab />}
        {activeTab === 'documents' && <DocumentsTab />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  1. CHAT TAB
// ═══════════════════════════════════════════════════════════════════
function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const resp = await chatWithAgent(query);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: resp.answer,
        timestamp: new Date(),
        response: resp,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `**Error:** ${err.message || 'Failed to get response from agent.'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'What encryption standards are required for data at rest?',
    'Run a compliance check against SOC2 Type II requirements',
    'What is the incident response escalation process?',
    'Analyze gaps in our access control policy',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-100 rounded-lg">
            <Bot className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Compliance Intelligence Agent</h2>
            <p className="text-xs text-slate-500">MCP-powered document Q&A with source citations</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="p-4 bg-brand-50 rounded-2xl">
              <Sparkles className="w-10 h-10 text-brand-500" />
            </div>
            <div className="text-center max-w-md">
              <h3 className="text-lg font-semibold text-slate-800">Enterprise Compliance Agent</h3>
              <p className="text-sm text-slate-500 mt-1">
                Ask questions about your enterprise documents. I&apos;ll retrieve relevant sections,
                provide source citations, and run compliance analysis.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  className="text-left text-xs px-3 py-2.5 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 text-slate-600 hover:text-brand-700 transition-all"
                >
                  <ChevronRight className="w-3 h-3 inline mr-1 text-brand-400" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-2xl px-4 py-3',
              msg.role === 'user'
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-slate-200 shadow-sm'
            )}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-slate max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}

              {/* Agent Response Metadata */}
              {msg.response && (
                <AgentResponseMeta response={msg.response} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Agent is analyzing documents...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about your enterprise documents..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm bg-white"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Response Meta (citations, trace, cost) ─────────────────
function AgentResponseMeta({ response }: { response: ChatResponse }) {
  const [showTrace, setShowTrace] = useState(false);
  const [showCitations, setShowCitations] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" /> {response.provider}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {response.latency_ms}ms
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> {response.cost}
        </span>
      </div>

      {/* Citations Toggle */}
      {response.citations && response.citations.length > 0 && (
        <div>
          <button
            onClick={() => setShowCitations(!showCitations)}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
          >
            <FileText className="w-3.5 h-3.5" />
            {response.citations.length} Source Citation{response.citations.length > 1 ? 's' : ''}
            {showCitations ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showCitations && (
            <div className="mt-2 space-y-2">
              {response.citations.map((c, i) => (
                <CitationCard key={i} citation={c} index={i + 1} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trace Toggle */}
      {response.trace && response.trace.length > 0 && (
        <div>
          <button
            onClick={() => setShowTrace(!showTrace)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            <Network className="w-3.5 h-3.5" />
            Agent Trace ({response.trace.length} steps)
            {showTrace ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showTrace && (
            <div className="mt-2 space-y-1.5">
              {response.trace.map((step, i) => (
                <TraceStepCard key={i} step={step} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-700 truncate">{citation.doc_title}</p>
          <p className="text-slate-400 text-[10px]">Section: {citation.section} · Page {citation.page_number}</p>
          {citation.verbatim_excerpt && (
            <p className="mt-1 text-slate-600 italic line-clamp-2">&ldquo;{citation.verbatim_excerpt}&rdquo;</p>
          )}
        </div>
        {citation.score !== undefined && (
          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
            {(citation.score * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

function TraceStepCard({ step }: { step: TraceStep }) {
  const phaseColors: Record<string, string> = {
    planning: 'bg-purple-100 text-purple-700',
    tool_call: 'bg-blue-100 text-blue-700',
    verification: 'bg-amber-100 text-amber-700',
    synthesis: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <div className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded bg-slate-50">
      <span className="w-4 text-right text-slate-400 font-mono">{step.step}</span>
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', phaseColors[step.phase] || 'bg-slate-100 text-slate-600')}>
        {step.phase}
      </span>
      {step.tool && <span className="font-mono text-brand-600">{step.tool}</span>}
      {step.intent && <span className="text-slate-500 truncate">{step.intent}</span>}
      {step.duration_ms !== undefined && <span className="ml-auto text-slate-400">{step.duration_ms}ms</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  2. COMPLIANCE TAB
// ═══════════════════════════════════════════════════════════════════
function ComplianceTab() {
  const [frameworks, setFrameworks] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [report, setReport] = useState<FrameworkReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFrameworks, setLoadingFrameworks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFrameworks = useCallback(() => {
    setError(null);
    setLoadingFrameworks(true);
    fetchFrameworks()
      .then(setFrameworks)
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoadingFrameworks(false));
  }, []);

  useEffect(() => { loadFrameworks(); }, [loadFrameworks]);

  const runAudit = async (fwId: string) => {
    setSelectedFramework(fwId);
    setReport(null);
    setError(null);
    setLoading(true);
    try {
      const r = await evaluateCompliance(fwId);
      setReport(r);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Compliance Audit Engine</h2>
            <p className="text-xs text-slate-500">Automated gap analysis against industry frameworks</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <ErrorNotice message={error} onRetry={loadFrameworks} />}
        {/* Framework Selector */}
        <section>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Compliance Framework</h3>
          {loadingFrameworks ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading frameworks...</div>
          ) : frameworks.length === 0 ? (
            <p className="text-sm text-slate-500">No frameworks available. Start the backend server first.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {frameworks.map(fw => (
                <button
                  key={fw.id}
                  onClick={() => runAudit(fw.id)}
                  disabled={loading}
                  className={cn(
                    'text-left p-4 rounded-xl border transition-all',
                    selectedFramework === fw.id
                      ? 'border-brand-400 bg-brand-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm'
                  )}
                >
                  <h4 className="font-medium text-sm text-slate-800">{fw.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{fw.count} requirements</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <p className="text-sm text-slate-600">Running compliance evaluation... This may take a minute.</p>
            <p className="text-xs text-slate-400">Analyzing documents against each control requirement</p>
          </div>
        )}

        {/* Report */}
        {report && !loading && (
          <>
            {/* Summary Cards */}
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Audit Summary — {report.framework_name}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard
                  label="Overall Score"
                  value={formatPercent(report.compliance_score)}
                  color="brand"
                  icon={<BarChart3 className="w-4 h-4" />}
                />
                <SummaryCard
                  label="Covered"
                  value={String(report.covered)}
                  color="emerald"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                />
                <SummaryCard
                  label="Partial"
                  value={String(report.partially_covered)}
                  color="amber"
                  icon={<AlertTriangle className="w-4 h-4" />}
                />
                <SummaryCard
                  label="Missing"
                  value={String(report.missing)}
                  color="red"
                  icon={<XCircle className="w-4 h-4" />}
                />
              </div>
            </section>

            {/* Compliance Score Bar */}
            <section>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div className="h-full rounded-full flex">
                  <div
                    className="bg-emerald-500 transition-all duration-700"
                    style={{ width: `${(report.covered / report.total_requirements) * 100}%` }}
                  />
                  <div
                    className="bg-amber-400 transition-all duration-700"
                    style={{ width: `${(report.partially_covered / report.total_requirements) * 100}%` }}
                  />
                  <div
                    className="bg-red-400 transition-all duration-700"
                    style={{ width: `${(report.missing / report.total_requirements) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Covered</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Partial</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Missing</span>
              </div>
            </section>

            {/* Findings List */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Detailed Findings</h3>
              {report.findings.map((f, i) => (
                <FindingCard key={f.id} finding={f} index={i + 1} />
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700 border-brand-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <div className={cn('p-4 rounded-xl border', colorMap[color] || colorMap.brand)}>
      <div className="flex items-center gap-2 mb-1 opacity-70">{icon}<span className="text-[11px] font-medium">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function FindingCard({ finding, index }: { finding: ComplianceFinding; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-xs text-slate-400 font-mono w-6">{String(index).padStart(2, '0')}</span>
        {statusIcon(finding.status)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{finding.title}</p>
          <p className="text-[11px] text-slate-500">{finding.id} · {finding.category}</p>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', statusColor(finding.status))}>
          {finding.status.replace('_', ' ')}
        </span>
        <span className="text-xs text-slate-400 w-10 text-right">{formatPercent(finding.confidence)}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          {/* Requirement */}
          <div className="mt-3">
            <p className="text-[11px] font-medium text-slate-500 mb-1">REQUIREMENT</p>
            <p className="text-xs text-slate-700">{finding.requirement}</p>
          </div>

          {/* Evidence */}
          {finding.evidence && finding.evidence.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">EVIDENCE ({finding.evidence.length})</p>
              <div className="space-y-1.5">
                {finding.evidence.map((ev, j) => (
                  <div key={j} className="p-2 rounded bg-emerald-50 border border-emerald-100 text-xs">
                    <p className="font-medium text-emerald-800">{ev.doc_title} — {ev.section}</p>
                    {ev.verbatim_excerpt && (
                      <p className="text-emerald-700 mt-0.5 italic line-clamp-3">&ldquo;{ev.verbatim_excerpt}&rdquo;</p>
                    )}
                    <p className="text-[10px] text-emerald-600 mt-0.5">Relevance: {formatPercent(ev.relevance_score)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gaps */}
          {finding.gaps && finding.gaps.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">IDENTIFIED GAPS</p>
              <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                {finding.gaps.map((g, j) => <li key={j}>{g}</li>)}
              </ul>
            </div>
          )}

          {/* Remediation */}
          {finding.remediation && (
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">REMEDIATION</p>
              <p className="text-xs text-slate-700">{finding.remediation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  3. KNOWLEDGE VAULT TAB
// ═══════════════════════════════════════════════════════════════════
function VaultTab() {
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<VaultNote | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [view, setView] = useState<'notes' | 'graph'>('notes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVault = useCallback(() => {
    setError(null);
    setLoading(true);
    Promise.all([fetchVaultNotes(), fetchVaultGraph()])
      .then(([n, g]) => { setNotes(n); setGraphData(g); })
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadVault(); }, [loadVault]);

  const openNote = async (slug: string) => {
    try {
      const note = await fetchVaultNote(slug);
      setSelectedNote(note);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <BookOpen className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Obsidian Knowledge Vault</h2>
              <p className="text-xs text-slate-500">
                {notes.length} notes · {graphData?.links?.length || 0} links · Wiki-style interlinked knowledge
              </p>
            </div>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('notes')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === 'notes' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              )}
            >Notes</button>
            <button
              onClick={() => setView('graph')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === 'graph' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              )}
            >Graph</button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {error && <div className="px-6 pt-4"><ErrorNotice message={error} onRetry={loadVault} /></div>}
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading vault...
          </div>
        ) : view === 'notes' ? (
          <div className="flex h-full">
            {/* Notes List */}
            <div className="w-72 border-r border-slate-200 overflow-y-auto bg-white">
              {notes.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No notes yet. Ingest documents and run compliance analysis first.</p>
              ) : (
                notes.map(note => (
                  <button
                    key={note.slug}
                    onClick={() => openNote(note.slug)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors',
                      selectedNote?.slug === note.slug && 'bg-brand-50 border-l-2 border-l-brand-500'
                    )}
                  >
                    <p className="text-sm font-medium text-slate-800 truncate">{note.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{note.type}</span>
                      {note.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Hash className="w-2.5 h-2.5" />{tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Note Detail */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedNote ? (
                <div className="max-w-2xl">
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{selectedNote.title}</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">{selectedNote.type}</span>
                    {selectedNote.tags?.map(tag => (
                      <span key={tag} className="text-xs text-slate-400 flex items-center gap-0.5">
                        <Tag className="w-3 h-3" />{tag}
                      </span>
                    ))}
                  </div>

                  {/* Content */}
                  <div className="prose prose-sm prose-slate max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedNote.content || '_No content available_'}
                    </ReactMarkdown>
                  </div>

                  {/* Backlinks */}
                  {selectedNote.backlinks && selectedNote.backlinks.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-2">BACKLINKS ({selectedNote.backlinks.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedNote.backlinks.map(bl => (
                          <button
                            key={bl.id}
                            onClick={() => openNote(bl.id)}
                            className="text-xs px-2 py-1 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                          >
                            ← {bl.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outgoing Links */}
                  {selectedNote.outgoing && selectedNote.outgoing.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-500 mb-2">OUTGOING LINKS ({selectedNote.outgoing.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedNote.outgoing.map(ol => (
                          <button
                            key={ol.id}
                            onClick={() => openNote(ol.id)}
                            className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                          >
                            {ol.title} →
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">
                  Select a note to view its content and links
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Graph View */
          <KnowledgeGraph graphData={graphData} onNodeClick={slug => { setView('notes'); openNote(slug); }} />
        )}
      </div>
    </div>
  );
}

// ─── SVG Knowledge Graph Visualization ────────────────────────────
function KnowledgeGraph({ graphData, onNodeClick }: { graphData: GraphData | null; onNodeClick: (slug: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const update = () => {
      if (svgRef.current?.parentElement) {
        setDimensions({
          width: svgRef.current.parentElement.clientWidth,
          height: svgRef.current.parentElement.clientHeight,
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        <div className="text-center">
          <Network className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p>No knowledge graph data yet</p>
          <p className="text-xs">Ingest documents and run compliance analysis to build the graph</p>
        </div>
      </div>
    );
  }

  // Simple force-directed layout (precomputed positions using deterministic algorithm)
  const nodePositions = computeNodePositions(graphData, dimensions.width, dimensions.height);

  const nodeColorMap: Record<string, string> = {
    'policy-document': '#6366f1',
    'compliance-finding': '#10b981',
    'uploaded-document': '#3b82f6',
    default: '#64748b',
  };

  return (
    <div className="w-full h-full relative bg-slate-50">
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
        {/* Links */}
        {graphData.links.map((link, i) => {
          const source = nodePositions[link.source];
          const target = nodePositions[link.target];
          if (!source || !target) return null;
          return (
            <line
              key={i}
              x1={source.x} y1={source.y}
              x2={target.x} y2={target.y}
              stroke="#cbd5e1"
              strokeWidth={1}
              opacity={0.5}
            />
          );
        })}

        {/* Nodes */}
        {graphData.nodes.map(node => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          const color = nodeColorMap[node.type] || nodeColorMap.default;
          const r = Math.max(6, Math.min(14, 6 + (node.connections || 0) * 2));
          return (
            <g key={node.id} onClick={() => onNodeClick(node.id)} className="cursor-pointer">
              <circle cx={pos.x} cy={pos.y} r={r + 3} fill={color} opacity={0.15} />
              <circle cx={pos.x} cy={pos.y} r={r} fill={color} stroke="white" strokeWidth={2} />
              <text
                x={pos.x}
                y={pos.y + r + 14}
                textAnchor="middle"
                className="text-[10px] fill-slate-600 pointer-events-none"
                fontFamily="system-ui"
              >
                {node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
        <p className="text-[10px] font-semibold text-slate-500 mb-1.5">NODE TYPES</p>
        {Object.entries(nodeColorMap).filter(([k]) => k !== 'default').map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 text-[10px] text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {type.replace(/-/g, ' ')}
          </div>
        ))}
      </div>
    </div>
  );
}

function computeNodePositions(graphData: GraphData, width: number, height: number) {
  const positions: Record<string, { x: number; y: number }> = {};
  const nodes = graphData.nodes;
  const cx = width / 2;
  const cy = height / 2;
  const radiusX = Math.min(width, 600) * 0.35;
  const radiusY = Math.min(height, 400) * 0.35;

  // Place nodes in ellipse layout, slightly jittered
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const jitter = ((i * 7919) % 50) - 25; // deterministic jitter
    positions[node.id] = {
      x: cx + Math.cos(angle) * (radiusX + jitter),
      y: cy + Math.sin(angle) * (radiusY + jitter * 0.5),
    };
  });

  return positions;
}

// ═══════════════════════════════════════════════════════════════════
//  4. DOCUMENTS TAB
// ═══════════════════════════════════════════════════════════════════
function DocumentsTab() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchDocuments()
      .then(setDocuments)
      .catch(err => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(file);
      }
      loadDocs();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Document Index</h2>
              <p className="text-xs text-slate-500">{documents.length} documents indexed · Chunk-level semantic search</p>
            </div>
          </div>
          <button
            onClick={loadDocs}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <ErrorNotice message={error} onRetry={loadDocs} />}
        {/* Upload Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
            dragOver
              ? 'border-brand-400 bg-brand-50'
              : 'border-slate-300 bg-white hover:border-brand-300 hover:bg-slate-50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.md,.markdown,.txt"
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              <p className="text-sm text-slate-600">Ingesting and indexing...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileUp className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">Drop files here or click to upload</p>
              <p className="text-xs text-slate-400">PDF, DOCX, Markdown, or Text files — SOPs, contracts, compliance docs</p>
            </div>
          )}
        </div>

        {/* Document List */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">No documents indexed yet</p>
            <p className="text-xs">Upload enterprise documents or start the backend to auto-ingest samples</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {documents.map(doc => (
              <div key={doc.doc_id} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <FileText className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                  <p className="text-xs text-slate-400">{doc.filename}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-brand-600">{doc.chunk_count} chunks</p>
                  <p className="text-[10px] text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
