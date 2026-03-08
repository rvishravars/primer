# Energy-Optimized CI Pipelines

# 1. Spark Narrative

**The Observation:** Every GitHub Action triggered, every CircleCI pipeline executed, every Jenkins build run consumes electricity. Yet the industry's default optimization target is singular: minimize wall-clock time. We parallelize aggressively, spin up powerful instances, and treat compute as if it were free. Meanwhile, data centers are commonly estimated to consume on the order of 1–2% of global electricity, and CI/CD workloads represent a growing slice of that pie.

Current CI optimization can be expressed as:
$$\min_{\text{config}} T_{\text{build}} \quad \text{subject to: } \text{tests pass}$$

But the true cost function should be:
$$\min_{\text{config}} \left( \alpha \cdot E_{\text{total}} + \beta \cdot T_{\text{build}} \right)$$

To avoid conflating energy with emissions, define:
$$E_{\text{total}} = \sum_{i=1}^{n} P_i \cdot t_i \quad \text{(kWh, with } P_i\text{ in kW and } t_i\text{ in hours)}$$
$$G_{\text{total}} = \sum_{i=1}^{n} E_i \cdot CI(t_i, r_i) \quad \text{(gCO}_{2}\text{e, with } CI \text{ in gCO}_{2}\text{e/kWh)}$$

Here, $P_i$ is power draw of instance $i$, $t_i$ is duration, $CI(\cdot)$ is time- and region-specific carbon intensity, and $\alpha, \beta$ weight the energy–latency trade-off. Emissions minimization is a related but distinct objective and is treated explicitly when used.


### Reader’s guide to the math (non-expert)

The proposal uses a small amount of notation to make the optimization goals and evaluation thresholds precise.

- **Time-first baseline:** $\min T_{\text{build}}$ means CI is configured to make workflows finish as quickly as possible, subject to correctness (tests pass).
- **Energy–latency trade-off:** $\min (\alpha E_{\text{total}} + \beta T_{\text{build}})$ means we balance energy use and turnaround time. Larger $\alpha$ prioritizes energy reduction; larger $\beta$ prioritizes speed.
- **Energy vs emissions (kept separate):**
  - $E_{\text{total}}$ (kWh) is electricity consumed.
  - $G_{\text{total}}$ (gCO$_2$e) is operational emissions, computed from energy and carbon intensity ($CI$, in gCO$_2$e/kWh). A workflow can reduce emissions by running at cleaner times/regions even if energy is unchanged.
- **Interpreting the hypothesis thresholds:**
  - $\frac{E_{\text{treatment}}-E_{\text{control}}}{E_{\text{control}}} \le -0.25$ means the treatment’s mean energy per run is at least **25\%** lower than control (i.e., $E_{\text{treatment}} \le 0.75 E_{\text{control}}$).
  - $\frac{T^{\text{treatment}}_{\text{median}}-T^{\text{control}}_{\text{median}}}{T^{\text{control}}_{\text{median}}} \le 0.15$ allows the median workflow latency to increase by up to **15\%** while still being considered acceptable.
- **Why robustness checks appear later:** CI workloads are often bursty and heavy-tailed; reporting bootstrap/permutation variants alongside parametric tests helps ensure conclusions are not artifacts of distributional assumptions.

**The Gap:** Current CI/CD platforms provide *zero visibility* into energy consumption per workflow. You can see build duration, but not kilowatt-hours used. There's no "energy budget" concept, no throttling based on carbon intensity of the grid, no scheduler that optimizes for watts instead of seconds. The tooling doesn't exist because the incentive structure doesn't exist—developers are measured on velocity, not sustainability.

