# 🧠 Scribe v2.0 - Glass Box AI Agent

The Scribe v2.0 is Primer's deterministic, hardware-agnostic AI agent for evaluating and validating Sparks. It runs locally on your CPU by default, with optional GPU acceleration and cloud API fallback.

## 📋 Overview

The Scribe enforces Primer Manifesto through three key functions:

1. **Narrative Auditor (Section 1)** - Validates Spark Narratives for clarity and specificity (Seed maturity)
2. **Design & Hypothesis Validator (Sections 2-4)** - Validates Design submissions for novelty, falsifiability, and feasibility (Structured/Modeled maturity)
3. **Stability auditor** - Checks all Sparks for structural integrity and Manifesto v3.0 alignment

Every decision includes a **Glass Box reasoning log** explaining which hardware was used, which prompts were tested, and the logic path taken.

## 🏗️ Architecture

```
scribe/
├── scribe_brain.py              # Core router (hardware switching, orchestration)
├── prompts/
│   ├── hunch_eval.md            # System prompt for Narrative Audit (Section 1)
│   └── shape_eval.md            # System prompt for Design & Hypothesis Audit (Section 2-4)
├── models/
│   └── downloader.py            # Fetch Qwen2.5-1.5B model (if needed)
├── logic/
│   └── stability_audit.py       # Structural validation (refactored novelty_scan.py)
├── utils/
│   └── glass_box_logger.py      # Reasoning log formatting
├── requirements.txt             # Scribe-specific dependencies
└── scribe_status.json           # Real-time thinking steps (for UI)

.github/workflows/
└── scribe-bot.yml               # GitHub Action for PR automation
```

## 🚀 Quick Start

### 1. Install Scribe Dependencies

```bash
# Option A: Core only (CPU)
pip install -r scribe/requirements.txt

# Option B: With GPU acceleration
pip install -r scribe/requirements.txt
# Then install GPU backend:
pip install torch  # For NVIDIA CUDA
# OR
pip install mlx    # For Apple Metal (macOS)

# Option C: With cloud fallback
export GROQ_API_KEY="your-groq-api-key"
pip install groq>=0.4.0
```

### 2. Download the Model (Optional)

The Scribe can run with or without the Qwen2.5-1.5B model:

```bash
# Check if model is available
python scribe/models/downloader.py --verify

# Download if missing
python scribe/models/downloader.py --download

# Or manually download from:
# https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF
```

### 3. Run Stability Audits

```bash
# Audit all Sparks
python scribe/logic/stability_audit.py --dir sparks/

# Audit a specific Spark
python scribe/logic/stability_audit.py --file sparks/scribe-v2-implementation.md

# Get JSON output for scripts
python scribe/logic/stability_audit.py --json
```

### 4. Run the Scribe Brain

```bash
# Evaluate a sample hunch
python scribe/scribe_brain.py

# Real-time status updates written to: scribe_status.json
```

## 💎 Features

### Hardware Detection & Switching

The Scribe automatically selects the best available hardware:

1. **NVIDIA GPU** (if CUDA available) - Fastest inference
2. **Apple Metal** (macOS only) - Hardware-optimized for Apple Silicon
3. **CPU Multi-threaded** - Default fallback (works everywhere)
4. **Groq API** - Cloud fallback (only if local device is throttled)

```python
from scribe.scribe_brain import HardwareDetector, ScribeBrain

# Auto-detect hardware
brain = ScribeBrain()
print(f"Using: {brain.hardware.value}")
```

### Glass Box Reasoning Logs

Every evaluation includes a transparent reasoning log:

```json
{
  "status": "approved",
  "mission": "narrative_audit",
  "reasoning": {
    "glass_box": {
      "hardware_used": "cpu",
      "hardware_acceleration": "None (CPU)",
      "time_elapsed_ms": 1234.5,
      "memory_used_mb": 125.3,
      "model_name": "Qwen2.5-1.5B-GGUF",
      "prompts_tested": ["hunch_eval.md"],
      "decision_path": [
        "Scanning for Loose Studs...",
        "Checking Clutch Power (Mission: Narrative Audit)...",
        "Validating Manifesto v3.0 alignment...",
        "Hardware Telemetry: cpu integration verified"
      ],
      "stability_score": 8.5,
      "critical_flaws": [],
      "recommendations": []
    }
  }
}
```

