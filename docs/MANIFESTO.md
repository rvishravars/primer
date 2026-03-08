# 📜 Primer: Master Framework (v3.0)

> *"The Commons rewards the intuition to see the gap, the design to shape it, and the logic to make it stick — and the discipline to validate it."*

---

## Part 1: The Manifesto

### 1. The Spark as the Unit of Value

Primer is a **modular idea meritocracy**. Every contribution is a **Spark** — a structured, falsifiable idea that evolves through defined maturity stages. We value **"Clutch Power"**: the ability of a spark to be validated, built upon, and snapped into the commons.

A Spark is not owned by a single role. It is a living document that any contributor can advance — from a raw observation to a deployed reality.

### 2. Governance: The Republic of Bricks

Influence is earned through tangible value. The system rewards the full "Chain of Value" — from the first hunch to the final deployed code.


#### 2.1 Contribution Roles

There are only two roles for a spark:

- **Opener:** The contributor who initiates the spark (submits the narrative and hypothesis).
- **Advancer:** Any contributor who advances the spark through modeling, validation, implementation, or amendment.

CS (Contribution Score) is earned by opening or advancing a spark. The Opener receives an initial score for starting the spark, and each Advancer receives score for meaningful progression.

#### 2.2 Collaboration Bonus

If someone advances a spark you opened, you receive a bonus. Advancers earn additional score for critical improvements or validations.

#### 2.3 Logarithmic Voting Power

To prevent "Whale Dictatorship," influence scales non-linearly:

$$Weight = \log_{10}(CS_{active})$$

> **Note:** Voting uses `active_cs` — contributions decay at **10% per month** if the contributor remains inactive for >60 days.

* **Sybil Protection:** Voting rights are restricted to contributors with **CS > 20** or **3 merged actions**.

### 3. The Scribe v2.0: Glass Box Intelligence

The AI Scribe is the system's **Automated Standards Enforcer**, not a gatekeeper. It is:

* **3.1 Local-First:** Runs locally using nano-models (Qwen2.5-1.5B-GGUF). Falls back to Groq API only when local resources are insufficient. Zero mandatory cost.
* **3.2 Transparent (Glass Box):** Every decision includes a human-readable reasoning log: hardware used, prompts applied, stability findings, and decision path.
* **3.3 Deterministic:** Hardware-agnostic switching (NVIDIA GPU → Apple Metal → CPU) ensures reproducible results across contributor environments.
* **3.4 Phase-Aware:** Validates `Spark Narrative` for conceptual soundness and `Hypothesis Formalization` for falsifiability before merge.

### 4. Conflict & Dispute Resolution (The Logic Audit)

