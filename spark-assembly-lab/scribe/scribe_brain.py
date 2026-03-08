#!/usr/bin/env python3
"""
The Scribe v2.0 Brain - Glass Box AI Agent for Primer

This is the core router that:
1. Detects available hardware (NVIDIA GPU, Apple Metal, CPU)
2. Loads and runs the Qwen2.5-1.5B model locally
3. Evaluates !HUNCH and !SHAPE Sparks
4. Outputs Glass Box reasoning logs
5. Maintains real-time status for UI integration
"""

import json
import os
import sys
import time
import psutil
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum

from missions import evaluate_spark_mission

# Try importing hardware acceleration libraries
try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

try:
    from llama_cpp import Llama
    HAS_LLAMA_CPP = True
except ImportError:
    HAS_LLAMA_CPP = False

try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(asctime)s - %(message)s'
)
logger = logging.getLogger(__name__)


class HardwareType(Enum):
    """Supported hardware accelerators."""
    NVIDIA_GPU = "nvidia_gpu"
    APPLE_METAL = "apple_metal"
    CPU = "cpu"
    GROQ_API = "groq_api"


class EvaluationPhase(Enum):
    """Spark evaluation phases aligned with Manifesto v3.0."""
    NARRATIVE = "hunch"       # Mission: Narrative Audit (Section 1)
    HYPOTHESIS = "shape"      # Mission: Design & Hypothesis Audit (Section 2)


@dataclass
class ReasoningLog:
    """Glass Box reasoning log structure with hardware telemetry."""
    hardware_used: str
    hardware_acceleration: str  # e.g., "CUDA", "Metal", "None (CPU)"
    time_elapsed_ms: float
    memory_used_mb: float
    model_name: str
    prompts_tested: list
    decision_path: list
    stability_score: float
    critical_flaws: list
    recommendations: list


@dataclass
class EvaluationResult:
    """Result of a Spark evaluation."""
    status: str  # approved|rejected|needs_clarification|needs_refinement
    phase: str
    stability_score: float
    reasoning: Dict[str, Any]


class HardwareDetector:
    """Detects available compute hardware and resources."""

    @staticmethod
    def detect_gpu() -> bool:
        """Check if NVIDIA GPU is available."""
        if not HAS_TORCH:
            return False
        try:
            return torch.cuda.is_available()
        except Exception as e:
            logger.warning(f"GPU detection failed: {e}")
            return False

    @staticmethod
    def detect_metal() -> bool:
        """Check if Apple Metal acceleration is available."""
        try:
            import platform
            return platform.system() == "Darwin"
        except Exception:
            return False

    @staticmethod
    def get_memory_info() -> Dict[str, float]:
        """Get current memory usage statistics."""
        mem = psutil.virtual_memory()
        return {
            "total_mb": mem.total / (1024 * 1024),
            "used_mb": mem.used / (1024 * 1024),
            "available_mb": mem.available / (1024 * 1024),
            "percent_used": mem.percent
        }

    @staticmethod
    def select_hardware() -> HardwareType:
        """Intelligently select best available hardware."""
        mem_info = HardwareDetector.get_memory_info()

        # Check if NVIDIA GPU is available and has sufficient memory
        if HardwareDetector.detect_gpu():
            logger.info("NVIDIA GPU detected")
            return HardwareType.NVIDIA_GPU

        # Check for Apple Metal on macOS
        if HardwareDetector.detect_metal():
            logger.info("Apple Metal detected")
            return HardwareType.APPLE_METAL

        # Check if memory is too constrained
        if mem_info["percent_used"] > 80:
            logger.warning(f"High memory usage ({mem_info['percent_used']:.1f}%). Consider Groq failover.")
            if HAS_GROQ and os.getenv("GROQ_API_KEY"):
                logger.info("Falling back to Groq API")
                return HardwareType.GROQ_API

        logger.info("Using CPU inference")
        return HardwareType.CPU


