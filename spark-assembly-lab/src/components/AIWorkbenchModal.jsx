import { useEffect, useMemo, useState } from 'react';
import { X, Brain, Send, Key, Trash2 } from 'lucide-react';
import { generateSparkMarkdown } from '../utils/sparkParser';

const PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', description: 'Runs in your browser with your API key' },
  { id: 'openai', label: 'OpenAI', description: 'Uses the backend proxy' },
];

const STORAGE_KEYS = {
  gemini: 'spark_lab_gemini_key',
  openai: 'spark_lab_openai_key',
};

const DEFAULT_GEMINI_MODEL = 'models/gemini-1.5-flash';
const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { id: 'gpt-4o', label: 'gpt-4o' },
];

const getStoredApiKey = (provider) => {
  try {
    return localStorage.getItem(STORAGE_KEYS[provider]) || '';
  } catch (e) {
    console.error('Failed to load API key:', e);
    return '';
  }
};

const saveApiKey = (provider, key) => {
  try {
    if (key) {
      localStorage.setItem(STORAGE_KEYS[provider], key);
    } else {
      localStorage.removeItem(STORAGE_KEYS[provider]);
    }
  } catch (e) {
    console.error('Failed to save API key:', e);
  }
};

const clearApiKey = (provider) => {
  try {
    localStorage.removeItem(STORAGE_KEYS[provider]);
  } catch (e) {
    console.error('Failed to clear API key:', e);
  }
};