* **4.1 The Challenge:** Contributors may file a `!CHALLENGE` if they believe a Spark lacks evidence (it's "wobbly") or its hypothesis is unfalsifiable.
* **4.2 The Cooling Rack:** If a Spark receives >5 critical flaws in 24 hours, the Scribe locks the thread for 12 hours to prevent dogpiling and allow the author to apply "Clutch Power" (revision).

---

## 🏛️ Theoretical Foundation

Primer is built upon decades of research into decentralised cooperation, institutional economics, and stigmergic systems.

### 1. The Governance of the Commons
Based on **Elinor Ostrom** (*Governing the Commons*, 1990).
* **The Principle:** Successful common-pool resources require "graduated sanctions" and "collective-choice arrangements."
* **Application:** The **Manifesto** is the constitutional layer. The **Scribe** is the automated monitor. The **Reputation Shield** (CS decay) is the graduated sanction.

### 2. Commons-Based Peer Production (CBPP)
Based on **Yochai Benkler** (*The Wealth of Networks*, 2006).
* **The Principle:** CBPP succeeds when tasks are **Granular** and **Modular**.
* **Application:** The Enhanced Spark template breaks a contribution into 8 independent sections. A contributor can advance a spark from any angle — formalising a hypothesis, modelling it, or critiquing it — without needing to own the entire idea.

### 3. Stigmergic Coordination
Based on **Mark Elliott** (*Stigmergic Collaboration*, 2016).
* **The Principle:** Agents coordinate by leaving "traces" that stimulate further action.
* **Application:** Every `.spark.md` in `/sparks/` is a digital signal. A `seed` spark invites hypothesis refinement; a `modelled` spark invites validation; a `validated` spark invites implementation.

### 4. Non-Linear Influence & Meritocracy
Based on **Logarithmic Scaling** and **Plural Control** (Glen Weyl et al.).
* **The Principle:** Voting power must not scale linearly with capital or points.
* **Application:** $$Weight = \log_{10}(CS_{active})$$ with time-decay for inactive contributors ensures a dynamic meritocracy.

### 5. Open-Source Translucence
Based on **Dabbish et al.** (*Social Translucence in GitHub*, 2012).
* **The Principle:** Transparency in contribution history drives trust and attracts quality Builders.
* **Application:** All Spark sections, revision histories, Glass Box Scribe logs, and CS scores are public. **"Execution is the Moat."**

---

## Part 2: The Enhanced Spark Standard

All sparks in Primer must follow the **Enhanced Spark Template** (`templates/enhanced_spark.md`). A valid spark file contains:

### Frontmatter (Metadata)
```yaml
id: spark_<unique_id>
title: "<Clear, concise spark title>"
domain: "<research | engineering | policy | education | product | other>"
spark_type: "<hypothesis | reframing | contradiction | system_design | constraint | exploration>"
maturity_level: "<seed | structured | modeled | validated | implemented>"
status: "<draft | under_review | iterating | accepted | archived>"
core_claim: "<One-sentence central claim or shift>"
```

### 8 Sections (Mandatory → Optional)

| # | Section | Maturity Gate | Required for merge? |
|---|---------|--------------|---------------------|
| 1 | **Spark Narrative** | Seed | ✅ Always |
| 2 | **Hypothesis Formalization** | Structured | ✅ Before Design review |
| 3 | **Simulation / Modeling Plan** | Modeled | ⬜ Recommended |
| 4 | **Evaluation Strategy** | Modeled | ⬜ Recommended |
| 5 | **Feedback & Critique** | Any | ⬜ Encouraged |
| 6 | **Results (When Available)** | Validated | ⬜ Required for Validated status |
| 7 | **Revision Notes** | Any | ⬜ Auto-tracked |
| 8 | **Next Actions** | Any | ⬜ Encouraged |

### Maturity Lifecycle

```
Seed → Structured → Modeled → Validated → Implemented
 ↑          ↑           ↑          ↑            ↑
[S.1]    [S.1+S.2]   [S.3+S.4]  [S.6]       [S.7+S.8 ✓]
```

---

## Part 3: Getting Started

### Level 1 — Open a Spark (+5 CS)
You have an observation — a gap, an inefficiency, a contradiction.

1. Fork the repo
2. Copy `templates/enhanced_spark.md` → `/sparks/<name>.spark.md`
3. Fill in the YAML frontmatter and **Section 1 (Spark Narrative)**
4. Add a falsifiable **Section 2 (Hypothesis)**
5. Set `maturity_level: seed` and open a PR

### Level 2 — Advance a Spark (+10–15 CS)
Find a `seed` or `structured` spark you can strengthen.

1. Add **Section 3 (Simulation / Modeling Plan)** and/or **Section 4 (Evaluation Strategy)**
2. Update `maturity_level: structured` or `modeled`
3. Open a PR — earn the **Echo Bonus** if you're advancing someone else's spark

### Level 3 — Validate or Implement (+25–35 CS)
Run the experiment, simulation, or implementation.

1. Populate **Section 6 (Results)** with real evidence
2. Update `maturity_level: validated` or `implemented`
3. Merge via PR — earn the **Validation Bonus** if confirmed by peer review

---

## Part 4: Development Roadmap

* [x] **Manifesto v2.0:** Integrated modular meritocracy (Owner/Others).
* [x] **Scribe v2.0:** Glass Box AI agent — local CPU inference, hardware switching, PR bot.
* [x] **Spark Assembly Lab:** React-based canvas for composing and submitting sparks.
* [x] **Reputation Shield:** CS decay for inactive contributors (10%/month via logarithmic scaling).
* [x] **Enhanced Spark Template:** 8-section modular format with YAML frontmatter and maturity levels.
* [x] **Manifesto v3.0:** Updated governance, Scribe spec, and Enhanced Spark Standard.
* [ ] **The DePIN Grid:** Community-powered GPU node for Scribe heavy-compute tasks.
* [ ] **The "Snap" Bot:** Automate Echo & Prototype bonus distribution via GitHub Actions.
* [ ] **Governance Vote v1:** First on-chain (or off-chain weighted) vote using logarithmic CS weights.

---

> *Based on: Ostrom (1990), Benkler (2006), Elliott (2016), Weyl et al. (2018), Dabbish et al. (2012)*