import { useEffect, useMemo, useState } from 'react';
import { X, Brain, Send } from 'lucide-react';
import { generateSparkMarkdown } from '../utils/sparkParser';
import { runAgent } from '../utils/apiClient';
import {
  getActiveLlmConfig,
  getBackendConfigForVendor,
} from '../utils/llmConfig';

export default function AIWorkbenchModal({ sparkData, onClose, onApplyMarkdown }) {
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
    // Refresh LLM config when the modal mounts so it reflects the latest login.
    setLlmConfig(getActiveLlmConfig());
  }, []);

  const callOpenAIWorkbench = async (conversation) => {
    const cfg = getActiveLlmConfig();
    const { provider, model } = getBackendConfigForVendor(cfg.vendorId);

    if (!cfg.apiKey) {
      throw new Error('No LLM API key configured. Use LLM Login in the header to enter a key for Codex or Claude Code.');
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 theme-overlay backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border-2 border-design-500 bg-black/90 shadow-[0_0_50px_-12px_rgba(56,189,248,0.6)] backdrop-blur-xl flex flex-col">
        {/* Header */}
        <div className="relative px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-spark-900/70 via-black to-logic-900/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-design-500 shadow-[0_0_15px_rgba(56,189,248,0.8)]">
              <Brain className="h-6 w-6 text-black" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">AI Workbench</h2>
              <p className="text-[11px] sm:text-xs text-white/70 truncate">
                Chat with Codex or Claude Code to iteratively improve this spark.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors flex-shrink-0"
            aria-label="Close AI Workbench"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-white/10 min-h-0">
          {/* Left: Chat */}
          <div className="flex-1 flex flex-col bg-black/60">
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 custom-scrollbar">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-full sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm border ${
                    m.role === 'assistant'
                      ? 'ml-0 mr-auto bg-white/5 border-white/15'
                      : 'ml-auto mr-0 bg-design-600/90 border-design-400/60 text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  {m.role === 'assistant' && m.updatedSpark && (
                    <button
                      onClick={() => handleApply(m.updatedSpark)}
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-logic-600/90 hover:bg-logic-500 text-[11px] font-semibold px-2.5 py-1 text-white transition-colors"
                    >
                      <span>Apply suggested spark update</span>
                    </button>
                  )}
                  {m.role === 'assistant' && m.updatedSpark && (
                    <button
                      onClick={() => setDiffTarget(m.updatedSpark)}
                      className="mt-2 ml-2 inline-flex items-center gap-1 rounded-full border border-design-500/70 bg-black/40 hover:bg-design-500/10 text-[10px] px-2 py-0.5 text-design-200 transition-colors"
                    >
                      View diff
                    </button>
                  )}
                </div>
              ))}

              {messages.length === 0 && (
                <p className="text-xs text-white/60">No messages yet. Ask the AI to help you rewrite or critique any part of this spark.</p>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-white/10 px-4 sm:px-5 py-3 bg-black/80 flex flex-col gap-2">
              {error && (
                <div className="text-[11px] text-red-300 bg-red-900/30 border border-red-500/40 rounded px-2 py-1">
                  {error}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  className="flex-1 resize-none rounded-2xl bg-black/40 border border-white/15 px-3 py-2 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-design-400/70 focus:border-design-400/70 custom-scrollbar"
                  placeholder="Ask the AI to tighten the narrative, suggest experiments, rewrite a section, etc."
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
                  className="inline-flex items-center justify-center rounded-full bg-design-500 hover:bg-design-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold shadow-lg shadow-design-500/40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Provider, task, and context inspector */}
          <div className="w-full sm:w-80 flex-shrink-0 bg-black/70 flex flex-col">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-2">LLM Provider</p>
              <div className="text-xs text-white/80">
                <p className="font-semibold">{vendor?.label || 'Not configured'}</p>
                <p className="text-[11px] text-white/60 mt-0.5">
                  {apiKey
                    ? vendor?.description || 'Using configured LLM.'
                    : 'No API key configured. Use LLM Login in the header to set up Codex or Claude Code.'}
                </p>
                {vendor && (
                  <p className="text-[10px] text-white/55 mt-1">
                    Model: {getBackendConfigForVendor(vendor.id).model}
                  </p>
                )}
              </div>
            </div>

            <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
              <span className="uppercase tracking-[0.18em] text-white/50 font-semibold">Task</span>
              <button
                type="button"
                onClick={() => setSelectedTask('improve_spark_maturity')}
                className={`px-2.5 py-1 rounded-full border ${
                  selectedTask === 'improve_spark_maturity'
                    ? 'border-design-400 bg-design-500/20 text-design-100'
                    : 'border-white/20 text-white/65 hover:border-design-400/70 hover:text-design-100'
                }`}
              >
                Audit maturity
              </button>
              <button
                type="button"
                onClick={() => setSelectedTask('design_experiment_from_spark')}
                className={`px-2.5 py-1 rounded-full border ${
                  selectedTask === 'design_experiment_from_spark'
                    ? 'border-design-400 bg-design-500/20 text-design-100'
                    : 'border-white/20 text-white/65 hover:border-design-400/70 hover:text-design-100'
                }`}
              >
                Refine experiment
              </button>
              <button
                type="button"
                onClick={() => setSelectedTask('summarize_results_for_review')}
                className={`px-2.5 py-1 rounded-full border ${
                  selectedTask === 'summarize_results_for_review'
                    ? 'border-design-400 bg-design-500/20 text-design-100'
                    : 'border-white/20 text-white/65 hover:border-design-400/70 hover:text-design-100'
                }`}
              >
                Summarize results
              </button>
            </div>

            <div className="px-4 py-3 border-b border-white/10 text-[10px] text-white/45 space-y-1">
              <p>
                The AI workbench uses your configured LLM (Codex or Claude Code) via the backend. Review changes before applying;
                they will update the local spark in this browser only until you submit a PR.
              </p>
            </div>

            <div className="px-4 py-3 text-[11px] text-white/70 border-t border-white/10 bg-black/80">
              <p className="font-semibold text-white/80 mb-1">Context Window Inspector</p>
              {lastContext ? (
                <div className="space-y-1">
                  <div>
                    <span className="text-white/55">Estimated tokens: </span>
                    <span className="text-design-300">{lastContext.estimated_tokens ?? 'n/a'}</span>
                  </div>
                  <p className="text-[10px] text-white/55 mt-1">
                    RAG / technical sections (stubbed in Phase 2) focus on:
                  </p>
                  <ul className="list-disc list-inside text-[10px] text-white/60">
                    <li>Section 3 — Simulation / Modeling Plan</li>
                    <li>Section 4 — Evaluation Strategy</li>
                  </ul>
                </div>
              ) : (
                <p className="text-[10px] text-white/55">Run an LLM task to see approximate token usage and technical sections here.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      {diffTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 theme-overlay backdrop-blur-sm">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border-2 border-design-500 bg-black/95 flex flex-col">
            <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-white/10 bg-gradient-to-r from-design-900/70 via-black to-logic-900/70">
              <p className="text-sm sm:text-base font-semibold text-white">Proposed Changes Preview</p>
              <button
                type="button"
                onClick={() => setDiffTarget(null)}
                className="p-1.5 rounded-lg hover:bg-white/10"
                aria-label="Close diff"
              >
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden">
              <div className="flex flex-col min-h-[200px]">
                <div className="px-4 sm:px-5 py-2 border-b border-white/10 text-xs font-semibold text-white/70">Current spark</div>
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 text-[11px] leading-relaxed text-white/70 font-mono bg-black/70">
                  <pre className="whitespace-pre-wrap break-words">
                    {sparkMarkdown.slice(0, 6000)}
                  </pre>
                </div>
              </div>
              <div className="flex flex-col min-h-[200px]">
                <div className="px-4 sm:px-5 py-2 border-b border-white/10 text-xs font-semibold text-white/70">AI‑proposed spark</div>
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 text-[11px] leading-relaxed text-white/70 font-mono bg-black/70">
                  <pre className="whitespace-pre-wrap break-words">
                    {diffTarget.slice(0, 6000)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
