import { useState, useEffect } from 'react';
import { X, Brain, Award, AlertCircle, Key, Trash2 } from 'lucide-react';
import { generateSparkMarkdown } from '../utils/sparkParser';

const PROVIDERS = [
  { id: 'gemini', label: 'Gemini', description: 'Direct from your browser' },
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

// Helper functions for secure storage
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

export default function QuizModal({ sparkData, onClose }) {
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [saveKeyToStorage, setSaveKeyToStorage] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_GEMINI_MODEL);
  const [openaiModel, setOpenaiModel] = useState(OPENAI_MODELS[0].id);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [quizMode, setQuizMode] = useState('1');
  const [quizStarted, setQuizStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load stored API key when provider changes
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

  const fetchGeminiModels = async () => {
    if (!apiKey || selectedProvider !== 'gemini') {
      setAvailableModels([]);
      setModelsError(null);
      return;
    }

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

  useEffect(() => {
    if (selectedProvider === 'gemini') {
      fetchGeminiModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, selectedProvider]);

  const buildGeminiPrompt = () => {
    const sparkContent = generateSparkMarkdown(sparkData);
    const focusMap = {
      '1': 'Spark Narrative',
      '2': 'Hypothesis Formalization',
      '3': 'Simulation / Modeling Plan',
      '4': 'Evaluation Strategy'
    };
    const focusTitle = focusMap[quizMode] || 'GENERAL';

    return `You are an expert quiz generator for TheCommons Spark Assembly Lab.

This quiz is a reflection exercise to strengthen the spark. There are no right answers.
Focus the questions on: ${focusTitle}.

Generate 5 multiple-choice quiz questions based on the following Spark document. Questions should test understanding of:
1. The problem/gap identified in the SPARK phase
2. The Novel Core (10% Delta) in the DESIGN phase
3. The technical implementation in the LOGIC phase
4. TheCommons framework concepts (roles, rewards, assembly line)
5. The overall spark's value proposition

Spark Name: ${sparkData.name}

Spark Content:
${sparkContent.slice(0, 3000)}

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation):
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "phase": "spark"
  }
]

Phase values must be one of: "spark", "design", "logic", or "general".
Do NOT include correct answers.
Make questions engaging and educational.`;
  };

  const buildSummaryPrompt = () => {
    const sparkContent = generateSparkMarkdown(sparkData);
    const answerLines = questions.map((q, idx) => {
      const selectedIndex = selectedAnswers[idx];
      const selectedText = Number.isInteger(selectedIndex) ? q.options[selectedIndex] : 'No answer';
      return `${idx + 1}. ${q.question}\nSelected: ${selectedText}`;
    }).join('\n\n');

    const focusMap = {
      '1': 'Spark Narrative',
      '2': 'Hypothesis Formalization',
      '3': 'Simulation / Modeling Plan',
      '4': 'Evaluation Strategy'
    };
    const focusTitle = focusMap[quizMode] || 'GENERAL';

    return `You are a Spark mentor. Provide a detailed and comprehensive feedback report based on the user's answers.

Focus area: ${focusTitle}.
There are no right or wrong answers. The goal is to strengthen the spark.

Spark Name: ${sparkData.name}

Spark Content:
${sparkContent.slice(0, 3000)}

User Answers:
${answerLines}

Return a thorough, structured feedback report with:
- Detailed strengths you observe
- Specific risks or gaps to consider
- Concrete suggested next steps
- One insightful clarifying question to ask the team

Ensure the report is complete and does not cut off. Write in plain text.`;
  };

  const generateGeminiQuiz = async () => {
    const modelPath = selectedModel.startsWith('models/') ? selectedModel : `models/${selectedModel}`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const fetchGemini = async (promptText) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  options: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  phase: { type: 'string' },
                },
                required: ['question', 'options', 'phase'],
              },
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
          ? `Gemini blocked the response (${blockReason}). Try rephrasing or shortening the spark content.`
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

      let normalized = text;
      if (normalized.startsWith('```json')) {
        normalized = normalized.slice(7);
      }
      if (normalized.startsWith('```')) {
        normalized = normalized.slice(3);
      }
      if (normalized.endsWith('```')) {
        normalized = normalized.slice(0, -3);
      }
      normalized = normalized.trim();

      const arrayMatch = normalized.match(/\[[\s\S]*\]/);
      const jsonPayload = arrayMatch ? arrayMatch[0] : normalized;
      return JSON.parse(jsonPayload);
    };

    try {
      return await fetchGemini(buildGeminiPrompt());
    } catch (err) {
      const strictPrompt = `${buildGeminiPrompt()}

IMPORTANT: Return ONLY a valid JSON array. Do not include any prose, markdown, or trailing commas. Ensure all strings use double quotes and are properly escaped.`;
      try {
        return await fetchGemini(strictPrompt);
      } catch (retryErr) {
        const message = retryErr.message || err.message || 'Gemini returned invalid JSON.';
        throw new Error(`Gemini returned invalid JSON. Please try again. Details: ${message}`);
      }
    }
  };

  const generateGeminiSummary = async () => {
    const modelPath = selectedModel.startsWith('models/') ? selectedModel : `models/${selectedModel}`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildSummaryPrompt() }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4000,
          responseMimeType: 'text/plain',
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
        ? `Gemini blocked the response (${blockReason}). Try rephrasing or shortening the spark content.`
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

    return text;
  };

  const generateOpenAIQuiz = async () => {
    const response = await fetch('/api/quiz/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'openai',
        apiKey,
        model: openaiModel,
        prompt: buildGeminiPrompt(),
        focus: quizMode,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'OpenAI request failed');
    }

    return data.questions || [];
  };

  const generateOpenAISummary = async () => {
    const response = await fetch('/api/quiz/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'openai',
        apiKey,
        model: openaiModel,
        prompt: buildSummaryPrompt(),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'OpenAI summary request failed');
    }

    return data.summary || '';
  };

  const handleStartQuiz = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!apiKey || apiKey.trim() === '') {
        throw new Error(`Please enter your ${selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key to proceed.`);
      }

      if (saveKeyToStorage) {
        saveApiKey(selectedProvider, apiKey);
      }

      const quiz = selectedProvider === 'openai'
        ? await generateOpenAIQuiz()
        : await generateGeminiQuiz();
      if (!quiz || quiz.length === 0) {
        throw new Error('No questions generated');
      }
      setQuestions(quiz);
      setQuizStarted(true);
    } catch (err) {
      const rawMessage = err.message || '';
      const normalized = rawMessage.toLowerCase();
      if (normalized.includes('model') && normalized.includes('not found')) {
        setError(selectedProvider === 'openai'
          ? 'That OpenAI model is not available for your key. Try a different model.'
          : 'That Gemini model is not available for your key. Use the model dropdown to pick an available one, then try again.');
      } else if (normalized.includes('insufficient_quota') || normalized.includes('quota')) {
        setError(selectedProvider === 'openai'
          ? 'Your OpenAI quota is exceeded. Please add billing at https://platform.openai.com/account/billing/overview, or use a different key.'
          : 'Your Gemini quota is exceeded. Please add billing at https://aistudio.google.com/app/billing, or use a different key.');
      } else {
        setError(rawMessage || 'Failed to generate quiz. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex, answerIndex) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: answerIndex,
    });
  };

  const handleClearApiKey = () => {
    clearApiKey(selectedProvider);
    setApiKey('');
    setSaveKeyToStorage(false);
  };

  const handleCopySummary = async () => {
    if (!summary || summaryLoading) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setCopyStatus('failed');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const handleNext = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      return;
    }

    setShowResults(true);
    setSummaryLoading(true);
    setSummary('');

    try {
      const report = selectedProvider === 'openai'
        ? await generateOpenAISummary()
        : await generateGeminiSummary();
      setSummary(report);
    } catch (err) {
      setSummary(err.message || 'Failed to generate summary.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const getPhaseColor = (phase) => {
    if (phase === 'spark') return 'text-spark-400';
    if (phase === 'design') return 'text-design-400';
    if (phase === 'logic') return 'text-logic-400';
    return 'theme-muted';
  };

  if (showResults) {
    return (
      <div className="fixed inset-0 z-50 theme-overlay backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
        <div className="theme-panel rounded-xl border-2 border-design-600 w-full max-w-2xl shadow-2xl max-h-[95vh] overflow-y-auto">
          <div className="bg-design-600 px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl flex items-center justify-between sticky top-0">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Award className="h-6 w-6 sm:h-8 sm:w-8" />
              <h2 className="text-lg sm:text-2xl font-bold">Reflection Summary</h2>
            </div>
            <button onClick={onClose} className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          <div className="p-4 sm:p-8">
            <p className="text-sm theme-subtle mb-4">
              Focus area: <span className="font-semibold text-white">{quizMode.toUpperCase()}</span>
            </p>

            {summaryLoading ? (
              <div className="text-center py-8 theme-subtle">
                <div className="text-sm">Generating your feedback report...</div>
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed bg-design-900/10 border border-design-700/40 rounded-lg p-4">
                {summary || 'No summary available.'}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={handleCopySummary}
                disabled={!summary || summaryLoading}
                className="px-4 py-3 bg-design-900/30 hover:bg-design-900/40 border border-design-700/60 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy Failed' : 'Copy Summary'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-design-600 hover:bg-design-700 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (quizStarted) {
    const q = questions[currentQuestion];
    const hasAnswered = selectedAnswers[currentQuestion] !== undefined;

    return (
      <div className="fixed inset-0 z-50 theme-overlay backdrop-blur-sm flex items-center justify-center p-4">
        <div className="theme-panel rounded-xl border-2 border-design-600 w-full max-w-2xl shadow-2xl">
          <div className="bg-design-600 px-6 py-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="h-6 w-6" />
              <h2 className="text-xl font-bold">
                Question {currentQuestion + 1} of {questions.length}
              </h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-4 sm:p-8">
            <div className="mb-4 sm:mb-6">
              <span className={`text-xs font-semibold uppercase ${getPhaseColor(q.phase)}`}>
                {q.phase === 'general' ? 'Reflection' : `${q.phase} Focus`}
              </span>
              <h3 className="text-lg sm:text-xl font-semibold mt-2">{q.question}</h3>
            </div>

            <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
              {q.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswerSelect(currentQuestion, idx)}
                  className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all ${selectedAnswers[currentQuestion] === idx
                    ? 'border-design-500 bg-design-900/20'
                    : 'theme-border theme-border-hover theme-card'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedAnswers[currentQuestion] === idx
                        ? 'border-design-500 bg-design-500'
                        : 'theme-border'
                        }`}
                    >
                      {selectedAnswers[currentQuestion] === idx && (
                        <div className="w-3 h-3 rounded-full bg-white"></div>
                      )}
                    </div>
                    <span>{option}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm theme-muted">
                {Object.keys(selectedAnswers).length} of {questions.length} answered
              </div>
              <button
                onClick={handleNext}
                disabled={!hasAnswered}
                className="px-6 py-2 bg-design-600 hover:bg-design-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentQuestion < questions.length - 1 ? 'Next' : 'Finish'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 theme-overlay backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="theme-panel rounded-xl border-2 border-design-600 w-full max-w-2xl shadow-2xl">
        <div className="bg-design-600 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">Improve Spark</h2>
              <p className="text-sm opacity-90">
                Get AI feedback to strengthen your spark
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Spark: {sparkData.name}</h3>
            <p className="text-sm theme-muted">
              Choose a focus area and provider to guide the reflection quiz. There are no right answers.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Provider</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${selectedProvider === provider.id
                    ? 'border-design-500 bg-design-900/20'
                    : 'theme-border theme-border-hover theme-card'
                    }`}
                >
                  <div className="text-sm font-semibold">{provider.label}</div>
                  <div className="text-xs theme-subtle mt-1">{provider.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Focus Area</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: '1', label: '1. Spark Narrative', description: 'The core story of the idea' },
                { id: '2', label: '2. Hypothesis', description: 'Falsifiable statement' },
                { id: '3', label: '3. Simulation Plan', description: 'Test the idea before implementation' },
                { id: '4', label: '4. Evaluation', description: 'Define how evidence is gathered' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setQuizMode(option.id)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${quizMode === option.id
                      ? 'border-design-500 bg-design-900/20'
                      : 'theme-border theme-border-hover theme-card'
                    }`}
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className="text-xs theme-subtle mt-1">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold">
                <Key className="inline h-4 w-4 mr-1" />
                {selectedProvider === 'openai' ? 'OpenAI API Key' : 'Gemini API Key'}
              </label>
              {apiKey && (
                <button
                  onClick={handleClearApiKey}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center space-x-1"
                  title="Clear saved API key"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key...`}
              className="w-full theme-input rounded border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-design-500"
            />
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveKeyToStorage}
                  onChange={(e) => setSaveKeyToStorage(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-design-600 focus:ring-design-500"
                />
                <span className="text-xs theme-subtle">Save to browser (localStorage)</span>
              </label>
            </div>
            <p className="text-xs theme-subtle mt-2">
              🔒 Your {selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key will be stored securely in your browser and never sent to our servers.
            </p>
          </div>

          {selectedProvider === 'gemini' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold">Gemini Model</label>
                <button
                  onClick={fetchGeminiModels}
                  disabled={!apiKey || modelsLoading}
                  className="text-xs theme-muted-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh model list"
                >
                  {modelsLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!apiKey || availableModels.length === 0}
                className="w-full theme-input rounded border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-design-500 disabled:opacity-50"
              >
                {availableModels.length === 0 ? (
                  <option value={selectedModel}>Enter API key to load models</option>
                ) : (
                  availableModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))
                )}
              </select>
              {modelsError && (
                <p className="text-xs text-red-300 mt-2">{modelsError}</p>
              )}
              {!modelsError && availableModels.length > 0 && (
                <p className="text-xs theme-subtle mt-2">
                  Select a model that supports generateContent for your account.
                </p>
              )}
            </div>
          )}

          {selectedProvider === 'openai' && (
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">OpenAI Model</label>
              <select
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="w-full theme-input rounded border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-design-500"
              >
                {OPENAI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
              <p className="text-xs theme-subtle mt-2">
                Select the OpenAI model available on your account.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-600 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleStartQuiz}
            disabled={!apiKey || loading}
            className="w-full px-6 py-3 bg-design-600 hover:bg-design-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating Quiz...' : 'Start Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}
