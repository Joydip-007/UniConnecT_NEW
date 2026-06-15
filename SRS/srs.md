# SRS.md — Context File for Generating the SRS LaTeX Document
 
This file is the master context for Claude Code to generate a **Software Requirement Specifications (SRS)** document in **LaTeX**, for the **System Analysis and Design** course at UIU.
 
---
 
## CRITICAL CONSTRAINTS (READ FIRST)
 
1. **This SRS is an academic design-phase deliverable**, prepared *before* implementation. It documents a **planned Figma design**, not a built/working product.
2. **DO NOT** state, imply, or reference whether the actual software/product has been built, is in progress, or is complete. No "current status," "implementation status," or "development progress" sections.
3. **DO NOT** pull in or reference any existing codebase, source code, repo structure, deployed product, or real product screenshots — even though Claude Code is run inside the project's codebase directory. The codebase is irrelevant to this document; ignore it as a source of content.
4. **Visuals = Figma only.** Section 9 ("System Design / Wireframe") must reference **Figma screenshots/wireframes/UI sketches only** — placeholders are fine (e.g., `\includegraphics{figma_login.png}` with a caption), but no product screenshots, no app/browser screenshots, no code excerpts.
5. Tone: course-deliverable style — clear, organized, not overly technical, written as a forward-looking design specification ("the system shall," "the design includes," "the planned interface will").
---
 
## Source Material Synthesis
 
Two sources were provided:
- A course-provided structure guide (simple 11-section outline, geared toward a Figma-based UI design submission).
- A lecture deck on formal SRS theory (purpose/scope/overview, functional/non-functional/interface/performance/design-constraint requirements, characteristics of a good SRS: correctness, completeness, consistency, unambiguity, modifiability, traceability, verifiability, testability, comprehensibility, feasibility).
This SRS.md merges both: it follows the **course's required 11-section structure** (since that's the graded format) while **enriching each section's content quality** using the formal SRS concepts from the lecture (e.g., proper FR-#/NFR-# numbering, clear purpose/scope framing, performance and design-constraint considerations where relevant).
 
---
 
## Required Document Structure (for the generated LaTeX SRS)
 
### 1. Cover Page
- Project Title
- Team Member Names and Student IDs (placeholder list — to be filled in by user)
- Course Name: System Analysis and Design (UIU)
- Submission note: this is a design-phase SRS based on a Figma prototype
### 2. Introduction
- What the project is (one clear paragraph)
- Purpose of the system
- Why the project is needed (problem statement / motivation)
### 3. Project Objectives
- Bullet list of main goals/features (e.g., easy navigation, modern responsive UI, user-friendly dashboard, smooth page-to-page interaction)
### 4. Target Users
- Bullet list identifying user types relevant to this project (e.g., students, customers, admins, general users — to be tailored to the actual project topic)
### 5. Functional Requirements
- Numbered list using **FR-1, FR-2, FR-3, …** format
- Each FR is a short "The system shall…" statement
- Cover core features only: login/register, search, profile management, dashboard, navigation, notifications, content/product display, etc. (tailor to project)
### 6. Non-Functional Requirements
- Numbered list using **NFR-1, NFR-2, …** format
- Cover usability, consistency, responsiveness, performance (e.g., load time targets), accessibility — informed by the lecture's non-functional attribute categories (operational, performance, security where relevant, but keep at course-appropriate simplicity)
### 7. Pages / Modules
- Bullet/numbered list of all pages or modules in the Figma design (e.g., Login Page, Home Page, Dashboard, Settings Page, Product/Content Page, Admin Panel — tailor to project)
### 8. Tools and Technologies
- List of **design tools only** (e.g., Figma, Canva, Adobe XD, icon packs/plugins used)
- Do NOT list backend/programming tech stacks — this section is about the design process tools, per course scope
### 9. System Design / Wireframe
- **Figma-only visuals.** Insert placeholder `\includegraphics` blocks with captions for:
  - UI sketches / wireframes (one per major page/module)
  - Workflow / navigation flow diagram
  - Simple architecture or page-connection diagram
- Add a note instructing the user to replace placeholder image filenames with actual exported Figma screenshots
- Explicitly state in a short intro sentence: "All visuals in this section are taken from the Figma design prototype."
### 10. Usability / Design Considerations
- Short paragraphs/bullets covering:
  - Navigation flow
  - Responsiveness across devices
  - Color consistency / design system
  - Accessibility considerations
  - Key user-friendly design decisions
### 11. Conclusion
- Short summary paragraph: recap of the project idea, design goals, and expected outcome of the design (not the product)
---
 
## LaTeX Generation Notes for Claude Code
 
- Use a clean academic article/report class (e.g., `article` or `report`), single column, standard margins.
- Use numbered sections matching 1–11 above; do not add extra sections beyond what's listed.
- For FR/NFR lists, use a consistent format, e.g.:
```latex
  \textbf{FR-1:} The system shall allow users to register and log in.
```
- For Section 9, use `figure` environments with `\includegraphics[width=...]{placeholder.png}` and descriptive captions; leave filenames as clear placeholders (e.g., `figma_dashboard_wireframe.png`).
- Cover page: use `\title`, `\author` (list all team members + IDs as a multi-line author block), `\date`, and the course name.
- Keep the document concise — this is meant to be a clean, readable, printable SRS, not an exhaustive technical spec.
- Do not generate any content describing implementation status, code, tech stack beyond design tools, or the actual running software.
---
 
## Placeholders the User Must Fill In Before Final Submission
 
- [ ] Project Title
- [ ] Team member names and IDs
- [ ] Project description (Section 2)
- [ ] Objectives, target users, FR/NFR lists tailored to the specific project topic
- [ ] Pages/Modules list matching the actual Figma file
- [ ] Exported Figma screenshots/diagrams for Section 9
- [ ] Tools/plugins actually used in the design