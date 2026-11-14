# FIRST FIRE chat benchmark

Each row in the linked result file contains the entire answer, reference, evidence, grading decisions and timing.

| Group | Exact rubric pass | Content checks | Citation groups | Any target @1 | All targets @3 |
| --- | --- | --- | --- | --- | --- |
| All | 78/100 | 84/100 | 83/92 | 71/92 | 85/92 |
| Beginner | 20/20 | 20/20 | 20/20 | 18/20 | 20/20 |
| Intermediate | 20/20 | 20/20 | 20/20 | 18/20 | 20/20 |
| Advanced | 14/20 | 15/20 | 17/20 | 12/20 | 18/20 |
| Complex | 13/20 | 14/20 | 16/20 | 15/20 | 16/20 |
| Challenge | 11/20 | 15/20 | 10/12 | 8/12 | 11/12 |
| Answer | 56/62 | 56/62 | 61/62 | 51/62 | 61/62 |
| Boundary | 17/26 | 19/26 | 19/26 | 18/26 | 20/26 |
| Unanswerable | 5/12 | 9/12 | 3/4 | 2/4 | 4/4 |
| Fixed history | 7/9 | 7/9 | 7/8 | 6/8 | 7/8 |

Median response time was 402.0 ms. The nearest-rank 95th percentile was 842.8 ms. Timing includes the request, local retrieval and generation when applicable.

The strict count requires all expected content checks, no flagged contradiction, an accepted response status and every required source group with a locator. The content check uses prewritten regular expressions. Inspect the raw answers for equivalent wording, omissions and unsupported additional claims. The seven research cases are public. No human preference, global model quality or independent generalization was measured.

[All answers and decisions](results.json) · [Machine-readable summary](summary.json) · [Question-by-question CSV](scores.csv)
