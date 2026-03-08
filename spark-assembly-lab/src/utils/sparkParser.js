/**
 * Parse a Spark markdown file
 * Note: Simplified parser for browser compatibility
 */
export function parseSparkFile(content) {
  console.log('🔍 Parsing spark file, content length:', content.length);

  let enhancedContributors = { scout: '' };

  // Extract spark name - support multiple formats
  let name = 'Untitled Spark';
  let markedForDeletion = false;

  // Try YAML frontmatter first
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1];
    // Try `name:` first, then `title:` (used by enhanced sparks)
    const nameFieldMatch = yaml.match(/^name:\s*(.+)$/m);
    const titleFieldMatch = yaml.match(/^title:\s*(.+)$/m);
    if (nameFieldMatch) {
      name = nameFieldMatch[1].trim().replace(/^["']|["']$/g, '');
    } else if (titleFieldMatch) {
      name = titleFieldMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    // Check for deletion flag
    const deletionFlagMatch = yaml.match(/^marked_for_deletion:\s*(true|yes)$/mi);
    if (deletionFlagMatch) {
      markedForDeletion = true;
    }
  }

  // If no name found in frontmatter, fall back to the first H1 heading
  // but skip enhanced template section headings like '# 1. Spark Narrative'
  if (name === 'Untitled Spark') {
    const lines = content.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('#') && !/^#\s*\d+\./.test(line)) {
        // Extract the title part after #
        const rawTitle = line.replace(/^#\s*/, '').trim();
        if (!rawTitle) continue;

        // Strip optional emoji and brand prefixes (Spark, Template)
        // This regex handles: 🧩 Spark: My Name, Spark: My Name, # My Name, etc.
        const cleanTitle = rawTitle.replace(/^(?:[^\w\s\u{1F300}-\u{1F9FF}]|\s)*(?:Spark|Template|The)\s*[:\s]\s*/iu, '').trim();

        name = cleanTitle || rawTitle;
        break;
      }
    }
  }

  console.log('📝 Spark name:', name);

  const stability = Object.values(extractGranularSections(content || ''))
    .filter(s => s && s.trim().length > 20).length;

  const result = {
    name,
    markedForDeletion,
    frontmatter: {},
    isEnhanced: true, // All sprouts are now considered enhanced
    sections: extractGranularSections(content || ''),
    contributors: {
      scout: enhancedContributors.scout || '',
    },
    stability,
    proposals: parseProposals(content),
  };
  console.log('✅ Parsed result:', result);
  return result;
}

const ENHANCED_SECTION_HEADERS = [
  '# 1. Spark Narrative',
  '# 2. Hypothesis Formalization',
  '# 3. Simulation / Modeling Plan',
  '# 4. Evaluation Strategy',
  '# 5. Feedback & Critique',
  '# 6. Results (When Available)',
  '# 7. Revision Notes',
  '# 8. Next Actions'
];

function extractGranularSections(content) {
  const sections = {};
  ENHANCED_SECTION_HEADERS.forEach((header, index) => {
    const nextHeader = ENHANCED_SECTION_HEADERS[index + 1];
    const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedNextHeader = nextHeader ? nextHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '$';
    const regex = new RegExp(`${escapedHeader}\\s*\\n?([\\s\\S]*?)(?=\\n---?\\n|\\n${escapedNextHeader}|${escapedNextHeader}|$)`, 'i');
    const match = content.match(regex);
    if (match) {
      sections[index + 1] = match[1].trim();
    }
  });
  return sections;
}


