import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Zap, RefreshCw, Search, X, Globe, FolderGit2, ChevronDown, ChevronUp, GitPullRequest } from 'lucide-react';
import { parseSparkFile } from '../utils/sparkParser';
import { getStoredToken, loadSparksFromGitHub, parseRepoUrl } from '../utils/github';
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
  // Legacy missions/summary removed
  const [prInfo, setPrInfo] = useState({ count: null, items: [], urls: [] });
  const [refreshToken, setRefreshToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isChallengesCollapsed, setIsChallengesCollapsed] = useState(false);
  const [isSparksListCollapsed, setIsSparksListCollapsed] = useState(false);
  const hasRegisteredRefresh = useRef(false);
  const onPermissionChangeRef = useRef(onPermissionChange);
  // Legacy missions/summary content refs removed

  useEffect(() => {
    onPermissionChangeRef.current = onPermissionChange;
  }, [onPermissionChange]);

  // Legacy missions/summary wiring removed

  // Expose refresh function to parent
  useEffect(() => {
    if (onPRRefresh && !hasRegisteredRefresh.current) {
      hasRegisteredRefresh.current = true;
      onPRRefresh(() => {
        setRefreshToken((value) => value + 1);
      });
    }
  }, [onPRRefresh]);

  const buildSparkEntry = useCallback((filename, content, sourcePath, lastCommit) => {
    console.log(`🛠️ Building spark entry for ${filename}, content length: ${content?.length || 0}`);
    const parsed = parseSparkFile(content);
    console.log(`✅ Parsed name for ${filename}:`, parsed.name);
    parsed.rawContent = content;
    parsed.sourceFile = filename;
    parsed.sourcePath = sourcePath || filename;

    // Attach last commit metadata when available
    if (lastCommit) {
      parsed.lastCommit = lastCommit;
    }

    // Derive spark owner from Git metadata when not explicitly set
    try {
      if (!parsed.contributors) parsed.contributors = {};
      // Prefer last commit author login when available from backend
      if (!parsed.contributors.scout && lastCommit?.login) {
        parsed.contributors.scout = lastCommit.login;
      } else if (!parsed.contributors.scout && repoUrl) {
        // Fallback: use repo owner
        const { owner } = parseRepoUrl(repoUrl);
        if (owner) {
          parsed.contributors.scout = owner;
        }
      }
    } catch (e) {
      console.warn('Failed to derive spark owner from repo URL:', e);
    }

    return {
      id: filename.replace('.spark.md', ''),
      name: parsed.name,
      file: filename,
      stability: parsed.stability,
      lastCommit: parsed.lastCommit || null,
      data: parsed,
    };
  }, [repoUrl]);

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

      // Load sparks directly from GitHub (searches the whole repo for .spark.md files)
      const result = await loadSparksFromGitHub(repoUrl, branch || 'main');

      if (!result.success) {
        // Handle errors
        const errorMsg = result.error || 'Failed to load sparks';

        const normalizedError = String(errorMsg).toLowerCase();

        // Be careful: GitHub returns 404 for private repos without access.
        if (
          normalizedError.includes("don't have access") ||
          normalizedError.includes('access required') ||
          normalizedError.includes('private')
        ) {
          setErrorType('no-access');
          setError('Access required. If this repo is private, login with a GitHub token (repo scope) and try again.');
        } else if (normalizedError.includes('branch') && normalizedError.includes('not found')) {
          setErrorType('branch-not-found');
          setError(errorMsg);
        } else if (
          normalizedError.includes("directory wasn't found") ||
          normalizedError.includes("directory doesn't exist") ||
          normalizedError.includes("'sparks/'")
        ) {
          setErrorType('no-sparks');
          setError(errorMsg);
        } else if (normalizedError.includes('rate limit')) {
          setErrorType('rate-limit');
          setError('GitHub API rate limit exceeded. Please add a GitHub token in the login menu.');
        } else if (normalizedError.includes('invalid repository format')) {
          setErrorType('invalid-format');
          setError('Invalid repository format. Use: owner/repo or https://github.com/owner/repo');
        } else if (normalizedError.includes('not found') || normalizedError.includes("doesn't exist")) {
          setErrorType('repo-not-found');
          setError('Repository not found. Please check the URL and try again.');
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
          buildSparkEntry(
            file.name || file.path || 'spark',
            file.content,
            file.path,
            file.lastCommit || null,
          )
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

  useEffect(() => {
    if (!selectedSpark && sparks.length > 0 && !currentSparkData) {
      onSparkSelect(sparks[0].data);
    }
  }, [sparks, selectedSpark, onSparkSelect, currentSparkData]);

  // Legacy missions/summary effect removed

  useEffect(() => {
    const sparkPath = selectedSpark?.sourcePath;
    if (!sparkPath || !repoUrl) {
      setPrInfo({ count: null, items: [], urls: [] });
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
        const count = data.count ?? 0;

        // Prefer structured items when available; otherwise fall back to legacy urls array.
        let items = Array.isArray(data.items) ? data.items : [];
        if ((!items || items.length === 0) && Array.isArray(data.urls)) {
          items = data.urls.map((url) => ({ url }));
        }

        setPrInfo({ count, items, urls: data.urls || [] });

        // Notify parent about push permissions
        onPermissionChangeRef.current?.(data.can_push ?? false);
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        setPrInfo({ count: null, items: [], urls: [] });
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
            {/* Updates section: open PRs / proposals for this spark */}
            {prInfo.count > 0 && (
              <div className="rounded-lg border theme-border theme-card-soft mb-3">
                <div
                  onClick={() => setIsChallengesCollapsed(!isChallengesCollapsed)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider theme-muted">
                      Updates
                      <span className="theme-text text-xs font-normal ml-1">
                        ({prInfo.count})
                      </span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {isChallengesCollapsed ? (
                      <ChevronDown className="h-4 w-4 theme-muted" />
                    ) : (
                      <ChevronUp className="h-4 w-4 theme-muted" />
                    )}
                  </div>
                </div>

                {!isChallengesCollapsed && (
                  <div className="px-3 pb-3 space-y-2">
                    {prInfo.items?.map((item, index) => (
                      <a
                        key={item.url || index}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-xs theme-link hover:underline"
                      >
                        <GitPullRequest className="h-3 w-3 text-spark-500" />
                        <span className="truncate">
                          {item.type === 'issue' ? 'Issue' : 'PR'}
                          {item.number ? ` #${item.number}` : ''}
                          {item.user ? ` by @${item.user}` : ''}
                        </span>
                      </a>
                    ))}
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
                        {errorType === 'branch-not-found' && (
                          <svg className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {(errorType === 'network-error' || errorType === 'rate-limit' || errorType === 'invalid-format') && (
                          <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {errorType === 'no-access' && (
                          <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-400 mb-1">
                            {errorType === 'repo-not-found' && 'Repository Not Found'}
                            {errorType === 'no-access' && 'Access Required'}
                            {errorType === 'no-sparks' && 'No Spark Files'}
                            {errorType === 'no-repo' && 'No Repository'}
                            {errorType === 'rate-limit' && 'Rate Limit Exceeded'}
                            {errorType === 'invalid-format' && 'Invalid Format'}
                            {errorType === 'branch-not-found' && 'Branch Not Found'}
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
                                {spark.data?.lastCommit?.date && (
                                  <p className="text-[11px] theme-subtle mt-0.5">
                                    Updated {formatTimeAgo(spark.data.lastCommit.date)}
                                  </p>
                                )}
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
