# Comparing rover designs across teams

Open **Mission review**, enter an optional team, project or agency label, and select **Save current as A**. After changing the rover or loading another scenario, B shows the current design. A holds a copy of the original inputs, simulation and traverse sample. Select **Replace A with current** only when the new design should become the reference. The page keeps its baseline, label and extra source selections in memory until it is reloaded.

## Reading a comparison

The engineering table initially shows changed quantities. Select **All engineering quantities** to include matching results and shared evidence gaps. The table uses B minus A in the units shown for each row. A dash appears when either case lacks the result. The adjacent cells explain the gap. For example, switching from a sealed habitat to an open deck removes the shared atmosphere and indoor tracer results. A zero agent mass or zero solar power remains a numeric value.

**Changed inputs** lists renamed components, new part IDs and edited conditions. Source IDs identify the analogues used in the assembly. Hardware fit, bus interfaces and flight qualification still require design-specific evidence. For calculations and permitted ranges, consult the [tool reference](tool-reference.md) and [scenario schema](scenario.schema.json).

**Traverse comparison** uses the samples visible when each design was captured. It compares travelled distance, elapsed time, instantaneous speed, drive energy, base-load energy, solar generation, curtailed energy and battery charge. It also reports mode, available waypoint counts and run status. A held or replayed sample can precede route completion. Compare the course, vehicle settings, distance and elapsed time before interpreting an energy difference. The static engineering budget and the integrated traverse cover independently chosen time intervals.

## Finding and sharing evidence

The research browser covers NASA, all seventeen partners in the 2026 Space Apps roster and the additional standards, research and vendor sources in the register. Search by agency, quantity, rover, instrument or test condition. Agency and evidence-class filters can be combined. Expand an agency and a record to inspect its reported quantities, conditions, scope, limits, primary source and archived file where available. Test, specification and flight records retain their original classification. [Agency register](agency-register.md) · [Source index](sources.json)

Teams from any organization can select **Add team evidence**. Enter the source organization and title, a full HTTP or HTTPS URL, a page, table or section, the reported evidence class, the collection or test conditions, the claim those conditions support and its limitations. Use **Add quantity** for each numeric observation or specification. Keep the source’s units, including a unit such as “ratio” for dimensionless quantities. Leave the quantity list empty for a qualitative source.

**Save team evidence** adds the record to the current review. Expand the record to inspect it or use **Remove record**. The form stores references in browser memory and leaves their URLs unopened until a reader follows the link. Export before reloading the page. The JSON package carries these records in `teamEvidence`, each with a generated ID, `origin: "user-supplied"` and `verification: "unverified"`. The evidence class describes the source as entered by the team. Flight heritage and qualification require independent verification. These records do not change the simulation or the curated register.

**Include in export** adds a research record to the package even when no selected component cites it. **Export review JSON** downloads a review of the valid current case, with A if one was saved. The file contains the optional team label, machine-readable scenarios and results, available traverse input and state, B-minus-A deltas with units, changed inputs, selected part descriptions and the cited or explicitly included evidence records. An evidence ID missing from the local index is listed separately. The exported record carries source URLs, locators, limits and archive metadata. The archived source documents remain in the accompanying research folder.

Use the existing scenario export and import controls when the goal is to reopen one editable scenario. The review package preserves a comparison for another team to inspect. Sharing the downloaded file is a separate user action.

## Integration and verification

Import `mountMissionReview` from [the review module](prototype/mission-review.mjs), load [its stylesheet](prototype/mission-review.css), and supply a container plus `catalog`, `sourceIndex`, `getScenario()`, `getResult()` and optional `getTraverse()`. The mount returns `{update()}`. Call it when a scenario or displayed drive sample changes. A null result disables capture and export for the current design. A null or unavailable source index leaves the engineering comparison available.

`getTraverse()` supplies the current run or replay sample, with `state`, optional `config`, `waypoints`, `mode`, `waypointsReached` and `status`. Coordinates, telemetry and solver configuration included by the caller remain available in the downloaded snapshot. Run `node --test prototype/mission-review.test.mjs` from this directory. [Review checks](https://github.com/Haresh276/first-fire/blob/main/rover-design/prototype/mission-review.test.mjs)
