import { useState } from 'react';
import { Search, Globe, Star, ExternalLink, Loader, AlertCircle, X, Filter } from 'lucide-react';
import { globalSearchSparkFiles, fetchSparkFilePreview, fetchLastCommitAuthor } from '../utils/github';
import { parseSparkFile } from '../utils/sparkParser';

export default function GlobalSparkSearch({ onSparkLoad, onRepoSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(null);

  const handleSearch = async (page = 1) => {
    if (!searchQuery.trim() && !userFilter.trim()) {
      setError('Please enter a search query or filter by user');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentPage(page);

    const searchResults = await globalSearchSparkFiles(searchQuery, {
      user: userFilter || undefined,
      page,
      perPage: 20,
    });

    if (!searchResults.success) {
      setError(searchResults.error);
      setResults([]);
      setTotalCount(0);
      setHasNextPage(false);
    } else {
      setResults(searchResults.results);
      setTotalCount(searchResults.totalCount);
      setHasNextPage(searchResults.hasNextPage);
    }

    setLoading(false);
  };

  const handleLoadSpark = async (result) => {
    setLoadingPreview(result.path);
    
    try {
      const content = await fetchSparkFilePreview(
        result.repository.owner,
        result.repository.repo,
        result.path
      );

      if (content) {
        const parsed = parseSparkFile(content);
        parsed.rawContent = content;
        parsed.sourceFile = result.name;
        parsed.sourcePath = result.path;
        parsed.repository = result.repository;

        // Enrich with last commit author from GitHub when available
        if (!parsed.contributors) parsed.contributors = {};
        try {
          const lastCommit = await fetchLastCommitAuthor(
            result.repository.owner,
            result.repository.repo,
            result.path,
          );
          if (!parsed.contributors.scout && lastCommit?.login) {
            parsed.contributors.scout = lastCommit.login;
          } else if (!parsed.contributors.scout && result.repository?.owner) {
            // Fallback: use repository owner when commit author is unavailable
            parsed.contributors.scout = result.repository.owner;
          }
        } catch (e) {
          console.warn('Failed to enrich global search spark with last commit author:', e);
          if (!parsed.contributors.scout && result.repository?.owner) {
            parsed.contributors.scout = result.repository.owner;
          }
        }

        if (onSparkLoad) {
          onSparkLoad(parsed);
        }
      } else {
        setError('Failed to load spark content');
      }
    } catch (err) {
      setError(`Failed to load spark: ${err.message}`);
    } finally {
      setLoadingPreview(null);
    }
  };

  const handleLoadRepository = (result) => {
    if (onRepoSelect) {
      onRepoSelect(`${result.repository.owner}/${result.repository.repo}`);
    }
  };

  const clearFilters = () => {
    setUserFilter('');
  };

  const hasActiveFilters = userFilter;

  return (
    <div className="flex flex-col h-full theme-card border theme-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b theme-border">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-5 w-5 text-design-500" />
          <h2 className="text-lg font-semibold">Global Spark Search</h2>
        </div>
        <p className="text-xs theme-subtle">
          Search for .spark.md files across all GitHub repositories
        </p>
      </div>

      {/* Search Form */}
      <div className="p-4 border-b theme-border space-y-3">
        {/* Main Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 theme-muted" />
          <input
            type="text"
            placeholder="Search keywords (e.g., 'reputation', 'governance')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch(1)}
            className="w-full pl-10 pr-4 py-2 rounded-lg theme-border theme-input text-sm focus:outline-none focus:ring-2 focus:ring-design-500"
          />
        </div>

        {/* Filters Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-xs theme-muted-hover transition-colors"
          >
            <Filter className="h-4 w-4" />
            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            {hasActiveFilters && (
              <span className="inline-flex h-2 w-2 rounded-full bg-design-500"></span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs theme-muted-hover transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Filter Inputs */}
        {showFilters && (
          <div className="pt-2 border-t theme-border">
            <input
              type="text"
              placeholder="User (e.g., 'torvalds', 'gvanrossum')..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg theme-border theme-input text-sm focus:outline-none focus:ring-2 focus:ring-design-500"
            />
          </div>
        )}

        {/* Search Button */}
        <button
          onClick={() => handleSearch(1)}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2 rounded-lg bg-design-600 px-4 py-2 text-sm font-semibold hover:bg-design-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              <span>Search GitHub</span>
            </>
          )}
        </button>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-3 mb-3 flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">Search Error</p>
              <p className="text-sm text-red-300 mt-1">{error}</p>
            </div>
          </div>
        )}

        {totalCount > 0 && (
          <div className="mb-3 text-xs theme-subtle">
            Found <span className="theme-text font-semibold">{totalCount}</span> spark file{totalCount !== 1 ? 's' : ''} 
            {currentPage > 1 && ` (Page ${currentPage})`}
          </div>
        )}

        {loading && results.length === 0 ? (
          <div className="text-center py-8 theme-subtle">
            <Loader className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Searching GitHub...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 theme-subtle">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {error ? 'Search failed' : 'No results yet'}
            </p>
            <p className="text-xs mt-1">
              {error ? 'Please check the error above' : 'Enter a search query to find spark files'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result, idx) => (
              <div
                key={`${result.repository.fullName}-${result.path}-${idx}`}
                className="theme-card-soft border theme-border rounded-lg p-3 hover:border-design-500 transition-colors"
              >
                {/* Repository Info */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <a
                      href={result.repository.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold theme-text hover:text-design-400 transition-colors inline-flex items-center gap-1"
                    >
                      {result.repository.fullName}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {result.repository.description && (
                      <p className="text-xs theme-subtle mt-1 line-clamp-2">
                        {result.repository.description}
                      </p>
                    )}
                  </div>
                  {result.repository.starCount > 0 && (
                    <div className="flex items-center gap-1 text-xs theme-subtle ml-2">
                      <Star className="h-3 w-3 fill-current" />
                      <span>{result.repository.starCount}</span>
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex items-center gap-2 mb-2 text-xs theme-subtle">
                  <span className="font-mono bg-gray-700/50 px-2 py-1 rounded">
                    {result.name}
                  </span>
                  <span className="text-gray-600">/</span>
                  <span className="truncate">{result.path}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleLoadSpark(result)}
                    disabled={loadingPreview === result.path}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-design-600 hover:bg-design-700 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {loadingPreview === result.path ? (
                      <>
                        <Loader className="h-3 w-3 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3 w-3" />
                        <span>Load Spark</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleLoadRepository(result)}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 rounded theme-card border theme-border hover:border-design-500 text-xs font-semibold transition-colors"
                  >
                    <Globe className="h-3 w-3" />
                    <span>Browse Repo</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {(currentPage > 1 || hasNextPage) && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t theme-border">
            <button
              onClick={() => handleSearch(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 rounded theme-card border theme-border hover:border-design-500 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs theme-subtle">
              Page {currentPage}
            </span>
            <button
              onClick={() => handleSearch(currentPage + 1)}
              disabled={!hasNextPage || loading}
              className="px-3 py-1.5 rounded theme-card border theme-border hover:border-design-500 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
