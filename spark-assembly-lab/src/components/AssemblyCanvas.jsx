import { useEffect, useRef, useState } from 'react';
import { Download, Copy, Eye, Brain, GitPullRequest, RotateCcw, Trash2, MoreVertical, Plus } from 'lucide-react';
import MarkdownPreview from './MarkdownPreview';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import QuizModal from './QuizModal';
import PRTracker from './PRTracker';
import { generateSparkMarkdown, parseSparkFile, validateSparkData } from '../utils/sparkParser';
import { useToast } from '../utils/ToastContext';
import { getStoredToken, getStoredUserInfo, parseRepoUrl } from '../utils/github';
import ContributorsList from './ContributorsList';

const ENHANCED_SECTIONS_CONFIG = {
  1: { title: '1. Spark Narrative', description: 'The core story of the idea', color: 'spark' },
  2: { title: '2. Hypothesis Formalization', description: 'Convert into a falsifiable statement', color: 'design' },
  3: { title: '3. Simulation / Modeling Plan', description: 'Test the idea before full implementation', color: 'logic' },
  4: { title: '4. Evaluation Strategy', description: 'Define how evidence will be gathered and judged', color: 'design' },
  5: { title: '5. Feedback & Critique', description: 'Internal critique and counter-hypotheses', color: 'spark' },
  6: { title: '6. Results (When Available)', description: 'Observed outcomes, deviations & surprises', color: 'logic' },
  7: { title: '7. Revision Notes', description: 'How the idea evolved over iterations', color: 'design' },
  8: { title: '8. Next Actions', description: 'Concrete steps forward', color: 'spark' }
};

const buildMarkdownDraftStorageKey = (repoUrl, draftId) => {
  let repoKey = 'local';
  try {
    if (repoUrl) {
      const { owner, repo } = parseRepoUrl(repoUrl);
      repoKey = `${owner}/${repo}`;
    }
  } catch (e) {
    repoKey = repoUrl || 'local';
  }

  const safeDraftId = draftId || 'untitled';
  return `spark_lab_markdown_draft:${repoKey}:${safeDraftId}`;
};

