# Data Privacy Architecture

## Local-Only Personal Health Storage

- Each astronaut's personal health records are stored **exclusively in their own browser** using IndexedDB.
- TUMI-HEALT **does not** upload personal health records to a centralized database, external API, or GitHub repository.
- Public NASA research datasets under `data/` are development and scientific reference resources, never personal astronaut records.

## User Control & Deletion

- Users can delete individual health records (`deleteRecord`), which logs a `RECORD_DELETED` audit event prior to removal.
- Users can delete an entire local profile and all associated health records (`deleteLocalProfileData`), or wipe the entire local IndexedDB database (`deleteLocalDatabase`).

## Known Privacy & Security Limitations

- **No Automatic Encryption:** IndexedDB does not encrypt stored data automatically. Anyone with physical or OS-level access to the unlocked browser profile can inspect IndexedDB contents.
- **No Built-In Authentication:** Separating data by `astronaut_id` is a logical organization mechanism, not cryptographic isolation or user authentication.
- **No Automatic Sync:** Data is not synchronized across browsers or devices.
- **Future External Integrations:** Any future external AI or cloud feature must undergo privacy review and must never transmit personal health data without explicit user consent.
- **Audit Log Limitation:** The local IndexedDB audit log is not tamper-proof or cryptographically immutable.
