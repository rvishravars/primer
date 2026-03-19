// Lightweight API client for orchestrator and spark endpoints.
// This centralizes fetch calls so UI components can remain focused
// on presentation and workflows.

export async function runAgent({
  provider = 'openai',
  apiKey,
  model = 'gpt-4o-mini',
  taskType = 'improve_spark_maturity',
  sparkContent,
  sparkData,
  messages,
}) {
  const response = await fetch('/api/agents/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      apiKey,
      model,
      task_type: taskType,
      sparkContent,
      sparkData,
      messages,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Agent orchestrator request failed');
  }

  return data;
}

export async function fetchSpark({ repo, path, branch = 'main' }) {
  const params = new URLSearchParams({ repo, path, branch });
  const response = await fetch(`/api/spark?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to fetch spark');
  }
  return data;
}

export async function fetchSparkHistory({ repo, path, branch = 'main' }) {
  const params = new URLSearchParams({ repo, path, branch });
  const response = await fetch(`/api/spark/history?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to fetch spark history');
  }
  return data;
}
