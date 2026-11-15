# Health Assistant and Medical Review

## Health Assistant

The Health Assistant is deterministic and runs locally. It answers:

- What changed since the latest previous record?
- How does a measurement compare with its personal history?
- What core data is missing, and what can be imported?
- What should be reviewed with the mission medical team?

It reads only the active profile's personal health records and daily self-reported check-ins. Comparisons reuse the analytics, baseline, hazard, and self-assessment services. Fewer than the required valid measurements produces a "Not enough data yet" explanation; the assistant does not extrapolate. Hazard text is educational context and does not infer a person's exposure or explain an individual result.

The assistant makes no LLM or external calls. It does not diagnose, recommend medication, or invent clinical thresholds. Guidance and escalation language are limited to existing engine output or a user-reported symptom. The screen states: "Educational information, not a diagnosis. Follow your mission medical protocols."

## Medical review request

The drawer can be opened from Mission Home, Daily Check-in, Body Explorer, or Health Assistant. The user selects a date range, local measurements and check-ins, and optional observations. Requests are stored in the `medical_review_requests` object store, scoped to a profile, with these states:

- `DRAFT`
- `PENDING_LOCAL`
- `EXPORTED`

The JSON download contains the saved request and only the explicitly selected records/check-ins. Nothing is sent to or received from a medical team. The UI states this plainly. Export is disabled in demo mode, and profile deletion/demo exit deletes associated requests.

## Body Explorer

Body Explorer is an educational 2D SVG. The head links to sleep and recovery, the chest to cardiovascular records, and the torso to blood biomarkers. Bones and muscles are labeled educational and not monitored. Hotspots have keyboard support and are duplicated in a keyboard-accessible region list. A licensed `.glb` asset is not present, so no 3D model is used.
