#!/usr/bin/env python3
"""
Stability Audit Module for Scribe v2.0

Refactored novelty_scan.py logic into a class that validates Spark structural integrity
and evaluates novelty. Returns structured results for Glass Box reasoning logs.
"""

import re
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PhaseStatus:
    """Status of a single phase completion."""
    phase_name: str
    is_complete: bool
    has_role: bool
    missing_patterns: List[str]
    role_handle: Optional[str] = None


@dataclass
class StabilityReport:
    """Complete stability audit report for a Spark."""
    filepath: str
    is_valid: bool
    completion_level: int  # 0-3 phases
    phase_statuses: List[PhaseStatus]
    novelty_score: float  # 0-100
    critical_flaws: List[str]
    warnings: List[str]
    recommendations: List[str]


class StabilityAuditor:
    """Audits Spark files for structural integrity and novelty."""

    # Phase definitions aligned with MANIFESTO
    PHASES = {
        "Spark (!HUNCH)": {
            "order": 1,
            "patterns": [r"The Observation", r"The Gap", r"The \"Why\""]
        },
        "Design (!SHAPE)": {
            "order": 2,
            "patterns": [r"The Novel Core", r"The Blueprint", r"The Interface"]
        },
        "Logic (!BUILD)": {
            "order": 3,
            "patterns": [r"Technical Implementation", r"Clutch Power Test"]
        }
    }

    def __init__(self):
        self.content = None
        self.filepath = None

    def load_spark(self, filepath: Path) -> bool:
        """Load a Spark file for analysis."""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                self.content = f.read()
            self.filepath = str(filepath)
            logger.info(f"✅ Loaded Spark: {filepath}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to load {filepath}: {e}")
            return False

    def check_phase_completion(self) -> List[PhaseStatus]:
        """Check completion status of each phase."""
        phase_statuses = []

        # Find owner handle (search entire file)
        owner_match = re.search(r"\*(?:Owner|Scout):\s*@?([\w-]+)\*", self.content, re.IGNORECASE)
        owner_handle = owner_match.group(1) if owner_match else None

        for phase_name, phase_config in self.PHASES.items():
            status = PhaseStatus(
                phase_name=phase_name,
                is_complete=False,
                has_role=bool(owner_handle),
                missing_patterns=[],
                role_handle=owner_handle
            )

            # Check if phase header exists
            if not re.search(re.escape(phase_name), self.content, re.IGNORECASE):
                phase_statuses.append(status)
                continue

            # Check for required pattern components
            for pattern in phase_config["patterns"]:
                if not re.search(pattern, self.content, re.IGNORECASE):
                    status.missing_patterns.append(pattern)

            # Phase is complete if owner exists AND all patterns present
            status.is_complete = status.has_role and len(status.missing_patterns) == 0

            phase_statuses.append(status)

        return phase_statuses

    def evaluate_novelty(self) -> float:
        """Evaluate novelty score of the Spark, focusing on SHAPE phase."""
        score = 50.0  # Base score

        # Look for "Novel Core" section
        novel_core_match = re.search(
            r"The Novel Core.*?\n\* \*\*The Blueprint:\*\*(.*?)(?=\* \*\*|---|\Z)",
            self.content,
            re.DOTALL | re.IGNORECASE
        )

        if novel_core_match:
            text = novel_core_match.group(1).strip()
            word_count = len(text.split())

            # Detailed description boosts novelty score
            if word_count > 100:
                score += 25
            elif word_count > 50:
                score += 15
            elif word_count > 15:
                score += 5
            else:
                score -= 20  # Too thin

            # Check for specific novelty indicators
            novelty_keywords = [
                r"novel",
                r"unique",
                r"new",
                r"differentiat",
                r"delta",
                r"gap",
                r"solve"
            ]

            keyword_count = sum(
                1 for kw in novelty_keywords
                if re.search(kw, text, re.IGNORECASE)
            )

            if keyword_count >= 3:
                score += 15

        # Check for "Prior Art" section
        if re.search(r"Prior Art", self.content, re.IGNORECASE):
            score += 10

        # Check for risk awareness
        if re.search(r"Risk|Challenge|Limitation|Trade-off", self.content, re.IGNORECASE):
            score += 10

        # Check for clarity of interface/integration
        if re.search(r"The Interface|snap|integrat", self.content, re.IGNORECASE):
            score += 10

        return min(max(score, 0), 100)  # Clamp to 0-100

    def identify_critical_flaws(self, phase_statuses: List[PhaseStatus]) -> List[str]:
        """Identify structural flaws in the Spark."""
        flaws = []

        # Check if any phase is present (minimum requirement)
        if not any(status.is_complete for status in phase_statuses):
            flaws.append("No complete phases found. Required: at minimum valid Spark (!HUNCH).")

        # Check for orphaned phases (e.g., Logic without Spark/Design)
        completed_phases = [s for s in phase_statuses if s.is_complete]
        if completed_phases:
            max_order = max(self.PHASES[s.phase_name]["order"] for s in completed_phases)
            for i in range(1, max_order):
                phase_names = [p for p, c in self.PHASES.items() if c["order"] == i]
                if phase_names and not any(
                    s.is_complete for s in completed_phases if s.phase_name == phase_names[0]
                ):
                    flaws.append(f"Missing foundational phase: {phase_names[0]}")

        # Check for inconsistent metadata
        contributor_pattern = r"@([\w-]+)"
        contributors = re.findall(contributor_pattern, self.content)
        if not contributors:
            flaws.append("No contributor handles (@username) found.")

        return flaws

    def generate_recommendations(self, report: StabilityReport) -> List[str]:
        """Generate recommendations for improvement."""
        recommendations = []

        if report.completion_level < 3:
            next_phase_num = report.completion_level + 1
            next_phase = next(
                (p for p, c in self.PHASES.items() if c["order"] == next_phase_num),
                None
            )
            if next_phase:
                recommendations.append(f"Complete the next phase: {next_phase}")

        if report.novelty_score < 60:
            recommendations.append("Strengthen the Novel Core description with more specific details.")

        if report.completion_level >= 2:  # Has SHAPE phase
            if report.novelty_score < 50:
                recommendations.append("Articulate the 10% delta more clearly against Prior Art.")

        if "No complete phases" in str(report.critical_flaws):
            recommendations.append("Start by completing the Spark (!HUNCH) phase with clear observation of a Loose Stud.")

        return recommendations

    def audit_spark(self, filepath: Path) -> Optional[StabilityReport]:
        """Run complete stability audit on a Spark file."""
        if not self.load_spark(filepath):
            return None

        # Check phase completion
        phase_statuses = self.check_phase_completion()

        # Count completed phases
        completion_level = sum(1 for s in phase_statuses if s.is_complete)

        # Evaluate novelty
        novelty_score = self.evaluate_novelty()

        # Identify critical flaws
        critical_flaws = self.identify_critical_flaws(phase_statuses)

        # Identify warnings
        warnings = []
        for status in phase_statuses:
            if not status.is_complete and status.has_role:
                warnings.append(f"{status.phase_name} is incomplete (missing: {', '.join(status.missing_patterns)})")

        # Is valid if at least Spark phase is complete
        is_valid = completion_level >= 1

        # Generate recommendations
        report = StabilityReport(
            filepath=str(filepath),
            is_valid=is_valid,
            completion_level=completion_level,
            phase_statuses=phase_statuses,
            novelty_score=novelty_score,
            critical_flaws=critical_flaws,
            warnings=warnings,
            recommendations=[]
        )

        report.recommendations = self.generate_recommendations(report)

        return report

    def format_report(self, report: StabilityReport) -> str:
        """Format report as human-readable output."""
        lines = []
        lines.append(f"\n🧱 Stability Report: {Path(report.filepath).name}")
        lines.append("=" * 60)

        # Overall status
        status_icon = "✅" if report.is_valid else "❌"
        lines.append(f"{status_icon} Status: {'Valid' if report.is_valid else 'Invalid'}")
        lines.append(f"📊 Completion Level: {report.completion_level}/3 phases")
        lines.append(f"💎 Novelty Score: {report.novelty_score:.1f}/100")

        # Phase status
        lines.append("\n🔨 Phase Status:")
        for status in report.phase_statuses:
            check = "✅" if status.is_complete else "⏳"
            role_str = f" (@{status.role_handle})" if status.role_handle else ""
            lines.append(f"  {check} {status.phase_name}{role_str}")
            if status.missing_patterns:
                for pattern in status.missing_patterns:
                    lines.append(f"     ⚠️  Missing: {pattern}")

        # Critical flaws
        if report.critical_flaws:
            lines.append("\n⛔ Critical Flaws:")
            for flaw in report.critical_flaws:
                lines.append(f"  • {flaw}")

        # Warnings
        if report.warnings:
            lines.append("\n⚠️  Warnings:")
            for warning in report.warnings:
                lines.append(f"  • {warning}")

        # Recommendations
        if report.recommendations:
            lines.append("\n💡 Recommendations:")
            for rec in report.recommendations:
                lines.append(f"  • {rec}")

        lines.append("")
        return "\n".join(lines)


