# Product

## Register

product

## Users

University students, alumni, faculty, and admin at UIU (United International University), Dhaka, Bangladesh. Used daily on campus and off — checking the feed between lectures, browsing jobs during a commute, posting events from a faculty office. South Asian campus context: high mobile usage, moderate bandwidth constraints, users accustomed to WhatsApp and Facebook but actively seeking something more purposeful and institution-native.

Primary jobs to be done: stay current with campus life (feed), find opportunities (jobs, events), maintain alumni relationships, and manage institutional tasks (admin, announcements).

## Product Purpose

UniConnecT replaces the fragmented mess of WhatsApp groups, Facebook pages, and LinkedIn profiles with one verified, private network per university. It is not a general social network with a university skin — it is purpose-built for campus community: role-aware (student vs. alumni vs. faculty vs. admin), institution-scoped, and privacy-preserving by design.

Success looks like: faculty use it instead of mass emails, alumni post real opportunities instead of cold LinkedIn outreach, and students default to it over WhatsApp for campus coordination.

## Brand Personality

Focused, warm, precise.

Voice: direct without being terse, institutional without being stiff, campus-native without being loud. The product knows it's a tool; it doesn't perform personality. Warmth comes from context-awareness and good defaults, not decorative elements.

## Anti-references

- **Consumer social (Facebook/Instagram)**: No engagement-bait patterns, no newsfeed clutter, no infinite-scroll dark patterns, no algorithmic "suggested for you" noise. No blue-heavy identity.
- Do not look like a general-purpose social network with a university logo slapped on it.
- Avoid the startup-SaaS aesthetic: no SaaS-cream light mode, no Notion-style beige, no "productivity tool" vibes.

## Design Principles

1. **The tool recedes; the work surfaces.** The UI should not demand attention. Navigation is clear and forgettable — users should feel they're on campus, not using software.
2. **Role-awareness is a feature, not a badge.** Faculty, students, alumni, and admins have different contexts. Surface the right affordances for the right role rather than showing everything to everyone.
3. **Precise over decorative.** Every visual element earns its place. Ornamentation that doesn't carry information is removed. Hierarchy communicates through scale and weight, not color noise.
4. **Warm through context, not through embellishment.** The warmth comes from the product knowing who you are and what you're doing — not from rounded corners and gradient illustrations.
5. **South Asian campus-native.** Mobile-first behavior, works gracefully on mid-tier Android devices and slow connections. Not built for a San Francisco office on a MacBook.

## Accessibility & Inclusion

Target: WCAG 2.1 AA across all surfaces.

Specific considerations:
- High-contrast text ratios (4.5:1 minimum for body, 3:1 for large text)
- Full keyboard navigation with visible focus indicators
- Screen reader compatibility: proper ARIA roles, labels, and live regions for real-time updates
- Reduced motion support via `prefers-reduced-motion`
- Touch targets ≥ 44×44px on all interactive elements (mobile-first)
