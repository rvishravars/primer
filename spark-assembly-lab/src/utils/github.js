/**
 * GitHub Personal Access Token Authentication
 * Users paste their GitHub token directly
 */

const GITHUB_AUTH_TOKEN_KEY = 'gh_user_token';
const GITHUB_USER_KEY = 'gh_user_info';

/**
 * Get stored GitHub token
 */
export const getStoredToken = () => {
  return localStorage.getItem(GITHUB_AUTH_TOKEN_KEY);
};

/**
 * Get stored user info
 */
export const getStoredUserInfo = () => {
  const stored = localStorage.getItem(GITHUB_USER_KEY);
  return stored ? JSON.parse(stored) : null;
};

/**
 * Fetch user info from GitHub using access token
 */
export const fetchUserInfo = async (token) => {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      login: data.login,
      name: data.name,
      avatar_url: data.avatar_url,
      id: data.id,
    };
  } catch (error) {
    console.error('Failed to fetch user info:', error);
    return null;
  }
};

/**
 * Login with personal access token
 */
export const loginWithToken = async (token) => {
  if (!token || !token.trim()) {
    return {
      success: false,
      error: 'Token is required',
    };
  }

  try {
    const userInfo = await fetchUserInfo(token);

    if (!userInfo) {
      return {
        success: false,
        error: 'Invalid token or unable to fetch user info. Make sure your token has at least "read:user" scope.',
      };
    }

    storeUserAuth(token, userInfo);
    return {
      success: true,
      user: userInfo,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to authenticate',
    };
  }
};

/**
 * Store user token and info
 */
export const storeUserAuth = (token, userInfo) => {
  localStorage.setItem(GITHUB_AUTH_TOKEN_KEY, token);
  localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(userInfo));
};

/**
 * Clear stored authentication
 */
export const clearUserAuth = () => {
  localStorage.removeItem(GITHUB_AUTH_TOKEN_KEY);
  localStorage.removeItem(GITHUB_USER_KEY);
};

/**
 * Open GitHub token creation page
 */
export const openTokenCreationPage = () => {
  const url = 'https://github.com/settings/tokens/new?scopes=read:user,repo&description=Spark%20Assembly%20Lab';
  window.open(url, '_blank');
};

/**
 * Parse repository URL into owner and repo
 */
export const parseRepoUrl = (input) => {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    throw new Error('Invalid repository format. Use: owner/repo or https://github.com/owner/repo');
  }

  // Strip URL query/hash fragments early.
  const withoutQuery = trimmed.split('?')[0].split('#')[0];

  // Support common copy-paste formats:
  // - https://github.com/owner/repo
  // - http(s)://github.com/owner/repo
  // - owner/repo
  // - git@github.com:owner/repo.git
  // - ssh://git@github.com/owner/repo.git
  const normalized = withoutQuery
    .replace(/^ssh:\/\/git@github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^github\.com\//i, '');

  const parts = normalized.split('/').filter(part => part);

  if (parts.length >= 2) {
    return {
      owner: parts[0],
      repo: parts[1].replace('.git', ''),
    };
  }

  throw new Error('Invalid repository format. Use: owner/repo or https://github.com/owner/repo');
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  let body = null;
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }
  return { response, body };
};

/**
 * Build GitHub API headers with optional authentication
 */
const buildGitHubHeaders = (options = {}) => {
  const { noAuth = false } = options;

  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'spark-assembly-lab',
  };

  const token = noAuth ? null : getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

const fetchGitHub = async (url, init = {}) => {
  const first = await fetch(url, {
    ...init,
    headers: buildGitHubHeaders(),
  });

  if (first.status !== 401) return first;

  // Stored token is invalid/revoked. Clear auth and retry without Authorization.
  try {
    clearUserAuth();
  } catch {
    // ignore
  }

  return await fetch(url, {
    ...init,
    headers: buildGitHubHeaders({ noAuth: true }),
  });
};

const fetchGitHubJson = async (url) => {
  const first = await fetchJson(url, { headers: buildGitHubHeaders() });
  if (first.response.status !== 401) return first;

  try {
    clearUserAuth();
  } catch {
    // ignore
  }

  return await fetchJson(url, { headers: buildGitHubHeaders({ noAuth: true }) });
};

const checkRepoAccessible = async (owner, repo) => {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const { response } = await fetchGitHubJson(url);
  if (response.status === 403) {
    throw new Error('GitHub API rate limit exceeded. Please add a GitHub token or try again later.');
  }
  return response.ok;
};

