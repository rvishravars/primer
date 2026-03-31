/**
 * Parse a Spark markdown file
 * Note: Simplified parser for browser compatibility
 */
export function parseSparkFile(content) {
  console.log('🔍 Parsing spark file, content length:', content.length);

  let name = 'Untitled Spark';
  let markedForDeletion = false;

  // Extract spark name from the first H1 heading
  // Skip enhanced template section headings like '# 1. Spark Narrative'
  const lines = content.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#') && !/^#\s*\d+\./.test(line)) {
      // Extract the title part after #
      const rawTitle = line.replace(/^#\s*/, '').trim();
      if (!rawTitle) continue;

      // Strip optional emoji and brand prefixes (Spark, Template)
      const cleanTitle = rawTitle.replace(/^(?:[^\w\s\u{1F300}-\u{1F9FF}]|\s)*(?:Spark|Template|The)\s*[:\s]\s*/iu, '').trim();

      name = cleanTitle || rawTitle;
      break;
    }
  }

  // Check for deletion marker (legacy or inline)
  if (content.includes('marked_for_deletion: true')) {
    markedForDeletion = true;
  }

  console.log('📝 Spark name:', name);

  const stability = Object.values(extractGranularSections(content || ''))
    .filter(s => s && s.trim().length > 20).length;

  const result = {
    name,
    markedForDeletion,
    isEnhanced: true,
    sections: extractGranularSections(content || ''),
    contributors: {
      scout: '', // Derived from Git elsewhere
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
  '# 3. Testing & Results'
];

function extractGranularSections(content) {
  const sections = {};
  const SECTION_MAPPINGS = [
    { target: 1, regexHead: '# (?:(?:1|10)\\.\\s*)?Spark Narrative' },
    { target: 2, regexHead: '# (?:(?:2|20)\\.\\s*)?Hypothesis Formalization' },
    { target: 3, regexHead: '# (?:(?:3|30|40|50|60)\\.\\s*)?Testing & Results' },
    { target: 9, regexHead: '# (?:(?:9)\\.\\s*)?Community Proposals' }
  ];

  SECTION_MAPPINGS.forEach((mapping) => {
    const nextMappings = SECTION_MAPPINGS.slice(SECTION_MAPPINGS.indexOf(mapping) + 1);
    const nextRegexHead = nextMappings.length > 0 
      ? nextMappings.map(m => m.regexHead).join('|')
      : '$';
    
    // Create a regex that starts with the current mapping's header and looks ahead for the next mapping's header or a separator
    const regex = new RegExp(`${mapping.regexHead}\\s*\\n?([\\s\\S]*?)(?=\\n---?\\n|\\n(?:${nextRegexHead})|$)`, 'i');
    
    const match = content.match(regex);
    if (match) {
      sections[mapping.target] = match[1].trim();
    }
  });

  return sections;
}


function parseProposals(content) {
  const proposals = { 1: '', 2: '', 3: '' };
  const sectionMatch = content.match(/# (?:9\.\s*)?Community Proposals\s*\n([\s\S]*?)(?=\n---\n# Maturity Guide|$)/i);
  if (!sectionMatch) return proposals;

  const section = sectionMatch[1];
  const sectionRegex = {
    1: /## Proposed Changes to Section 1 \(Spark Narrative\)\s*\n([\s\S]*?)(?=\n---\n## Proposed Changes to Section 2|$)/,
    2: /## Proposed Changes to Section 2 \(Hypothesis Formalization\)\s*\n([\s\S]*?)(?=\n---\n## Proposed Changes to Section 3|$)/,
    3: /## Proposed Changes to Section 3 \(Testing & Results\)\s*\n([\s\S]*?)(?=\n---\n> \*\*Proposal Tracking\*\*:|$)/,
  };

  Object.entries(sectionRegex).forEach(([key, regex]) => {
    const match = section.match(regex);
    if (match) {
      proposals[key] = match[1].trim();
    }
  });

  return proposals;
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

  if (markedForDeletion) {
    markdown += `> ⚠️ **This spark is marked for deletion.** A pull request to remove this spark has been submitted. To cancel the deletion, close the associated pull request without merging.\n\n`;
    markdown += `marked_for_deletion: true\n\n`;
  }

  markdown += `# ${name}\n\n`;

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
    3: 'Testing & Results'
  };

  const hasProposals = Object.keys(proposals).some(k => proposals[k]);
  if (hasProposals) {
    markdown += `# 9. Community Proposals\n\n`;
    for (let i = 1; i <= 3; i++) {
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
