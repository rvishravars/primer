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


def get_file_commit_history(owner: str, repo: str, path: str, branch: str, headers: Dict[str, str]) -> List[Dict[str, Any]]:
    """Fetch commit history for a given file.

    Returns a list of commits (most recent first) using the GitHub commits API
    filtered by path and branch.
    """
    commits_url = (
        f"https://api.github.com/repos/{owner}/{repo}/commits"
        f"?path={urllib.parse.quote(path)}&sha={urllib.parse.quote(branch)}&per_page=50"
    )
    try:
        commits = fetch_json(commits_url, headers)
    except Exception as err:
        print(f"Failed to fetch commit history for {path}: {err}")
        return []

    if isinstance(commits, list):
        return commits
    return []


def fetch_single_spark(owner: str, repo: str, path: str, branch: str = "main") -> Dict[str, Any]:
    """Fetch a single spark file's content and basic metadata from GitHub."""
    headers = build_github_headers()

    # Prefer raw content URL when possible
    content_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
    try:
        content = fetch_text(content_url, headers)
    except Exception:
        # Fallback to contents API (auth-aware) if raw fails
        api_url = (
            f"https://api.github.com/repos/{owner}/{repo}/contents/"
            f"{urllib.parse.quote(path)}?ref={urllib.parse.quote(branch)}"
        )
        data = fetch_json(api_url, headers)
        encoded = data.get("content", "").replace("\n", "")
        if not encoded:
            raise RuntimeError(f"Failed to fetch content for {path}")
        content = base64.b64decode(encoded).decode("utf-8")

    last_commit_author = get_last_commit_author(owner, repo, path, branch, headers)

    return {
        "name": path.split("/")[-1],
        "path": path,
        "content": content,
        "lastCommit": last_commit_author,
    }


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
                    f"Repository '{owner}/{repo}' or branch '{branch}' not found, or no spark files could be discovered."
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


def estimate_tokens(text: str) -> int:
    """Very rough token estimate based on character count.

    This is used for lightweight context window accounting in the
    model gateway and orchestrator without depending on a tokenizer
    library. Roughly assumes ~4 characters per token.
    """
    if not text:
        return 0
    return max(1, len(text) // 4)


@app.post("/api/model/infer")
def model_infer():
    """Generic model gateway endpoint.

    Accepts a structured payload and returns a single model response
    string plus lightweight context accounting metadata.
    """
    if not OPENAI_AVAILABLE:
        return jsonify({"error": "OpenAI SDK not installed on backend"}), 500

    payload = request.get_json(silent=True) or {}
    provider = payload.get("provider") or "openai"
    api_key = payload.get("apiKey") or os.environ.get("OPENAI_API_KEY")
    model = payload.get("model") or "gpt-4o-mini"
    system_prompt = payload.get("system_prompt") or ""
    spark_sections = payload.get("spark_sections") or {}
    retrieved_snippets = payload.get("retrieved_snippets") or []
    conversation = payload.get("conversation") or []
    task_type = payload.get("task_type") or "generic"

    if provider != "openai":
        return jsonify({"error": "Only 'openai' provider is supported in Phase 1"}), 400

    if not api_key:
        return jsonify({"error": "OpenAI API key required"}), 400

    try:
        client = openai.OpenAI(api_key=api_key)
    except TypeError as e:
        return jsonify({
            "error": "OpenAI client initialization failed. Ensure openai>=1.30.0 is installed.",
            "details": str(e),
        }), 500

    # Assemble a compact context payload for the model
    sections_text_parts = []
    for key, value in (spark_sections or {}).items():
        if not value:
            continue
        sections_text_parts.append(f"[Section {key}]\n{value}\n")
    sections_text = "\n".join(sections_text_parts)

    snippets_text = "\n\n".join(str(s) for s in retrieved_snippets if s)

    history_lines: List[str] = []
    for m in conversation[-10:]:  # last 10 turns
        role = (m.get("role") or "user").capitalize()
        content = m.get("content") or ""
        history_lines.append(f"{role}: {content}")

    user_payload = {
      "task_type": task_type,
      "sections": sections_text[:8000],
      "retrieved": snippets_text[:4000],
      "conversation": history_lines,
    }

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": json.dumps(user_payload)})

    # Lightweight context accounting
    token_estimate = estimate_tokens(system_prompt) + estimate_tokens(sections_text) + estimate_tokens(snippets_text)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.4,
            max_tokens=2000,
        )
        content = (response.choices[0].message.content or "").strip()
    except Exception as err:
        return jsonify({"error": f"OpenAI API error (model.infer): {err}"}), 502

    return jsonify({
        "output": content,
        "model": model,
        "provider": provider,
        "task_type": task_type,
        "estimated_tokens": token_estimate,
    })