const checkBranchExists = async (owner, repo, branch) => {
  if (!branch) return true;
  const url = `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`;
  const { response } = await fetchGitHubJson(url);
  if (response.status === 403) {
    throw new Error('GitHub API rate limit exceeded. Please add a GitHub token or try again later.');
  }
  if (response.status === 404) return false;
  return response.ok;
};

/**
 * Search for .spark.md files in a repository
 */
const searchSparkFiles = async (owner, repo) => {
  const query = `filename:.spark.md repo:${owner}/${repo}`;
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}`;

  const response = await fetchGitHub(url);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please add a GitHub token or try again later.');
    }
    throw new Error(`GitHub search failed: ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
};

/**
 * List files in a directory
 */
const listDirectory = async (owner, repo, path = 'sparks', branch = 'main') => {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const response = await fetchGitHub(url);

  if (!response.ok) {
    if (response.status === 404) {
      // 404 here is ambiguous: could be missing repo, missing access, missing branch, or missing directory.
      // Do a couple of targeted checks to return a more actionable error.
      const repoAccessible = await checkRepoAccessible(owner, repo);
      if (!repoAccessible) {
        throw new Error(`Repository '${owner}/${repo}' not found, or you don't have access. If it's private, add a GitHub token.`);
      }

      const branchExists = await checkBranchExists(owner, repo, branch);
      if (!branchExists) {
        throw new Error(`Branch '${branch}' not found in '${owner}/${repo}'. Please select a different branch.`);
      }

      throw new Error(`The '${path}/' directory wasn't found in '${owner}/${repo}' on branch '${branch}'.`);
    }
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please add a GitHub token or try again later.');
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const items = await response.json();
  return items.filter(item =>
    item.type === 'file' && item.name.endsWith('.spark.md')
  );
};

/**
 * Fetch file content from GitHub
 */
const fetchFileContent = async (owner, repo, path, branch = 'main') => {
  // Use raw.githubusercontent.com for direct content access (no rate limiting)
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

  const response = await fetch(url);
  if (response.ok) {
    return await response.text();
  }

  // Fallback: use GitHub Contents API (supports auth via PAT) and decode base64 content.
  // This is more rate-limited than raw, but helps in environments where raw.githubusercontent.com is blocked.
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}` +
    `?ref=${encodeURIComponent(branch)}`;

  const { response: apiResponse, body } = await fetchGitHubJson(apiUrl);
  if (!apiResponse.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  if (!body || typeof body.content !== 'string') {
    throw new Error(`Failed to fetch ${path}: unexpected GitHub API response`);
  }

  const base64 = body.content.replace(/\n/g, '');
  try {
    // atob is available in browsers; Buffer is a Node fallback.
    if (typeof atob === 'function') {
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(base64), (c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join('')
      );
    }
    if (globalThis?.Buffer?.from) {
      return globalThis.Buffer.from(base64, 'base64').toString('utf-8');
    }
    throw new Error('No base64 decoder available');
  } catch (e) {
    throw new Error(`Failed to decode ${path} content`);
  }
};

/**
 * Fetch the last commit author for a specific file
 */
export const fetchLastCommitAuthor = async (owner, repo, filepath, branch = 'main') => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(filepath)}&sha=${encodeURIComponent(branch)}&per_page=1`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      // Best-effort only; don't fail the whole flow.
      console.warn('Failed to fetch last commit author:', response.status);
      return null;
    }

    const commits = await response.json();
    if (Array.isArray(commits) && commits.length > 0) {
      const commit = commits[0];
      const authorUser = commit.author || {};
      const commitAuthor = (commit.commit || {}).author || {};
      const login = authorUser.login || null;
      const name = commitAuthor.name || null;
      const date = commitAuthor.date || null;

      const result = {};
      if (login) result.login = login;
      if (name) result.name = name;
      if (date) result.date = date;
      if (Object.keys(result).length > 0) {
        return result;
      }
    }

    return null;
  } catch (error) {
    console.warn('Failed to fetch last commit author:', error);
    return null;
  }
};

/**
 * Load all sparks from a GitHub repository
 */
