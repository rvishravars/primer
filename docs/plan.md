# Context Engineering Implementation Plan

This plan describes how to evolve Spark Assembly Lab into a full implementation of the context engineering system described in `context-engineering-system.md`.

---

## 0. Goals & Non‑Goals

- Make **sparks the primary context artifact** for all AI tasks.
- Introduce a **backend orchestration layer** (agents, tools, RAG, model gateway).
- Keep the UI focused on:
  - Authoring / curating sparks.
  - Inspecting AI‑proposed changes.
  - Driving improvement loops.
- Do **not** optimize for multi‑tenant scale yet; focus on a single‑org, single‑model deployment first.

---

## 1. Spark Schema & Storage

**1.1 Canonical Enhanced Spark Schema**

- Finalize the v3.0 Enhanced Spark YAML + markdown schema (see `docs/enhanced-spark-schema.md`):
  - Required fields (metadata, ownership, maturity, sections 1–8).
  - Optional fields (tags, links, experiment IDs).
  - Agent‑managed sections vs human‑owned sections.
- Update:
  - Spark parser/generator to match the canonical schema.
  - Example sparks in this repo to conform.

**1.2 Spark Store Abstraction**

- Define a `SparkStore` interface:
  - `getSpark(id)`, `listSparks(filter)`, `saveSpark(id, content, metadata)`, `history(id)`.
- Implement a single canonical backend:
  - GitHub repository (current behavior, via REST API).
  - Any in-memory caches are ephemeral and can always be rebuilt from GitHub; **no additional database is used to store sparks**.

---

## 2. Model Gateway & LLM Backend

**2.1 Model Gateway Service**

- Introduce a backend service (e.g., `orchestrator` or reuse `server_py`) exposing:
  - `POST /model/infer` — generic LLM call with:
    - `system_prompt`, `spark_sections`, `retrieved_snippets`, `conversation`, `task_type`.
- Implement **context window accounting**:
  - Tokenize assembled prompt.
  - Drop/shorten low‑priority sections when over limit.
  - Strategy per task (e.g., prefer Narrative + Hypothesis over old chat).

**2.2 Model Providers**

- Add pluggable providers:
  - Codex (OpenAI) / Claude Code (Anthropic) via the model gateway.
  - Local model (optional).
- Configure **per‑task model selection**, e.g.:
  - Fast model for feedback loops.
  - Stronger model for critical revisions.

---

## 3. Context Assembly / RAG Service

**3.1 RAG Service API**

- Add a `POST /rag/assemble` endpoint that:
  - Takes `spark_id`, `task_type`, and recent tool outputs.
  - Returns updated **technical sections** for the spark (e.g., `retrieved_context`, `evidence_summary`).

**3.2 Retrieval Sources**

- Start simple:
  - GitHub code search and issues.
  - Docs in this repo (primer and lab docs).
- Later:
  - Logs / metrics / external knowledge bases.

**3.3 Embeddings & Indexing**

- Introduce an embeddings store (file or simple DB) for:
  - Spark content.
  - Local docs and examples.
- Add periodic or on‑demand indexing jobs run by an agent.

---

## 4. Agent Orchestrator

**4.1 Agent Definitions**

- Define a small set of agents to start:
  - `improve_spark_maturity`
  - `design_experiment_from_spark`
  - `summarize_results_for_review`
- For each agent, specify:
  - Allowed tools.
  - System prompt template.
  - Model selection.
  - Inputs/outputs.

**4.2 Orchestration Loop**

- Implement an `Agent Orchestrator` backend module that:
  - Receives a `task_type` + `spark_id` + user goal.
  - Calls tools via MCP adapter.
  - Calls RAG service to update technical sections.
  - Calls Model Gateway with assembled prompt.
  - Writes AI‑proposed changes into **draft sections** (not final).

---

## 5. Tools (MCP) Integration

**5.1 MCP Client**

- Add a Tool Adapter module implementing:
  - Tool registry (name → schema + endpoint).
  - Call wrapper with auth, retries, and structured responses.

**5.2 Initial Tool Set**

- `code_search` — GitHub search scoped to spark’s repo.
- `issue_lookup` — fetch issues/PRs linked in spark.
- `doc_lookup` — search this repo’s docs and examples.

---

## 6. UI Evolution: Spark Assembly Lab

**6.1 Backend Integration Layer**

- Add an API client in the React app for:
  - `POST /agents/run` (improve this spark, design experiment, etc.).
  - `GET/POST /sparks` (if not already mediated by GitHub only).
- Route all AI actions through the orchestrator instead of calling models directly.

**6.2 Improvement Workflows**

- Replace the current “Improve Spark” flow with:
  - A **task picker** (e.g., “Audit maturity”, “Sharpen hypothesis”, “Refine experiment”).
  - Clear display of:
    - What sections were used as context.
    - What tools/RAG steps were executed.
  - Diff view for AI‑proposed changes to:
    - Core sections (Narrative, Hypothesis, Results).
    - Technical sections (retrieved context, evidence summary).

