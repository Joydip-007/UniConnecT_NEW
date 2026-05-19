---
target: full app shell
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-05-18T15-50-18Z
slug: apps-web-src-components-feedlayout-tsx
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Reconnection banner works; badge counts are solid. Banner has no aria-live role. |
| 2 | Match System / Real World | 3 | "Alerts" on mobile nav vs. "Notifications" in store/API is a label mismatch. |
| 3 | User Control and Freedom | 3 | Escape + arrow keys in dropdowns; focus trap in More sheet. No undo layer. |
| 4 | Consistency and Standards | 2 | Shuttle tracker appears in both the main nav list and campus tools section. Hardcoded Groups dot. |
| 5 | Error Prevention | 2 | External links (eLMS, CGPA) open new tabs with no leave-warning. Reconnection banner missing semantic role. |
| 6 | Recognition Rather Than Recall | 3 | Icons always paired with labels. Active state clearly indicated. |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts. No quick-compose entry in shell. Sidebar cannot be collapsed. |
| 8 | Aesthetic and Minimalist Design | 2 | 11 flat nav items with no grouping. Duplicate navigation. Right sidebar can render 4 simultaneous sections. |
| 9 | Error Recovery | 3 | Reconnection banner is the only shell error state; it works. |
| 10 | Help and Documentation | 1 | No tooltips, no help affordance. "Get verified" shows a Lock icon with no explanation. |
| **Total** | | **24/40** | **Needs work** |

### Anti-Patterns Verdict

LLM assessment: Does not look AI-generated. Token discipline is hard to fake. Deterministic scan: 0 findings.

### Overall Impression

Technically excellent, architecturally conservative. Token system and a11y groundwork are strong. The failure mode is information architecture: 11 flat nav items, duplicated Shuttle entry, overstuffed right sidebar.

### Priority Issues

[P1] 11 flat nav items with no visual grouping — cognitive load on primary navigation surface
[P1] Shuttle tracker duplicated in main nav AND campus tools, with inconsistent labels
[P2] Groups nav hardcoded hasDot: true — permanent dot misleads users
[P2] PersonRow has no follow action — missed conversion moment in "People you may know"
[P3] Reconnection banner missing role="alert" — not accessible to screen readers

### Persona Red Flags

Power User (Rakib): No keyboard shortcuts, no fast path, external links silently open new tabs.
First-Timer (Priya): "Get verified" lock icon unexplained, profile name shows "Loading…" on first render, Groups dot sends her somewhere empty.
