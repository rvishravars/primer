import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid/dist/mermaid.core.mjs';

const Mermaid = ({ chart, theme = 'dark' }) => {
  const ref = useRef(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'light-theme' ? 'default' : 'dark',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    });
  }, [theme]);

  useEffect(() => {
    if (ref.current && chart) {
      const renderDiagram = async () => {
        try {
          ref.current.innerHTML = '';
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(id, chart);
          if (ref.current) {
            ref.current.innerHTML = svg;
          }
        } catch (e) {
          console.error('Mermaid render error:', e);
          if (ref.current) {
            ref.current.innerHTML = `<pre class="text-red-500 text-xs p-2 bg-red-900/20 rounded">Mermaid Error: ${e.message}</pre>`;
          }
        }
      };
      renderDiagram();
    }
  }, [chart, theme]);

  return (
    <div className="mermaid-container flex justify-center my-6 overflow-x-auto bg-black/10 rounded-xl p-4 border border-white/5">
      <div ref={ref} className="mermaid w-full flex justify-center" />
    </div>
  );
};

export default Mermaid;
