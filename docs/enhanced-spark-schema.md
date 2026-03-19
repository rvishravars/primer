# Canonical Enhanced Spark Schema

This document defines the canonical schema for **Enhanced Sparks** used by Spark Assembly Lab and the context engineering system.

It has two layers:

1. **YAML frontmatter** — machine-readable metadata (identity, ownership, maturity, routing).
2. **Markdown body** — eight primary sections (1–8) that hold the functional and technical content of the spark.

---

## 1. YAML Frontmatter Schema

Frontmatter is required and appears at the top of every spark file:

```yaml
---
id: spark_<unique_id_or_slug>
title: "<Clear, concise spark title>"
domain: "<research | engineering | policy | education | product | other>"
spark_type: "<hypothesis | reframing | contradiction | system_design | constraint | exploration>"

maturity_level: "<seed | structured | modeled | validated | implemented>"
status: "<draft | under_review | iterating | accepted | archived>"

core_claim: "<One-sentence central claim or shift>"
problem_statement: "<What gap or inefficiency does this address?>"

assumptions:
  - "<Assumption 1>"
  - "<Assumption 2>"

unknowns:
  - "<Unknown 1>"
  - "<Unknown 2>"

variables:
  independent:
    - "<Variable manipulated>"
  dependent:
    - "<Outcome measured>"

metrics:
  - "<Metric 1>"
  - "<Metric 2>"

constraints:
  - "<Budget / time / technical constraint>"
  - "<Acceptable trade-offs>"

risks:
  - "<Technical risk>"
  - "<Adoption risk>"
  - "<Ethical or unintended consequence>"

evaluation_strategy:
  method: "<experiment | simulation | case study | prototype | survey | analysis>"
  success_criteria: "<What defines success?>"
  falsifiable: true

# Ownership & routing
owners:
  scout: "<github_username_of_primary_scout>"
  steward: "<optional github_username_of_steward>"
  reviewers:
    - "<optional github_username_of_reviewer>"

repo:
  url: "https://github.com/<org>/<repo>"
  path: "path/to/spark_file.spark.md"

related_sparks:
  - "<spark_id_if_any>"

revision_history:
  - version: "0.1"
    note: "Initial structured spark"
---
```

### 1.1 Required vs Optional Fields

Required (for all Enhanced Sparks):
- `id`
- `title`
- `domain`
- `spark_type`
- `maturity_level`
- `status`
- `core_claim`
- `problem_statement`
- `owners.scout`

Recommended (strongly encouraged, but can be empty early on):
- `assumptions`, `unknowns`
- `variables.independent`, `variables.dependent`
- `metrics`
- `constraints`
- `risks`
- `evaluation_strategy.method`, `evaluation_strategy.success_criteria`, `evaluation_strategy.falsifiable`
- `repo.url`, `repo.path`

Optional:
- `owners.steward`, `owners.reviewers`
- `related_sparks`
- `revision_history`

### 1.2 Maturity Semantics

- `seed` — narrative exists; sections 1 and 2 may be rough.
- `structured` — hypothesis is clearly defined (sections 1–2 meaningful).
- `modeled` — simulation/modeling plan exists and/or has been executed (section 3 populated).
- `validated` — results exist and support or refute hypothesis (section 6 populated).
- `implemented` — idea deployed in a real context; next actions and revision notes reflect rollout.

The **UI and agents** should treat `maturity_level` as the primary signal for which sections must be present and which tasks are relevant (e.g., experiment design vs results summarization).

---

## 2. Markdown Body Schema (Sections 1–8)

Every Enhanced Spark uses the same numbered section headings. These are the canonical anchors used by the parser and by agents.

### 2.1 Section List

1. `# 1. Spark Narrative`
2. `# 2. Hypothesis Formalization`
3. `# 3. Simulation / Modeling Plan`
4. `# 4. Evaluation Strategy`
5. `# 5. Feedback & Critique`
6. `# 6. Results (When Available)`
7. `# 7. Revision Notes`
8. `# 8. Next Actions`

Sections **1–8** together define the functional + technical content of the spark. Agents may write primarily into 3–6 and into clearly labeled subheadings, but they never change the numbering.

### 2.2 Section Responsibilities

- **Section 1 — Spark Narrative**
  - Human‑owned canonical story of the idea.
  - Explains the shift in thinking and why it matters.

- **Section 2 — Hypothesis Formalization**
  - Human‑owned but often assisted by agents.
  - Holds explicit hypothesis and null hypothesis.

- **Section 3 — Simulation / Modeling Plan**
  - Mixed: humans outline, agents may refine and attach technical details.
  - Describes planned models, inputs, outputs, and sensitivity analysis.

- **Section 4 — Evaluation Strategy**
  - Mixed: humans define goals; agents can suggest metrics and criteria.
  - Defines how evidence will be gathered and judged.

- **Section 5 — Feedback & Critique**
  - Human and community feedback, counter‑hypotheses, concerns.
  - Agents can summarize critique or cluster themes, but owners curate.

- **Section 6 — Results (When Available)**
  - Experimental / simulation results and interpretation.
  - Agents may assist with summarization and statistical checks.

- **Section 7 — Revision Notes**
  - Changelog of how the idea evolved and why.

- **Section 8 — Next Actions**
  - Concrete, checkable steps.
  - Can be partly agent‑generated (e.g., suggested next experiments).

### 2.3 Ownership Model (Per Section)

- **Direct human editing** is concentrated in:
  - **Section 5 — Feedback & Critique** (primary human surface for owners and collaborators).
  - `# 9. Community Proposals` (structured proposals per section).
- **Core sections 1–4 and 6–8** are **agent‑managed**:
  - Agents generate and update these sections based on the initial human prompt, tools, and RAG outputs.
  - Humans influence them indirectly by adding feedback/critique, and by accepting/rejecting AI‑proposed diffs in PRs, rather than by free‑editing the text.
- **Owners (scout/steward)** still approve changes to all sections via GitHub review, but their main writing surface is Feedback & Critique and proposal responses, not the core narrative/hypothesis/results text.

---

## 3. Community Proposals & Technical Sections

The canonical template also includes:

- `# 9. Community Proposals` — structured proposal slots per section (1–8).
- `# Maturity Guide (Reference)` — non‑canonical helper section for humans.

**Technical sections** produced by RAG/tools should live **inside sections 3–6** under clearly marked subheadings, for example:

```markdown
# 3. Simulation / Modeling Plan

## Human Plan
...primary human-written plan...

## Retrieved Context (Agent-Managed)
...summaries and snippets assembled by RAG/tools...

## Evidence Summary (Agent-Managed)
...short, model-optimized summary for context windows...
```

Agents and the RAG service are responsible for keeping these subheadings up to date while preserving the surrounding human narrative.

---

## 4. Relation to Existing Template & Parser

The `ENHANCED_SPARK_TEMPLATE` and `parseSparkFile` are (and must remain) aligned with this schema, which is the single source of truth for Enhanced Sparks.