export default function AssemblyCanvas({ sparkData, onSparkUpdate, repoUrl, originalSparkData, onResetSpark, isReadOnly, onPRCreated, canPush = true, onNewSpark }) {
  const [viewMode, setViewMode] = useState('components'); // 'components' | 'markdown'
  const [showPreview, setShowPreview] = useState(false);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showPRTracker, setShowPRTracker] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [editStatus, setEditStatus] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionDraft, setSectionDraft] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [contributors, setContributors] = useState([]);
  const [contributorsLoading, setContributorsLoading] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState('');
  const sparkDataRef = useRef(sparkData);
  const markdownDraftId = originalSparkData?.sourcePath || sparkData?.sourcePath || sparkData?.name || 'untitled';
  const markdownDraftStorageKey = buildMarkdownDraftStorageKey(repoUrl, markdownDraftId);
  const toast = useToast();
  const user = getStoredUserInfo();
  const isOwner = user && (() => {
    let repoOwner = '';
    try {
      repoOwner = parseRepoUrl(repoUrl).owner;
    } catch (e) {
      console.warn("Error parsing repo URL in isOwner check:", e);
    }
    return (
      user.login?.toLowerCase() === sparkData?.contributors?.scout?.toLowerCase() ||
      user.login?.toLowerCase() === repoOwner.toLowerCase()
    );
  })();

  useEffect(() => {
    sparkDataRef.current = sparkData;
  }, [sparkData]);

  useEffect(() => {
    if (viewMode !== 'markdown') return;

    try {
      const stored = localStorage.getItem(markdownDraftStorageKey);
      if (stored !== null) {
        setMarkdownDraft(stored);
      } else {
        setMarkdownDraft(generateSparkMarkdown(sparkDataRef.current));
      }
    } catch (e) {
      setMarkdownDraft(generateSparkMarkdown(sparkDataRef.current));
    }

    setShowMarkdownPreview(false);
  }, [viewMode, markdownDraftStorageKey]);

  useEffect(() => {
    if (viewMode !== 'markdown') return;

    const timeoutId = window.setTimeout(() => {
      try {
        localStorage.setItem(markdownDraftStorageKey, markdownDraft);
      } catch (e) {
        // Best-effort persistence.
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [markdownDraft, viewMode, markdownDraftStorageKey]);

  useEffect(() => {
    if (viewMode !== 'markdown') return;
    if (!markdownDraft) return;

    const timeoutId = window.setTimeout(() => {
      try {
        const parsed = parseSparkFile(markdownDraft);
        const current = sparkDataRef.current;
        if (!current) return;

        onSparkUpdate({
          ...current,
          name: parsed?.name || current.name,
          markedForDeletion: typeof parsed?.markedForDeletion === 'boolean' ? parsed.markedForDeletion : current.markedForDeletion,
          sections: parsed?.sections || current.sections,
          proposals: parsed?.proposals || current.proposals,
        });
      } catch (e) {
        // Best-effort parsing; keep draft editable even if parsing fails.
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [markdownDraft, onSparkUpdate, viewMode]);

  // Load contributors for the selected spark
  useEffect(() => {
    if (!sparkData?.sourcePath || !repoUrl) {
      setContributors([]);
      return;
    }

    const controller = new AbortController();
    const loadContributors = async () => {
      setContributorsLoading(true);
      try {
        const response = await fetch(`/api/contributors?repo=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(sparkData.sourcePath)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Failed to load contributors');
        }
        const data = await response.json();
        setContributors(data.contributors || []);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Failed to load contributors:', err);
        setContributors([]);
      } finally {
        setContributorsLoading(false);
      }
    };

    loadContributors();
    return () => controller.abort();
  }, [sparkData?.sourcePath, repoUrl]);


  const handleDownload = () => {
    const validation = validateSparkData(sparkData);
    if (!validation.valid) {
      toast.error(`Sanctity check failed: ${validation.errors.join('; ')}`);
      return;
    }
    const md = generateSparkMarkdown(sparkData);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sparkData.name.toLowerCase().replace(/\s+/g, '-')}.spark.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Spark downloaded successfully!');
  };

  const handleCopyToClipboard = () => {
    const validation = validateSparkData(sparkData);
    if (!validation.valid) {
      toast.error(`Sanctity check failed: ${validation.errors.join('; ')}`);
      return;
    }
    const md = generateSparkMarkdown(sparkData);
    navigator.clipboard.writeText(md).then(
      () => toast.success('Markdown copied to clipboard!'),
      () => toast.error('Failed to copy to clipboard')
    );
  };

  const calculateStability = () => {
    // Count how many active sections have meaningful content
    const sections = sparkData.sections || {};
    const activeSections = sparkData.activeSections || [1];
    return activeSections.filter(n => (sections[n] || '').trim().length > 20).length;
  };

  const stability = calculateStability();
  const validation = validateSparkData(sparkData);
  const isDirty = originalSparkData
    ? JSON.stringify(sparkData) !== JSON.stringify(originalSparkData)
    : true;

  const handleEditDone = () => {
    const result = validateSparkData(sparkData);
    if (result.valid) {
      setEditStatus({
        type: 'success',
        message: 'Saved locally. Ready to submit.',
      });
      return;
    }

    setEditStatus({
      type: 'error',
      message: `Validation failed: ${result.errors.join('; ')}`,
    });
  };

  const openSectionEditor = (sectionNum) => {
    setSectionDraft(sparkData.sections?.[sectionNum] || '');
    setEditingSection(sectionNum);
  };

  const saveSectionEditor = () => {
    if (!editingSection) return;

    const updated = {
      ...sparkData,
      sections: {
        ...(sparkData.sections || {}),
        [editingSection]: sectionDraft
      }
    };

    onSparkUpdate(updated);
    handleEditDone();
    setEditingSection(null);
  };


  const handleSubmit = async () => {
    // If confirmation is not yet shown, show it first
    if (!showConfirmation) {
      const validationResult = validateSparkData(sparkData);
      if (!validationResult.valid) {
        toast.error(`Sanctity check failed: ${validationResult.errors.join('; ')}`);
        return;
      }
      setShowConfirmation(true);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      toast.error('GitHub token required to submit a PR');
      setShowConfirmation(false);
      return;
    }

    setIsSubmitting(true);

    // Cool progress simulation
    for (let i = 0; i <= 100; i += 5) {
      setSyncProgress(i);
      await new Promise(r => setTimeout(r, 40));
    }

    try {
      const markdown = generateSparkMarkdown(sparkData);
      const slug = sparkData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const path = sparkData.sourcePath || `sparks/${slug || 'new-spark'}.spark.md`;
      const title = `Spark: ${sparkData.name}`;
      const body = `Automated submission from Spark Assembly Lab.`;

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          repo: repoUrl,
          path,
          content: markdown,
          title,
          body,
          isProposal: !canPush,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit PR');
      }

      if (data.is_proposal) {
        toast.success(`Proposal submitted as a PR: ${data.pr_url}`);
      } else {
        toast.success(`PR created: ${data.pr_url}`);
      }
      setShowConfirmation(false);
      if (data.pr_url) {
        window.open(data.pr_url, '_blank');
      }
      // Refresh PR counts
      if (onPRCreated) {
        onPRCreated();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit PR');
      setSyncProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (!onResetSpark || !originalSparkData) {
      return;
    }
    onResetSpark();
    setEditStatus({
      type: 'success',
      message: 'Changes reset to original content.',
    });
    toast.success('Changes reset to original content.');
  };

  const handleDeleteRequest = async () => {
    // Check if user is the owner
    if (!isOwner) {
      toast.error('Only the spark owner can delete a spark');
      return;
    }

    if (!showDeleteConfirmation) {
      setShowDeleteConfirmation(true);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      toast.error('GitHub token required to submit a delete request');
      setShowDeleteConfirmation(false);
      return;
    }

    setIsSubmitting(true);

    // Cool progress simulation
    for (let i = 0; i <= 100; i += 5) {
      setSyncProgress(i);
      await new Promise(r => setTimeout(r, 40));
    }

    try {
      const slug = sparkData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const path = sparkData.sourcePath || `sparks/${slug || 'new-spark'}.spark.md`;
      const title = `Delete Spark: ${sparkData.name}`;
      const body = `Request to delete spark: ${sparkData.name}\n\nRequested by @${user?.login}. To cancel this deletion, close this PR without merging.`;

      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          repo: repoUrl,
          path,
          title,
          body,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit delete request');
      }

      toast.success(`Delete PR created: ${data.pr_url}`);
      setShowDeleteConfirmation(false);
      if (data.pr_url) {
        window.open(data.pr_url, '_blank');
      }
      // Refresh PR counts
      if (onPRCreated) {
        onPRCreated();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit delete request');
      setSyncProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b theme-border theme-surface px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              readOnly={isReadOnly}
              value={sparkData.name}
              onChange={(e) => onSparkUpdate({ ...sparkData, name: e.target.value })}
              className={`text-xl sm:text-2xl font-bold bg-transparent border border-transparent hover:border-design-400/50 focus:border-design-500 focus:outline-none focus:ring-2 focus:ring-design-500 rounded px-2 -ml-2 w-full transition-colors ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
              placeholder="Spark Name"
            />
            <ContributorsList contributors={contributors} loading={contributorsLoading} />
            <div className="mt-1 flex items-center space-x-2">
              {(() => {
                const total = (sparkData.activeSections || [1]).length;
                const ratio = stability / total;
                const color = ratio === 0
                  ? 'bg-red-600'
                  : ratio < 0.4
                    ? 'bg-spark-600'
                    : ratio < 0.8
                      ? 'bg-design-600'
                      : 'bg-logic-600';
                return (
                  <span className={`inline-flex items-center rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-semibold ${color}`}>
                    {stability}/{total} Stable
                  </span>
                );
              })()}
              {originalSparkData && originalSparkData.name !== sparkData.name && (
                <span className="inline-flex items-center rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-semibold bg-yellow-600 text-white">
                  Edited
                </span>
              )}
              {!validation.valid && (
                <span className="text-xs text-red-300">Sanctity check failed</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs theme-subtle hidden sm:inline">View</span>
              <select
                value={viewMode}
                onChange={(e) => {
                  const nextMode = e.target.value;
                  setViewMode(nextMode);
                  setShowPreview(false);
                  setShowPRTracker(false);
                  if (nextMode === 'markdown') setShowMarkdownPreview(false);
                }}
                className="rounded-lg theme-button px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors"
              >
                <option value="components">Components</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>

            {/* Primary Toggle: Create New Spark */}
            <button
              onClick={onNewSpark}
              className="flex items-center justify-center rounded-lg bg-design-600 hover:bg-design-700 p-1.5 sm:p-2 transition-colors flex-shrink-0 group relative"
              title="Create New Spark"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[70] border border-white/10">
                New Spark
              </span>
            </button>

            {/* Primary Toggle: Preview/Edit */}
            {viewMode === 'components' && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center space-x-1 sm:space-x-2 rounded-lg theme-button px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0"
              >
                <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{showPreview ? 'Edit' : 'Preview'}</span>
              </button>
            )}

            {/* Primary Action: Submit */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isReadOnly || !isDirty}
              className={`flex items-center space-x-1 sm:space-x-2 rounded-lg bg-logic-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold hover:bg-logic-700 transition-colors disabled:opacity-60 whitespace-nowrap flex-shrink-0 ${isReadOnly || !isDirty ? 'cursor-not-allowed grayscale' : ''}`}
            >
              <GitPullRequest className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{canPush ? 'Submit' : 'Propose'}</span>
            </button>

            {/* Secondary Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-2 rounded-lg theme-button hover:bg-white/10 transition-colors flex-shrink-0"
                title="More actions"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {showDropdown && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-[55]"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 rounded-xl theme-panel border theme-border shadow-2xl z-[60] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => { setShowQuiz(true); setShowDropdown(false); }}
                      disabled={!user}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm hover:bg-design-500/10 transition-colors disabled:opacity-50"
                    >
                      <Brain className="h-4 w-4 text-design-400" />
                      <span>Quiz</span>
                    </button>

                    <button
                      onClick={() => { setShowPRTracker(!showPRTracker); setShowDropdown(false); }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                    >
                      <GitPullRequest className="h-4 w-4 theme-muted" />
                      <span>Evolution</span>
                    </button>

                    <div className="h-px theme-border my-1 mx-2" />

                    <button
                      onClick={() => { handleCopyToClipboard(); setShowDropdown(false); }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                    >
                      <Copy className="h-4 w-4 theme-muted" />
                      <span>Copy MD</span>
                    </button>

                    <button
                      onClick={() => { handleDownload(); setShowDropdown(false); }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                    >
                      <Download className="h-4 w-4 theme-muted" />
                      <span>Download</span>
                    </button>

                    <div className="h-px theme-border my-1 mx-2" />

                    <button
                      onClick={() => { handleReset(); setShowDropdown(false); }}
                      disabled={!isDirty || isReadOnly}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4 text-yellow-500/80" />
                      <span>Reset</span>
                    </button>

                    <button
                      onClick={() => { handleDeleteRequest(); setShowDropdown(false); }}
                      disabled={isSubmitting || isReadOnly || !originalSparkData}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {isReadOnly && (
        <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-design-500/40 bg-design-500/10 px-3 py-2 text-xs sm:text-sm text-design-100">
          Login to edit or propose changes to this spark.
        </div>
      )}

      {/* Assembly Area */}
      {editStatus && (
        <div
          className={`mx-4 sm:mx-6 mt-4 rounded-lg border px-3 py-2 text-xs sm:text-sm ${editStatus.type === 'success'
            ? 'border-logic-600/50 bg-logic-600/10 text-logic-200'
            : 'border-red-600/50 bg-red-900/20 text-red-200'
            }`}
        >
          {editStatus.message}
        </div>
      )}

      {viewMode === 'markdown' ? (
        <div className="flex-1 overflow-y-auto">
          <div className="h-full flex flex-col p-4 sm:p-6 gap-4 sm:gap-6">
            <div className="flex-1 flex flex-col rounded-xl border-2 border-white/10 theme-panel-soft min-w-0">
              <div className="px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl bg-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold theme-muted">Markdown</h2>
                  <p className="text-xs sm:text-sm mt-1 theme-subtle">Edits are saved locally in this browser</p>
                </div>
                <button
                  onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                  className="flex items-center space-x-2 rounded-lg theme-button px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0"
                >
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{showMarkdownPreview ? 'Edit' : 'Preview'}</span>
                </button>
              </div>

              <div className="flex-1 p-3 sm:p-4 overflow-hidden">
                {showMarkdownPreview ? (
                  <div className="h-full overflow-y-auto">
                    <MarkdownPreview markdown={markdownDraft || ''} />
                  </div>
                ) : (
                  <textarea
                    value={markdownDraft}
                    onChange={(e) => setMarkdownDraft(e.target.value)}
                    readOnly={isReadOnly}
                    className={`w-full h-full resize-none theme-input rounded border p-3 sm:p-4 text-xs sm:text-sm font-mono bg-black/10 overflow-y-auto ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
                    spellCheck={false}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ) : showPreview ? (
        <MarkdownPreview markdown={generateSparkMarkdown(sparkData)} />
      ) : showPRTracker ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <PRTracker
            repoUrl={repoUrl}
            sparkFile={originalSparkData?.sourcePath || sparkData.sourcePath}
            user={user}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* ── Enhanced Two-Column Split View (Now Unified) ────────────────── */}
          <div className="h-full flex flex-col lg:flex-row p-4 sm:p-6 gap-4 sm:gap-6">

            {/* LEFT: Section 1 — always Spark Narrative */}
            {(() => {
              const config = ENHANCED_SECTIONS_CONFIG[1];
              return (
                <div className={`flex-1 flex flex-col rounded-xl border-2 border-${config.color}-600 theme-panel-soft min-w-0`}>
                  <div className={`bg-${config.color}-600 px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl`}>
                    <h2 className="text-lg sm:text-xl font-bold">{config.title}</h2>
                    <p className="text-xs sm:text-sm mt-1 opacity-90">{config.description}</p>
                  </div>
                  <div className="flex-1 p-3 sm:p-4 flex flex-col overflow-hidden">
                    <div className="flex-1 theme-input rounded border p-3 sm:p-4 text-sm sm:text-base bg-black/10 overflow-y-auto">
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {sparkData.sections?.[1] || ''}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="mt-2">
                      <button onClick={() => openSectionEditor(1)} disabled={isReadOnly}
                        className={`text-xs text-${config.color}-400 hover:text-${config.color}-300 disabled:opacity-50 disabled:cursor-not-allowed`}>
                        {!isReadOnly && <span>{isOwner ? 'Edit' : 'Add'}</span>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* RIGHT: Swappable section slot */}
            {(() => {
              // The second active section (if any) is the swapped section
              const rightSectionNum = (sparkData.activeSections || [1]).find(n => n !== 1);
              const config = rightSectionNum ? ENHANCED_SECTIONS_CONFIG[rightSectionNum] : null;

              if (config) {
                // A section is selected — render it
                return (
                  <div className={`flex-1 flex flex-col rounded-xl border-2 border-${config.color}-600 theme-panel-soft min-w-0`}>
                    <div className={`bg-${config.color}-600 px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl flex items-center justify-between`}>
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold">{config.title}</h2>
                        <p className="text-xs sm:text-sm mt-1 opacity-90">{config.description}</p>
                      </div>
                      <button
                        onClick={() => onSparkUpdate({ ...sparkData, activeSections: [1] })}
                        className="text-white/70 hover:text-white text-xs border border-white/20 rounded px-2 py-1 ml-4"
                      >
                        ✕ Close
                      </button>
                    </div>
                    <div className="flex-1 p-3 sm:p-4 flex flex-col overflow-hidden">
                      <div className="flex-1 theme-input rounded border p-3 sm:p-4 text-sm sm:text-base bg-black/10 overflow-y-auto">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {sparkData.sections?.[rightSectionNum] || ''}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="mt-2">
                        <button onClick={() => openSectionEditor(rightSectionNum)} disabled={isReadOnly}
                          className={`text-xs text-${config.color}-400 hover:text-${config.color}-300 disabled:opacity-50 disabled:cursor-not-allowed`}>
                          {!isReadOnly && <span>{isOwner ? 'Edit' : 'Add'}</span>}
                        </button>
                      </div>
                    </div>

                    {/* Section picker at the bottom */}
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                      <p className="text-xs theme-subtle mb-2">Switch section:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ENHANCED_SECTIONS_CONFIG)
                          .filter(([num]) => parseInt(num) !== 1)
                          .map(([num, cfg]) => (
                            <button
                              key={num}
                              onClick={() => onSparkUpdate({ ...sparkData, activeSections: [1, parseInt(num)] })}
                              className={`text-xs px-2 py-1 rounded border transition-all ${parseInt(num) === rightSectionNum
                                ? `border-${cfg.color}-500 bg-${cfg.color}-500/20 text-${cfg.color}-300`
                                : 'border-white/10 hover:border-white/30 theme-muted hover:theme-text'
                                }`}
                            >
                              {num}. {cfg.title.split('. ')[1]}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              }

              // No section selected yet — show a picker panel and news pane
              return (
                <div className="flex-1 flex flex-col rounded-xl border-2 border-white/10 theme-panel-soft min-w-0">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl bg-white/5">
                    <h2 className="text-lg sm:text-xl font-bold theme-muted">Select a Section</h2>
                    <p className="text-xs sm:text-sm mt-1 theme-subtle">Pick a section to view alongside the Spark Narrative</p>
                  </div>
                  <div className="flex-1 p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(ENHANCED_SECTIONS_CONFIG)
                        .filter(([num]) => parseInt(num) !== 1)
                        .map(([num, cfg]) => (
                          <button
                            key={num}
                            onClick={() => onSparkUpdate({ ...sparkData, activeSections: [1, parseInt(num)] })}
                            className={`p-3 rounded-lg border-2 border-${cfg.color}-500/30 hover:border-${cfg.color}-500 hover:bg-${cfg.color}-500/10 transition-all text-left`}
                          >
                            <p className={`text-sm font-semibold text-${cfg.color}-400`}>{cfg.title}</p>
                            <p className="text-xs theme-subtle mt-0.5">{cfg.description}</p>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Quiz Modal */}
          {showQuiz && <QuizModal sparkData={sparkData} onClose={() => setShowQuiz(false)} />}

          {/* Cool PR Confirmation Modal */}
          {showConfirmation && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 theme-overlay backdrop-blur-md">
              <div className="w-full max-w-lg overflow-hidden rounded-3xl border-2 border-logic-500 bg-black/80 shadow-[0_0_50px_-12px_rgba(34,197,94,0.5)] backdrop-blur-xl animate-in zoom-in-95 duration-200">
                {/* Modal Header with Glow */}
                <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-logic-900/50 to-black p-6">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(34,197,94,0.3),_transparent_70%)]" />
                  <div className="relative flex items-center space-x-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-logic-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]">
                      <GitPullRequest className="h-8 w-8 text-black" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tighter text-white">SYNC SPARK</h2>
                      <p className="text-xs font-bold uppercase tracking-widest text-logic-400">Final Validation Sequence</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-widest">
                      <span className="text-white/40">Status</span>
                      <span className="text-logic-400">Ready to Ship</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-widest">
                      <span className="text-white/40">Integrity Check</span>
                      <span className="text-logic-400">PASSED</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-widest">
                      <span className="text-white/40">Merit Stake</span>
                      <span className="text-logic-400">Verified</span>
                    </div>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-logic-600 to-logic-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>

                  {isSubmitting ? (
                    <div className="py-4 text-center font-mono text-sm font-bold text-logic-400 animate-pulse uppercase tracking-[0.2em]">
                      Synchronizing with TheCommons...
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        onClick={() => setShowConfirmation(false)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-white/10"
                      >
                        Abort
                      </button>
                      <button
                        onClick={handleSubmit}
                        className="flex-1 rounded-xl bg-logic-500 py-4 text-sm font-black uppercase tracking-widest text-black shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all hover:bg-logic-400 hover:shadow-[0_0_40px_rgba(34,197,94,0.6)]"
                      >
                        Phase Shift
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-logic-900/20 p-4 text-center border-t border-logic-900/30">
                  <p className="text-[10px] font-mono text-logic-400/60 uppercase tracking-widest">
                    Instruction Set v2.0 &#47;&#47; Standard Gauge: 100% Correct
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirmation && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 theme-overlay backdrop-blur-md">
              <div className="w-full max-w-lg overflow-hidden rounded-3xl border-2 border-red-500 bg-black/80 shadow-[0_0_50px_-12px_rgba(239,68,68,0.5)] backdrop-blur-xl animate-in zoom-in-95 duration-200">
                {/* Modal Header with Glow */}
                <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-red-900/50 to-black p-6">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(239,68,68,0.3),_transparent_70%)]" />
                  <div className="relative flex items-center space-x-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]">
                      <Trash2 className="h-8 w-8 text-black" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tighter text-white">DELETE SPARK</h2>
                      <p className="text-xs font-bold uppercase tracking-widest text-red-400">Permanent Request</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  <div className="space-y-4 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                    <p className="text-sm text-white/90">
                      You are about to request the deletion of this spark:
                    </p>
                    <p className="text-lg font-bold text-red-400">
                      &ldquo;{sparkData.name}&rdquo;
                    </p>
                    <div className="text-xs text-white/70 space-y-2 pt-2">
                      <p>• A pull request will be created to remove this spark</p>
                      <p>• Only you (the scout) can make this request</p>
                      <p>• You can cancel by closing the PR without merging</p>
                      <p>• Community review will apply to this deletion</p>
                    </div>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>

                  {isSubmitting ? (
                    <div className="py-4 text-center font-mono text-sm font-bold text-red-400 animate-pulse uppercase tracking-[0.2em]">
                      Submitting deletion request...
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        onClick={() => setShowDeleteConfirmation(false)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteRequest}
                        className="flex-1 rounded-xl bg-red-500 py-4 text-sm font-black uppercase tracking-widest text-black shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all hover:bg-red-400 hover:shadow-[0_0_40px_rgba(239,68,68,0.6)]"
                      >
                        Confirm Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-red-900/20 p-4 text-center border-t border-red-900/30">
                  <p className="text-[10px] font-mono text-red-400/60 uppercase tracking-widest">
                    This action creates a deletion PR &#47;&#47; Community Approval Required
                  </p>
                </div>
              </div>
            </div>
          )}

          {editingSection && (
            <div className="fixed inset-0 z-50 theme-overlay backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
              <div className="theme-panel rounded-xl border-2 border-design-600 w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl">
                <div className="bg-design-600 px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-xl font-bold truncate">Edit Section</h2>
                    <p className="text-xs sm:text-sm opacity-90 truncate">Update the full block for this section.</p>
                  </div>
                  <button
                    onClick={() => setEditingSection(null)}
                    className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                  <textarea
                    value={sectionDraft}
                    onChange={(e) => setSectionDraft(e.target.value)}
                    className="w-full h-full theme-input rounded border p-3 sm:p-4 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-design-500 font-mono resize-none min-h-[400px] sm:min-h-[500px]"
                    autoFocus
                  />
                </div>

                <div className="px-3 sm:px-6 py-3 sm:py-4 border-t theme-border flex justify-between items-center">
                  <div className="text-xs sm:text-sm theme-muted">{sectionDraft.length} characters</div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingSection(null)}
                      className="px-4 py-2 theme-button rounded-lg font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSectionEditor}
                      className="px-4 py-2 bg-design-600 hover:bg-design-700 rounded-lg font-semibold transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
