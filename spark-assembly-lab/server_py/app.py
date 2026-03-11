#!/usr/bin/env python3
"""
Spark Assembly Lab Python backend.
Replaces the Node/Express server with Flask.
"""

import json
import os
import time
import urllib.parse
import urllib.request
import base64
from pathlib import Path
from typing import Dict, Any, List, Optional

from flask import Flask, jsonify, request, send_from_directory

# Import AI SDKs
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


APP_ROOT = Path(__file__).resolve().parents[1]
DIST_PATH = APP_ROOT / "dist"

app = Flask(__name__, static_folder=str(DIST_PATH), static_url_path="")
app.url_map.strict_slashes = False

@app.before_request
def log_request_info():
    app.logger.debug('Headers: %s', request.headers)
    app.logger.debug('Body: %s', request.get_data())

@app.after_request
def after_request(response):
    app.logger.debug('Response Status: %s', response.status)
    return response

cache: Dict[str, Any] = {
    "timestamp": 0,
    "data": None,
}

pr_cache: Dict[str, Any] = {
    "timestamp": 0,
    "data": {},
}


def get_env(key: str, fallback: str) -> str:
    return os.environ.get(key, fallback)


def build_github_headers() -> Dict[str, str]:
    headers = {
        "User-Agent": "spark-assembly-lab",
        "Accept": "application/vnd.github+json",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def build_github_headers_with_token(token: Optional[str]) -> Dict[str, str]:
    headers = build_github_headers()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def parse_repo_url(input_value: str) -> Dict[str, str]:
    clean_input = input_value.strip()
    clean_input = clean_input.replace("https://", "").replace("http://", "")
    clean_input = clean_input.replace("github.com/", "")
    parts = [part for part in clean_input.split("/") if part]
    if len(parts) >= 2:
        return {
            "owner": parts[0],
            "repo": parts[1].replace(".git", ""),
        }
    raise ValueError("Invalid repository format. Use: owner/repo or https://github.com/owner/repo")


def fetch_json(url: str, headers: Dict[str, str]) -> Dict[str, Any]:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        data = response.read().decode("utf-8")
        return json.loads(data)


def fetch_text(url: str, headers: Dict[str, str]) -> str:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        return response.read().decode("utf-8")


def fetch_json_with_token(url: str, token: str, method: str = "GET", payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "spark-assembly-lab")
    if payload is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"HTTP Error {e.code}: {e.reason}")
        print(f"Response Body: {error_body}")
        raise e


