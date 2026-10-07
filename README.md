# FAIRWORK 2.0

> **Your work should be your proof.**

FAIRWORK is a Work Intelligence & Trust platform designed to connect skills, evidence, companies, jobs, offers, agreements, verified work, and career growth.

## Product Vision

Traditional careers are represented mainly by CVs, certificates, and job titles.

FAIRWORK is designed around a different idea:

**A person's demonstrated ability and real work should become portable evidence.**

The platform follows this lifecycle:

DISCOVER → PROVE → AGREE → WORK → VERIFY → GROW → BETTER OPPORTUNITIES

## Core Innovation — No CV? Prove It.

People who do not have a strong CV or previous work experience should still have a way to demonstrate what they can do.

FAIRWORK provides profession-specific practical challenges.

Examples:

- Graphic designer → Create a design from a real brief
- Developer → Fix a bug or implement a feature
- Accountant → Analyze transactions
- Electrician → Identify unsafe wiring
- Teacher → Explain a concept
- Mechanic → Diagnose a vehicle problem

Challenge results become structured **Skill Evidence**.

Skill Evidence contributes to the user's:

- Work DNA
- Work Passport
- Job matching
- Career recommendations

## FAIRWORK Core Systems

### Work DNA
Evidence-based representation of a person's demonstrated abilities.

### Prove Mode
Practical challenges for users who want to prove skills instead of relying only on a CV.

### Skill Evidence
Structured evidence from challenges, work records, employer confirmations, portfolios, certifications, and other permitted sources.

### Company Intelligence
Researches permitted public information about companies and presents useful company intelligence with source tracking.

### Job Intelligence
Understands job requirements and connects them to demonstrated user skills.

### Intelligent Matching
Matches people, skills, jobs, and companies using evidence rather than keywords alone.

### Offer Intelligence
Analyzes employment offers, identifies important conditions and missing information, and helps users generate questions.

### Offer Version History
Tracks changes to important offer conditions such as salary, working hours, payment terms, and responsibilities.

### Agreement
Creates a clear record of agreed employment conditions.

### Work Records
Creates structured records of actual work performed.

### Employer Confirmation
Allows employers and workers to explicitly confirm shared work records.

### Work Passport
Portable evidence of verified skills, experience, challenges, and work history.

### Career Intelligence
Identifies skill gaps and recommends challenges, learning paths, career directions, and opportunities.

## Trust Principle

FAIRWORK must distinguish between:

- user-provided information
- AI-generated analysis
- public-source information
- employer-confirmed information
- FAIRWORK challenge evidence
- verified information

Important external facts should support:

- source
- retrieval date
- confidence
- verification status

AI must never present unsupported information as verified fact.

## Privacy and Security

FAIRWORK must use secure authentication and authorization.

Primary roles:

- Worker
- Employer
- Admin

Private user information must not become accessible to another user simply because it exists in the database.

Authorization must be enforced at the backend/database level, not only through the user interface.

## LinkedIn

FAIRWORK must NOT use unauthorized LinkedIn scraping.

Any LinkedIn functionality must use official or permission-based integration where available.

## Existing UI

The existing FAIRWORK Figma design is the visual source of truth.

Existing screens include:

1. Welcome
2. Home
3. Add Offer
4. Analyzing
5. FAIRWORK Check
6. Questions
7. Agreement
8. Work Record
9. Work Passport

### IMPORTANT UI RULE

**DO NOT REDESIGN THE EXISTING UI.**

Developers and AI coding agents must preserve the existing:

- visual identity
- layout philosophy
- typography
- colors
- spacing
- navigation style
- component appearance

New functionality should extend the existing FAIRWORK design language rather than replacing it with a generic SaaS dashboard.

## Figma

Main FAIRWORK design:

https://www.figma.com/design/5mFuLmt00uZP7Osp3ezM0z/Untitled?node-id=0-1

The Figma design should be consulted before implementing or modifying user-facing interfaces.

## Approved Architecture Baseline

[FAIRWORK-ARCH-1.0.0](docs/ARCHITECTURE_BASELINE.md) is the approved Stage 1 implementation baseline. Read the [approval record](docs/STAGE1_APPROVAL.md), [master capability manifest](docs/FAIRWORK_MASTER_SPEC.md) and [solo competition plan](docs/MVP_PLAN.md) before implementation. The lifecycle below remains the long-term vision; the competition scope is narrower and no runtime capability is implemented yet. This documentation task does not start Stage 2.

## Current Development Status

FAIRWORK began as a UI/UX prototype.

It is now being converted into a real working application.

Do not assume that a feature shown in the UI is already implemented.

In particular, do not claim that AI analysis, company research, authentication, databases, employer verification, OCR, LinkedIn integration, or other backend functionality exists until it has actually been implemented and tested.

## Development Workflow

GitHub is the project's source of truth.

AI development tools may include:

- ChatGPT
- Codex
- Claude
- Google Antigravity

Agents should inspect the existing repository and documentation before making major architectural changes.

Agents must not independently redesign the product or existing UI.

## Current Goal

Build the first real production-capable FAIRWORK application while preserving the existing design.

Target end-to-end journey:

REGISTER
→ CREATE PROFILE
→ ADD SKILLS
→ TAKE CHALLENGE
→ CREATE SKILL EVIDENCE
→ UPDATE WORK DNA
→ SEARCH COMPANY
→ VIEW COMPANY INTELLIGENCE
→ SEARCH JOB
→ RECEIVE MATCH
→ ANALYZE OFFER
→ ASK QUESTIONS
→ CREATE AGREEMENT
→ CREATE WORK RECORD
→ EMPLOYER CONFIRMS
→ UPDATE WORK PASSPORT
→ RECEIVE CAREER RECOMMENDATION

## Status

🚧 FAIRWORK 2.0 is currently under active development.
