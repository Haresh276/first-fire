# Can search find the intended case?

On 18 questions written for FIRST FIRE’s six published research cases, semantic-plus-keyword search placed the intended case first **15 times**. The same keyword search with the semantic model disabled also placed it first **15 times**. Each returned the intended case somewhere in its first eight results for all 18 questions. These are software retrieval measurements on authored questions. Nobody performed a timed research task for this benchmark.

| Measure | Semantic + keyword | Keyword only |
|---|---:|---:|
| Intended case first | 15/18 | 15/18 |
| Intended case in first three | 17/18 | 17/18 |
| Intended case in eight returned results | 18/18 | 18/18 |
| Mean reciprocal rank through position eight | 0.894 | 0.878 |

## What was compared

The benchmark runs the application's own search code twice with the same 26 searchable documents: the six retrospective cases, one forecast case and 19 investigation summaries. Both variants use the same case descriptions and authored vocabulary, keyword scoring, filters and result limit. The normal path also uses the locally bundled [Model2Vec potion-base-2M weights](https://huggingface.co/minishlab/potion-base-2M). The baseline exercises the application's genuine model-unavailable fallback. Search does not index individual CSV records; those are searched through the data explorer.

One person or system with knowledge of the case library can write plausible questions using its vocabulary. Here, the questions and six intended case routes were authored with that knowledge and frozen before scoring. None was selected using its result. The queries include case names, paraphrases and indirect references, with three questions per case. The one preassigned case is the target; related investigation results receive no credit for this specific navigation task. No query or pass rule was chosen by independent users.

## All 18 scored queries

Rank 1 is the first result. A missing target in the eight returned results would contribute zero to mean reciprocal rank; a target at rank 4 contributes one quarter.

| Intended case | Frozen query | Semantic + keyword | Keyword only |
|---|---|---:|---:|
| SIBAL | Does slower spread imply a shorter flame lifetime in lunar gravity? | 1 | 1 |
| SIBAL | The cloth was still alight when the plane finished its arc. Can that run tell us when it went out? | 3 | 3 |
| SIBAL | Fabric on a spinning rocket was compared with an upright sample on Earth. Which outcome lasted longer? | 1 | 1 |
| Saffire-II | Did the darkened Nomex catch fire beside the acrylic in Saffire-II? | 1 | 1 |
| Saffire-II | A 140 second burn was reported for the assembly. Which piece provided the fuel? | 1 | 1 |
| Saffire-II | Is discoloration of a neighboring fabric enough to establish its ignition? | 1 | 1 |
| FLEX | Does the end of a visible heptane flame mean combustion has stopped? | 1 | 1 |
| FLEX | A droplet shrank after the camera went dark. What can be inferred about the chemical endpoint? | 1 | 1 |
| FLEX | Distinguish a vapor cloud with inconclusive evidence from a sustained reaction after the glow disappeared. | 1 | 1 |
| SAME | Which smoke escaped notice by the station light scattering alarm? | 1 | 1 |
| SAME | Can microscopy of particles tell us whether the installed warning instrument triggered? | 1 | 1 |
| SAME | Would a strong response to silicone rubber establish that the sensor also catches emissions from fluoropolymer insulation? | 1 | 1 |
| CFI-G | In the inverse ethane case, was 85 percent oxygen in the chamber or the burner? | 1 | 1 |
| CFI-G | Two trials fed the same oxidiser mixture through a porous sphere. Why did only one light? | 4 | 7 |
| CFI-G | Which measurements count toward a search for oxygen rich air surrounding the fuel? | 2 | 3 |
| ICES | Did all materials shift their oxygen limit the same way in short lunar-gravity tests? | 1 | 1 |
| ICES | Ground screening made conflicting errors for plastics. Which result was actually measured? | 1 | 1 |
| ICES | Can the conservative correction in table two stand in for an observed ignition boundary? | 1 | 1 |

The systems missed the same three first-rank targets. Both sent the aircraft-duration query to the FLEX droplet case. For the porous-sphere query, the semantic model moved CFI-G from seventh to fourth, while its first suggestion was Saffire-I. The word “same” in the query can also match the smoke investigation's acronym in the untyped text index. For the surrounding-air query, CFI-G moved from third to second, with SPICE first in both variants. These are leads a researcher must check. The model added no first-rank hits in this sample.

## Four queries outside the scored set

| Query | Semantic + keyword | Keyword only |
|---|---|---|
| What is the next train departure from Berlin to Paris? | No results | No results |
| At what exact oxygen concentration will my new untested spacesuit liner ignite on the Moon? | 8 references; FM² first | 8 references; FM² first |
| What is the latest flight result for every lunar fabric burn? | 8 references; FM² first | 8 references; FM² first |
| the and an | No results | No results |

The untested liner has no empirical threshold in this corpus. The FM² edition contains no verified lunar outcomes. Returning related references for these questions is compatible with the reading interface, but a returned reference cannot establish that a question is answerable. A future answer-generating interface would need a separate assessment of whether its sources support the requested claim. Two unanswered subject queries observed here are insufficient to estimate an abstention rate.

## Reproduce the check

From the full source project run:

```sh
node scripts/benchmark_search.cjs
```

The command needs Node.js 18 or later. It reads the packaged dashboard when available, otherwise the same search code and local model inputs used by the build. It prints every returned first choice, target rank, sanity-check count, aggregate and input fingerprint. No network call or external package is required.

| Fingerprint | SHA-256 |
|---|---|
| Shipped search function | `cfbb28300bc24aabb614518dd537ed4892c635969582e0775a7e116164e02040` |
| Quantized search weights and vocabulary | `ec8813a1e15898e0614de4401bb663767dc0c0dde506bb1adf44a80649c26472` |
| Cases and investigation metadata | `48cddf00e7f41773af6057565e31dd8057698cb7679aa83dda747dbf7808d5ca` |
| Frozen queries and target map | `38267023233e14226562718b30868c790f00b35b8a2e9729768588b9f02efe5b` |

The index has manually assigned case-specific terms. The questions, source figures and case explanations are public, and the six topics overlap the design work. These observations cannot establish performance on unseen investigations, measure evidence interpretation or establish a benefit for human users. The [facilitated study protocol](evaluation.md) specifies privately authored questions, masked assessors and separate time and correctness measurements.
