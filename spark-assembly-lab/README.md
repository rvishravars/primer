# Spark Assembly Lab

A React-based modular interface for building and visualizing **Enhanced Sparks** in Primer v3.0 maturity meritocracy.

## 📸 Screenshots

### Enhanced Two-Column Interface
![Assembly Canvas](./docs/screenshots/assembly-canvas.png)
*The split-view interface: Fixed Narrative (Left) and Swappable Research Modules (Right)*

### 8-Section Building Blocks
![Building Blocks](./docs/screenshots/building-blocks.png)
*Modular sections (Narrative, Hypothesis, Modeling, etc.) with maturity-specific indicators*

### Full-Screen Editor
![Full Screen Editor](./docs/screenshots/fullscreen-editor.png)
*Maximize any section for focused, distraction-free drafting*

### Improve Spark (Maturity Audit)
![Improvement Mode](./docs/screenshots/quiz-mode.png)
*Get AI feedback to advance your spark from `seed` to `validated`*

---

## 🎯 Features

- **Split-View Canvas**: Always-on visibility of the **Spark Narrative** while iterating on technical sections.
- **8-Section Standard**: Full support for the v3.0 Enhanced Spark template (Hypothesis, Modeling, Evaluation, etc.).
- **Smart Maturity Tracking**: Stability indicators scale based on active sections (e.g., `4/8 Stable`).
- **Glass Box AI Feedback**: Powered by local-first models or Cloud APIs to audit your hypothesis and results.
- **Global Spark Search**: Find `.spark.md` files across all of GitHub with advanced filters.
- **GitHub Integration**: Login via PAT to load/save sparks directly to repositories.
- **Mobile Responsive**: Optimized viewports with drawer navigation for on-the-go scouting.
- **Live Markdown Preview**: Real-time rendering of your complex spark structures.

---

## 📈 The Maturity Lifecycle

Instead of static phases, the Lab supports 8 modular sections that define a spark's maturity:

1. **Spark Narrative** (Required for `seed`)
2. **Hypothesis Formalization** (Required for `structured`)
3. **Simulation / Modeling Plan** (Required for `modeled`)
4. **Evaluation Strategy**
5. **Feedback & Critique**
6. **Results** (Required for `validated`)
7. **Revision Notes**
8. **Next Actions**

---

## 🚀 Quick Start (Docker Only)

### Local Development (Docker Compose)

```bash
# From the spark-assembly-lab directory
docker compose up

# Visit http://localhost:3000
```

**Note:** Use `docker compose` (V2) instead of `docker-compose` (V1). The Docker setup automatically installs dependencies and enables Hot Module Replacement (HMR).

### Building for Production (Docker)

All builds must be run through Docker to ensure consistency:

```bash
# From the repo root
./build.sh

# Or manually
docker build -f spark-assembly-lab/Dockerfile.prod -t spark-assembly-lab:latest .
```

---

## 🔧 Technical Stack

- **Framework**: React 18
- **Build Tool**: Vite 5
- **Styling**: Vanilla CSS (Cyan/Yellow/Green Blueprint Theme)
- **Markdown**: `react-markdown` + `gray-matter`
- **Icons**: `lucide-react`
- **Authentication**: GitHub PAT
- **API**: GitHub REST API v3
- **Containerization**: Docker

---

## 🏗️ Stability Calculation

Stability is no longer a simple 1-2-3 count. It is calculated based on the number of **Active Sections** that contain meaningful content:

- **Seed**: Narrative (S1) + Hypothesis (S2) populated.
- **Stable (8/8)**: All sections populated and validated against the Scribe's glass-box criteria.
- **Indicator**: Visual progress bar in the sidebar and canvas header.

---

## 📝 Usage Guide

### Composing Enhanced Sparks
1. Click **"New Spark"** and enter a title.
2. Draft your core idea in the **Left Column** (Spark Narrative).
3. Use the **Right Column Picker** to select a module to work on (e.g., Hypothesis).
4. Use the **Bottom Tab Strip** to quickly swap between active modules.
5. Click **Download** to save the `.spark.md` file with full YAML frontmatter.

### GitHub Search
- Switch to the **Global Search** tab.
- Filter by `org:`, `user:`, or keywords.
- "Load Spark" to pull any `.spark.md` from the public web directly into your workspace.

---

## 📄 License

Part of Primer v3.0 - Modular Meritocracy.

> *"Execution is the Moat. Build with clarity. Validate with rigor."*
