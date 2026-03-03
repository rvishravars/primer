import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Zap, RefreshCw, Search, X, Globe, FolderGit2, ChevronDown, ChevronUp, GitPullRequest } from 'lucide-react';
import { buildMissionSummary, parseSparkFile } from '../utils/sparkParser';
import { getStoredToken, loadSparksFromGitHub } from '../utils/github';
import RepoInput from './RepoInput';
import GlobalSparkSearch from './GlobalSparkSearch';

export default function SparkSelector({ selectedSpark, onSparkSelect, repoUrl, branch = 'main', onRepoChange, onBranchChange, currentSparkData, onPRRefresh, onPermissionChange }) {
  console.log('🚀 SparkSelector component mounted!');
  const [activeTab, setActiveTab] = useState('repo'); // 'repo' or 'global'
  const [sparks, setSparks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null); // 'repo-not-found', 'no-sparks', 'network-error'
  // const [repoInfo, setRepoInfo] = useState(null);
  const [missionSummary, setMissionSummary] = useState(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState(null);
  const [missionRefreshToken, setMissionRefreshToken] = useState(0);
  const [prInfo, setPrInfo] = useState({ count: null, urls: [] });
  const [refreshToken, setRefreshToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScribeSummaryCollapsed, setIsScribeSummaryCollapsed] = useState(true);
  const [isSparksListCollapsed, setIsSparksListCollapsed] = useState(true);
  const hasRegisteredRefresh = useRef(false);
  const onPermissionChangeRef = useRef(onPermissionChange);
  const missionContentRef = useRef(null);
  const missionFallbackRef = useRef(null);

  useEffect(() => {
    onPermissionChangeRef.current = onPermissionChange;
  }, [onPermissionChange]);

  useEffect(() => {
    missionContentRef.current = selectedSpark?.rawContent || null;
    missionFallbackRef.current = selectedSpark || null;
  }, [selectedSpark]);

  // Expose refresh function to parent
  useEffect(() => {
    if (onPRRefresh && !hasRegisteredRefresh.current) {
      hasRegisteredRefresh.current = true;
      onPRRefresh(() => {
        setRefreshToken((value) => value + 1);
      });
    }
  }, [onPRRefresh]);

  const getAuditBadge = (status) => {
    if (status === 'GREEN') return 'bg-logic-600';
    if (status === 'YELLOW') return 'bg-design-600';
    return 'bg-red-600';
  };

  const buildSparkEntry = useCallback((filename, content, sourcePath) => {
    console.log(`🛠️ Building spark entry for ${filename}, content length: ${content?.length || 0}`);
    const parsed = parseSparkFile(content);
    console.log(`✅ Parsed name for ${filename}:`, parsed.name);
    parsed.rawContent = content;
    parsed.sourceFile = filename;
    parsed.sourcePath = sourcePath || filename;
    return {
      id: filename.replace('.spark.md', ''),
      name: parsed.name,
      file: filename,
      stability: parsed.stability,
      data: parsed,
    };
  }, []);

  // Update spark in list when currentSparkData changes
  useEffect(() => {
    if (selectedSpark && currentSparkData) {
      const selectedFile = selectedSpark.sourceFile || selectedSpark.sourcePath;
      if (selectedFile) {
        setSparks(prevSparks =>
          prevSparks.map(spark => {
            if (spark.file === selectedFile || spark.data.sourcePath === selectedFile) {
              return {
                ...spark,
                name: currentSparkData.name,
                data: { ...spark.data, ...currentSparkData }
              };
            }
            return spark;
          })
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSparkData?.name, selectedSpark?.sourceFile, selectedSpark?.sourcePath]);

  const loadSparks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorType(null);
    setRefreshToken((value) => value + 1);

    try {
      console.log('🔍 Loading sparks from GitHub...');

      if (!repoUrl) {
        setErrorType('no-repo');
        setError('Please enter a repository URL to load sparks');
        setSparks([]);
        setLoading(false);
        return;
      }

      // Load sparks directly from GitHub
      const result = await loadSparksFromGitHub(repoUrl, branch || 'main', 'sparks');

      if (!result.success) {
        // Handle errors
        const errorMsg = result.error || 'Failed to load sparks';

        if (errorMsg.includes('not found') || errorMsg.includes("doesn't exist")) {
          setErrorType('repo-not-found');
          setError('Repository not found. Please check the URL and try again.');
        } else if (errorMsg.includes('rate limit')) {
          setErrorType('rate-limit');
          setError('GitHub API rate limit exceeded. Please add a GitHub token in the login menu.');
        } else if (errorMsg.includes('Invalid repository format')) {
          setErrorType('invalid-format');
          setError('Invalid repository format. Use: owner/repo or https://github.com/owner/repo');
        } else {
          setErrorType('network-error');
          setError(errorMsg);
        }
        setSparks([]);
        setLoading(false);
        return;
      }

      // Store repo info for display
      // if (result.owner && result.repo) {
      //   setRepoInfo(`${result.owner}/${result.repo}`);
      // }

      // Check if we have files
      if (result.files && result.files.length > 0) {
        const parsedSparks = result.files.map((file) =>
          buildSparkEntry(file.name || file.path || 'spark', file.content, file.path)
        );

        // Sort by name in reverse order (latest first)
        parsedSparks.sort((a, b) => b.name.localeCompare(a.name));
        setSparks(parsedSparks);
        setLoading(false);
        return;
      } else {
        // No spark files found in the repository
        setErrorType('no-sparks');
        setError(result.message || 'No .spark.md files found in this repository');
        setSparks([]);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('❌ Error in loadSparks:', err);
      setErrorType('network-error');
      setError(err.message || 'Failed to load sparks from GitHub');
      setSparks([]);
    } finally {
      setLoading(false);
    }
  }, [buildSparkEntry, repoUrl, branch]);

  useEffect(() => {
    loadSparks();
  }, [loadSparks]);

  // Filter sparks based on search query
  const filteredSparks = sparks.filter(spark => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const nameMatch = spark.name.toLowerCase().includes(query);
    const fileMatch = spark.file.toLowerCase().includes(query);
    const contentMatch = spark.data.rawContent?.toLowerCase().includes(query);

    return nameMatch || fileMatch || contentMatch;
  });

  useEffect(() => {
    if (!selectedSpark && sparks.length > 0 && !currentSparkData) {
      onSparkSelect(sparks[0].data);
    }
  }, [sparks, selectedSpark, onSparkSelect, currentSparkData]);

  useEffect(() => {
    const missionKey = selectedSpark?.sourcePath || selectedSpark?.sourceFile || selectedSpark?.id || null;
    const content = missionContentRef.current;

    if (!missionKey || !content) {
      setMissionSummary(null);
      setMissionError(null);
      setMissionLoading(false);
      setPrInfo({ count: null, urls: [] });
      return;
    }

    const controller = new AbortController();
    const loadMission = async () => {
      setMissionLoading(true);
      setMissionError(null);

      try {
        const response = await fetch('/api/mission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Mission request failed: ${response.status}`);
        }

        const data = await response.json();
        setMissionSummary({
          status: data?.audit?.status || 'RED',
          recommendation: data?.audit?.recommendation || 'Reject',
          scribe_report: data?.audit?.scribe_report || 'No report available.',
          critical_flaws: data?.audit?.critical_flaws || [],
          merit_plan: data?.merit_plan || [],
        });
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        setMissionError(err.message || 'Failed to run mission evaluation');
        setMissionSummary(buildMissionSummary(missionFallbackRef.current));
      } finally {
        setMissionLoading(false);
      }
    };

    loadMission();
    return () => controller.abort();
  }, [selectedSpark?.sourcePath, selectedSpark?.sourceFile, selectedSpark?.id, missionRefreshToken]);

  useEffect(() => {
    const sparkPath = selectedSpark?.sourcePath;
    if (!sparkPath || !repoUrl) {
      setPrInfo({ count: null, urls: [] });
      return;
    }

    const controller = new AbortController();
    const loadPrs = async () => {
      try {
        const token = getStoredToken();
        const response = await fetch(`/api/prs?repo=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(sparkPath)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Failed to load PR status');
        }
        const data = await response.json();
        setPrInfo({ count: data.count ?? 0, urls: data.urls || [] });

        // Notify parent about push permissions
        onPermissionChangeRef.current?.(data.can_push ?? false);
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        setPrInfo({ count: null, urls: [] });
      }
    };

    loadPrs();
    return () => controller.abort();
  }, [selectedSpark?.sourcePath, repoUrl, refreshToken]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex border-b theme-border">
        <button
          onClick={() => setActiveTab('repo')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'repo'
            ? 'theme-card border-b-2 border-design-500'
            : 'theme-subtle hover:theme-text'
            }`}
        >
          <FolderGit2 className="h-4 w-4" />
          <span>Repository</span>
        </button>
        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'global'
            ? 'theme-card border-b-2 border-design-500'
            : 'theme-subtle hover:theme-text'
            }`}
        >
          <Globe className="h-4 w-4" />
          <span>Global Search</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'global' ? (
        <GlobalSparkSearch
          onSparkLoad={onSparkSelect}
          onRepoSelect={onRepoChange}
        />
      ) : (
        <>
          <RepoInput
            onRepoChange={onRepoChange}
            currentRepo={repoUrl}
            currentBranch={branch}
            onBranchChange={onBranchChange}
          />


          {/* Search Bar */}
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 theme-muted" />
              <input
                type="text"
                placeholder="Search sparks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 rounded-lg theme-border theme-input text-sm focus:outline-none focus:ring-2 focus:ring-design-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 theme-muted-hover transition-colors"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs theme-subtle mt-2">
                Found {filteredSparks.length} of {sparks.length} spark{filteredSparks.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {missionSummary && (
              <div className="mb-4 rounded-lg border theme-border theme-card-soft">
                <div
                  onClick={() => setIsScribeSummaryCollapsed(!isScribeSummaryCollapsed)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors cursor-pointer"
                >
                  <p className="text-xs uppercase tracking-wider theme-muted font-semibold">
                    Scribe Summary
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMissionRefreshToken((value) => value + 1);
                      }}
                      disabled={missionLoading}
                      className="theme-muted-hover transition-colors disabled:opacity-50"
                      title="Re-run mission"
                    >
                      <RefreshCw className={`h-4 w-4 ${missionLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {isScribeSummaryCollapsed ? (
                      <ChevronDown className="h-4 w-4 theme-muted" />
                    ) : (
                      <ChevronUp className="h-4 w-4 theme-muted" />
                    )}
                  </div>
                </div>

                {!isScribeSummaryCollapsed && (
                  <div className="px-3 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm mt-1">{missionSummary.scribe_report}</p>
                        {missionLoading && (
                          <p className="text-xs theme-subtle mt-1">Running mission evaluation...</p>
                        )}
                        {missionError && (
                          <p className="text-xs text-red-300 mt-1">{missionError}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getAuditBadge(missionSummary.status)}`}>
                        {missionSummary.status}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-xs theme-subtle">
                        <span>
                          Recommendation:{' '}
                          <span className="theme-text font-semibold">{missionSummary.recommendation}</span>
                        </span>
                        {selectedSpark && (
                          <span className="text-right">
                            Stability:{' '}
                            <span className="theme-text font-semibold">{selectedSpark.stability}/3</span>
                          </span>
                        )}
                      </div>
                      {prInfo.count !== null && prInfo.count > 0 && (
                        <div className="mt-3 border-t border-gray-700/50 pt-3">
                          <p className="text-[10px] uppercase tracking-wider theme-muted font-semibold mb-2">
                            Evolution Activity ({prInfo.count})
                          </p>
                          <div className="space-y-1.5">
                            {prInfo.urls.map((url, idx) => {
                              const isPR = url.includes('/pull/');
                              const number = url.split('/').pop();
                              return (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center justify-between p-2 rounded bg-black/20 hover:bg-black/40 transition-colors text-[10px] border border-white/5`}
                                >
                                  <span className="truncate flex-1 mr-2 flex items-center gap-1.5">
                                    {isPR ? (
                                      <GitPullRequest className="h-3 w-3 text-spark-400" />
                                    ) : (
                                      <Zap className="h-3 w-3 text-design-400" />
                                    )}
                                    <span>{isPR ? `PR #${number}` : `Proposal #${number}`}</span>
                                  </span>
                                  <span className="theme-muted">View →</span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {missionSummary.critical_flaws.length > 0 && (
                      <div className="mt-3 text-xs text-red-300">
                        <p className="font-semibold text-red-400">Critical Flaws</p>
                        <ul className="mt-1 space-y-1">
                          {missionSummary.critical_flaws.map((flaw) => (
                            <li key={flaw}>• {flaw}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {missionSummary.merit_plan.length > 0 && (
                      <div className="mt-3 text-xs theme-subtle">
                        <p className="font-semibold theme-text mb-2">Leadership Board</p>
                        <div className="flex flex-wrap gap-2">
                          {missionSummary.merit_plan.slice(0, 3).map((entry) => (
                            <span key={`${entry.handle}-${entry.role}`} className="inline-flex items-center gap-1 rounded-full bg-logic-600/20 px-2 py-1 text-xs">
                              <span className="font-semibold">{entry.handle.replace('@', '')}</span>
                              <span className="text-logic-300">{entry.reward}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border theme-border theme-card-soft mb-3">
              <div
                onClick={() => setIsSparksListCollapsed(!isSparksListCollapsed)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider theme-muted">
                    Sparks <span className="theme-text text-xs font-normal ml-1">
                      ({searchQuery ? `${filteredSparks.length}/${sparks.length}` : sparks.length})
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadSparks();
                    }}
                    disabled={loading}
                    className="theme-muted-hover transition-colors disabled:opacity-50"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  {isSparksListCollapsed ? (
                    <ChevronDown className="h-4 w-4 theme-muted" />
                  ) : (
                    <ChevronUp className="h-4 w-4 theme-muted" />
                  )}
                </div>
              </div>

              {!isSparksListCollapsed && (
                <div className="px-3 pb-3">
                  {error && (
                    <div className="bg-red-900/20 border border-red-600 rounded-lg p-3 mb-3">
                      <div className="flex items-start space-x-2">
                        {errorType === 'repo-not-found' && (
                          <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        )}
                        {(errorType === 'no-sparks' || errorType === 'no-repo') && (
                          <svg className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {(errorType === 'network-error' || errorType === 'rate-limit' || errorType === 'invalid-format') && (
                          <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-400 mb-1">
                            {errorType === 'repo-not-found' && 'Repository Not Found'}
                            {errorType === 'no-sparks' && 'No Spark Files'}
                            {errorType === 'no-repo' && 'No Repository'}
                            {errorType === 'rate-limit' && 'Rate Limit Exceeded'}
                            {errorType === 'invalid-format' && 'Invalid Format'}
                            {errorType === 'network-error' && 'Connection Error'}
                            {!errorType && 'Error'}
                          </p>
                          <p className="text-sm text-red-300">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {loading && sparks.length === 0 ? (
                      <div className="text-center py-8 theme-subtle">
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                        <p className="text-sm">Loading sparks...</p>
                      </div>
                    ) : filteredSparks.length === 0 ? (
                      <div className="text-center py-8 theme-subtle">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          {searchQuery ? 'No matching sparks found' : error ? 'Unable to load sparks' : 'No sparks found'}
                        </p>
                        <p className="text-xs mt-1">
                          {searchQuery ? 'Try a different search term' : error ? 'Please check the error message above' : 'This repository has no .spark.md files'}
                        </p>
                      </div>
                    ) : (
                      filteredSparks.map((spark) => (
                        <button
                          key={spark.id}
                          onClick={() => onSparkSelect(spark.data)}
                          className={`w-full rounded-lg border-2 p-3 text-left transition-all hover:border-design-500 ${(selectedSpark?.sourceFile === spark.file || selectedSpark?.sourcePath === spark.data.sourcePath)
                            ? 'border-design-500 theme-card'
                            : 'theme-border theme-card-soft'
                            }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-2">
                              <Zap className="h-4 w-4 mt-0.5 text-design-500" />
                              <div>
                                <h4 className="font-semibold text-sm">{spark.name}</h4>
                                <p className="text-xs theme-muted mt-1">{spark.file}</p>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