export const loadSparksFromGitHub = async (repoInput, branch = 'main', searchPath = 'sparks') => {
  try {
    // Parse repository URL
    const { owner, repo } = parseRepoUrl(repoInput);

    let searchItems = [];
    let dirItems = [];
    let searchError = null;
    let dirError = null;

    // Directory listing is authoritative and avoids GitHub Code Search rate limiting.
    try {
      dirItems = await listDirectory(owner, repo, searchPath, branch);
    } catch (listErr) {
      dirError = listErr;
      console.warn('Directory listing failed:', listErr);
    }

    // Only fall back to code search if directory listing failed or returned nothing.
    if (!dirError && Array.isArray(dirItems) && dirItems.length > 0) {
      searchItems = [];
    } else {
      try {
        searchItems = await searchSparkFiles(owner, repo);
      } catch (searchErr) {
        searchError = searchErr;
        console.warn('Search failed:', searchErr);
      }
    }

    const combinedItems = [];
    const seenPaths = new Set();
    const addItem = (item) => {
      const path = item.path || item.name;
      if (!path || seenPaths.has(path)) return;
      seenPaths.add(path);
      combinedItems.push(item);
    };

    searchItems.forEach(addItem);
    dirItems.forEach(addItem);

    if (combinedItems.length === 0) {
      if (dirError) throw dirError;
      if (searchError) throw searchError;
      return {
        success: true,
        owner,
        repo,
        branch,
        files: [],
        message: 'No .spark.md files found in this repository',
      };
    }

    // Fetch content (and optionally last commit) for each spark file
    const files = [];
    for (const item of combinedItems) {
      try {
        const path = item.path || item.name;
        const content = await fetchFileContent(owner, repo, path, branch);
        const lastCommit = await fetchLastCommitAuthor(owner, repo, path, branch);
        files.push({
          name: item.name || path.split('/').pop(),
          path: path,
          content: content,
          lastCommit,
        });
      } catch (err) {
        console.warn(`Failed to fetch ${item.name || item.path}:`, err);
        // Continue with other files
      }
    }

    if (combinedItems.length > 0 && files.length === 0) {
      // Browser-side fetching can be blocked by extensions/privacy tools.
      // Cloud Run includes a backend endpoint that fetches server-side, which is typically more reliable.
      try {
        const backendUrl = `/api/sparks?repo=${encodeURIComponent(repoInput)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(searchPath)}`;
        const backendResponse = await fetch(backendUrl);
        if (backendResponse.ok) {
          const backendData = await backendResponse.json();
          if (backendData?.files?.length) {
            return {
              success: true,
              owner: backendData.owner || owner,
              repo: backendData.repo || repo,
              branch: backendData.branch || branch,
              files: backendData.files,
              source: backendData.source || 'backend',
            };
          }
        }
      } catch (backendErr) {
        console.warn('Backend spark fetch failed:', backendErr);
      }

      return {
        success: false,
        error: `Found ${combinedItems.length} .spark.md file(s) but failed to fetch their contents. This is often caused by browser extensions blocking GitHub requests. Try disabling blockers for github.com/raw.githubusercontent.com or refreshing in incognito, or login with a GitHub token and refresh.`,
      };
    }

    return {
      success: true,
      owner,
      repo,
      branch,
      files,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to load sparks from GitHub',
    };
  }
};

/**
 * Fetch branches from a GitHub repository
 */
export const fetchBranches = async (repoInput) => {
  try {
    const { owner, repo } = parseRepoUrl(repoInput);
    const url = `https://api.github.com/repos/${owner}/${repo}/branches`;

    const response = await fetchGitHub(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository '${owner}/${repo}' not found`);
      }
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please add a GitHub token or try again later.');
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const branches = await response.json();
    return {
      success: true,
      branches: branches.map(b => b.name),
      defaultBranch: branches.find(b => b.name === 'main' || b.name === 'master')?.name || branches[0]?.name || 'main',
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to fetch branches',
      branches: ['main'],
      defaultBranch: 'main',
    };
  }
};

/**
 * Fetch all open pull requests in a repository
 */
export const fetchOpenPullRequests = async (owner, repo) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PRs: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch pull requests:', error);
    return [];
  }
};

/**
 * Fetch all open issues in a repository
 */
export const fetchOpenIssues = async (owner, repo) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch issues: ${response.status}`);
    }

    const issues = await response.json();
    // GitHub API includes PRs in the issues list, filter them out
    return issues.filter(issue => !issue.pull_request);
  } catch (error) {
    console.error('Failed to fetch issues:', error);
    return [];
  }
};

/**
 * Fetch files changed in a specific pull request
 */
export const fetchPRFiles = async (owner, repo, prNumber) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PR files: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch files for PR #${prNumber}:`, error);
    return [];
  }
};

/**
 * Get file diff content from a PR
 */