@app.get("/api/sparks")
def get_sparks():
    now = int(time.time() * 1000)
    repo_input = request.args.get("repo") or get_env("SPARK_REPO", "rvishravars/primer")
    branch = request.args.get("branch") or "main"
    # Default to searching the whole repo; 'search_path' is kept only for
    # backward compatibility but no longer defaults to 'sparks'.
    search_path = request.args.get("path") or ""

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


@app.get("/api/spark")
def get_spark():
    """Get a single spark file by path from a GitHub repository.

    This is the `getSpark(id)` operation of the SparkStore abstraction,
    where `id` is the file path within the repo.
    """
    repo_input = request.args.get("repo") or get_env("SPARK_REPO", "rvishravars/primer")
    path = request.args.get("path")
    branch = request.args.get("branch") or "main"

    if not path:
        return jsonify({"error": "path is required"}), 400

    try:
        parsed = parse_repo_url(repo_input)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    owner = parsed["owner"]
    repo = parsed["repo"]

    try:
        file_data = fetch_single_spark(owner, repo, path, branch)
        return jsonify({
            "owner": owner,
            "repo": repo,
            "branch": branch,
            "file": file_data,
        })
    except Exception as err:
        return jsonify({"error": str(err)}), 502


@app.get("/api/spark/history")
def get_spark_history():
    """Get commit history for a single spark file.

    This is the `history(id)` operation of the SparkStore abstraction.
    """
    repo_input = request.args.get("repo") or get_env("SPARK_REPO", "rvishravars/primer")
    path = request.args.get("path")
    branch = request.args.get("branch") or "main"

    if not path:
        return jsonify({"error": "path is required"}), 400

    try:
        parsed = parse_repo_url(repo_input)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    owner = parsed["owner"]
    repo = parsed["repo"]
    headers = build_github_headers_with_token(None)

    try:
        commits = get_file_commit_history(owner, repo, path, branch, headers)
        return jsonify({
            "owner": owner,
            "repo": repo,
            "branch": branch,
            "path": path,
            "commits": commits,
        })
    except Exception as err:
        return jsonify({"error": str(err)}), 502

## Legacy missions and /api/mission endpoints removed




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


@app.post("/api/rag/assemble")
def rag_assemble():
    """Minimal RAG service for Phase 1.

    For now, this endpoint performs a lightweight "assembly" step by
    echoing back a technical summary stub. In later phases this can
    call GitHub/code search and other tools.
    """
    payload = request.get_json(silent=True) or {}
    spark_content = payload.get("sparkContent") or ""
    spark_data = payload.get("sparkData") or {}
    task_type = payload.get("task_type") or "improve_spark_maturity"

    if not spark_content:
        return jsonify({"error": "sparkContent is required"}), 400

    name = (spark_data or {}).get("name") or "Unnamed Spark"

    # In Phase 1, we don't yet perform real retrieval; instead we
    # return a structured stub that downstream agents can use.
    technical_sections = {
        "3": f"Automated notes for simulation/modeling plan when running task '{task_type}' on spark '{name}'.",
        "4": f"Automated notes for evaluation strategy for spark '{name}'.",
    }

    return jsonify({
        "task_type": task_type,
        "spark_name": name,
        "technical_sections": technical_sections,
    })


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
        result = submit_spark_to_github(owner, repo, token, path, content, title, body, is_proposal)
        return jsonify(result)
    except Exception as err:
        print(f"Submission error: {err}")
        return jsonify({"error": str(err)}), 502


@app.post("/api/spark/save")
def save_spark():
    """REST wrapper for the SparkStore save operation.

    Accepts the same payload shape as /api/submit but is named to reflect
    the logical `saveSpark` operation. This can be used by future
    orchestrator/agent services while keeping the existing /api/submit
    endpoint for UI compatibility.
    """
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
        result = submit_spark_to_github(owner, repo, token, path, content, title, body, is_proposal)
        return jsonify(result)
    except Exception as err:
        print(f"Save error: {err}")
        return jsonify({"error": str(err)}), 502


