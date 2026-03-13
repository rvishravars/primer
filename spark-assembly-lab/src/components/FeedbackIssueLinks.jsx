import { useEffect, useState } from 'react';
import { AlertCircle, Link2 } from 'lucide-react';
import { parseRepoUrl, fetchOpenIssues } from '../utils/github';

export default function FeedbackIssueLinks({ repoUrl, sparkPath }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!repoUrl || !sparkPath) return;

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { owner, repo } = parseRepoUrl(repoUrl);
        const allIssues = await fetchOpenIssues(owner, repo);
        const sparkName = sparkPath.replace('.spark.md', '').split('/').pop().toLowerCase();

        const relevant = allIssues.filter((issue) => {
          const title = (issue.title || '').toLowerCase();
          const body = (issue.body || '').toLowerCase();
          return title.includes(sparkName) || body.includes(sparkName) || body.includes(sparkPath.toLowerCase());
        });

        if (!controller.signal.aborted) {
          setIssues(relevant);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err.message || 'Failed to load linked issues');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [repoUrl, sparkPath]);

  if (!repoUrl || !sparkPath) return null;

  if (loading) {
    return (
      <div className="mt-3 text-[11px] sm:text-xs text-spark-200/80 flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-spark-400 border-t-transparent animate-spin" />
        <span>Loading linked issues…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 text-[11px] sm:text-xs text-red-200/90 flex items-center gap-2">
        <AlertCircle className="h-3 w-3" />
        <span>{error}</span>
      </div>
    );
  }

  if (!issues.length) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="text-[11px] sm:text-xs uppercase tracking-[0.18em] text-spark-200/80 font-semibold mb-1">
        Linked GitHub Issues
      </p>
      <ul className="space-y-1.5 text-[11px] sm:text-xs text-spark-100/90">
        {issues.map((issue) => (
          <li key={issue.id} className="flex items-center gap-2">
            <Link2 className="h-3 w-3 flex-shrink-0 text-spark-300" />
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-spark-200 underline decoration-spark-400/70 decoration-dotted truncate"
            >
              #{issue.number} {issue.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