export default function AIWorkbenchModal({ sparkData, onClose, onApplyMarkdown }) {
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [saveKeyToStorage, setSaveKeyToStorage] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_GEMINI_MODEL);
  const [openaiModel, setOpenaiModel] = useState(OPENAI_MODELS[0].id);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
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

  const sparkMarkdown = useMemo(() => generateSparkMarkdown(sparkData), [sparkData]);

  useEffect(() => {
    const storedKey = getStoredApiKey(selectedProvider);
    if (storedKey) {
      setApiKey(storedKey);
      setSaveKeyToStorage(true);
    } else {
      setApiKey('');
      setSaveKeyToStorage(false);
    }
  }, [selectedProvider]);

  useEffect(() => {
    if (selectedProvider !== 'gemini') return;
    if (!apiKey) {
      setAvailableModels([]);
      setModelsError(null);
      return;
    }

    const fetchGeminiModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
        );
        const data = await response.json();
        if (!response.ok) {
          const message = data?.error?.message || 'Failed to load Gemini models.';
          throw new Error(message);
        }
        const models = (data.models || [])
          .filter((model) => (model.supportedGenerationMethods || []).includes('generateContent'))
          .map((model) => model.name);
        setAvailableModels(models);
        if (models.length > 0) {
          setSelectedModel(models.includes(DEFAULT_GEMINI_MODEL) ? DEFAULT_GEMINI_MODEL : models[0]);
        }
      } catch (err) {
        setModelsError(err.message || 'Failed to load Gemini models.');
      } finally {
        setModelsLoading(false);
      }
    };

    fetchGeminiModels();
  }, [apiKey, selectedProvider]);

  const buildWorkbenchPrompt = (conversation, markdown) => {
    const historyText = conversation
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    return `You are an AI workbench helping improve a Spark document in Primer Spark Assembly Lab.

You always respond as a JSON object (no markdown code fences, no prose) with this exact shape:
{
  "reply": "short, conversational response to the user",
  "updatedSpark": "full updated spark markdown if you propose concrete edits, or an empty string if you are only discussing"
}

Spark name: ${sparkData.name}

Current Spark markdown (may be truncated):
<<<SPARK_MARKDOWN>>>
${markdown.slice(0, 8000)}
<<<END_SPARK_MARKDOWN>>>

Conversation so far:
${historyText || '(no previous conversation)'}

When you propose edits, return the full spark in updatedSpark so the UI can apply it. Do not include any keys other than reply and updatedSpark.`;
  };

  const callGeminiWorkbench = async (conversation) => {
    if (!apiKey) {
      throw new Error('Gemini API key required.');
    }
    const modelPath = selectedModel.startsWith('models/') ? selectedModel : `models/${selectedModel}`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const promptText = buildWorkbenchPrompt(conversation, sparkMarkdown);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              reply: { type: 'string' },
              updatedSpark: { type: 'string' },
            },
            required: ['reply'],
          },
        },
      }),
    });

    const responseBody = await response.json();
    if (!response.ok) {
      const message = responseBody?.error?.message || 'Gemini API request failed';
      throw new Error(message);
    }

    const candidates = responseBody?.candidates || [];
    if (candidates.length === 0) {
      const blockReason = responseBody?.promptFeedback?.blockReason;
      const safetyMessage = blockReason
        ? `Gemini blocked the response (${blockReason}). Try simplifying the spark content or your request.`
        : 'Gemini returned an empty response.';
      throw new Error(safetyMessage);
    }

    const text = candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

    const payload = JSON.parse(cleaned);
    return {
      reply: payload.reply || '',
      updatedSpark: payload.updatedSpark || '',
    };
  };

  const callOpenAIWorkbench = async (conversation) => {
    const response = await fetch('/api/workbench/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        apiKey,
        model: openaiModel,
        sparkContent: sparkMarkdown,
        sparkData: { name: sparkData.name },
        messages: conversation.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'OpenAI request failed');
    }

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
      const result =
        selectedProvider === 'gemini'
          ? await callGeminiWorkbench(baseMessages)
          : await callOpenAIWorkbench(baseMessages);

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

  const handleProviderChange = (providerId) => {
    setSelectedProvider(providerId);
    setError(null);
  };

  const handleApiKeySaveToggle = (checked) => {
    setSaveKeyToStorage(checked);
    if (checked) {
      saveApiKey(selectedProvider, apiKey);
    } else {
      clearApiKey(selectedProvider);
    }
  };

  const handleApiKeyChange = (value) => {
    setApiKey(value);
    if (saveKeyToStorage) {
      saveApiKey(selectedProvider, value);
    }
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
                Chat with Gemini or OpenAI to iteratively improve this spark.
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

          {/* Right: Provider & model settings */}
          <div className="w-full sm:w-72 flex-shrink-0 bg-black/70 flex flex-col">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-2">AI Provider</p>
              <div className="flex flex-col gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    className={`w-full text-left rounded-xl px-3 py-2 border text-xs sm:text-sm transition-all ${
                      selectedProvider === p.id
                        ? 'border-design-400 bg-design-500/15 text-white'
                        : 'border-white/15 hover:border-white/35 text-white/80 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">{p.label}</div>
                    <div className="text-[11px] text-white/60 mt-0.5">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-3 border-b border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-white/70">
                  <Key className="h-3 w-3" />
                  <span>API key</span>
                </span>
                {apiKey && (
                  <button
                    onClick={() => {
                      setApiKey('');
                      clearApiKey(selectedProvider);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={selectedProvider === 'gemini' ? 'Gemini API key' : 'OpenAI API key'}
                className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-design-400/70 focus:border-design-400/70"
              />
              <label className="flex items-center gap-2 text-[11px] text-white/60 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-white/40 bg-black/40"
                  checked={saveKeyToStorage}
                  onChange={(e) => handleApiKeySaveToggle(e.target.checked)}
                />
                <span>Remember on this browser</span>
              </label>
            </div>

            {selectedProvider === 'gemini' ? (
              <div className="px-4 py-3 space-y-2 border-b border-white/10 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Gemini model</span>
                  {modelsLoading && <span className="text-[11px] text-white/50">Loading…</span>}
                </div>
                {modelsError && (
                  <p className="text-[11px] text-red-300">{modelsError}</p>
                )}
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-design-400/70 focus:border-design-400/70"
                >
                  {[selectedModel, ...availableModels.filter((m) => m !== selectedModel)].map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-white/45">
                  Models are fetched directly from the Gemini API using your key. No keys are sent to the backend.
                </p>
              </div>
            ) : (
              <div className="px-4 py-3 space-y-2 border-b border-white/10 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/70">OpenAI model</span>
                </div>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-design-400/70 focus:border-design-400/70"
                >
                  {OPENAI_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-white/45">
                  OpenAI calls are proxied through the backend using your key or the server&apos;s configured key.
                </p>
              </div>
            )}

            <div className="px-4 py-3 text-[10px] text-white/45 space-y-1">
              <p>
                The AI workbench can propose full spark rewrites. Review changes before applying; they will update the local spark
                in this browser only until you submit a PR.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