# CLI INTERFACE - RESERVED FOR LATER
# The AI scribe is not invoked via commands currently.
# This functionality is preserved for future use.

# def main():
#     """CLI entry point for the stability auditor."""
#     import argparse
# 
#     parser = argparse.ArgumentParser(
#         description="Stability Audit for Primer Sparks"
#     )
#     parser.add_argument("--file", type=Path, help="Specific Spark file to audit")
#     parser.add_argument("--dir", type=Path, default=Path("sparks"), help="Directory containing Sparks")
#     parser.add_argument("--json", action="store_true", help="Output as JSON")
# #     args = parser.parse_args()
# 
#     auditor = StabilityAuditor()
# 
#     # Collect files to audit
#     files_to_audit = []
#     if args.file:
#         files_to_audit = [args.file]
#     elif args.dir.exists():
#         files_to_audit = sorted(args.dir.glob("*.spark.md"))
# 
#     if not files_to_audit:
#         logger.warning(f"⚠️  No Spark files found in {args.dir}")
#         return
# 
#     # Run audits
#     all_valid = True
#     reports = []
# 
#     for filepath in files_to_audit:
#         report = auditor.audit_spark(filepath)
#         if report:
#             reports.append(report)
#             if not report.is_valid:
#                 all_valid = False
# 
#             if not args.json:
#                 print(auditor.format_report(report))
# 
#     # JSON output
#     if args.json:
#         import json
# 
#         json_reports = []
#         for report in reports:
#             json_reports.append({
#                 "filepath": report.filepath,
#                 "is_valid": report.is_valid,
#                 "completion_level": report.completion_level,
#                 "novelty_score": report.novelty_score,
#                 "critical_flaws": report.critical_flaws,
#                 "warnings": report.warnings,
#                 "recommendations": report.recommendations
#             })
# 
#         print(json.dumps(json_reports, indent=2))
# 
#     # Exit code
#     import sys
#     sys.exit(0 if all_valid else 1)


# if __name__ == "__main__":
#     main()
