# Shared memory artifact template

Use this shape only for curated `project-shared` memory. Do not use it for raw
chat logs, secrets, or personal memory.

```yaml
title: ""
type: decision # decision | discovery | pattern | preference | risk | glossary | rollout-note
scope: project-shared
source: "" # session summary | curated note | PRD | docs review | runtime memory
provenance:
  author_or_runtime: ""
  date: "YYYY-MM-DD"
  source_ref: ""
sensitivity: public-in-repo # public-in-repo | restricted | do-not-share
status: draft # draft | validated | superseded | active
topic_key: ""
content: |
  What:
  Why:
  Where:
  Learned:
```

Rules:

- Keep content normalized and durable.
- Preserve provenance when importing between runtimes.
- Never promote `do-not-share` content into repository-shared memory.