export const fetchPRDiff = async (owner, repo, prNumber, filename) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PR diff: ${response.status}`);
    }

    const files = await response.json();
    return files.find(f => f.filename === filename);
  } catch (error) {
    console.error(`Failed to fetch diff for ${filename}:`, error);
    return null;
  }
};

/**
 * Filter PRs that affect a specific file
 */
export const filterPRsByFile = (prs, filename) => {
  return prs.filter(pr => {
    // Check if the filename or similar spark file is in the PR's title or body
    return (
      pr.title.includes(filename.replace('.spark.md', '')) ||
      (pr.body && pr.body.includes(filename))
    );
  });
};

/**
 * Fetch commit history for a specific file
 */
export const fetchFileCommitHistory = async (owner, repo, filepath, branch = 'main') => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${filepath}&sha=${branch}&per_page=50`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch commit history: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch commit history:', error);
    return [];
  }
};

/**
 * Fetch full commit details including diff
 */
export const fetchCommitDetails = async (owner, repo, sha) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch commit details: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch commit details:', error);
    return null;
  }
};

/**
 * Fetch issue or pull request comments (conversation) for a given number
 * Note: PRs are also issues in the GitHub API, so this works for both.
 */
export const fetchIssueComments = async (owner, repo, number) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch comments for #${number}:`, error);
    return [];
  }
};

/**
 * Fetch discussions in a repository
 */
export const fetchDiscussions = async (owner, repo) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/discussions?per_page=100`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      // Many repos won't have Discussions enabled; treat 404 as "no discussions".
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch discussions: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch discussions:', error);
    return [];
  }
};

/**
 * Fetch comments on a specific discussion
 */
export const fetchDiscussionComments = async (owner, repo, discussionNumber) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/discussions/${discussionNumber}/comments?per_page=100`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      // As above, 404 likely means discussions not enabled.
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch discussion comments: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch comments for discussion #${discussionNumber}:`, error);
    return [];
  }
};

/**
 * Global search for .spark.md files across all GitHub repositories
 * @param {string} searchQuery - Search query (can include keywords, org:name, user:name, etc.)
 * @param {Object} options - Search options
 * @param {string} options.org - Filter by organization name
 * @param {string} options.user - Filter by user name
 * @param {number} options.perPage - Results per page (default: 30, max: 100)
 * @param {number} options.page - Page number (default: 1)
 * @returns {Promise<Object>} Search results with spark files
 */
export const globalSearchSparkFiles = async (searchQuery = '', options = {}) => {
  try {
    const { org, user, perPage = 30, page = 1 } = options;

    // Build query parts
    const queryParts = ['filename:.spark.md'];

    // Add search keywords if provided
    if (searchQuery && searchQuery.trim()) {
      queryParts.push(searchQuery.trim());
    }

    // Add org/user filters
    if (org) {
      queryParts.push(`org:${org}`);
    } else if (user) {
      queryParts.push(`user:${user}`);
    }

    const query = queryParts.join(' ');
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;

    const response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });

    if (!response.ok) {
      if (response.status === 403) {
        // const resetTime = response.headers.get('X-RateLimit-Reset');
        throw new Error('GitHub API rate limit exceeded. Please add a GitHub token or try again later.');
      }
      if (response.status === 422) {
        throw new Error('Invalid search query. Please refine your search.');
      }
      throw new Error(`GitHub search failed: ${response.status}`);
    }

    const data = await response.json();

    // Parse results into a more usable format
    const results = (data.items || []).map(item => {
      const repoFullName = item.repository.full_name;
      const [owner, repo] = repoFullName.split('/');

      return {
        path: item.path,
        name: item.name,
        repository: {
          fullName: repoFullName,
          owner,
          repo,
          url: item.repository.html_url,
          description: item.repository.description,
          starCount: item.repository.stargazers_count,
          language: item.repository.language,
        },
        url: item.html_url,
        sha: item.sha,
      };
    });

    return {
      success: true,
      totalCount: data.total_count,
      incompleteResults: data.incomplete_results,
      results,
      page,
      perPage,
      hasNextPage: results.length === perPage && data.total_count > page * perPage,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to search for spark files',
      results: [],
      totalCount: 0,
    };
  }
};

/**
 * Fetch content preview for a spark file from search results
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} branch - Branch name (default: 'main')
 * @returns {Promise<string>} File content
 */
export const fetchSparkFilePreview = async (owner, repo, path, branch = 'main') => {
  try {
    return await fetchFileContent(owner, repo, path, branch);
  } catch (error) {
    console.error(`Failed to fetch preview for ${path}:`, error);
    return null;
  }
};
