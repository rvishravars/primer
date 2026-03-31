import { useEffect, useRef, useState } from 'react';
import { Download, Copy, Eye, Brain, GitPullRequest, RotateCcw, Trash2, ChevronLeft, ChevronRight, Plus, MessageCircle } from 'lucide-react';
import MarkdownPreview from './MarkdownPreview';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import AIWorkbenchPanel from './AIWorkbenchPanel';
import PRTracker from './PRTracker';
import CommentsPanel from './CommentsPanel';
import FeedbackIssueLinks from './FeedbackIssueLinks';
import { generateSparkMarkdown, parseSparkFile, validateSparkData } from '../utils/sparkParser';
import { useToast } from '../utils/ToastContext';
import { getStoredToken, getStoredUserInfo, parseRepoUrl } from '../utils/github';
import ContributorsList from './ContributorsList';

const ENHANCED_SECTIONS_CONFIG = {
  1: { title: '1. Spark Narrative', description: 'The core story of the idea', color: 'spark' },
  2: { title: '2. Hypothesis Formalization', description: 'Convert into a falsifiable statement', color: 'design' },
  3: { title: '3. Testing & Results', description: 'Experimentation outcomes and evaluation', color: 'logic' }
};

export default function AssemblyCanvas({ sparkData, onSparkUpdate, repoUrl, originalSparkData, onResetSpark, isReadOnly, onPRCreated, canPush = true, onNewSpark, viewMode = 'components' }) {
  const [showPreview, setShowPreview] = useState(false);
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [showPRTracker, setShowPRTracker] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [editStatus, setEditStatus] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionDraft, setSectionDraft] = useState('');
  const [toolbarExpanded, setToolbarExpanded] = useState(true);
  const [aiApplied, setAiApplied] = useState(false);
  const [contributors, setContributors] = useState([]);
  const [contributorsLoading, setContributorsLoading] = useState(false);
  const [highlightPropose, setHighlightPropose] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [isWorkbenchExpanded, setIsWorkbenchExpanded] = useState(false);
  const sparkDataRef = useRef(sparkData);
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
  const canAddFeedback = !!user && !isOwner;

  useEffect(() => {
    sparkDataRef.current = sparkData;
  }, [sparkData]);

  // Reset some UI state when the global view mode changes
  useEffect(() => {
    setShowPreview(false);
    setShowPRTracker(false);
    setShowCommentsPanel(false);
    setShowWorkbench(false);
  }, [viewMode]);

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

  const calculateCompleteness = () => {
    const sections = sparkData.sections || {};
    const total = 3;
    let filled = 0;
    for (let i = 1; i <= total; i += 1) {
      if ((sections[i] || '').trim().length > 0) {
        filled += 1;
      }
    }
    return { filled, total };
  };

  const completeness = calculateCompleteness();
  const validation = validateSparkData(sparkData);
  const isDirty = originalSparkData
    ? JSON.stringify(sparkData) !== JSON.stringify(originalSparkData)
    : true;

  const formatTimeAgo = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;

    const now = new Date();
    let diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) diffMs = 0;

    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.floor(diffMs / dayMs);

    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;

    const months = Math.floor(days / 30);
    if (months === 1) return '1 month ago';
    if (months < 12) return `${months} months ago`;

    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (remMonths === 0) {
      return years === 1 ? '1 year ago' : `${years} years ago`;
    }
    const yearsPart = years === 1 ? '1 year' : `${years} years`;
    const monthsPart = remMonths === 1 ? '1 month' : `${remMonths} months`;
    return `${yearsPart} ${monthsPart} ago`;
  };

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

  const handleApplySparkMarkdownFromAI = (markdown) => {
    if (!markdown) return;
    try {
      const parsed = parseSparkFile(markdown);
      const hasNewSections = parsed?.sections && Object.keys(parsed.sections).length > 0;
      const updated = {
        ...sparkData,
        name: parsed?.name || sparkData.name,
        markedForDeletion: typeof parsed?.markedForDeletion === 'boolean' ? parsed.markedForDeletion : sparkData.markedForDeletion,
        sections: hasNewSections ? { ...sparkData.sections, ...parsed.sections } : sparkData.sections,
        proposals: parsed?.proposals || sparkData.proposals,
      };
      onSparkUpdate(updated);
      setAiApplied(true);
      toast.success('AI workbench suggestion applied.');
    } catch (e) {
      console.error('AI Apply Error:', e);
      toast.error('Failed to apply AI changes.');
    }
  };

  const handleSubmit = async () => {
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
      toast.error('GitHub token required');
      setShowConfirmation(false);
      return;
    }

    setIsSubmitting(true);
    for (let i = 0; i <= 100; i += 5) {
      setSyncProgress(i);
      await new Promise(r => setTimeout(r, 40));
    }

    try {
      const markdown = generateSparkMarkdown(sparkData);
      const slug = sparkData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
      if (!response.ok) throw new Error(data.error || 'Failed to submit PR');

      toast.success(data.is_proposal ? 'Proposal submitted!' : 'PR created!');
      setShowConfirmation(false);
      if (data.pr_url) window.open(data.pr_url, '_blank');
      if (onPRCreated) onPRCreated();
    } catch (err) {
      toast.error(err.message || 'Failed to submit PR');
      setSyncProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (!onResetSpark || !originalSparkData) return;
    onResetSpark();
    setEditStatus({ type: 'success', message: 'Reset to original.' });
    toast.success('Reset to original.');
    setAiApplied(false);
  };

  const handleDeleteRequest = async () => {
    if (!isOwner) {
      toast.error('Only owners can delete');
      return;
    }

    if (!showDeleteConfirmation) {
      setShowDeleteConfirmation(true);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      toast.error('Token required');
      setShowDeleteConfirmation(false);
      return;
    }

    setIsSubmitting(true);
    for (let i = 0; i <= 100; i += 5) {
      setSyncProgress(i);
      await new Promise(r => setTimeout(r, 40));
    }

    try {
      const slug = sparkData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const path = sparkData.sourcePath || `sparks/${slug || 'new-spark'}.spark.md`;
      const title = `Delete Spark: ${sparkData.name}`;
      const body = `Request to delete spark: ${sparkData.name}\n\nRequested by @${user?.login}.`;

      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, repo: repoUrl, path, title, body }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete');

      toast.success('Delete request created!');
      setShowDeleteConfirmation(false);
      if (data.pr_url) window.open(data.pr_url, '_blank');
      if (onPRCreated) onPRCreated();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
      setSyncProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden theme-surface">
      {/* Toolbar */}
      <div className="border-b theme-border theme-surface px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
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
              {sparkData?.lastCommit?.date && (
                <span className="inline-flex items-center rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[11px] font-medium bg-gray-700/60 text-gray-200/90">
                  Updated {formatTimeAgo(sparkData.lastCommit.date)}
                </span>
              )}

              {(() => {
                const total = completeness.total;
                const ratio = total === 0 ? 0 : completeness.filled / total;
                const color = ratio === 0 ? 'bg-red-600' : ratio < 0.4 ? 'bg-spark-600' : ratio < 0.8 ? 'bg-design-600' : 'bg-logic-600';
                return (
                  <span className={`inline-flex items-center rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-semibold ${color}`}>
                    Completeness {completeness.filled}/{total}
                  </span>
                );
              })()}
              {aiApplied && (
                <span className="inline-flex items-center rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] font-semibold bg-design-600/80 text-white/90">
                  AI suggestion applied
                </span>
              )}
              {!validation.valid && <span className="text-xs text-red-300">Sanctity check failed</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setToolbarExpanded(!toolbarExpanded)}
              className="p-2 rounded-lg theme-button hover:bg-white/10 transition-colors flex-shrink-0"
              title={toolbarExpanded ? 'Hide actions' : 'More actions'}
            >
              {toolbarExpanded ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>

            <div className={`flex items-center gap-2 transition-all duration-200 origin-right ${toolbarExpanded ? 'opacity-100 max-w-3xl translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none overflow-hidden'}`}>
              <button onClick={onNewSpark} className="flex items-center justify-center rounded-lg bg-design-600 hover:bg-design-700 p-2 text-white group" title="New Spark"><Plus className="h-5 w-5" /></button>
              {viewMode === 'components' && (
                <button onClick={() => setShowPreview(!showPreview)} className="flex items-center justify-center rounded-lg theme-button p-2.5" title="Toggle Preview"><Eye className="h-4 w-4" /></button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isReadOnly || !isDirty}
                className={`flex items-center justify-center rounded-lg bg-logic-600 p-2.5 text-xs font-semibold hover:bg-logic-700 transition-colors disabled:opacity-60 ${highlightPropose && !showConfirmation ? 'animate-pulse ring-2 ring-logic-300' : ''}`}
                title="Propose changes"
              >
                <GitPullRequest className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowWorkbench(!showWorkbench)}
                disabled={!user}
                className={`hidden sm:flex items-center justify-center rounded-lg p-2.5 transition-all ${showWorkbench ? 'bg-design-600/20 text-design-300 border border-design-500/50' : 'theme-button'}`}
                title="AI Workbench"
              >
                <Brain className="h-4 w-4" />
              </button>
              <button onClick={handleCopyToClipboard} className="hidden md:flex items-center justify-center rounded-lg theme-button p-2.5" title="Copy Markdown"><Copy className="h-4 w-4" /></button>
              <button onClick={handleDownload} className="hidden md:flex items-center justify-center rounded-lg theme-button p-2.5" title="Download"><Download className="h-4 w-4" /></button>
              <button onClick={handleReset} disabled={!isDirty || isReadOnly} className="hidden lg:flex items-center justify-center rounded-lg theme-button p-2.5 disabled:opacity-50" title="Reset"><RotateCcw className="h-4 w-4 text-yellow-500/80" /></button>
              <button onClick={handleDeleteRequest} disabled={isSubmitting || isReadOnly || !isOwner} className="hidden lg:flex items-center justify-center rounded-lg theme-button p-2.5 text-red-400 hover:bg-red-500/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>

      {isReadOnly && (
        <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-design-500/40 bg-design-500/10 px-3 py-2 text-xs text-design-100">
          Login to edit or propose changes to this spark.
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {showPreview ? (
            <div className="flex-1 overflow-y-auto p-6 bg-black/5">
              <MarkdownPreview markdown={generateSparkMarkdown(sparkData)} />
            </div>
          ) : showPRTracker ? (
            <div className="flex-1 overflow-y-auto p-6 text-white"><PRTracker repoUrl={repoUrl} sparkFile={sparkData.sourcePath} user={user} /></div>
          ) : showCommentsPanel ? (
            <div className="flex-1 overflow-y-auto p-6 text-white"><CommentsPanel repoUrl={repoUrl} sparkFile={sparkData.sourcePath} user={user} /></div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="h-full flex flex-col lg:flex-row gap-6">
                {/* LEFT: Narrative */}
                <div className="flex-1 flex flex-col rounded-xl border-2 border-spark-600 theme-panel-soft min-w-0 overflow-hidden">
                  <div className="bg-spark-600 px-4 py-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold">1. Spark Narrative</h2>
                      <p className="text-xs opacity-90">The core story of the idea</p>
                    </div>
                    {isOwner && !isReadOnly && (
                      <button onClick={() => openSectionEditor(1)} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded font-bold">Edit</button>
                    )}
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {sparkData.sections?.[1] || '_Narrative is empty._'}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* RIGHT: Swappable Section (Defaults to Section 2) */}
                {(() => {
                  const rightSectionNum = (sparkData.activeSections || [1]).find(n => n !== 1) || 2;
                  const config = ENHANCED_SECTIONS_CONFIG[rightSectionNum];

                  return (
                    <div className={`flex-1 flex flex-col rounded-xl border-2 border-${config.color}-600 theme-panel-soft min-w-0 overflow-hidden`}>
                      <div className={`bg-${config.color}-600 px-4 py-3 flex items-center justify-between`}>
                        <div>
                          <h2 className="text-lg font-bold">{config.title}</h2>
                          <p className="text-xs opacity-90">{config.description}</p>
                        </div>
                        <div className="flex gap-2">
                           {isOwner && !isReadOnly && (
                             <button 
                               onClick={() => openSectionEditor(rightSectionNum)} 
                               className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded font-bold"
                             >
                               Edit
                             </button>
                           )}
                        </div>
                      </div>
                      <div className="flex-1 p-4 overflow-y-auto prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {sparkData.sections?.[rightSectionNum] || '_Section is empty._'}
                        </ReactMarkdown>
                      </div>
                      
                      {/* Section Switcher Action Bar */}
                      <div className="p-4 border-t theme-border bg-black/10 flex items-center justify-between">
                         <div className="flex gap-2">
                           {Object.entries(ENHANCED_SECTIONS_CONFIG)
                             .filter(([n]) => parseInt(n) !== 1)
                             .map(([n, cfg]) => (
                               <button 
                                 key={n} 
                                 onClick={() => onSparkUpdate({ ...sparkData, activeSections: [1, parseInt(n)] })}
                                 className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                                   parseInt(n) === rightSectionNum 
                                     ? `border-${cfg.color}-500 bg-${cfg.color}-600/40 text-${cfg.color}-200 shadow-lg shadow-${cfg.color}-900/20` 
                                     : 'border-white/10 bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10'
                                 }`}
                               >
                                 Section {n}: {cfg.title.split(': ').pop().split('. ').pop()}
                               </button>
                             ))}
                         </div>
                         <div className="text-[10px] theme-subtle font-bold uppercase tracking-widest hidden md:block">
                           CORE 3 ARCHITECTURE
                         </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* AI Workbench Sidebar */}
        {showWorkbench && (
          <div className={`flex-shrink-0 flex flex-col border-l theme-border bg-black/20 backdrop-blur-md animate-in slide-in-from-right duration-300 transition-all ${isWorkbenchExpanded ? 'w-full lg:w-[850px]' : 'w-80 lg:w-[450px]'}`}>
            <AIWorkbenchPanel 
              sparkData={sparkData} 
              onClose={() => setShowWorkbench(false)} 
              onApplyMarkdown={handleApplySparkMarkdownFromAI} 
              isExpanded={isWorkbenchExpanded}
              onToggleExpand={() => setIsWorkbenchExpanded(!isWorkbenchExpanded)}
            />
          </div>
        )}
      </div>

      {/* Global Modals */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border-2 border-logic-500 bg-black shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-logic-900/50 to-black p-8 text-center border-b border-logic-500/20">
              <div className="h-20 w-20 bg-logic-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-logic-500/30"><GitPullRequest className="h-10 w-10 text-black" /></div>
              <h2 className="text-3xl font-black text-white mb-2 tracking-tight">SYNC SPARK</h2>
            </div>
            <div className="p-8 space-y-8">
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-logic-500 transition-all duration-300" style={{ width: `${syncProgress}%` }} /></div>
              {isSubmitting ? (
                <div className="text-center py-4 font-mono text-xs text-logic-400 animate-pulse uppercase tracking-widest">Synchronizing...</div>
              ) : (
                <div className="flex gap-4">
                  <button onClick={() => setShowConfirmation(false)} className="flex-1 py-4 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 uppercase text-xs">Abort</button>
                  <button onClick={handleSubmit} className="flex-1 py-4 bg-logic-500 text-black font-black rounded-2xl hover:bg-logic-400 uppercase text-xs shadow-lg shadow-logic-500/40">Phase Shift</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
           <div className="w-full max-w-md rounded-3xl border-2 border-red-500 bg-black p-8 shadow-2xl">
             <h2 className="text-2xl font-black text-white mb-2">DELETE SPARK</h2>
             <p className="theme-subtle mb-8 text-sm">Permanently remove via PR?</p>
             <div className="flex gap-4">
                <button onClick={() => setShowDeleteConfirmation(false)} className="flex-1 py-4 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5">Cancel</button>
                <button onClick={handleDeleteRequest} className="flex-1 py-4 bg-red-500 text-black font-black rounded-2xl hover:bg-red-400">Confirm Delete</button>
             </div>
           </div>
        </div>
      )}

      {editingSection && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="theme-panel rounded-2xl border-2 border-design-600 w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl bg-black/40">
            <div className="bg-design-600 px-6 py-4 flex items-center justify-between"><h2 className="text-xl font-bold text-white">Edit Section {editingSection}</h2><button onClick={() => setEditingSection(null)} className="text-white">✕</button></div>
            <textarea value={sectionDraft} onChange={(e) => setSectionDraft(e.target.value)} className="flex-1 w-full bg-transparent p-8 text-white font-mono text-lg resize-none focus:outline-none" autoFocus />
            <div className="p-6 border-t theme-border flex justify-end gap-3">
               <button onClick={() => setEditingSection(null)} className="px-6 py-2 theme-button rounded-xl font-bold uppercase text-xs tracking-widest">Cancel</button>
               <button onClick={saveSectionEditor} className="px-6 py-2 bg-design-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="theme-panel rounded-2xl border-2 border-spark-600 w-full max-w-2xl h-[65vh] flex flex-col shadow-2xl bg-black/40">
            <div className="bg-spark-600 px-6 py-4 flex items-center justify-between"><h2 className="text-xl font-bold text-white">Add Feedback</h2><button onClick={() => setShowFeedbackModal(false)} className="text-white">✕</button></div>
            <textarea value={feedbackDraft} onChange={(e) => setFeedbackDraft(e.target.value)} className="flex-1 w-full bg-transparent p-8 text-white font-mono text-lg resize-none focus:outline-none" placeholder="Add feedback..." autoFocus />
            <div className="p-6 border-t theme-border flex justify-end gap-3">
               <button onClick={() => { setFeedbackDraft(''); setShowFeedbackModal(false); }} className="px-6 py-2 theme-button rounded-xl font-bold uppercase text-xs">Cancel</button>
               <button 
                 onClick={() => {
                   if (!feedbackDraft.trim()) return;
                   const existing = sparkData.sections?.[5] || '';
                   const author = user?.login ? `@${user.login}` : 'Anonymous';
                   const block = `\n\n---\n\n### Feedback from ${author} (${new Date().toISOString().split('T')[0]})\n\n${feedbackDraft.trim()}\n`;
                   onSparkUpdate({ ...sparkData, sections: { ...(sparkData.sections || {}), 5: `${existing}${block}`.trimStart() } });
                   setFeedbackDraft(''); setShowFeedbackModal(false); handleEditDone();
                 }} 
                 className="px-6 py-2 bg-spark-600 text-white rounded-xl font-bold uppercase text-xs"
               >
                 Append
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