def submit_spark_to_github(
    owner: str,
    repo: str,
    token: str,
    path: str,
    content: str,
    title: str,
    body: str,
    is_proposal: bool = False,
) -> Dict[str, Any]:
    """Core GitHub-backed save operation for sparks.

    This is the `saveSpark(id, content, metadata)` operation of SparkStore.
    """
    if is_proposal:
        # Create GitHub Issue (Proposal)
        issue_payload = {
            "title": f"[PROPOSAL] {title}",
            "body": (
                f"## 📝 Proposed Spark Update\n\n**File:** `{path}`\n\n"
                f"### Proposed Content\n\n```markdown\n{content}\n```\n\n---\n{body}"
            ),
        }
        issue = create_github_issue(owner, repo, token, issue_payload)
        return {
            "pr_url": issue.get("html_url"),
            "is_proposal": True,
        }

    # --- Pull Request Flow (for owners) ---
    # 1. Get repo and branch info
    repo_info = fetch_json_with_token(f"https://api.github.com/repos/{owner}/{repo}", token)
    base_branch = repo_info.get("default_branch", "main")

    # 2. Get base branch SHA
    ref_url = f"https://api.github.com/repos/{owner}/{repo}/git/refs/heads/{base_branch}"
    ref_data = fetch_json_with_token(ref_url, token)
    base_sha = ref_data.get("object", {}).get("sha")
    if not base_sha:
        raise RuntimeError("Failed to resolve base branch")

    # 3. Create proposal branch
    proposal_branch = f"proposal/spark-{int(time.time())}"
    fetch_json_with_token(
        f"https://api.github.com/repos/{owner}/{repo}/git/refs",
        token,
        method="POST",
        payload={
            "ref": f"refs/heads/{proposal_branch}",
            "sha": base_sha,
        },
    )

    # 4. Check if file already exists to get its SHA (for updating)
    file_sha = None
    try:
        existing = fetch_json_with_token(
            f"https://api.github.com/repos/{owner}/{repo}/contents/{urllib.parse.quote(path)}?ref={base_branch}",
            token,
        )
        file_sha = existing.get("sha")
    except Exception:
        file_sha = None

    # 5. Commit to new branch
    encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
    commit_payload: Dict[str, Any] = {
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
        payload=commit_payload,
    )

    # 6. Create PR from proposal branch
    pr_payload = {
        "title": title,
        "body": (
            "## 🚀 Spark Update\n\n"
            f"{body}\n\n---\n*This PR was automatically generated by the Spark Assembly Lab.*"
        ),
        "head": proposal_branch,
        "base": base_branch,
    }
    pr = fetch_json_with_token(
        f"https://api.github.com/repos/{owner}/{repo}/pulls",
        token,
        method="POST",
        payload=pr_payload,
    )

    # Invalidate PR cache
    cache_key = f"{owner}/{repo}:{path}"
    if cache_key in pr_cache["data"]:
        del pr_cache["data"][cache_key]

    return {
        "pr_url": pr.get("html_url"),
        "branch": proposal_branch,
        "is_proposal": False,
    }


