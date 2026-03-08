#!/usr/bin/env python3
"""
Scribe v2.0 Quick Start Verification Script

Checks that the Scribe implementation is ready to use and runs tests.
"""

import subprocess
import sys
from pathlib import Path

def run_command(cmd, description):
    """Run a command and report results."""
    print(f"\n🔍 {description}...")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print(f"   ✅ {description}")
            return True
        else:
            if result.stderr:
                print(f"   ⚠️  {result.stderr.splitlines()[-1][:80]}")
            return False
    except subprocess.TimeoutExpired:
        print(f"   ⏱️  Timeout - check manually")
        return False
    except Exception as e:
        print(f"   ❌ Error: {str(e)[:80]}")
        return False

def main():
    """Run all checks."""
    print("\n" + "="*70)
    print("🧠 SCRIBE v3.0 MISSION VERIFICATION (MANIFESTO ALIGNED)")
    print("="*70)

    base_path = Path(__file__).parent
    results = {}

    # 1. File structure
    print("\n📁 Checking File Structure:")
    files = [
        "scribe_brain.py",
        "prompts/hunch_eval.md",
        "prompts/shape_eval.md",
        "logic/stability_audit.py",
        "models/downloader.py",
        "../sparks/scribe-v2-implementation.md"
    ]
    
    all_exist = True
    for f in files:
        exists = (base_path / f).exists()
        symbol = "✅" if exists else "❌"
        print(f"   {symbol} {f}")
        all_exist = all_exist and exists
    results["files"] = all_exist

    # 2. Python syntax
    print("\n🐍 Checking Python Syntax:")
    py_files = [
        "scribe_brain.py",
        "logic/stability_audit.py",
        "models/downloader.py"
    ]
    
    syntax_ok = True
    for f in py_files:
        ok = run_command(f"python3 -m py_compile {base_path / f}", f"Syntax: {f}")
        syntax_ok = syntax_ok and ok
    results["syntax"] = syntax_ok

    # 3. Demo mode
    print("\n🎬 Testing Demo Mode:")
    demo_ok = run_command(
        f"python3 {base_path / 'scribe_brain.py'} --demo 2>&1 | grep -q 'Demo complete'",
        "Demo mode execution"
    )
    results["demo"] = demo_ok

    # 4. Stability auditor
    print("\n🧱 Testing Stability Auditor:")
    audit_ok = run_command(
        f"python3 {base_path / 'logic/stability_audit.py'} --dir {base_path.parent / 'sparks'} 2>&1 | grep -q 'Stability Report'",
        "Stability audit execution"
    )
    results["audit"] = audit_ok

    # 5. Model downloader
    print("\n📦 Checking Model Downloader:")
    dl_ok = run_command(
        f"python3 {base_path / 'models/downloader.py'} --verify 2>&1 | grep -q 'Model'",
        "Model downloader check"
    )
    results["downloader"] = dl_ok

    # 6. Dependencies
    print("\n📚 Checking Dependencies:")
    deps = [
        ("psutil", "psutil"),
        ("requests", "requests"),
    ]
    
    deps_ok = True
    for name, module in deps:
        ok = run_command(f"python3 -c 'import {module}'", f"Import {name}")
        deps_ok = deps_ok and ok
    results["dependencies"] = deps_ok

    # 7. Git status
    print("\n🔧 Git Status:")
    branch = subprocess.run(
        "cd " + str(base_path) + " && git branch --show-current",
        shell=True,
        capture_output=True,
        text=True
    ).stdout.strip()
    print(f"   📍 Current branch: {branch}")
    if branch == "feat/scribe-v2-nano":
        print(f"   ✅ On correct branch")
        results["git"] = True
    else:
        print(f"   ⚠️  Expected: feat/scribe-v2-nano, Got: {branch}")
        results["git"] = False

    # Summary
    print("\n" + "="*70)
    print("📊 VERIFICATION SUMMARY")
    print("="*70)

    all_ok = all(results.values())
    
    for check, passed in results.items():
        symbol = "✅" if passed else "❌"
        print(f"{symbol} {check.upper():<20} {'PASSED' if passed else 'NEEDS ATTENTION'}")

    print("\n" + "="*70)
    if all_ok:
        print("🎉 ALL CHECKS PASSED - SCRIBE V2.0 IS READY TO USE!")
        print("\n🚀 Next Steps:")
        print("   1. python3 scribe_brain.py --demo")
        print("   2. python3 logic/stability_audit.py --dir ../sparks/")
        print("   3. Read SCRIBE_TESTING_GUIDE.md for full setup")
        return 0
    else:
        print("⚠️  SOME CHECKS FAILED - Please review above")
        print("\n💡 Troubleshooting:")
        print("   • Check that you're in the primer directory")
        print("   • Ensure Python 3.8+ is installed")
        print("   • Run: pip install -r scribe/requirements.txt")
        print("   • See SCRIBE_TESTING_GUIDE.md for help")
        return 1


if __name__ == "__main__":
    sys.exit(main())
