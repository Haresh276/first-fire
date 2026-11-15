# Update the archive and resolve the FM² forecast

Run these commands from the FIRST FIRE repository. Each intake writes a new directory. Keep its integrity receipt alongside the version you review.

## Stage a NASA PSI release

```sh
python3 scripts/intake.py census
python3 scripts/intake.py psi PSI-98 /tmp/first-fire-saffire
python3 scripts/intake.py verify /tmp/first-fire-saffire
```

Replace `PSI-98` with the published accession when NASA releases LUCI or FM². For a subsequent release, pass `--base /tmp/first-fire-saffire/raw`. To replay saved downloads, pass `--mirror DIR --retrieved YYYY-MM-DD`, with the publisher’s unmodified `PSI-N.json` and `PSI-N-I.csv` files in that directory. The receipt labels a supplied mirror separately from a live download. [NASA PSI Saffire-I record](https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-98)

The stage retains the publisher response, released DOI, study and table versions, download URLs, file digests and both census snapshots. Every nonblank CSV record has a source locator and cell-content digest in `incoming-rows.csv`. A quoted multiline cell counts as one logical record. The staged normalizer reuses approved mappings when the accession, table, ordered headers, platform and hardware match the pinned release. New or changed schemas remain in the source index for a researcher to map, check units and confirm gravity before adoption. A publication with no public CSV creates a metadata-only stage. Inspect `stage.json`, `normalized-preview.csv` and `unmapped_tables` before adding records to the dashboard.

The archived census contains **1,999 source records in 20 tables from 19 investigations**. The challenge subset contains 1,622 in 16 tables from 15 investigations. A fresh download of Saffire-I version 4 reproduced all four source records and the two mapped burns. Both censuses had SHA-256 `e3612c42a54c3a88ff381a34764ef0d4ce1d02f8823d5ae4ccf30b3d1af354d0`.

## Resolve a published FM² burn

```sh
python3 scripts/intake.py fm2 /tmp/first-fire-pending
python3 scripts/intake.py verify /tmp/first-fire-pending
python3 scripts/intake.py fm2 /tmp/first-fire-release --packet adjudication.json
python3 scripts/intake.py verify /tmp/first-fire-release
```

The first command verifies the original forecast and its RFC 3161 timestamp against the system CA bundle. Use `--ca PATH` for a different trusted bundle. With no submitted results it records **four pending, zero scored**. A complete four-burn mean needs four resolved burns. [Timestamped forecast](../site/forecast-lock/fm2-v1.json) · [NASA experiment design](https://ntrs.nasa.gov/citations/20260001966)

An adjudication packet is JSON with `forecast_sha256`, `publications` and `burns`. Use the original forecast SHA-256 `9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3`. Submit a cumulative packet to a new directory for every update.

| Record | Fields and requirements |
| --- | --- |
| Publication | Supply `id`, `title`, direct NASA HTTPS `url`, `role` of `flight_results`, `published_utc`, source-byte `sha256` and `format` of `pdf`, `csv` or UTF-8 `text`. Use the release date, or a timezone-qualified timestamp for a release on the day of the lock. PDF extraction requires `pypdf`. |
| Burn | Supply integer `burn` 1–4, `planned_o2_pct`, official `test_id`, `publication_id`, `basis`, `reviewer`, `rationale`, outcome `quote` and `locator`. Add `conditions_evidence` containing its own `quote` and `locator`. The test ID must appear in an attributed passage. Locators have one key, either `page`, `row` or `line`, counting from one. CSV cells are joined with ` | ` for quoting. |
| Actual conditions | In `actual` record `material`, `gravity`, `gas` and `orientation` using the signed design’s strings, plus `pressure_psia`, `length_cm`, `chamber_litres` and measured `starting_o2_pct`. Mark `nominal_initial_conditions` true only when the source supports it. For a measured start differing from the target, include the source’s `published_o2_tolerance_pp`. For a void, record the available conditions and reason. |
| Classification | Use `sustained_beyond_igniter` for yes. Use `nominal_no_ignition` or `no_sustained_spread_after_power` for no. Void reasons are `insufficient_telemetry`, `changed_material_or_geometry`, `invalid_initial_conditions`, `hardware_fault`, `abort` and `ambiguous_classification`. Omitted burns remain pending. Optional `measured_travel_cm` is attributable sustained sample travel. |

The intake downloads the publication, checks its checksum and quoted passages, and preserves the source bytes with the researcher’s interpretation. The reviewer must verify that NASA reports an actual flight outcome and supports the stated conditions. Both Brier scores use the same resolved burns and full-precision locked probabilities. Length errors are predicted minus measured in centimetres. Offline verification repeats quote extraction, scoring and timestamp checks. A receipt digest detects a changed stage when compared with an independently retained copy.