@app.post("/api/agents/run")
def run_agent():
    """Agent Orchestrator entrypoint.

    Phase 2 supports multiple task types:
      - improve_spark_maturity
      - design_experiment_from_spark
      - summarize_results_for_review

    Each agent uses a shared JSON contract with the model to return
    { reply, updatedSpark }, plus lightweight context metadata.
    """
    payload = request.get_json(silent=True) or {}
    task_type = payload.get("task_type") or "improve_spark_maturity"
    provider = payload.get("provider") or "openai"
    api_key = payload.get("apiKey")
    spark_content = payload.get("sparkContent") or ""
    spark_data = payload.get("sparkData") or {}
    messages = payload.get("messages") or []
    model_override = payload.get("model") or "gpt-4o-mini"

    if provider not in ("openai", "anthropic"):
        return jsonify({"error": "Only 'openai' and 'anthropic' providers are supported for agents in this phase"}), 400
    if not spark_content:
        return jsonify({"error": "sparkContent is required"}), 400
    if not isinstance(messages, list) or not messages:
        return jsonify({"error": "messages array with at least one item is required"}), 400

    if not api_key:
        if provider == "openai":
            api_key = os.environ.get("OPENAI_API_KEY")
        elif provider == "anthropic":
            api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return jsonify({"error": f"{provider.capitalize()} API key required. Please enter your API key in the LLM Login."}), 400

    agent_definitions = {
        "improve_spark_maturity": {
            "description": "Audit and improve the spark's overall maturity and coherence across sections.",
        },
        "design_experiment_from_spark": {
            "description": "Design or refine experiments and simulations based on this spark.",
        },
        "summarize_results_for_review": {
            "description": "Summarize current results and prepare the spark for human review.",
        },
    }

    if task_type not in agent_definitions:
        return jsonify({"error": f"Unsupported task_type '{task_type}' for Phase 2 agents"}), 400

    # Minimal RAG-style technical sections stub
    name = (spark_data or {}).get("name") or "Unnamed Spark"
    technical_sections = {
        "3": f"Automated notes for simulation/modeling plan when running task '{task_type}' on spark '{name}'.",
        "4": f"Automated notes for evaluation strategy for spark '{name}'.",
    }

    # Log basic trace info for this agent run.
    app.logger.info(
        "agent_run",
        extra={
            "task_type": task_type,
            "spark_name": spark_data.get("name"),
            "model": model_override,
        },
    )

    # Build model client based on provider
    openai_client = None
    anthropic_client = None
    if provider == "openai":
        if not OPENAI_AVAILABLE:
            return jsonify({"error": "OpenAI SDK not installed"}), 500
        try:
            openai_client = openai.OpenAI(api_key=api_key)
        except TypeError as e:
            return jsonify({
                "error": "OpenAI client initialization failed. Ensure openai>=1.30.0 is installed.",
                "details": str(e),
            }), 500
    elif provider == "anthropic":
        if not ANTHROPIC_AVAILABLE:
            return jsonify({"error": "Anthropic SDK not installed"}), 500
        try:
            anthropic_client = anthropic.Anthropic(api_key=api_key)
        except Exception as e:  # noqa: BLE001
            return jsonify({
                "error": "Anthropic client initialization failed.",
                "details": str(e),
            }), 500

    # Compress recent conversation
    history_lines: List[str] = []
    for m in messages[-10:]:
        role = (m.get("role") or "user").capitalize()
        content = m.get("content") or ""
        history_lines.append(f"{role}: {content}")

    agent_desc = agent_definitions[task_type]["description"]

    system_prompt = (
        "You are an agent in Primer's Spark Assembly Lab.\n"
        f"Your current task type is: {task_type}. {agent_desc}\n"
        "Always respond with ONLY a JSON object (no markdown fences, no extra prose) "
        "with this exact shape:\n"
        "{\n  \"reply\": \"short conversational response to the user\",\n  "
        "\"updatedSpark\": \"full updated spark markdown when you propose concrete edits, or an empty string when you are only discussing\"\n}\n\n"
        "If you suggest specific edits, include the entire updated spark document in updatedSpark. "
        "Do not include any keys other than reply and updatedSpark."
    )

    user_payload = {
        "sparkName": spark_data.get("name"),
        "task_type": task_type,
        "sparkContent": spark_content[:10000],
        "technical_sections": technical_sections,
        "conversation": history_lines,
    }

    messages_for_model = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_payload)},
    ]

    token_estimate = estimate_tokens(system_prompt) + estimate_tokens(spark_content) + estimate_tokens("\n".join(technical_sections.values()))

    try:
        if provider == "openai":
            response = openai_client.chat.completions.create(
                model=model_override,
                messages=messages_for_model,
                temperature=0.5,
                max_tokens=2000,
            )
            content = response.choices[0].message.content or ""
        else:
            response = anthropic_client.messages.create(
                model=model_override,
                max_tokens=2000,
                temperature=0.5,
                system=system_prompt,
                messages=[{"role": "user", "content": json.dumps(user_payload)}],
            )
            # Anthropic returns a list of content blocks; concatenate text parts.
            content_parts = []
            for block in response.content:
                if getattr(block, "type", None) == "text":
                    content_parts.append(getattr(block, "text", ""))
                elif isinstance(block, dict) and block.get("type") == "text":
                    content_parts.append(block.get("text", ""))
            content = "".join(content_parts).strip()

        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        reply = data.get("reply") or ""
        updated_spark = data.get("updatedSpark") or ""
    except json.JSONDecodeError as err:
        return jsonify({"error": f"Agent returned invalid JSON: {err}"}), 502
    except Exception as err:  # noqa: BLE001
        return jsonify({"error": f"Agent orchestrator failed: {err}"}), 500

    return jsonify({
        "reply": reply,
        "updatedSpark": updated_spark,
        "agent": {
            "task_type": task_type,
            "technical_sections": technical_sections,
        },
        "context": {
            "estimated_tokens": token_estimate,
        },
    })


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