**6.3 Context Transparency UI**

- Add a “Context Window Inspector” panel showing:
  - Which sections/snippets went into the last model call.
  - Approx token counts by component (system prompt, spark sections, snippets).
  - Any truncation/summarization actions taken by the gateway.

**6.4 Collaboration Surface**

- Tighten feedback workflows:
  - Dedicated pane for “Feedback & Critique” and “Proposals”.
  - One‑click “Open GitHub Issue” for proposals.

---

## 7. System Prompts & Templates

**7.1 Prompt Template Library**

- Extract prompt text into versioned templates:
  - One per agent and task type.
  - With slots for spark metadata and sections.
- Store alongside docs for review and iteration.

**7.2 Governance**

- Add a simple change process:
  - PRs required for prompt changes.
  - Changelog entry per major prompt revision.
  - Optional A/B tags in logs to compare behaviors.

---

## 8. Telemetry, Evaluation & Guardrails

**8.1 Logging & Traces**

- Log for each agent run:
  - Task type, spark id, agent version, prompt template version.
  - Context composition summary (sections/snippets used).
  - Tool calls and errors.
  - Outcome (accepted/rejected edits).

**8.2 Evaluation Loops**

- Define a small set of metrics:
  - Time/iterations to reach `validated`.
  - Fraction of AI‑proposed edits accepted.
  - User satisfaction (lightweight rating in UI).

**8.3 Safety & Policy Layers**

- Add basic guardrails in the Model Gateway:
  - Maximum tokens per task.
  - Simple content filters / refusals for disallowed domains.
  - Rate limiting by user/token.

---

## 9. Rollout Plan

**Phase 1: Skeleton Backend + One Agent**

- Implement Model Gateway, minimal RAG, and `improve_spark_maturity` agent.
- Wire the current “Improve” button to the new pipeline.
- Keep UI changes minimal; focus on correctness.

**Phase 2: Rich UI & Multiple Agents**

- Introduce context inspector, task picker, and diff UX.
- Add experiment design and results summarization agents.

**Phase 3: Tooling & RAG Expansion**

- Add more tools and retrieval sources.
- Improve technical sections and indexing.

**Phase 4: Hardening**

- Add telemetry dashboards, prompts governance, and safety policies.
- Document the end‑to‑end architecture and playbooks for operators.

---

## Implementation Checklist

### Phase 1: Skeleton Backend + One Agent

- [x] Define canonical Enhanced Spark schema (metadata, ownership, maturity, sections 1–8).
- [x] Update spark parser/generator to match the canonical schema and example sparks.
- [x] Implement `SparkStore` backed by GitHub (get/list/save/history via REST API).
- [x] Implement Model Gateway service with `POST /model/infer` and context window accounting.
- [x] Implement minimal RAG service with `POST /rag/assemble` that updates technical sections in spark files in GitHub.
- [x] Implement `improve_spark_maturity` agent in the Agent Orchestrator.
- [x] Wire the current "Improve Spark" UI button to call the orchestrator (`/agents/run`) instead of direct model calls.
- [x] Add basic logging/traces for each agent run (task type, spark id, prompt template version).

### Phase 2: Rich UI & Multiple Agents

- [x] Add API client in the React app for orchestrator and spark endpoints.
- [x] Replace the existing Improve flow with a task picker (audit maturity, sharpen hypothesis, refine experiment).
- [x] Implement diff view for AI‑proposed changes to core and technical sections.
- [x] Surface RAG/Tools activity in the UI (what tools ran, what was updated).
- [x] Add initial Context Window Inspector showing sections/snippets and approximate token counts.
- [x] Implement additional agents: `design_experiment_from_spark` and `summarize_results_for_review`.

### Phase 3: Tooling & RAG Expansion

- [ ] Implement MCP Tool Adapter (registry + call wrapper).
- [ ] Add `code_search` tool for GitHub code search scoped to the spark’s repo.
- [ ] Add `issue_lookup` tool for linked issues/PRs.
- [ ] Add `doc_lookup` tool for primer and lab docs.
- [ ] Introduce embeddings/indexing for sparks and local docs (derived, not canonical storage).
- [ ] Extend RAG service to use embeddings/index for retrieval.

### Phase 4: Hardening & Governance

- [ ] Extract prompts into versioned templates per agent/task type.
- [ ] Add a prompt change process (PRs + changelog entries).
- [ ] Add safety policies and rate limiting in the Model Gateway.
- [ ] Add telemetry dashboards for agent performance and acceptance rates.
- [ ] Add UX for lightweight user feedback on AI suggestions.
- [ ] Document runbooks for operating the orchestrator, RAG, and Model Gateway.