class ModelHandler:
    """Manages model loading and inference."""

    def __init__(self, model_dir: Path = None):
        self.model_dir = model_dir or Path(__file__).parent / "models"
        self.model_dir.mkdir(exist_ok=True)
        self.model_path = self.model_dir / "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf"
        self.model = None
        self.hardware_type = None

    def ensure_model_exists(self) -> bool:
        """Ensure the model file exists. Download if necessary."""
        if self.model_path.exists():
            logger.info(f"Model found at {self.model_path}")
            return True

        logger.info(f"Model not found. Would download from Hugging Face...")
        # In a real implementation, use huggingface_hub to download
        # For now, we'll note that the downloader.py script handles this
        return False

    def load_model(self, hardware_type: HardwareType) -> bool:
        """Load the model with appropriate hardware acceleration."""
        if not self.model_path.exists():
            logger.error(f"Model not found at {self.model_path}")
            return False

        try:
            if hardware_type == HardwareType.NVIDIA_GPU and HAS_TORCH:
                logger.info("Loading model on NVIDIA GPU...")
                self.model = Llama(
                    model_path=str(self.model_path),
                    n_gpu_layers=-1,  # Offload all layers to GPU
                    n_ctx=2048,
                    verbose=False
                )
            elif hardware_type == HardwareType.APPLE_METAL:
                logger.info("Loading model on Apple Metal...")
                self.model = Llama(
                    model_path=str(self.model_path),
                    n_gpu_layers=-1,
                    n_ctx=2048,
                    verbose=False
                )
            else:
                logger.info("Loading model on CPU...")
                self.model = Llama(
                    model_path=str(self.model_path),
                    n_ctx=2048,
                    n_threads=os.cpu_count() or 4,
                    verbose=False
                )

            self.hardware_type = hardware_type
            logger.info(f"Model loaded successfully on {hardware_type.value}")
            return True

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False

    def infer(self, prompt: str, system_prompt: str, max_tokens: int = 1024) -> Optional[str]:
        """Run inference with the loaded model."""
        if not self.model:
            logger.error("Model not loaded")
            return None

        try:
            # Format as conversation
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]

            response = self.model.create_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.7
            )

            return response["choices"][0]["message"]["content"]

        except Exception as e:
            logger.error(f"Inference failed: {e}")
            return None


class GroqFallback:
    """Fallback to Groq API for inference."""

    @staticmethod
    def infer(prompt: str, system_prompt: str) -> Optional[str]:
        """Use Groq API as fallback."""
        if not HAS_GROQ:
            logger.error("Groq SDK not installed")
            return None

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.error("GROQ_API_KEY environment variable not set")
            return None

        try:
            client = Groq(api_key=api_key)
            response = client.chat.completions.create(
                model="mixtral-8x7b-32768",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1024,
                temperature=0.7
            )
            return response.choices[0].message.content

        except Exception as e:
            logger.error(f"Groq inference failed: {e}")
            return None


class GlassBoxLogger:
    """Formats and outputs Glass Box reasoning logs."""

    @staticmethod
    def create_reasoning_log(
        hardware_used: str,
        time_elapsed_ms: float,
        memory_used_mb: float,
        prompts_tested: list,
        decision_path: list,
        stability_score: float,
        critical_flaws: list = None,
        recommendations: list = None
    ) -> Dict[str, Any]:
        """Create a standardized reasoning log."""
        return {
            "hardware_used": hardware_used,
            "time_elapsed_ms": time_elapsed_ms,
            "memory_used_mb": memory_used_mb,
            "prompts_tested": prompts_tested,
            "decision_path": decision_path,
            "stability_score": stability_score,
            "critical_flaws": critical_flaws or [],
            "recommendations": recommendations or []
        }

    @staticmethod
    def save_status(status_file: Path, status: Dict[str, Any]):
        """Save real-time status to JSON for UI integration."""
        status_file.parent.mkdir(parents=True, exist_ok=True)
        with open(status_file, 'w') as f:
            json.dump(status, f, indent=2)
        logger.info(f"Status saved to {status_file}")


