FIRST FIRE FM2 forecast v1 — deposit files
Team Code Blooded, 14 November 2026

fm2-v1.json contains the four fixed predictions, assumptions, scoring rule
and handling of missing or invalid outcomes. Preserve the exact file bytes.
fm2-v1.tsr is the RFC 3161 timestamp response signed by DigiCert at
2026-11-14 12:57:06 UTC. It identifies when this byte sequence already existed.
It does not identify the depositor or demonstrate predictive accuracy.

SHA-256 of fm2-v1.json
9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3

Example verification command using a system trust bundle
openssl ts -verify -data fm2-v1.json -in fm2-v1.tsr -CAfile /etc/ssl/cert.pem

Suggested repository title
FIRST FIRE FM2 lunar fabric forecast v1: four pre-outcome probabilities
Creator: Team Code Blooded
Record type: Dataset
Description: Four model probabilities for sustained spread after nominal
ignition on Synergy Pro Navy at 8.2 psia. The file includes point scenarios
for flame travel, NASA's qualitative expectations and the scoring protocol.
Experimental design: https://ntrs.nasa.gov/citations/20260001966
Team forecast: https://first-fire-lunar-lab.christsamuel26.chatgpt.site/#forecast

This edition has no DOI. To deposit, the team can upload the JSON and TSR as
separate files to a repository under its account, complete the repository's
required metadata, and add the assigned DOI to the project. Keep this version
intact when later outcomes or revised forecasts are released.

Separate conditional PMMA forecast
pmma-v1.json records a prospective FIRST FIRE prediction for a proposed
independent replication with thin acrylic in opposed microgravity flow.
Its SHA-256 is 79f0c1a253004730e9449a0a8e9b78c1f6b6fcb8bbec3d5184c253f55eea86ec.
The DigiCert RFC 3161 receipt is dated 2026-11-15 05:18:00 UTC.
openssl ts -verify -data pmma-v1.json -in pmma-v1.tsr -CAfile /etc/ssl/cert.pem
A future independent laboratory must preregister the named trials
before data collection. The four outcomes remain pending.
