const fs = require('fs');
const path = require('path');

/**
 * Parses unified diff text into an array of file diff objects with hunk details.
 */
function parseUnifiedDiff(diffText, findings = []) {
  const fileDiffs = [];
  if (!diffText) return fileDiffs;

  const lines = diffText.split('\n');
  let currentFile = null;
  let currentHunk = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git ')) {
      currentFile = null;
      currentHunk = null;
    } else if (line.startsWith('+++ b/')) {
      let filePath = line.substring(6).trim();
      // Ensure path is relative to repository root
      if (!filePath.startsWith('services/') && findings && findings.length > 0) {
        const matchingFinding = findings.find(f => (f.file_path || '').endsWith('/' + filePath) || (f.file_path || '') === filePath);
        if (matchingFinding && matchingFinding.file_path) {
          filePath = matchingFinding.file_path;
        }
      }
      currentFile = { path: filePath, hunks: [] };
      fileDiffs.push(currentFile);
    } else if (line.startsWith('@@ ') && currentFile) {
      // e.g. @@ -42,3 +42,5 @@
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        currentHunk = {
          oldStart: parseInt(match[1], 10),
          oldCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
          newStart: parseInt(match[3], 10),
          newCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
          lines: []
        };
        currentFile.hunks.push(currentHunk);
      }
    } else if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }

  return fileDiffs;
}