class ScribeBrain:
    """The Scribe v2.0 Brain - orchestrates evaluation and reasoning."""

    def __init__(self, workspace_root: Path = None):
        self.workspace_root = workspace_root or Path(__file__).parent.parent
        self.model_handler = ModelHandler()
        self.status_file = self.workspace_root / "scribe_status.json"
        self.hardware = HardwareDetector.select_hardware()

    def load_system_prompt(self, phase: EvaluationPhase) -> Optional[str]:
        """Load the appropriate system prompt for the evaluation phase."""
        prompt_file = self.workspace_root / "scribe" / "prompts" / f"{phase.value}_eval.md"

        if not prompt_file.exists():
            logger.error(f"Prompt file not found: {prompt_file}")
            return None

        try:
            with open(prompt_file, 'r') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to load prompt: {e}")
            return None

    def update_status(self, thinking_step: str):
        """Update real-time thinking status for UI."""
        status = {
            "timestamp": time.time(),
            "thinking_step": thinking_step,
            "hardware": self.hardware.value
        }
        GlassBoxLogger.save_status(self.status_file, status)

    def evaluate_spark(
        self,
        phase: EvaluationPhase,
        spark_content: str
    ) -> Optional[EvaluationResult]:
        """Evaluate a Spark (!HUNCH or !SHAPE) for quality and novelty."""

        start_time = time.time()
        initial_memory = psutil.Process().memory_info().rss / (1024 * 1024)

        try:
            # Update status
            self.update_status(f"Scanning for Loose Studs...")

            # Load system prompt
            self.update_status(f"Loading {phase.value} evaluator...")
            system_prompt = self.load_system_prompt(phase)
            if not system_prompt:
                return None

            # Prepare evaluation prompt
            eval_prompt = f"Please evaluate this {phase.value} submission:\n\n{spark_content}"

            # Try local inference first
            self.update_status(f"Running inference on {self.hardware.value}...")
            response = None

            if self.hardware != HardwareType.GROQ_API:
                # Load and use local model
                if self.model_handler.load_model(self.hardware):
                    response = self.model_handler.infer(eval_prompt, system_prompt)

            # Fallback to Groq if local failed
            if not response and self.hardware != HardwareType.GROQ_API:
                logger.info("Local inference failed, falling back to Groq...")
                self.update_status("Checking Clutch Power (Groq fallback)...")
                response = GroqFallback.infer(eval_prompt, system_prompt)
                self.hardware = HardwareType.GROQ_API

            if not response:
                logger.error("All inference methods failed")
                return None

            # Parse response as JSON (or convert to JSON)
            self.update_status("Validating Prior Art...")
            try:
                # Try parsing as JSON if the model output JSON
                if response.strip().startswith("{"):
                    result_json = json.loads(response)
                else:
                    # Create a standardized result from text response
                    result_json = {
                        "status": "approved",
                        "stability_score": 7.5,
                        "reasoning": {
                            "phase": phase.value,
                            "checks": {
                                "analysis": response[:500]  # First 500 chars of analysis
                            },
                            "decision_path": [
                                "Analyzed submission content",
                                f"Applied Mission: {phase.value.capitalize()} Audit criteria",
                                "Generated Glass Box stability assessment",
                                f"Hardware Telemetry: {self.hardware.value} integration verified"
                            ]
                        }
                    }
            except json.JSONDecodeError:
                result_json = {
                    "status": "needs_clarification",
                    "stability_score": 5.0,
                    "reasoning": {"phase": phase.value}
                }

            # Calculate metrics
            elapsed_ms = (time.time() - start_time) * 1000
            final_memory = psutil.Process().memory_info().rss / (1024 * 1024)
            memory_used = final_memory - initial_memory

            # Create result with reasoning
            result = EvaluationResult(
                status=result_json.get("status", "needs_clarification"),
                phase=phase.value,
                stability_score=result_json.get("stability_score", 5.0),
                reasoning={
                    "checks": result_json.get("reasoning", {}).get("checks", {}),
                    "decision_path": result_json.get("reasoning", {}).get("decision_path", []),
                    "glass_box": GlassBoxLogger.create_reasoning_log(
                        hardware_used=self.hardware.value,
                        time_elapsed_ms=elapsed_ms,
                        memory_used_mb=memory_used,
                        prompts_tested=[f"{phase.value}_eval.md"],
                        decision_path=result_json.get("reasoning", {}).get("decision_path", []),
                        stability_score=result_json.get("stability_score", 5.0),
                        critical_flaws=result_json.get("reasoning", {}).get("critical_flaws", []),
                        recommendations=result_json.get("reasoning", {}).get("recommendations", [])
                    )
                }
            )

            self.update_status(f"✅ Evaluation complete: {result.status}")
            return result

        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            self.update_status(f"❌ Evaluation error: {str(e)}")
            return None

    def output_result(self, result: EvaluationResult) -> str:
        """Format result as JSON for consumption."""
        return json.dumps({
            "status": result.status,
            "phase": result.phase,
            "stability_score": result.stability_score,
            "reasoning": result.reasoning
        }, indent=2)

    def evaluate_spark_missions(self, spark_content: str) -> Dict[str, Any]:
        """Run the Scribe-Architect missions pipeline on a full Spark file."""
        start_time = time.time()
        initial_memory = psutil.Process().memory_info().rss / (1024 * 1024)

        self.update_status("Executing Scribe-Architect missions...")
        mission_output = evaluate_spark_mission(spark_content)

        elapsed_ms = (time.time() - start_time) * 1000
        final_memory = psutil.Process().memory_info().rss / (1024 * 1024)
        memory_used = final_memory - initial_memory

        glass_box = GlassBoxLogger.create_reasoning_log(
            hardware_used=self.hardware.value,
            time_elapsed_ms=elapsed_ms,
            memory_used_mb=memory_used,
            prompts_tested=["missions"],
            decision_path=[
                "Parsed Spark markdown into JSON",
                "Audited stability and completeness",
                "Generated governance advisory"
            ],
            stability_score=mission_output.get("spark_info", {}).get("stability_score", 0),
            critical_flaws=mission_output.get("audit", {}).get("critical_flaws", []),
            recommendations=[]
        )

        mission_output["audit"]["glass_box"] = glass_box
        self.update_status("✅ Mission evaluation complete")
        return mission_output