**The "Why":** Three converging forces make this urgent:
1. **Economic Pressure:** Cloud providers are beginning to price carbon costs into compute. AWS launched "Customer Carbon Footprint Tool"; Azure has "Emissions Impact Dashboard". Energy-aware CI may reduce operational cost by reducing wasted compute and enabling lower-power runner choices, but the magnitude is workload- and pricing-dependent.
2. **Regulatory Momentum:** Sustainability reporting requirements are expanding in several jurisdictions (e.g., the EU's CSRD for certain firms). CI pipelines are measurable, optimizable, and often sit on the critical path.
3. **Developer Ethos:** The open-source community increasingly values sustainability. Projects that can demonstrate "green builds" will attract contributors and sponsorships.

**The Shift:** Instead of asking *"How fast can this build?"*, ask *"What's the minimum energy needed to validate this commit?"* This reframes CI as an **energy arbitrage problem**: schedule non-critical tests during low-grid-carbon hours, use ARM instances for lightweight workloads, batch dependency updates to reduce cold-start overhead, and implement adaptive parallelism based on real-time energy pricing.

This arbitrage primarily targets **operational emissions**, not energy. A simple upper-bound proxy for emissions avoided by time-shifting a fixed-energy job $E$ within a window $\Delta t$ is:
$$\Delta G_{\text{potential}} = E \cdot \left( CI_{\text{avg}}(\Delta t) - CI_{\min}(\Delta t) \right)$$

where $CI_{\text{avg}}(\Delta t)$ and $CI_{\min}(\Delta t)$ are the average and minimum carbon intensity within the admissible scheduling window. This is an illustrative bound; realized reductions depend on queueing, deadlines, and the scheduler's feasibility constraints.

---

# 2. Hypothesis Formalization

**Hypothesis Statement**
> "Implementing energy-aware scheduling policies in CI/CD pipelines (time-shifting non-critical jobs to low-carbon hours, using lower-power instance types, and batching similar workloads) will reduce total energy consumption by **25-35%** compared to time-optimized defaults, while keeping median build latency within **15%** of baseline for critical path workflows."

Mathematically:
$$\frac{E_{\text{treatment}} - E_{\text{control}}}{E_{\text{control}}} \leq -0.25 \quad \text{(25\% reduction)}$$
$$\frac{T_{\text{median}}^{\text{treatment}} - T_{\text{median}}^{\text{control}}}{T_{\text{median}}^{\text{control}}} \leq 0.15 \quad \text{(15\% increase tolerance)}$$

**Null Hypothesis**
> "Energy-aware CI scheduling does not achieve the target energy reduction (i.e., energy reduction is < **25%** on the primary endpoint), and/or it violates latency non-inferiority constraints on critical-path workflows (median latency increase ≥ **15%** or p95 latency increase ≥ **25%**)."

**Falsifiability Criteria:**
- **Measurable:** Energy consumption tracked via cloud provider APIs (AWS CloudWatch, GCP Carbon Footprint) and open-source tools (Scaphandre, CodeCarbon).
- **Bounded:** Clear thresholds defined (25% energy reduction primary endpoint; 15% median latency non-inferiority margin; 25% p95 latency guardrail).
- **Testable:** Can be validated through A/B testing on real CI infrastructure over 30-day periods.
- **Refutable:** If energy reduction < 25% on the primary endpoint, or latency constraints are violated, the hypothesis is rejected.

---

# 3. Simulation / Modeling Plan

## Model Type
**Data Replay + Discrete Event Simulation**
- Replay 90 days of historical CI logs from 3-5 open-source repositories (varying sizes: small <100 builds/day, medium 100-500, large >500)
- Simulate alternative scheduling policies using discrete event simulation framework (SimPy or similar)
- Model includes: job arrival patterns, execution DAGs, instance provisioning delays, energy cost functions

## Inputs
**Historical Data:**
- GitHub Actions workflow logs (JSON): timestamps, duration, runner type, job dependencies
- Grid carbon intensity data: ElectricityMap API (gCO$_2$e/kWh by region, hourly granularity)
- Cloud instance specifications: CPU/memory, TDP (Thermal Design Power), pricing

**Policy Parameters:**
- Time-shift tolerance window (e.g., "non-blocking tests can wait up to 4 hours")
- Carbon intensity threshold for triggering delays (e.g., "pause if grid > 400 gCO$_2$e/kWh")
- Instance selection rules (ARM vs x86, spot vs on-demand)

**Energy Estimation Model:**
$$E_{\text{job}} = \frac{\left( P_{\text{CPU}} \cdot U_{\text{CPU}} + P_{\text{DRAM}} + P_{\text{base}} \right)}{1000} \cdot \frac{t_{\text{duration}}}{3600}$$

Where:
- $P_{\text{CPU}}$ = CPU TDP (e.g., 65W for typical x86, 15W for ARM)
- $U_{\text{CPU}}$ = CPU utilization (0-1, measured via profiling)
- $P_{\text{DRAM}}$ = Memory power (≈3W per 8GB)
- $P_{\text{base}}$ = Baseline system power (≈20-30W)
- $t_{\text{duration}}$ = Job duration in seconds

This yields $E_{\text{job}}$ in kWh (Watts converted to kW; seconds converted to hours).

**Baseline Metrics:**
- Current energy consumption (estimated via instance type × duration × TDP)
- Current p50/p95 build latency
- Current cost per 1000 builds

## Expected Outputs
1. **Energy Reduction Matrix:** % savings by policy combination (time-shift vs instance-type vs batching)
2. **Latency Impact Distribution:** Histogram of build time deltas for each policy
3. **Cost-Benefit Curves:** Energy savings vs developer experience trade-off frontier
4. **Optimal Policy Recommendation:** Configuration that maximizes energy savings while meeting latency SLO

## Sensitivity Analysis
**Critical Variables:**
- **Repository Commit Frequency:** High-velocity repos (>20 commits/hour) have less flexibility for time-shifting
- **Test Suite Composition:** CPU-bound tests benefit more from ARM; I/O-bound less so
- **Grid Carbon Intensity Variance:** Regions with stable low-carbon grids (e.g., Iceland, Norway) see smaller gains from time-shifting
- **Developer Tolerance:** Survey-based "frustration threshold" for build delays impacts policy aggressiveness

**Scenarios to Model:**
- Best case: Low-carbon region + batch-friendly workloads + flexible deadlines → 40-50% savings
- Worst case: High-carbon region + real-time workflows + legacy x86 dependencies → 5-10% savings
- Typical case: Mixed workload, moderate flexibility → 25-35% savings (hypothesis target)

**Optimization Objective Function:**
To keep objectives and units consistent, define an explicit multi-objective loss over scheduled jobs $j$:
$$\min \sum_{j \in \text{Jobs}} \Big[ \alpha \cdot E_j + \gamma \cdot (E_j \cdot CI(t_j, r_j)) + \lambda \cdot \max(0, T_j - T_{\text{SLO}}) \Big]$$

Where $E_j$ is job energy (kWh), $CI(t_j, r_j)$ is carbon intensity (gCO$_2$e/kWh) at the scheduled time and runner region, $E_j\cdot CI(\cdot)$ is operational emissions (gCO$_2$e), $T_j$ is completion time, $T_{\text{SLO}}$ is a latency target, and $(\alpha, \gamma, \lambda)$ tune the relative penalties. When evaluating an “energy-first” policy, set $\gamma=0$ and treat emissions as a secondary outcome; when evaluating an “emissions-first” policy, set $\gamma>0$ explicitly.

---

# 4. Evaluation Strategy

## Measurement Method
**Instrumented A/B Test on Production CI Infrastructure**
- **Control Group:** 50% of builds use standard time-optimized scheduling (GitHub Actions defaults)
- **Treatment Group:** 50% use energy-aware scheduling via custom GitHub Actions dispatcher
- **Duration:** 30-day test period per repository
- **Randomization:** Stable, deterministic assignment with stratification to reduce contamination and time-based confounding:
  - Assign at the **PR level** when applicable (e.g., hash of `(repo, PR number)`), otherwise at the **commit level** (hash of `(repo, commit SHA)`).
  - Stratify (blocked randomization) by **repository** and **time-of-day** (e.g., hourly blocks) so treatment/control see similar background carbon intensity and queue load.
  - Enforce isolation: separate cache namespaces/keys and (when possible) separate runner labels/pools for treatment vs control to prevent cross-arm contamination via warm caches, pre-pulled images, or shared runners.

## Data Collection
**Energy Metrics:**
- **Tool:** CodeCarbon Python library + Scaphandre (for Linux runners)
- **Capture (Primary):** Operational energy (kWh) per job/workflow using on-host telemetry (Scaphandre) or calibrated software estimates (CodeCarbon).
- **Capture (Secondary):** Operational emissions (gCO$_2$e) computed from measured energy and matched carbon intensity. Embodied emissions are reported separately only if a defensible attribution model is available.
- **Granularity:** Per-job, aggregated to per-workflow and per-repository levels
- **Storage:** Export to Prometheus + Grafana for visualization

**Carbon Intensity Data (for emissions):**
- **Source:** ElectricityMap (or equivalent) hourly carbon intensity by region
- **Join key:** Runner region $r$ and job start-time window; record the matching method and time aggregation (e.g., hourly) to make the mapping auditable

**Performance Metrics:**
- **Build Latency:** Time from commit push to all checks complete (p50, p95, p99)
- **Queue Time:** Time jobs spend waiting for runner availability
- **Failure Rate:** % of builds that fail due to timeout or resource constraints

**Developer Experience:**
- **Survey:** Weekly pulse survey (5-point Likert scale): "How satisfied are you with build speed this week?"
- **Behavioral:** Track PR merge velocity, incidents of developers bypassing CI

## Statistical Criteria
**Outcomes**
- **Primary outcome:** Operational energy per *successful* workflow run (kWh/run).
- **Secondary outcomes:** Operational emissions per successful run (gCO$_2$e/run), median and p95 end-to-end latency, failure rate, queue time, and developer-experience measures.

**Primary Success Criterion (Superiority):**
- Relative reduction in mean energy per successful run of **≥25%** in treatment vs control.

**Secondary Success / Guardrails (Non-inferiority + Safety):**
- Median end-to-end latency increase **<15%** (non-inferiority margin $\delta_T=15\%$)
- P95 end-to-end latency increase **<25%** (guardrail)
- No statistically or practically meaningful increase in failure rate (guardrail; see below)

**Primary Analysis (Energy):**
- Report relative effect $\Delta_E = (\bar{E}_{\text{treat}}-\bar{E}_{\text{ctrl}})/\bar{E}_{\text{ctrl}}$ with a 95% confidence interval.
- Use Welch's t-test as the primary frequentist test (two-sided, $\alpha=0.05$), and additionally report a **bootstrap** 95% CI (block bootstrap by day within repository) to address non-normality and temporal correlation.

**Welch's t-test (reference):**
$$t = \frac{\bar{E}_{\text{treatment}} - \bar{E}_{\text{control}}}{\sqrt{\frac{s_{\text{treatment}}^2}{n_{\text{treatment}}} + \frac{s_{\text{control}}^2}{n_{\text{control}}}}}$$

**Effect Size:**
$$d = \frac{\bar{E}_{\text{treatment}} - \bar{E}_{\text{control}}}{s_{\text{pooled}}} \quad \text{where } s_{\text{pooled}} = \sqrt{\frac{(n_1-1)s_1^2 + (n_2-1)s_2^2}{n_1+n_2-2}}$$

**Robustness Checks (Pre-specified):**
- Nonparametric confirmation via permutation test or Mann–Whitney U on per-run energy.
- Sensitivity to outliers via trimmed-mean comparison (e.g., 5% trimming) and/or analysis on log-energy if heavy-tailed.

**Secondary Metrics (Reported, not required for primary success):**
- Operational emissions change (gCO$_2$e/run), computed as $G = E \cdot CI$ with matched $CI$
- Developer satisfaction score ≥ 3.5/5.0 (acceptable threshold)
- Cost impact reported as compute cost and energy cost **separately** when possible; otherwise compute cost alone

**Failure Conditions (Hypothesis Rejection):**
- Primary endpoint not met: estimated energy reduction < **25%** OR
- Latency constraints violated: median latency increase ≥ **15%** OR p95 latency increase ≥ **25%** OR
- Reliability degraded: failure rate increases by > **5** percentage points (guardrail) OR
- Developer satisfaction < **3.0/5.0** (guardrail)

## Comparison Baseline
**Control Configuration:**
- GitHub Actions standard runners (ubuntu-latest, 2-core)
- Default concurrent job limits (20 for free tier, 60 for Teams, 180 for Enterprise)
- No time-shifting, no instance selection, no batching
- Measured over 30-day pre-test period to establish stable baseline

**Expected Variance:**
- Historical CV (coefficient of variation) for energy consumption: ~15-20%
- Min detectable effect size: 20% difference with 80% power, assumes N > 500 builds per group

**Power Analysis:**
$$n = \frac{2(z_{\alpha/2} + z_{\beta})^2 \sigma^2}{(\mu_1 - \mu_2)^2}$$

For $\alpha = 0.05$, $\beta = 0.20$ (80% power), $\sigma/\mu = 0.15$ (CV), and target effect $\mu_1 - \mu_2 = 0.25\mu$:
$$n \approx 2 \cdot \frac{(1.96 + 0.84)^2 \cdot (0.15)^2}{(0.25)^2} \approx 112 \text{ builds per group}$$

With safety margin: **N ≥ 500 builds/group recommended** to account for outliers and non-normality.

## Publication Plan
- **Open Data:** Anonymized build logs, energy measurements, and analysis code published to GitHub
- **Reproducibility:** Docker container with full simulation environment
- **Peer Review:** Submit findings to USENIX ATC or ACM SoCC conference for validation

---

# 5. Feedback & Critique

## Internal Critique
### Hidden assumptions
- Energy/carbon impact is measurable at per-job granularity on common CI runners.
- Workflows contain deferrable/non-critical jobs with slack (time-shift tolerance).
- Energy-aware scheduling does not materially increase flaky-test incidence.

### Weaknesses / Risks
- Measurement noise: software-based energy estimation may vary by runner hardware and virtualization layer.
- Adoption friction: developers may resist any perceived delay, even if median latency remains within bounds.
- Regional dependence: time-shifting benefits are smaller where grid carbon intensity variance is low.

### Scalability concerns
- High-velocity repos with frequent commits have reduced slack for deferral strategies.
- Complex DAGs/monorepos reduce batching simplicity and may need heuristics.

## Counter-Hypothesis
"Most CI/CD energy savings come from test suite design (caching, incremental builds, reducing redundant tests) rather than scheduling/time-shifting; therefore energy-aware scheduling yields <10% improvement in typical repos."

## Mitigations
- Triangulate measurement: provider telemetry + host power model + sampling calibration.
- Make policies opt-in per workflow with hard SLO caps and transparent reporting.

## Threats to Validity
**Construct validity (measurement):** Software-based power estimates may not reflect true node-level energy under virtualization; runner heterogeneity can bias between-group comparisons if not balanced.

**Internal validity (causality):** Shared caches, shared runner pools, or time-of-day workload shifts can confound treatment effects. Stable assignment plus cache/runner isolation and blocked randomization reduce (but do not eliminate) these risks.

**External validity (generalization):** Results from 3–5 open-source repositories may not transfer to monorepos, regulated environments, or organizations with strict latency SLOs and high commit rates.

**Conclusion validity (statistics):** Non-independence across runs (burst commits, incident days), heavy tails, and multiple secondary endpoints can inflate false positives. Pre-specification, block bootstrapping, and robustness checks mitigate this.

---

# 6. Results (When Available)

## Observed outcomes
- Simulation results summary:
- A/B test results summary:

## Deviations from expectation
- Where energy savings were lower than expected:
- Where latency impact was higher than expected:

## Surprises
- Workload classes that broke assumptions (I/O-bound, dependency-heavy, flaky tests):

---

# 7. Revision Notes

## v0.2 (proposal)
- Completed sections 5–8 to remove empty critical phases.
- Added a counter-hypothesis and adoption/measurement risks.
- Added mitigations and a concrete execution plan. Rationale: improves falsifiability, governance completeness, and real-world adoptability.

---

# 8. Next Actions

## Next Actions (30–45 day plan)
- [ ] Identify 3–5 candidate repos with sufficient build volume and varied workload profiles; export 90 days of workflow logs.
- [ ] Implement discrete event simulation (SimPy) for baseline replay + policy variants; document region mapping for carbon-intensity data.
- [ ] Calibrate energy estimation by cross-checking Scaphandre/CodeCarbon against at least one provider metric where available.
- [ ] Select 2–3 treatment policies with strict latency SLO guardrails.
- [ ] Run 30-day A/B test with stable deterministic assignment (PR-level when applicable, otherwise commit-level) and blocked randomization by time-of-day; monitor latency/failure-rate daily.
- [ ] Publish anonymized dataset + code + write-up (methodology, limitations, and results).
