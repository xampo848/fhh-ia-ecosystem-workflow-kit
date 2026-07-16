# Capability registry

This registry maps external or optional AI capabilities to neutral attach points.
It keeps concrete tools swappable so `.agents/instructions.md` can stay generic.

## Selection rules

1. Start from the capability class needed by the task, not from a vendor name.
2. Check whether the preferred capability is installed/available in the active runtime.
3. Check whether it is attached to the neutral workflow.
4. Use it only when its activation rules fit the current task.
5. Fall back to the next available capability or normal concise behavior.

## Capability inventory

| Capability class | Preferred capability | Manifest | Status | Runtime posture | Fallback |
| --- | --- | --- | --- | --- | --- |
| Token-saving communication/helper | `caveman` | `.agents/capabilities/manifests/caveman.md` | optional / attachable | Use as default token-saving posture only when installed/available and attached | normal concise prose + compact internal handoffs |

## Implementation capability inventory

| Capability | Class | Manifest | Status | Runtime posture | Fallback |
| --- | --- | --- | --- | --- | --- |
| `context7` | runtime capability already available | `.agents/capabilities/manifests/context7.md` | optional / attachable | Use for current docs lookup during implementation when runtime exposes it and task fit is clear | official docs already loaded locally or explicit stop/fallback |
| `engram` | runtime capability already available | `.agents/capabilities/manifests/engram.md` | optional / attachable | Use for durable implementation memory when runtime exposes it and memory protocol applies | local session context only |
| `impeccable` | repo-owned capability / frontend craft overlay | `.agents/capabilities/manifests/impeccable.md` | optional / attachable | Use for premium visible UI craft/QA when explicitly invoked in implementation | frontend-design + design-system guidance |
| `caveman` | token-saving communication/helper | `.agents/capabilities/manifests/caveman.md` | optional / attachable | Use when compression preserves correctness and clarity | normal concise prose |
| `cavecrew` | repo-owned capability / compressed helper delegation | `.agents/capabilities/manifests/cavecrew.md` | optional / attachable | Use for narrow locate/edit/review helper tasks | normal delegate flow or inline execution |
| `skills-sh` | installable external skill-pack source/policy | `.agents/capabilities/manifests/skills-sh.md` | optional / installable / attachable | Use as a governed source for external skills only after explicit install/attach steps succeed | repo-owned skills and current attached capabilities only |

## Add or replace a capability

To replace `caveman` or add another token-saving tool:

1. Add a manifest under `.agents/capabilities/manifests/<capability>.md`.
2. Update the preferred capability row above, or add priority/order notes.
3. Keep `.agents/instructions.md` generic.
4. Update runtime wrappers only to point back to this registry or to runtime-specific availability metadata.
5. Validate install/attach separately through `.agents/integrations/README.md`.