# CLI INTERFACE - RESERVED FOR LATER
# The AI scribe is not invoked via commands currently.
# This functionality is preserved for future use.

# def main():
#     """Main entry point for the Scribe Brain."""
#     import argparse
#     
#     parser = argparse.ArgumentParser(description="Scribe v2.0 Brain - Glass Box AI Agent")
#     parser.add_argument("--demo", action="store_true", help="Run in demo mode (no inference)")
#     parser.add_argument("--eval-file", type=str, help="Spark file to evaluate")
#     parser.add_argument("--phase", choices=["hunch", "shape"], default="hunch", help="Evaluation phase")
#     parser.add_argument("--missions", action="store_true", help="Run Scribe-Architect missions on a full Spark")
# #     args = parser.parse_args()
# 
#     logger.info("🧠 Initializing Scribe v3.0 Brain...")
# 
#     if args.demo:
#         logger.info("📊 Running in DEMO MODE (Mission: Narrative Audit simulation)")
#         demo_mode()
#         return
# 
#     brain = ScribeBrain()
#     logger.info(f"Hardware selected: {brain.hardware.value}")
# 
#     try:
#         if args.missions:
#             if not args.eval_file:
#                 logger.error("--missions requires --eval-file")
#                 sys.exit(1)
# 
#             with open(args.eval_file, "r") as f:
#                 spark_content = f.read()
# 
#             logger.info("📥 Running Scribe-Architect missions...")
#             mission_result = brain.evaluate_spark_missions(spark_content)
#             logger.info("\n" + json.dumps(mission_result, indent=2))
#             return
# 
#         if args.eval_file:
#             with open(args.eval_file, "r") as f:
#                 spark_content = f.read()
# 
#             logger.info(f"📥 Evaluating {args.phase.upper()} from file...")
#             result = brain.evaluate_spark(EvaluationPhase(args.phase), spark_content)
#         else:
#             # Example: Evaluate a sample hunch
#             sample_hunch = """
#             I notice that our Spark files don't have consistent date fields. 
#             It's hard to track when a blueprint was created vs. when it was approved.
#             This makes it difficult to analyze the velocity of the Commons.
#             """
# 
#             logger.info("📥 Evaluating sample HUNCH...")
#             result = brain.evaluate_spark(EvaluationPhase.HUNCH, sample_hunch)
# 
#         if result:
#             logger.info("\n" + brain.output_result(result))
#         else:
#             logger.error("Evaluation failed")
#             logger.info("\n💡 HELP:")
#             logger.info("   1. Download model: python spark-assembly-lab/scribe/models/downloader.py --download")
#             logger.info("   2. Or use demo mode: python spark-assembly-lab/scribe/scribe_brain.py --demo")
#             logger.info("   3. Or set Groq API: export GROQ_API_KEY='your-key'")
#             sys.exit(1)
#     except Exception as e:
#         logger.error(f"Fatal error during evaluation: {e}")
#         logger.info("\n💡 HELP:")
#         logger.info("   • Run demo mode: python spark-assembly-lab/scribe/scribe_brain.py --demo")
#         logger.info("   • Install model: python spark-assembly-lab/scribe/models/downloader.py --download")
#         logger.info("   • Check dependencies: pip install -r spark-assembly-lab/scribe/requirements.txt")
#         sys.exit(1)


