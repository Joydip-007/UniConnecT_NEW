---
source_file: "apps/api/src/database/migrations/044_add_mentorship_request_jobs.ts"
type: "code"
community: "Community 111"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Community_111
---

# mentorship_requests Table

## Connections
- [[Active Mentorship Request Unique Index]] - `references` [EXTRACTED]
- [[Mentorship Request Conversation and Job Columns]] - `references` [EXTRACTED]
- [[Mentorship Request Expired Status]] - `references` [EXTRACTED]
- [[Seed Mentorship Fixture]] - `references` [EXTRACTED]
- [[mentorship_sessions Table]] - `references` [EXTRACTED]
- [[profiles.max_mentees Column]] - `conceptually_related_to` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/Community_111