module.exports = async ({ github, context, core }) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const pull_number = context.payload.pull_request ? context.payload.pull_request.number : null;

  if (!pull_number) {
    core.warning('No pull_request context found. Skipping PR comments.');
    return;
  }

  const reviewDataPath = path.resolve('reports/review_data.json');
  let reviewData = { findings: [], totalScanned: 0 };
  if (fs.existsSync(reviewDataPath)) {
    try {
      reviewData = JSON.parse(fs.readFileSync(reviewDataPath, 'utf8'));
    } catch (e) {
      core.warning(`Failed to parse review_data.json: ${e.message}`);
    }
  }

  const rawFindings = reviewData.findings || [];

  // Deduplicate findings by (file_path + title) as an additional safety layer
  const seenKeys = new Set();
  const findings = [];
  for (const f of rawFindings) {
    const normPath = (f.file_path || f.file || '').replace(/^.*(services\/.*)$/, '$1');
    const normTitle = (f.title || f.type || '').trim().toLowerCase();
    const key = `${normPath}::${normTitle}`;
    if (!seenKeys.has(key) && normTitle) {
      seenKeys.add(key);
      findings.push({ ...f, file_path: normPath });
    }
  }

  // =========================================================================
  // COMMENT 1: Detailed Findings Review in PR Discussion
  // =========================================================================
  let detailedCommentBody = '';

  if (findings.length === 0) {
    detailedCommentBody = `## 🛡️ CodeMender Security Review

✅ **No security vulnerabilities detected** in the modified files for this Pull Request!
* All scanned services and files passed static analysis and security checks.
`;
  } else {
    detailedCommentBody = `## 🛡️ CodeMender Security Review: Findings Analysis

CodeMender scanned the services modified in this Pull Request and evaluated potential security remediations.

### 📋 Detected Vulnerabilities Summary

| Finding ID | Title / Vulnerability | File | Severity | Remediation (\`cm fix\`) |
| :--- | :--- | :--- | :--- | :--- |
`;

    for (const f of findings) {
      const fid = f.id || f.finding_id || 'N/A';
      const title = (f.title || 'Security Flaw').replace(/\|/g, '/');
      const filePath = f.file_path || f.file || 'unknown';
      const severity = f.severity || 'UNKNOWN';
      const fixStatus = f.fix_status || 'SKIPPED';

      detailedCommentBody += `| \`${fid}\` | ${title} | \`${filePath}\` | **${severity}** | ${fixStatus} |\n`;
    }

    detailedCommentBody += `
---

### 🔍 Technical Details & Impact
`;

    for (const f of findings) {
      const fid = f.id || f.finding_id;
      const title = f.title || 'Security Flaw';
      const desc = f.description || f.hypothesis || 'Potential security issue identified by CodeMender AI auditor.';
      const filePath = f.file_path || f.file || '';

      detailedCommentBody += `
<details>
<summary><b>${title}</b> (<code>${fid}</code>) - <i>${filePath}</i></summary>

> **Severity:** ${f.severity || 'UNKNOWN'}  
> **Remediation Status:** ${f.fix_status || 'N/A'}  
> **Description:** ${desc}

</details>
`;
    }

    detailedCommentBody += `
---
> [!TIP]
> Check the **Files changed** tab for inline fix suggestions. You can review and apply the recommended patches with a single click.
`;
  }

  core.info('Posting Comment 1: Detailed Findings Review...');
  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: pull_number,
    body: detailedCommentBody
  });

  // If no findings or no fixes, stop here
  if (findings.length === 0) {
    return;
  }

  // =========================================================================
  // COMMENT 2: Inline Fix Suggestions (GitHub Review API)
  // =========================================================================
  const patchPath = path.resolve('reports/codemender-changes.patch');
  let patchText = '';
  if (fs.existsSync(patchPath)) {
    patchText = fs.readFileSync(patchPath, 'utf8');
  }

  if (!patchText.trim()) {
    core.info('No code patches generated. Skipping inline suggestions.');
    return;
  }

  const fileDiffs = parseUnifiedDiff(patchText, findings);
  const inlineComments = [];

  for (const fileDiff of fileDiffs) {
    for (const hunk of fileDiff.hunks) {
      // Find replacement lines (lines starting with '+' or ' ')
      const replacementLines = [];
      for (const line of hunk.lines) {
        if (line.startsWith('+')) {
          replacementLines.push(line.substring(1));
        } else if (line.startsWith(' ')) {
          replacementLines.push(line.substring(1));
        }
      }

      // Target line on the new file is newStart + newCount - 1 (or newStart)
      const targetLine = hunk.newStart > 0 ? (hunk.newStart + Math.max(hunk.newCount - 1, 0)) : 1;
      const suggestionCode = replacementLines.join('\n');

      const body = `### 🛡️ CodeMender Fix Suggestion
The automated AI security auditor generated the following remediation patch for this code block:

\`\`\`suggestion
${suggestionCode}
\`\`\`
*(Review and click **Apply suggestion** to incorporate this fix into your branch)*`;

      inlineComments.push({
        path: fileDiff.path,
        line: targetLine,
        side: 'RIGHT',
        body: body
      });
    }
  }

  // Retrieve the latest commit SHA of the PR
  let commit_id;
  try {
    const commits = await github.rest.pulls.listCommits({
      owner,
      repo,
      pull_number
    });
    commit_id = commits.data[commits.data.length - 1].sha;
  } catch (err) {
    core.warning(`Could not determine latest commit_id: ${err.message}`);
  }

  if (inlineComments.length > 0 && commit_id) {
    core.info(`Attempting to submit review with ${inlineComments.length} inline suggestion(s)...`);
    try {
      await github.rest.pulls.createReview({
        owner,
        repo,
        pull_number,
        commit_id,
        event: 'COMMENT',
        body: '### 🛡️ CodeMender Code Review: Inline Suggestions\n\nPlease review the inline remediation suggestions proposed below based on the vulnerability analysis.',
        comments: inlineComments
      });
      core.info('Successfully submitted inline suggestions review!');
      return;
    } catch (apiErr) {
      core.warning(`Failed to create review with inline comments (hunks may be outside PR diff range): ${apiErr.message}`);
    }
  }

  // Fallback: If inline comments fail (e.g. hunk outside diff), post suggestions as a review body comment
  core.info('Posting suggestions in a fallback summary review...');
  let fallbackBody = `### 🛡️ CodeMender Remediation Suggestions (Patch Summary)

CodeMender synthesized remediation patches for the detected vulnerabilities:

\`\`\`diff
${patchText.length > 30000 ? patchText.substring(0, 30000) + '\n\n... (diff truncated)' : patchText}
\`\`\`
`;

  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: pull_number,
    body: fallbackBody
  });
};