### Real-Time Status for UI

The Scribe writes thinking steps to `scribe_status.json` for React UI integration:

```json
{
  "timestamp": 1676923456.123,
  "thinking_step": "Running inference on cpu...",
  "hardware": "cpu"
}
```

## 📖 System Prompts

### Mission: Narrative Audit (hunch_eval.md)
Evaluates **Section 1 (Narrative)** submissions on:
- **Specificity** - Is the observation concrete?
- **Actionability** - Does it lead to a falsifiable hypothesis?
- **Novelty** - Is it a new gap or duplicate?
- **Manifesto Alignment** - Is it within the modular framework?

### Mission: Design & Hypothesis Audit (shape_eval.md)
Evaluates **Section 2 (Hypothesis)** and **Sections 3-4 (Modeling)** on:
- **Novel Core** - Clear articulation of the 10% delta
- **Falsifiability** - Can the hypothesis be proven wrong?
- **Integration** - Does it snap cleanly into existing Bricks?
- **Prior Art Check** - How is it differentiated?
- **Risk Awareness** - Are Loose Studs identified?
- **Manifesto Alignment** - Uses LEGO terminology correctly

**Output Scores:**
- ✅ **Approved** - Buildable blueprint
- ⏳ **Needs Refinement** - Strengthen the design
- 🔴 **High-Risk Prototype** - Experimental
- ❌ **Rejected** - Insufficient novelty or duplicate

## 🔧 Development

### Running Tests

```bash
pytest scribe/tests/ -v
```

### Integration with Assembly Lab (React)

The Scribe outputs are monitored by the Assembly Lab UI:

```javascript
// src/components/ScribeStatus.jsx
useEffect(() => {
  const status = await fetch('/${PUBLIC}/scribe_status.json').json();
  setThinkingStep(status.thinking_step);
  setHardware(status.hardware);
}, []);
```

### Adding New Evaluation Phases

1. Create a new system prompt: `scribe/prompts/[phase_eval].md`
2. Add phase to `EvaluationPhase` enum in `scribe_brain.py`
3. Call `brain.evaluate_spark(EvaluationPhase.[PHASE], content)`

## 📊 CI/CD Integration

The `.github/workflows/scribe-bot.yml` runs on:
- **Pull Requests** to Spark files
- **Manual Trigger** via workflow dispatch

Each PR gets a comment with:
- Stability Audit Report
- Glass Box Reasoning Log
- Critical Flaws & Recommendations

## 🎯 LEGO Vocabulary Reference

The Scribe uses consistent terminology:

- **Loose Studs** - Flaws, gaps, or inefficiencies
- **Clutch Power** - Strength, specificity, and actionability
- **Bricks** - Modular components (Manifesto, Sparks, Code)
- **Stability** - Structural soundness and alignment
- **Snap** - How cleanly a design integrates
- **Novel Core** - The 10% delta (what's new)

## 🚨 Troubleshooting

### Model fails to load
```bash
# Ensure model file exists and is valid GGUF format
python scribe/models/downloader.py --verify

# If memory constrained, use Groq fallback
export GROQ_API_KEY="..."
python scribe/scribe_brain.py
```

### GPU not detected
```python
# Check hardware detection
from scribe.scribe_brain import HardwareDetector
print(HardwareDetector.detect_gpu())  # Should be True if CUDA available
```

### High memory usage
- Reduce model context: `n_ctx=1024` in scribe_brain.py
- Use Groq fallback (negligible local memory)
- Run on CPU with fewer threads

## 📚 References

- [MANIFESTO.md](../docs/MANIFESTO.md) - Primer principles
- [scribe-v2-implementation.spark](../sparks/scribe-v2-implementation.md) - Design document

## 📝 License

Primer - See [LICENSE](../LICENSE)
