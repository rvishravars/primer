import { useEffect, useState } from 'react';
import { MessageCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { parseRepoUrl, fetchOpenPullRequests, fetchOpenIssues, fetchDiscussions, fetchIssueComments, fetchDiscussionComments } from '../utils/github';

export default function CommentsPanel({ repoUrl, sparkFile, user }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!repoUrl || !sparkFile || !user) return;
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl, sparkFile, user]);

  const loadComments = async () => {
    setLoading(true);
    setError(null);

    try {
      const { owner, repo } = parseRepoUrl(repoUrl);
      const sparkName = sparkFile.replace('.spark.md', '').split('/').pop();

      const [allPRs, allIssues, allDiscussions] = await Promise.all([
        fetchOpenPullRequests(owner, repo),
        fetchOpenIssues(owner, repo),
        fetchDiscussions(owner, repo),
      ]);

      const matchesSpark = (item) => {
        const name = (sparkName || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        const body = (item.body || '').toLowerCase();
        return (
          title.includes(name) ||
          body.includes(name) ||
          (sparkFile && body.includes(sparkFile))
        );
      };

      const relevantPRs = allPRs.filter(matchesSpark);
      const relevantIssues = allIssues.filter(matchesSpark);
      const relevantDiscussions = allDiscussions.filter(matchesSpark);

      const [prComments, issueComments, discussionComments] = await Promise.all([
        Promise.all(relevantPRs.map((pr) => fetchIssueComments(owner, repo, pr.number))),
        Promise.all(relevantIssues.map((issue) => fetchIssueComments(owner, repo, issue.number))),
        Promise.all(relevantDiscussions.map((discussion) => fetchDiscussionComments(owner, repo, discussion.number))),
      ]);

      const prThreads = relevantPRs.map((pr, idx) => ({
        id: `pr-${pr.number}`,
        type: 'pr',
        number: pr.number,
        title: pr.title,
        author: pr.user?.login,
        createdAt: pr.created_at,
        commentsCount: pr.comments,
        url: pr.html_url,
        comments: prComments[idx] || [],
      }));

      const issueThreads = relevantIssues.map((issue, idx) => ({
        id: `issue-${issue.number}`,
        type: 'issue',
        number: issue.number,
        title: issue.title,
        author: issue.user?.login,
        createdAt: issue.created_at,
        commentsCount: issue.comments,
        url: issue.html_url,
        comments: issueComments[idx] || [],
      }));

      const discussionThreads = relevantDiscussions.map((discussion, idx) => ({
        id: `discussion-${discussion.number}`,
        type: 'discussion',
        number: discussion.number,
        title: discussion.title,
        author: (discussion.user || discussion.author)?.login,
        createdAt: discussion.created_at,
        commentsCount: discussion.comments,
        url: discussion.html_url,
        comments: discussionComments[idx] || [],
      }));

      setThreads([...prThreads, ...issueThreads, ...discussionThreads]);
    } catch (err) {
      console.error('Error loading comments:', err);
      setError(err.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!user) {
    return (
      <div className="theme-panel rounded-lg p-6 border-2 border-spark-600 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm opacity-75">Login with GitHub to view comments for this spark.</p>
      </div>
    );
  }

  return (
    <div className="theme-panel rounded-lg border-2 border-design-600 overflow-hidden">
      <div className="bg-design-600 px-4 py-3 flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        <h3 className="font-semibold">Comments for this Spark</h3>
        {threads.length > 0 && (
          <span className="ml-auto inline-block bg-white/20 px-2 py-0.5 rounded text-xs font-semibold">
            {threads.length} threads
          </span>
        )}
      </div>

      {loading && (
        <div className="p-4 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-design-600 border-t-transparent"></div>
          <p className="text-sm mt-3 opacity-75">Loading comments...</p>
        </div>
      )}

      {!loading && error && (
        <div className="p-4 text-center">
          <p className="text-sm opacity-70">{error}</p>
          <button
            onClick={loadComments}
            className="mt-3 text-xs px-3 py-1 bg-design-600 hover:bg-design-700 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && threads.length === 0 && (
        <div className="p-4 text-center opacity-60">
          <p className="text-sm">No comments found for this spark yet.</p>
        </div>
      )}

      {!loading && !error && threads.length > 0 && (
        <div className="divide-y divide-border-200/30">
          {threads.map((thread) => (
            <div key={thread.id} className="hover:bg-white/5 transition-colors">
              <button
                onClick={() => setExpandedId(expandedId === thread.id ? null : thread.id)}
                className="w-full p-4 text-left flex items-start gap-3 group"
              >
                <MessageCircle className="h-5 w-5 text-design-300 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate group-hover:text-design-200 transition-colors">
                    <span className="text-xs opacity-60 mr-2">#{thread.number}</span>
                    {thread.title}
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs opacity-70">
                    <span className="bg-design-600/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-design-300">
                      {thread.type === 'pr'
                        ? 'Pull Request'
                        : thread.type === 'issue'
                          ? 'Issue'
                          : 'Discussion'}
                    </span>
                    {thread.author && <span>{thread.author}</span>}
                    <span>•</span>
                    <span>{formatDate(thread.createdAt)}</span>
                    <span>•</span>
                    <span>{thread.commentsCount} comments</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {expandedId === thread.id ? (
                    <ChevronUp className="h-5 w-5 opacity-60" />
                  ) : (
                    <ChevronDown className="h-5 w-5 opacity-60 group-hover:opacity-100" />
                  )}
                </div>
              </button>

              {expandedId === thread.id && (
                <div className="bg-white/5 border-t border-white/10 p-4 space-y-3">
                  {thread.comments && thread.comments.length > 0 ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {thread.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="bg-black/30 rounded border border-white/10 p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold opacity-80">{comment.user?.login}</span>
                            <span className="opacity-60 text-[10px]">{formatDate(comment.created_at)}</span>
                          </div>
                          <div className="opacity-80 whitespace-pre-wrap mt-1">
                            {comment.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs opacity-60">No comments yet in this thread.</p>
                  )}

                  <div className="pt-2 border-t border-white/10">
                    <a
                      href={thread.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-design-400 hover:text-design-300 transition-colors"
                    >
                      View full discussion on GitHub →
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
