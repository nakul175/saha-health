"""Fail-closed release-packet validator; it does not fetch or attest GitHub facts.

Release must assemble the packet from fresh tool results, inspect evidence, and
use GitHub's expected-head merge plus native protections. Passing invented input
is not permission. Invoke: python3 automation/gate.py packet.json
"""
from __future__ import annotations
import json
import re
import sys
from typing import Any

SHA = re.compile(r"^[0-9a-f]{40}$")

def merge_blockers(packet: Any) -> list[str]:
    if not isinstance(packet, dict):
        return ["packet must be an object"]
    out: list[str] = []
    for key in ("enabled", "standing_merge_authority", "synthetic_only", "lease_owned",
                "scope_matches", "native_checks_pass", "no_blocking_findings",
                "history_preserved", "release_target_confirmed", "rollback_compatible"):
        if packet.get(key) is not True:
            out.append(key + " must be explicitly true")
    for key in ("head_sha", "base_sha", "spec_sha"):
        if not isinstance(packet.get(key), str) or not SHA.fullmatch(packet[key]):
            out.append(key + " must identify exact Git source")
    if packet.get("head_sha") != packet.get("live_head_sha"):
        out.append("PR head moved")
    if packet.get("base_sha") != packet.get("live_base_sha"):
        out.append("main/base moved")
    if packet.get("active_issue") != packet.get("pr_story_issue") or type(packet.get("active_issue")) is not int:
        out.append("PR must belong to the one active story")
    if packet.get("pr_number") in (173, 184, 187) or type(packet.get("pr_number")) is not int:
        out.append("new focused story PR required; no bulk legacy/planning merge")
    criteria = packet.get("required_criteria")
    if not isinstance(criteria, list) or not criteria or any(not isinstance(k, str) or not k for k in criteria) or len(set(criteria)) != len(criteria):
        out.append("nonempty unique frozen criteria required")
        criteria = []
    actor_runs: list[str] = []
    for role in ("author", "qa", "review"):
        receipt = packet.get(role)
        if not isinstance(receipt, dict):
            out.append(role + " receipt missing")
            continue
        if receipt.get("role") != role or receipt.get("status") != "pass":
            out.append(role + " has not passed")
        for key in ("head_sha", "base_sha", "spec_sha"):
            if receipt.get(key) != packet.get(key):
                out.append(role + " receipt stale: " + key)
        if not isinstance(receipt.get("run_id"), str) or not receipt["run_id"]:
            out.append(role + " run identity missing")
        else:
            actor_runs.append(receipt["run_id"])
        if not isinstance(receipt.get("evidence"), list) or not receipt["evidence"] or any(not isinstance(v,str) or not v for v in receipt["evidence"]):
            out.append(role + " evidence missing")
    if len(actor_runs) != 3 or len(set(actor_runs)) != 3:
        out.append("author, QA and reviewer need distinct recorded runs")
    qa = packet.get("qa") if isinstance(packet.get("qa"),dict) else {}
    results = qa.get("criteria")
    if not isinstance(results, dict) or set(results) != set(criteria) or any(v != "pass" for v in results.values()):
        out.append("all and only frozen pre-merge criteria must pass")
    checks = packet.get("required_checks")
    if not isinstance(checks, list) or not checks:
        out.append("required check evidence missing")
    else:
        for c in checks:
            if not isinstance(c, dict) or c.get("status") != "completed" or c.get("outcome") != "success" or c.get("head_sha") != packet.get("head_sha") or not c.get("evidence"):
                out.append("a required exact-head check is not a proven success")
    return out

def delivery_blockers(packet: Any) -> list[str]:
    if not isinstance(packet, dict):
        return ["delivery packet must be an object"]
    out = []
    merged = packet.get("merge_sha")
    if not isinstance(merged, str) or not SHA.fullmatch(merged):
        out.append("merged source missing")
    if packet.get("deployed_sha") != merged:
        out.append("deployed source not the merged source")
    for key in ("deployment_observed", "story_smoke_passed", "synthetic_only"):
        if packet.get(key) is not True:
            out.append(key + " not evidenced")
    if not packet.get("evidence"):
        out.append("deployment evidence missing")
    return out

def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 automation/gate.py release-packet.json", file=sys.stderr)
        return 2
    try:
        with open(sys.argv[1], encoding="utf-8") as stream:
            packet = json.load(stream)
        errors = merge_blockers(packet)
    except (OSError, ValueError, TypeError) as exc:
        print(json.dumps({"allowed": False, "error": str(exc)}))
        return 2
    print(json.dumps({"allowed": not errors, "blockers": errors}, indent=2))
    return int(bool(errors))

if __name__ == "__main__":
    raise SystemExit(main())
