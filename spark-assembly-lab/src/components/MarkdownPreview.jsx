import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import Mermaid from './Mermaid';

export default function MarkdownPreview({ markdown, theme }) {
  const components = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const chartCode = String(children).replace(/\n$/, '');

      if (!inline && match && match[1] === 'mermaid') {
        return <Mermaid chart={chartCode} theme={theme} />;
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className="flex-1 overflow-y-auto theme-panel">
      <div className="max-w-4xl mx-auto p-8">
        <div className="prose prose-invert prose-lg max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={components}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