function parseProposals(content) {
  const proposals = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' };
  const sectionMatch = content.match(/# 9\. Community Proposals\s*\n([\s\S]*?)(?=\n---\n# Maturity Guide|$)/);
  if (!sectionMatch) return proposals;

  const section = sectionMatch[1];
  const sectionRegex = {
    1: /## Proposed Changes to Section 1 \(Spark Narrative\)\s*\n([\s\S]*?)(?=\n---\n## Proposed Changes to Section 2|$)/,
    2: /## Proposed Changes to Section 2 \(Hypothesis Formalization\)\s*\n([\s\S]*?)(?=\n---\n## Proposed Changes to Section 3|$)/,
    3: /## Proposed Changes to Section 3 \(Simulation \/ Modeling Plan\)\s*\n([\s\S]*?)(?=\n---\n## Proposed Changes to Section 4|$)/,
    4: /## Proposed Changes to Section 4 \(Evaluation Strategy\)\s*\n([\s\S]*?)(?=\n---\n## Proposed Changes to Section 5|$)/,
    5: /## Proposed Changes to Section 5 \(Feedback & Critique\)\s*\n([\s\S]*?)(?=\n---\n## Proposed Changes to Section 6|$)/,
    6: /## Proposed Changes to Section 6 \(Results\)\s*\n([\s\S]*?)(?=\n---\n## Proposed Changes to Section 7|$)/,
    7: /## Proposed Changes to Section 7 \(Revision Notes\)\s*\n([\s\S]*?)(?=\n---\n## Proposed Changes to Section 8|$)/,
    8: /## Proposed Changes to Section 8 \(Next Actions\)\s*\n([\s\S]*?)(?=\n---\n> \*\*Proposal Tracking\*\*:|$)/,
  };

  Object.entries(sectionRegex).forEach(([key, regex]) => {
    const match = section.match(regex);
    if (match) {
      proposals[key] = match[1].trim();
    }
  });

  return proposals;
}

export function buildMissionSummary(parsedSpark) {
  // Enhanced spark validation (8 sections)
  const sections = parsedSpark?.sections || {};

  // Helper to check if section has meaningful content (not just comments or placeholders)
  const hasMeaningfulContent = (content) => {
    if (!content) return false;
    const cleaned = content
      .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
      .replace(/^#+\s+.*$/gm, '') // Remove headers
      .replace(/^-\s+.*$/gm, '') // Remove list items
      .trim();
    return cleaned && cleaned.length > 20;
  };

  const checks = {
    section_1_complete: hasMeaningfulContent(sections[1]), // Spark Narrative
    section_2_complete: hasMeaningfulContent(sections[2]), // Hypothesis Formalization
    section_3_or_4_complete:
      hasMeaningfulContent(sections[3]) ||
      hasMeaningfulContent(sections[4]) // Simulation or Evaluation
  };

  const stableCount = Object.values(checks).filter(Boolean).length;
  let status = 'RED';
  if (stableCount === 3) {
    status = 'GREEN';
  } else if (stableCount >= 2) {
    status = 'YELLOW';
  }

  const criticalFlaws = [];
  if (!checks.section_1_complete) {
    criticalFlaws.push('Section 1 (Spark Narrative) is missing or needs more detail');
  }
  if (!checks.section_2_complete) {
    criticalFlaws.push('Section 2 (Hypothesis Formalization) is missing or needs more detail');
  }
  if (!checks.section_3_or_4_complete) {
    criticalFlaws.push('Section 3 (Simulation) or Section 4 (Evaluation) needed');
  }

  const recommendation = status === 'GREEN'
    ? 'Final Lock'
    : status === 'YELLOW'
      ? 'Request Refinement'
      : 'Reject';

  const scribeReport = status === 'GREEN'
    ? `✅ Fully stable across core sections.`
    : status === 'YELLOW'
      ? `⚠️ Core sections need refinement before merge.`
      : `❌ Unstable. Critical sections are missing or incomplete.`;

  const meritPlan = [];
  if (parsedSpark?.contributors?.scout) {
    meritPlan.push({
      handle: `@${parsedSpark.contributors.scout}`,
      role: 'Owner',
      reward: '+5 CS',
    });
  }

  return {
    status,
    critical_flaws: criticalFlaws,
    recommendation,
    scribe_report: scribeReport,
    merit_plan: meritPlan,
  };
}

export function validateSparkData(sparkData) {
  const errors = [];
  const name = (sparkData?.name || '').trim();

  // --- Common checks ---
  if (!name || name === 'New Spark') {
    errors.push('Please give your spark a descriptive name');
  }

  const sections = sparkData.sections || {};
  const narrativeContent = (sections[1] || '').trim();

  if (!narrativeContent || narrativeContent.length < 50) {
    errors.push('Section 1 (Spark Narrative) must have meaningful content — minimum 50 characters');
  }

  const activeSections = sparkData.activeSections || [1];
  for (const sectionNum of activeSections) {
    const content = (sections[sectionNum] || '').trim();
    if (!content || content.length < 10) {
      errors.push(`Section ${sectionNum} is active but has no content — fill it in or remove it`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate markdown from spark data
 */
export function generateSparkMarkdown(sparkData) {
  const { name, markedForDeletion = false } = sparkData;
  let markdown = '';

  // Add YAML frontmatter with deletion flag
  if (markedForDeletion) {
    markdown += `---\ntitle: "${name}"\nstatus: deletion_pending\nmarked_for_deletion: true\n---\n\n`;
    markdown += `> ⚠️ **This spark is marked for deletion.** A pull request to remove this spark has been submitted. To cancel the deletion, close the associated pull request without merging.\n\n`;
  } else if (sparkData.rawContent && sparkData.rawContent.includes('spark_type:')) {
    // If we have raw content (e.g. from template), preserve it but update title
    markdown = sparkData.rawContent.replace(/^title:\s*".*?"/m, `title: "${name}"`);
    return markdown;
  }

  markdown = `# ${name}\n\n`;

  const sections = sparkData.sections || {};
  ENHANCED_SECTION_HEADERS.forEach((header, index) => {
    const sectionNum = index + 1;
    if (sections[sectionNum]) {
      markdown += `${header}\n${sections[sectionNum]}\n\n---\n\n`;
    }
  });

  // Community Proposals (Section-level contributions from non-owners)
  const proposals = sparkData.proposals || {};
  const sectionNames = {
    1: 'Spark Narrative',
    2: 'Hypothesis Formalization',
    3: 'Simulation / Modeling Plan',
    4: 'Evaluation Strategy',
    5: 'Feedback & Critique',
    6: 'Results',
    7: 'Revision Notes',
    8: 'Next Actions'
  };

  const hasProposals = Object.keys(proposals).some(k => proposals[k]);
  if (hasProposals) {
    markdown += `# 9. Community Proposals\n\n`;
    for (let i = 1; i <= 8; i++) {
      if (proposals[i]) {
        markdown += `## Proposed Changes to Section ${i} (${sectionNames[i]})\n`;
        markdown += `${proposals[i].trim()}\n\n`;
        markdown += `---\n\n`;
      }
    }
    markdown += `> **Proposal Tracking**: Each proposal is tracked with contributor attribution for Echo Bonus (+5 CS) and Validation Bonus (+10 CS) rewards per the Manifesto.\n\n`;
    markdown += `---\n\n`;
  }

  return markdown;
}