def create_github_issue(owner: str, repo: str, token: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new GitHub Issue in the specified repository."""
    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    return fetch_json_with_token(url, token, method="POST", payload=payload)


def get_open_activity_count(owner: str, repo: str, spark_path: str, token: Optional[str]) -> Dict[str, Any]:
    headers = build_github_headers_with_token(token)
    
    can_push = False
    if token:
        try:
            # Check for write permission by attempting to get the repo's push permission info
            repo_info = fetch_json(f"https://api.github.com/repos/{owner}/{repo}", headers)
            permissions = repo_info.get("permissions", {})
            can_push = permissions.get("push", False)
        except Exception:
            can_push = False

    # 1. Fetch Pull Requests
    pulls_url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=open&per_page=100"
    pulls = fetch_json(pulls_url, headers)

    count = 0
    items: List[Dict[str, Any]] = []

    for pr in pulls:
        number = pr.get("number")
        if not number:
            continue
        files_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files?per_page=100"
        files = fetch_json(files_url, headers)
        for item in files:
            if item.get("filename") == spark_path:
                count += 1
                items.append({
                    "type": "pr",
                    "url": pr.get("html_url"),
                    "number": pr.get("number"),
                    "user": (pr.get("user") or {}).get("login"),
                })
                break

    # 2. Fetch Issues (Proposals)
    issues_url = f"https://api.github.com/repos/{owner}/{repo}/issues?state=open&per_page=100"
    all_issues = fetch_json(issues_url, headers)
    
    # Filter for proposals that aren't PRs and mention the spark_path
    spark_name = spark_path.split("/")[-1].replace(".spark.md", "")
    for issue in all_issues:
        if issue.get("pull_request"):
            continue

        title = issue.get("title", "").lower()
        body = issue.get("body", "").lower() if issue.get("body") else ""

        if spark_name.lower() in title or spark_name.lower() in body:
            count += 1
            items.append({
                "type": "issue",
                "url": issue.get("html_url"),
                "number": issue.get("number"),
                "user": (issue.get("user") or {}).get("login"),
            })

    return {"count": count, "items": items, "can_push": can_push}


def search_for_spark_files(owner: str, repo: str) -> List[Dict[str, Any]]:
    headers = build_github_headers()
    query = f"filename:.spark.md repo:{owner}/{repo}"
    search_url = f"https://api.github.com/search/code?q={urllib.parse.quote(query)}"
    search_data = fetch_json(search_url, headers)
    return search_data.get("items", [])


def get_last_commit_author(owner: str, repo: str, path: str, branch: str, headers: Dict[str, str]) -> Optional[Dict[str, Optional[str]]]:
    """Fetch the last commit for a given file and return author info.

    Uses the GitHub commits API filtered by path and branch, limited to 1 result.
    Returns a dict with keys 'login', 'name', and 'date' (ISO 8601) when available,
    otherwise None.
    """
    commits_url = (
        f"https://api.github.com/repos/{owner}/{repo}/commits"
        f"?path={urllib.parse.quote(path)}&sha={urllib.parse.quote(branch)}&per_page=1"
    )
    try:
        commits = fetch_json(commits_url, headers)
    except Exception as err:
        print(f"Failed to fetch commits for {path}: {err}")
        return None

    if isinstance(commits, list) and commits:
        commit = commits[0]
        author_user = commit.get("author") or {}
        commit_author = (commit.get("commit") or {}).get("author", {})
        login = author_user.get("login")
        name = commit_author.get("name")
        date = commit_author.get("date")

        result: Dict[str, Optional[str]] = {}
        if login:
            result["login"] = login
        if name:
            result["name"] = name
        if date:
            result["date"] = date

        if result:
            return result

    return None


def fetch_sparks_from_github(owner: str, repo: str, branch: str = "main", search_path: str = "sparks") -> Dict[str, Any]:
    headers = build_github_headers()
    spark_items: List[Dict[str, Any]] = []

    try:
        spark_items = search_for_spark_files(owner, repo)
    except Exception as err:
        print(f"Search failed, falling back to directory listing: {err}")

    if not spark_items:
        index_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{search_path}?ref={branch}"
        try:
            items = fetch_json(index_url, headers)
        except urllib.error.HTTPError as err:
            if err.code == 404:
                raise RuntimeError(
                    f"Repository '{owner}/{repo}' not found or the '{search_path}' directory doesn't exist"
                )
            if err.code == 403:
                raise RuntimeError("GitHub API rate limit exceeded. Please try again later or add a GITHUB_TOKEN")
            raise RuntimeError(f"GitHub index fetch failed: {err.code}")

        spark_items = [
            item for item in items
            if item.get("type") == "file" and item.get("name", "").endswith(".spark.md")
        ]

    files = []
    for item in spark_items:
        try:
            path = item.get("path") or item.get("name")
            if not path:
                continue
            content_url = item.get("download_url")
            if not content_url:
                content_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
            content = fetch_text(content_url, headers)
            last_commit_author = get_last_commit_author(owner, repo, path, branch, headers)
            files.append({
                "name": item.get("name") or path.split("/")[-1],
                "path": path,
                "content": content,
                "lastCommit": last_commit_author,
            })
        except Exception as err:
            print(f"Failed to fetch {item.get('name') or item.get('path')}: {err}")
            continue

    return {
        "source": "github",
        "owner": owner,
        "repo": repo,
        "branch": branch,
        "files": files,
    }


def get_cache_ttl_ms() -> int:
    return int(get_env("SPARK_CACHE_TTL_SECONDS", "60")) * 1000


@app.get("/api/health")
def health_check():
    return jsonify({"status": "ok"})


@app.get("/api/sparks")
def get_sparks():
    now = int(time.time() * 1000)
    repo_input = request.args.get("repo") or get_env("SPARK_REPO", "rvishravars/primer")
    branch = request.args.get("branch") or "main"
    search_path = request.args.get("path") or "sparks"

    try:
        parsed = parse_repo_url(repo_input)
    except ValueError as err:
        return jsonify({"error": str(err), "files": []}), 400

    owner = parsed["owner"]
    repo = parsed["repo"]
    cache_key = f"{owner}/{repo}:{branch}"

    if cache["data"] and cache["data"].get("cacheKey") == cache_key:
        if now - cache["timestamp"] < get_cache_ttl_ms():
            cached_data = dict(cache["data"])
            cached_data["cached"] = True
            cached_data["updatedAt"] = cache["timestamp"]
            return jsonify(cached_data)

    try:
        data = fetch_sparks_from_github(owner, repo, branch, search_path)
        cache["timestamp"] = now
        cache["data"] = {**data, "cacheKey": cache_key}
        response = {**data, "cached": False, "updatedAt": now}
        return jsonify(response)
    except RuntimeError as err:
        if cache["data"] and cache["data"].get("cacheKey") == cache_key:
            stale_data = dict(cache["data"])
            stale_data.update({
                "cached": True,
                "stale": True,
                "error": str(err),
                "updatedAt": cache["timestamp"],
            })
            return jsonify(stale_data)
        return jsonify({"error": str(err), "files": []}), 502

## Scribe missions and /api/mission endpoints removed




def generate_workbench_reply_with_openai(
    spark_content: str,
    spark_data: Dict[str, Any],
    messages: List[Dict[str, str]],
    api_key: str,
    model: str = "gpt-4o-mini",
) -> Dict[str, str]:
    """Generate an AI workbench reply using OpenAI.

    Returns a dict with keys:
      - reply: natural-language assistant message
      - updatedSpark: full markdown string with the updated spark, or empty string if no changes
    """
    if not OPENAI_AVAILABLE:
        raise RuntimeError("OpenAI SDK not installed")

    try:
        client = openai.OpenAI(api_key=api_key)
    except TypeError as e:
        raise RuntimeError(
            f"OpenAI client initialization failed. Please ensure openai>=1.30.0 is installed. Error: {e}"
        )

    # Compress conversation for the model
    history_lines: List[str] = []
    for m in messages[-10:]:  # limit history to last 10 turns
        role = (m.get("role") or "user").capitalize()
        content = m.get("content") or ""
        history_lines.append(f"{role}: {content}")

    payload = {
        "sparkName": spark_data.get("name"),
        "sparkContent": spark_content[:10000],
        "conversation": history_lines,
    }

    system_prompt = (
        "You are an AI workbench helping iteratively improve a Spark markdown document.\n"
        "Always respond with **only** a JSON object (no markdown fences, no extra prose) with this exact shape:\n"
        "{\n  \"reply\": \"short conversational response to the user\",\n  "
        "\"updatedSpark\": \"full updated spark markdown when you propose concrete edits, or an empty string when you are only discussing\"\n}\n\n"
        "If you suggest specific edits, include the entire updated spark document in updatedSpark. "
        "Do not include any keys other than reply and updatedSpark."
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload)},
            ],
            temperature=0.5,
            max_tokens=2000,
        )

        content = response.choices[0].message.content or ""
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        data = json.loads(content)
        reply = data.get("reply") or ""
        updated_spark = data.get("updatedSpark") or ""
        return {"reply": reply, "updatedSpark": updated_spark}
    except json.JSONDecodeError as err:
        raise RuntimeError(f"OpenAI returned invalid JSON for workbench reply: {err}")
    except Exception as err:
        raise RuntimeError(f"OpenAI API error (workbench): {err}")




@app.post("/api/workbench/message")
def workbench_message():
    """Handle a single AI workbench chat turn using OpenAI via the backend proxy."""
    payload = request.get_json(silent=True) or {}
    provider = payload.get("provider") or "openai"
    api_key = payload.get("apiKey")
    spark_content = payload.get("sparkContent") or ""
    spark_data = payload.get("sparkData") or {}
    messages = payload.get("messages") or []
    model_override = payload.get("model") or "gpt-4o-mini"

    if provider != "openai":
        return jsonify({"error": "provider must be 'openai'"}), 400
    if not spark_content:
        return jsonify({"error": "sparkContent is required"}), 400
    if not isinstance(messages, list) or not messages:
        return jsonify({"error": "messages array with at least one item is required"}), 400

    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return jsonify({"error": "OpenAI API key required. Please enter your API key in the AI Workbench."}), 400

    try:
        result = generate_workbench_reply_with_openai(
            spark_content,
            spark_data,
            messages,
            api_key,
            model=model_override,
        )
        return jsonify(result)
    except RuntimeError as err:
        return jsonify({"error": str(err)}), 502
    except Exception as err:
        return jsonify({"error": f"AI Workbench failed: {err}"}), 500


@app.get("/api/prs")
def get_prs_for_spark():
    repo_input = request.args.get("repo")
    spark_path = request.args.get("path")
    if not repo_input or not spark_path:
        return jsonify({"error": "repo and path are required"}), 400

    try:
        parsed = parse_repo_url(repo_input)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    owner = parsed["owner"]
    repo = parsed["repo"]
    cache_key = f"{owner}/{repo}:{spark_path}"

    now = int(time.time() * 1000)
    ttl_ms = get_cache_ttl_ms()
    cached = pr_cache["data"].get(cache_key)
    if cached and now - pr_cache["timestamp"] < ttl_ms:
        return jsonify({**cached, "cached": True})

    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()

    try:
        result = get_open_activity_count(owner, repo, spark_path, token)
        response = {
            "count": result["count"],
            "items": result["items"],
            "can_push": result["can_push"],
            "cached": False,
        }
        pr_cache["data"][cache_key] = response
        pr_cache["timestamp"] = now
        return jsonify(response)
    except Exception as err:
        return jsonify({"error": str(err)}), 502


@app.get("/api/contributors")
def get_contributors():
    repo_input = request.args.get("repo")
    spark_path = request.args.get("path")
    if not repo_input or not spark_path:
        return jsonify({"error": "repo and path are required"}), 400

    try:
        parsed = parse_repo_url(repo_input)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    owner = parsed["owner"]
    repo = parsed["repo"]
    headers = build_github_headers()
    
    # Filter for contributors who have raised issues/proposals related to the spark
    spark_name = spark_path.split("/")[-1].replace(".spark.md", "")
    
    # We fetch ALL issues to get historical contributors as well
    url = f"https://api.github.com/repos/{owner}/{repo}/issues?state=all&per_page=100"
    
    try:
        issues = fetch_json(url, headers)
        contributors_map = {}
        
        for issue in issues:
            # Skip actual Pull Requests to focus on proposal contributors
            if issue.get("pull_request"):
                continue
                
            title = issue.get("title", "").lower()
            body = issue.get("body", "").lower() if issue.get("body") else ""
            
            if spark_name.lower() in title or spark_name.lower() in body:
                user = issue.get("user")
                if user:
                    login = user.get("login")
                    if login not in contributors_map:
                        contributors_map[login] = {
                            "login": login,
                            "avatar_url": user.get("avatar_url"),
                            "html_url": user.get("html_url")
                        }
        
        return jsonify({"contributors": list(contributors_map.values())})
    except Exception as err:
        return jsonify({"error": str(err)}), 502


@app.post("/api/submit")
def submit_spark():
    payload = request.get_json(silent=True) or {}
    token = payload.get("token")
    repo_input = payload.get("repo")
    path = payload.get("path")
    content = payload.get("content")
    title = payload.get("title") or "Spark submission"
    body = payload.get("body") or "Submitted from Spark Assembly Lab."
    is_proposal = payload.get("isProposal", False)

    if not token or not repo_input or not path or not content:
        return jsonify({"error": "token, repo, path, and content are required"}), 400

    try:
        parsed = parse_repo_url(repo_input)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    owner = parsed["owner"]
    repo = parsed["repo"]

    try:
        if is_proposal:
            # Create GitHub Issue (Proposal)
            issue_payload = {
                "title": f"[PROPOSAL] {title}",
                "body": f"## 📝 Proposed Spark Update\n\n**File:** `{path}`\n\n### Proposed Content\n\n```markdown\n{content}\n```\n\n---\n{body}"
            }
            issue = create_github_issue(owner, repo, token, issue_payload)
            return jsonify({
                "pr_url": issue.get("html_url"),
                "is_proposal": True
            })

        # --- Pull Request Flow (for owners) ---
        # 1. Get repo and branch info
        repo_info = fetch_json_with_token(f"https://api.github.com/repos/{owner}/{repo}", token)
        base_branch = repo_info.get("default_branch", "main")
        
        # 2. Get base branch SHA
        ref_url = f"https://api.github.com/repos/{owner}/{repo}/git/refs/heads/{base_branch}"
        ref_data = fetch_json_with_token(ref_url, token)
        base_sha = ref_data.get("object", {}).get("sha")
        if not base_sha:
            return jsonify({"error": "Failed to resolve base branch"}), 502

        # 3. Create proposal branch
        proposal_branch = f"proposal/spark-{int(time.time())}"
        fetch_json_with_token(
            f"https://api.github.com/repos/{owner}/{repo}/git/refs",
            token,
            method="POST",
            payload={
                "ref": f"refs/heads/{proposal_branch}",
                "sha": base_sha
            }
        )
        
        # 4. Check if file already exists to get its SHA (for updating)
        file_sha = None
        try:
            existing = fetch_json_with_token(
                f"https://api.github.com/repos/{owner}/{repo}/contents/{urllib.parse.quote(path)}?ref={base_branch}",
                token
            )
            file_sha = existing.get("sha")
        except Exception:
            file_sha = None

        # 5. Commit to new branch
        encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
        commit_payload = {
            "message": f"Update {path}",
            "content": encoded,
            "branch": proposal_branch,
        }
        if file_sha:
            commit_payload["sha"] = file_sha

        fetch_json_with_token(
            f"https://api.github.com/repos/{owner}/{repo}/contents/{urllib.parse.quote(path)}",
            token,
            method="PUT",
            payload=commit_payload
        )
        
        # 6. Create PR from proposal branch
        pr_payload = {
            "title": title,
            "body": f"## 🚀 Spark Update\n\n{body}\n\n---\n*This PR was automatically generated by the Spark Assembly Lab.*",
            "head": proposal_branch,
            "base": base_branch
        }
        pr = fetch_json_with_token(
            f"https://api.github.com/repos/{owner}/{repo}/pulls",
            token,
            method="POST",
            payload=pr_payload
        )

        # Invalidate PR cache
        cache_key = f"{owner}/{repo}:{path}"
        if cache_key in pr_cache["data"]:
            del pr_cache["data"][cache_key]

        return jsonify({
            "pr_url": pr.get("html_url"),
            "branch": proposal_branch,
            "is_proposal": False
        })
        
    except Exception as err:
        print(f"Submission error: {err}")
        return jsonify({"error": str(err)}), 502


@app.post("/api/delete")
def delete_spark():
    """
    Request deletion of a spark by creating a PR that deletes the file.
    Only the spark owner (scout) can request deletion.
    """
    payload = request.get_json(silent=True) or {}
    token = payload.get("token")
    repo_input = payload.get("repo")
    path = payload.get("path")
    title = payload.get("title") or "Delete spark"
    body = payload.get("body") or "Requested deletion of spark from Spark Assembly Lab."

    if not token or not repo_input or not path:
        return jsonify({"error": "token, repo, and path are required"}), 400

    try:
        parsed = parse_repo_url(repo_input)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    owner = parsed["owner"]
    repo = parsed["repo"]

    try:
        repo_info = fetch_json_with_token(f"https://api.github.com/repos/{owner}/{repo}", token)
        base_branch = repo_info.get("default_branch", "main")
        ref = fetch_json_with_token(f"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{base_branch}", token)
        base_sha = ref.get("object", {}).get("sha")
        if not base_sha:
            return jsonify({"error": "Failed to resolve base branch"}), 502

        # Create deletion branch
        branch_name = f"delete-spark/{int(time.time())}"
        fetch_json_with_token(
            f"https://api.github.com/repos/{owner}/{repo}/git/refs",
            token,
            method="POST",
            payload={"ref": f"refs/heads/{branch_name}", "sha": base_sha}
        )

        # Check for existing file and get its SHA
        file_sha = None
        try:
            existing = fetch_json_with_token(
                f"https://api.github.com/repos/{owner}/{repo}/contents/{urllib.parse.quote(path)}?ref={base_branch}",
                token
            )
            file_sha = existing.get("sha")
        except Exception:
            file_sha = None

        if not file_sha:
            return jsonify({"error": "Spark file not found in repository"}), 404

        # Delete the file on the new branch
        delete_payload = {
            "message": title,
            "sha": file_sha,
            "branch": branch_name,
        }

        fetch_json_with_token(
            f"https://api.github.com/repos/{owner}/{repo}/contents/{urllib.parse.quote(path)}",
            token,
            method="DELETE",
            payload=delete_payload
        )

        # Create deletion PR
        pr = fetch_json_with_token(
            f"https://api.github.com/repos/{owner}/{repo}/pulls",
            token,
            method="POST",
            payload={"title": title, "body": body, "head": branch_name, "base": base_branch}
        )

        # Invalidate PR cache for this spark
        cache_key = f"{owner}/{repo}:{path}"
        if cache_key in pr_cache["data"]:
            del pr_cache["data"][cache_key]

        return jsonify({"pr_url": pr.get("html_url"), "branch": branch_name})
    except Exception as err:
        return jsonify({"error": str(err)}), 502


@app.get("/")
@app.get("/<path:path>")
def serve_ui(path: Optional[str] = None):
    if not DIST_PATH.exists():
        return "UI build not found. Run npm run build.", 404

    if path and (DIST_PATH / path).exists():
        return send_from_directory(DIST_PATH, path)

    return send_from_directory(DIST_PATH, "index.html")


if __name__ == "__main__":
    port = int(get_env("PORT", "8080"))
    app.run(host="0.0.0.0", port=port)