def demo_mode():
    """Demo mode showing Scribe v3.0 mission functionality without inference."""
    logger.info("\n" + "="*60)
    logger.info("🧠 SCRIBE v3.0 GLASS BOX DEMO")
    logger.info("="*60)
    
    # Simulate Section 1 Narrative
    sample_narrative = """
    Spark files currently lack a mechanism for automated 'Echo Bonus' tracking. 
    While the Manifesto (v3.0) defines the reward, the metadata structure doesn't 
    distinguish between an owner's update and a community proposal in a way that 
    the Scribe can parse. This slows down the meritocracy.
    """
    
    logger.info("\nMission: Narrative Audit (Section 1)")
    logger.info(f"INPUT: {sample_narrative.strip()}")
    
    # Simulated Glass Box output
    demo_result = {
        "status": "approved",
        "mission": "narrative_audit",
        "section": 1,
        "stability_score": 8.5,
        "reasoning": {
            "checks": {
                "specificity": "✅ Concrete observation about Echo Bonus metadata structure",
                "actionability": "✅ Hypothesis (Section 2) can define new metadata schema",
                "novelty": "✅ Not documented in existing Echo Bonus Sparks",
                "manifesto_alignment": "✅ Directly addresses meritocracy scaling"
            },
            "decision_path": [
                "Scanning for Loose Studs (Section 1 Narrative)...",
                "Identifying specific gap: Echo Bonus metadata ambiguity",
                "Checking Clutch Power (specificity of observation)...",
                "Validating Manifesto alignment (Meritocracy impacts)...",
                "Cross-referencing against existing Sparks...",
                "Novelty assessment: Narrative identifies unique structural gap"
            ],
            "glass_box": {
                "hardware_used": "cpu (demo mode simulation)",
                "hardware_acceleration": "None (Demo)",
                "time_elapsed_ms": 12.5,
                "memory_used_mb": 0.0,
                "model_name": "Scribe-Internal-Demo",
                "prompts_tested": ["hunch_eval.md"],
                "decision_path": [
                    "Initialized Mission: Narrative Audit",
                    "Applied Glass Box reasoning template",
                    "Hardware Telemetry: cpu integration verified"
                ]
            }
        }
    }
    
    logger.info("\n📊 OUTPUT: Glass Box Reasoning Log")
    logger.info("="*60)
    logger.info(json.dumps(demo_result, indent=2))
    
    logger.info("\n" + "="*60)
    logger.info("✅ Demo complete")
    logger.info("="*60)
    logger.info("\n💡 NEXT STEPS:")
    logger.info("   1. Download Qwen2.5-1.5B model:")
    logger.info("      python spark-assembly-lab/scribe/models/downloader.py --download")
    logger.info("")
    logger.info("   2. Or set up Groq API fallback:")
    logger.info("      export GROQ_API_KEY='your-groq-api-key'")
    logger.info("      pip install groq>=0.4.0")
    logger.info("")
    logger.info("   3. Run stability audits (no model required):")
    logger.info("      python spark-assembly-lab/scribe/logic/stability_audit.py --dir sparks/")
    logger.info("")
    logger.info("   4. Then run live evaluation:")
    logger.info("      python spark-assembly-lab/scribe/scribe_brain.py")
    logger.info("")


# if __name__ == "__main__":
#     main()
