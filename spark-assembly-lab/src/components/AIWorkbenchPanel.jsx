import { useEffect, useMemo, useState } from 'react';
import { X, Brain, Send, Github, Info, ChevronRight, Layout, Sparkles, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { generateSparkMarkdown } from '../utils/sparkParser';
import { runAgent } from '../utils/apiClient';
import {
  getActiveLlmConfig,
  getBackendConfigForVendor,
} from '../utils/llmConfig';

export default function AIWorkbenchPanel({ sparkData, onClose, onApplyMarkdown, isExpanded, onToggleExpand }) {
  const [{ vendor, apiKey }, setLlmConfig] = useState(() => getActiveLlmConfig());
  const [messages, setMessages] = useState(() => [
    {
      id: 'assistant-initial',
      role: 'assistant',
      content:
        'I have loaded this spark. Ask me to critique sections, propose revisions, or rewrite parts. When I attach an updated spark, you can apply it with one click.',
      updatedSpark: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTask, setSelectedTask] = useState('improve_spark_maturity');
  const [lastContext, setLastContext] = useState(null);
  const [diffTarget, setDiffTarget] = useState(null);

  const sparkMarkdown = useMemo(() => generateSparkMarkdown(sparkData), [sparkData]);

  useEffect(() => {
    // Refresh LLM config when the panel mounts/updates so it reflects the latest login.
    setLlmConfig(getActiveLlmConfig());
  }, []);

  const callOpenAIWorkbench = async (conversation) => {
    const cfg = getActiveLlmConfig();
    const { provider, model } = getBackendConfigForVendor(cfg.vendorId);

    if (!cfg.apiKey) {
      throw new Error('No LLM API key configured. Use LLM Login in the header to enter a key.');
    }

    const data = await runAgent({
      provider,
      apiKey: cfg.apiKey,
      model,
      taskType: selectedTask,
      sparkContent: sparkMarkdown,
      sparkData: { name: sparkData.name },
      messages: conversation.map((m) => ({ role: m.role, content: m.content })),
    });

    setLastContext(data.context || null);

    return {
      reply: data.reply || '',
      updatedSpark: data.updatedSpark || '',
    };
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      updatedSpark: null,
    };

    const baseMessages = [...messages, userMessage];
    setMessages(baseMessages);
    setInput('');
    setError(null);
    setSending(true);

    try {
      const result = await callOpenAIWorkbench(baseMessages);

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.reply || 'No reply generated.',
        updatedSpark: result.updatedSpark || '',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err.message || 'Failed to contact AI');
    } finally {
      setSending(false);
    }
  };

  const handleApply = (updatedMarkdown) => {
    if (!updatedMarkdown || !onApplyMarkdown) return;
    onApplyMarkdown(updatedMarkdown);
  };

  return (
    <div className="h-full flex flex-col bg-black/40 border-l theme-border backdrop-blur-xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="relative px-4 py-4 border-b theme-border flex items-center justify-between gap-3 bg-gradient-to-r from-spark-900/40 via-black/20 to-logic-900/40">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-design-500 shadow-[0_0_15px_rgba(56,189,248,0.5)]">
            <Brain className="h-5 w-5 text-black" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white uppercase">AI Workbench</h2>
            <p className="text-[10px] text-white/50 font-medium">OMNI-ORCHESTRATOR</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleExpand}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            title="Close AI Workbench"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body - Task Selection (Compact) */}
      <div className="px-4 py-3 bg-black/20 border-b theme-border flex flex-wrap gap-1.5 shadow-inner">
        <p className="w-full text-[9px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">Inference Matrix</p>
        {[
          { id: 'improve_spark_maturity', label: 'Audit Maturity' },
          { id: 'design_experiment_from_spark', label: 'Refine Experiment' },
          { id: 'summarize_results_for_review', label: 'Summarize results' },
        ].map((task) => (
          <button
            key={task.id}
            onClick={() => setSelectedTask(task.id)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
              selectedTask === task.id
                ? 'border-design-400 bg-design-500/20 text-design-300'
                : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/60'
            }`}
          >
            {task.label}
          </button>
        ))}
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.role === 'assistant' ? 'items-start' : 'items-end'
            }`}
          >
             <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-lg border ${
                m.role === 'assistant'
                  ? 'bg-white/5 border-white/10 text-white/90 shadow-black/10'
                  : 'bg-design-600/60 border-design-400/40 text-white shadow-design-600/10'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
            </div>
            
            {m.role === 'assistant' && m.updatedSpark && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => handleApply(m.updatedSpark)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-logic-600/80 hover:bg-logic-500 text-[10px] font-bold px-2.5 py-1 text-white transition-colors border border-white/10"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>APPLY UPDATE</span>
                </button>
                <button
                  onClick={() => setDiffTarget(m.updatedSpark)}
                  className="inline-flex items-center gap-1 rounded-lg border border-design-500/50 bg-black/40 hover:bg-design-500/10 text-[9px] px-2 py-1 text-design-100 transition-colors uppercase font-bold"
                >
                  View diff
                </button>
                <button
                  onClick={() => {
                    const newMessages = messages.map(msg => 
                      msg.id === m.id ? { ...msg, updatedSpark: null } : msg
                    );
                    setMessages(newMessages);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-black/20 hover:bg-red-500/10 text-[9px] px-2 py-1 text-red-400/60 hover:text-red-400 transition-colors uppercase font-bold"
                  title="Discard Proposal"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex items-center space-x-2 text-[10px] theme-subtle italic animate-pulse">
            <Brain className="h-3 w-3 animate-spin" />
            <span>AI is reasoning...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/40 border-t theme-border">
        {error && (
          <div className="mb-3 text-[10px] text-red-300 bg-red-900/30 border border-red-500/40 rounded-lg px-2 py-1.5 flex items-start gap-2">
            <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="relative flex items-end gap-2">
          <textarea
            rows={2}
            className="flex-1 resize-none rounded-xl bg-black/40 border theme-border px-3 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-design-500/50 focus:border-design-500/50 custom-scrollbar shadow-inner"
            placeholder="Suggest revisions, audit sections..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="absolute right-2 bottom-2 p-2 rounded-lg bg-design-600 hover:bg-design-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-design-600/20 group"
          >
            <Send className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
        
        {/* Footer Stats */}
        <div className="mt-3 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-white/30 px-1">
          <div className="flex items-center gap-2">
             <span className="h-1.5 w-1.5 rounded-full bg-logic-500"></span>
             <span>{vendor?.label || 'OFFLINE'}</span>
          </div>
          {lastContext?.estimated_tokens && (
            <span>{lastContext.estimated_tokens} TOKENS USED</span>
          )}
        </div>
      </div>

      {/* Diff Preview Overlays */}
      {diffTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-12 theme-overlay backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-7xl h-full overflow-hidden rounded-3xl border-2 border-design-600/40 bg-black/95 shadow-2xl flex flex-col scale-in-center">
            <div className="flex items-center justify-between px-6 py-4 border-b theme-border bg-gradient-to-r from-design-900/30 to-black">
              <div>
                <h3 className="text-xl font-black text-white italic tracking-tighter">PRE-SYNCHRONIZATION DIFF</h3>
                <p className="text-[10px] text-design-300 font-bold uppercase tracking-widest">Verify AI proposals before local application</p>
              </div>
              <button
                type="button"
                onClick={() => setDiffTarget(null)}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                aria-label="Close diff"
              >
                <X className="h-5 w-5 text-white/50" />
              </button>
            </div>
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x theme-border overflow-hidden min-h-0">
              <div className="flex flex-col bg-black/40 min-h-0">
                <div className="px-5 py-2.5 border-b theme-border text-[10px] font-black uppercase tracking-[0.2em] theme-subtle">
                   [Source Artifact]
                </div>
                <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed text-white/50 custom-scrollbar min-h-0">
                  <pre className="whitespace-pre-wrap">{sparkMarkdown}</pre>
                </div>
              </div>
              <div className="flex flex-col bg-design-900/5 min-h-0">
                <div className="px-5 py-2.5 border-b theme-border text-[10px] font-black uppercase tracking-[0.2em] text-design-400">
                   [AI Candidate]
                </div>
                <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed text-design-100/90 custom-scrollbar min-h-0">
                  <pre className="whitespace-pre-wrap">{diffTarget}</pre>
                </div>
              </div>
            </div>
            <div className="p-4 border-t theme-border flex items-center justify-center">
               <button 
                 onClick={() => {
                   handleApply(diffTarget);
                   setDiffTarget(null);
                 }}
                 className="px-8 py-2.5 rounded-xl bg-design-600 hover:bg-design-500 text-white font-black italic tracking-tighter shadow-lg shadow-design-600/40 transition-all uppercase"
               >
                 Confirm and Apply Changes
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
