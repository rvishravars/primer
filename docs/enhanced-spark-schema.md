# Enhanced Spark Schema (Pure Markdown Standard)

The **Enhanced Spark** (v3.0) is a streamlined, markdown-native format for capturing, formalizing, and testing scientific sparks. It replaces the previous YAML-heavy frontmatter with a pure markdown structure where identity and context are derived directly from the content.

## 1. File Naming
- Extension: `.spark.md`
- Filename: Lowercase, hyphenated (e.g., `neural-synthesis.spark.md`)

## 2. Global Identity
The identity of a spark is derived from the first `# Heading` (H1) found in the file.
- No mandatory frontmatter.
- Optional inline flags (e.g., `marked_for_deletion: true`) may be used as hidden markers.

## 3. Core Structure (3-Section Model)

A valid Enhanced Spark must contain exactly three primary sections, separated by consistent headers and dividers.

### # 1. Spark Narrative
- **Purpose**: The qualitative, intuitive description of the spark.
- **Content**: Free-form markdown explaining the 'What' and 'Why'.
- **Requirement**: Minimum 50 characters to ensure meaningful depth.

### # 2. Hypothesis Formalization
- **Purpose**: The quantitative, logical reduction of the narrative.
- **Components**:
    - **Hypothesis Statement**: A testable, falsifiable claim.
    - **Null Hypothesis**: The condition that proves the spark wrong.

### # 3. Testing & Results
- **Purpose**: The empirical evidence or modeling outcomes.
- **Components**:
    - **Methodology**: How the hypothesis is being tested (e.g., AI Simulation, Data Replay).
    - **Outcomes**: Observed deviations, results, and evaluation metrics.

## 4. Extended Modules (Optional)

### # 9. Community Proposals
Used for collaborative editing and non-owner contributions.
- Structure: Subheadings per section (e.g., `## Proposed Changes to Section 1`).
- Used to track collaborative bonuses as per the Primer Manifesto.

## 5. Technical Validation
The Spark Assembly Lab performs a **Sanctity Check** based on this schema:
1. **First H1** found? → Extract Name.
2. **Three Sections** present? → Extract Content.
3. **Minimum Length** met? → Mark as Stable.
