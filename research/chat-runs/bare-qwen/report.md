# FIRST FIRE chat benchmark

Each row in the linked result file contains the entire answer, reference, evidence, grading decisions and timing.

| Group | Exact rubric pass | Content checks | Citation groups | Any target @1 | All targets @3 |
| --- | --- | --- | --- | --- | --- |
| All | 5/100 | 10/100 | 0/92 | 0/92 | 0/92 |
| Beginner | 0/20 | 1/20 | 0/20 | 0/20 | 0/20 |
| Intermediate | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |
| Advanced | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |
| Complex | 0/20 | 3/20 | 0/20 | 0/20 | 0/20 |
| Challenge | 5/20 | 6/20 | 0/12 | 0/12 | 0/12 |
| Answer | 0/62 | 1/62 | 0/62 | 0/62 | 0/62 |
| Boundary | 0/26 | 3/26 | 0/26 | 0/26 | 0/26 |
| Unanswerable | 5/12 | 6/12 | 0/4 | 0/4 | 0/4 |
| Fixed history | 0/9 | 0/9 | 0/8 | 0/8 | 0/8 |

Median response time was 211.4 ms. The nearest-rank 95th percentile was 425.3 ms. Timing includes the request, local retrieval and generation when applicable.

The strict count requires all expected content checks, no flagged contradiction, an accepted response status and every required source group with a locator. The content check uses prewritten regular expressions. Inspect the raw answers for equivalent wording, omissions and unsupported additional claims. The seven research cases are public. No human preference, global model quality or independent generalization was measured.

[All answers and decisions](results.json) · [Machine-readable summary](summary.json) · [Question-by-question CSV](scores.csv)
