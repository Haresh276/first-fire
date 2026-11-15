window.FFRoverScorecard = {
  "title": "FIRST FIRE and ChatGPT",
  "date": "15 November 2026",
  "summary": "Both systems earned all 18 science points and all 6 workflow points on this source packet. Try the real rover replay below, then inspect the exact answers and the fixed scoring key.",
  "arms": {
    "firstfire": {
      "name": "FIRST FIRE",
      "detail": "An operator used the public judging lab and cabin physics tool. Each task began in a fresh browser context; the tools produced the numerical readouts, exports and replay verdicts."
    },
    "chatgpt": {
      "name": "ChatGPT",
      "detail": "ChatGPT web, GPT-6 selected, Medium thinking. One first response to all eight tasks in a temporary, unpersonalized chat. No follow-up or answer correction."
    }
  },
  "sources": [
    {
      "id": "PSI",
      "title": "NASA PSI-98 · run conditions and IDs",
      "url": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98"
    },
    {
      "id": "NTRS",
      "title": "NASA Saffire-I flight report · rate plot, slide 21",
      "url": "https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21"
    },
    {
      "id": "NBS",
      "title": "NBS Technical Note 1128 · Table 1",
      "url": "https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf"
    },
    {
      "id": "MODEL",
      "title": "Shared team assumptions and formulas",
      "url": "rover-scorecard-files/shared-prompt.txt"
    }
  ],
  "protocol": [
    "The questions, common source extract, model assumptions and 24 binary criteria were fixed before ChatGPT answered. Each criterion earned zero or one point. The same observations and equations were available to both arms.",
    "The FIRST FIRE operator configured the instruments from the questions. ChatGPT received the entire written packet verbatim and could use calculations or code. Native exports and ordinary JSON were both accepted.",
    "The first 18 criteria assess numbers, interpretation and limits. Six assess an actual JSON record and two genuine plus one altered-distance replay. Both files were parsed and the returned validator was executed.",
    "Tool readouts and individual artifact fields appear on the FIRST FIRE side. Display equations and tables on the ChatGPT side are reformatted for legibility. The original browser transcript, answer code and run logs are available below."
  ],
  "limits": [
    "One team-designed, unblinded pilot on the Saffire-I rover scenario. The equations, measured rates, and assumptions were supplied. The tie describes these eight tasks.",
    "Different interaction styles: a human-directed instrument versus one prompted assistant. This comparison did not measure time savings, human error rates, usability or superiority on unseen science questions.",
    "The extra source-locator replay is a live product demonstration after grading. ChatGPT was asked to validate the distance only. Neither system received extra points for that demonstration."
  ],
  "tasks": [
    {
      "id": "Q1",
      "title": "Two flight rates at 37 seconds",
      "prompt": "At 37 s compare S1 as baseline and S2 as current: give both modeled front distances and the signed current-minus-baseline difference.",
      "category": "science",
      "sources": [
        "PSI",
        "NTRS"
      ],
      "criteria": [
        {
          "label": "6.66 cm baseline",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "6.66 cm",
            "chatgpt": "The S1 baseline cell reads 6.66 cm."
          }
        },
        {
          "label": "4.81 cm current",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "4.81 cm",
            "chatgpt": "The S2 current cell reads 4.81 cm."
          }
        },
        {
          "label": "-1.85 cm signed difference",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "-1.85 cm",
            "chatgpt": "It subtracts baseline from current and reports −1.85 cm."
          }
        }
      ],
      "answers": {
        "firstfire": "Instrument readouts and extracted fields from the original run:\n\n6.66 cm\n\n4.81 cm\n\n-1.85 cm",
        "chatgpt": "Quantity | S1 baseline | S2 current\nAirflow direction | Concurrent | Opposed\nObserved orbital front rate | 1.8 mm/s | 1.3 mm/s\nModeled front distance | 6.66 cm | 4.81 cm\n\nSigned difference (current − baseline):\n\n4.81 − 6.66 = −1.85 cm\n\nThe opposed-flow model predicts 1.85 cm less travel after 37 s."
      },
      "links": [
        {
          "url": "rover-scorecard-files/Q1-response.json",
          "label": "Full FIRST FIRE action log and screen text"
        },
        {
          "url": "rover-scorecard-files/Q1-comparison.json",
          "label": "Native file · Q1-comparison.json"
        }
      ]
    },
    {
      "id": "Q2",
      "title": "Can the flight tests isolate airflow direction?",
      "prompt": "Did reversing the airflow cause the difference seen in the two flight tests? Identify the design limitation, suggest a fair next experiment, and identify the NASA source and locator for the front rates versus the run settings.",
      "category": "science",
      "sources": [
        "PSI",
        "NTRS"
      ],
      "criteria": [
        {
          "label": "same specimen used sequentially; direction effect not isolated",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "Test fresh matched specimens in both flow directions and counterbalance the order. The Saffire-I directions were tested in sequence on one specimen. Discriminating test. Repeat both directions on fresh, matched specimens and counterbalance run order. Hold oxygen, pressure, geometry and airflow magnitude fixed. Compare calibrated front position over time and record remaining fuel. This separates a direction effect from possible prior heating or changes to the shared specimen.",
            "chatgpt": "Identifies sequential reuse, specimen condition and order as confounders."
          }
        },
        {
          "label": "fresh matched samples with counterbalanced or randomized order",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "Test fresh matched specimens in both flow directions and counterbalance the order. The Saffire-I directions were tested in sequence on one specimen.",
            "chatgpt": "Specifies fresh identical specimens, comparable conditions, randomized order and replication."
          }
        },
        {
          "label": "separates PSI table settings from rate in NTRS 20170008805 slide 21",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "Original CSV row 3 · SIBAL fabric · 20 cm/s air · about 21.5% O₂ · 70 s | Slide 21 and Table I on PDF page 29 · 1.3 mm/s in microgravity",
            "chatgpt": "Identifies NTRS slide 21 for rates and the PSI table plus its two row IDs for run settings."
          }
        }
      ],
      "answers": {
        "firstfire": "Instrument readouts and extracted fields from the original run:\n\nTest fresh matched specimens in both flow directions and counterbalance the order. The Saffire-I directions were tested in sequence on one specimen. Discriminating test. Repeat both directions on fresh, matched specimens and counterbalance run order. Hold oxygen, pressure, geometry and airflow magnitude fixed. Compare calibrated front position over time and record remaining fuel. This separates a direction effect from possible prior heating or changes to the shared specimen.\n\nTest fresh matched specimens in both flow directions and counterbalance the order. The Saffire-I directions were tested in sequence on one specimen.\n\nOriginal CSV row 3 · SIBAL fabric · 20 cm/s air · about 21.5% O₂ · 70 s | Slide 21 and Table I on PDF page 29 · 1.3 mm/s in microgravity",
        "chatgpt": "No causal conclusion is justified. Airflow direction changed, but S2 burned the specimen remaining after S1. The sequential design confounds direction with specimen condition and test order.\n\nA fair next experiment would use fresh, identical specimens, comparable atmospheric and airflow conditions, randomized direction order across independent trials, and repeated measurements.\n\nNASA source locators:\n\nFront rates: S2, NASA NTRS 20170008805, slide 21 — concurrent 1.8 mm/s; opposed 1.3 mm/s.\n\nRun settings: S1, NASA PSI-98 experimental table v1, records PSI-98:1:2 and PSI-98:1:3.\n\nThe CSV provides experimental settings, not measured front rates."
      },
      "links": [
        {
          "url": "rover-scorecard-files/Q2-response.json",
          "label": "Full FIRST FIRE action log and screen text"
        },
        {
          "url": "rover-scorecard-files/Q2-comparison.json",
          "label": "Native file · Q2-comparison.json"
        }
      ]
    },
    {
      "id": "Q3",
      "title": "Replace the NASA rate",
      "prompt": "Override the published rate with a user-entered 2.0 mm/s and evaluate at 40 s. What is the modeled distance, whose rate is it, and can this run qualify the material for a rover?",
      "category": "science",
      "sources": [
        "NTRS",
        "MODEL"
      ],
      "criteria": [
        {
          "label": "8 cm",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "positionCm = 8",
            "chatgpt": "Reports 8.0 cm simulated at 40 s."
          }
        },
        {
          "label": "manual/user-imposed rate rather than NASA attribution",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "The judge supplied the front speed. The cabin model uses that assumption to calculate the result.",
            "chatgpt": "Labels 2.0 mm/s a user-entered override."
          }
        },
        {
          "label": "no rover material qualification from this calculation",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "The imposed front speed is a user assumption. Ignition, sustained spread and flight qualification need separate measurements.",
            "chatgpt": "Explicitly withholds rover material certification."
          }
        }
      ],
      "answers": {
        "firstfire": "Instrument readouts and extracted fields from the original run:\n\npositionCm = 8\n\nThe judge supplied the front speed. The cabin model uses that assumption to calculate the result.\n\nThe imposed front speed is a user assumption. Ignition, sustained spread and flight qualification need separate measurements.",
        "chatgpt": "d = 2.0 × 40 / 10 = 8.0 cm\n\nRate: 2.0 mm/s, user-entered override, not a NASA observation.\n\nDistance: 8.0 cm, simulated.\n\nRover qualification: No. This modeled run cannot certify ignition resistance, flammability, or material safety. No rover qualification data is supplied."
      },
      "links": [
        {
          "url": "rover-scorecard-files/Q3-response.json",
          "label": "Full FIRST FIRE action log and screen text"
        },
        {
          "url": "rover-scorecard-files/Q3-comparison.json",
          "label": "Native file · Q3-comparison.json"
        }
      ]
    },
    {
      "id": "Q4",
      "title": "A polyethylene coupon at 50 seconds",
      "prompt": "Change only the material to polyethylene at 50 s with the concurrent rate. What mass has been consumed, what net chemical energy has been released by then, and what is the full coupon's net chemical potential?",
      "category": "science",
      "sources": [
        "NTRS",
        "NBS",
        "MODEL"
      ],
      "criteria": [
        {
          "label": "2.25 g consumed",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "2.25 g",
            "chatgpt": "Calculates 2.25 g from the uniform coupon."
          }
        },
        {
          "label": "97.65 kJ released by 50 s",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "97.65 kJ",
            "chatgpt": "Multiplies by the reference heat and gives 97.65 kJ."
          }
        },
        {
          "label": "434 kJ full coupon",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "434 kJ",
            "chatgpt": "Calculates 434 kJ for the whole 10 g coupon."
          }
        }
      ],
      "answers": {
        "firstfire": "Instrument readouts and extracted fields from the original run:\n\n2.25 g\n\n97.65 kJ\n\n434 kJ",
        "chatgpt": "Using the observed concurrent rate of 1.8 mm/s and the assumed 10 g, 40 cm coupon:\n\nd = 1.8 × 50 / 10 = 9.0 cm\n\nm = 10 g × 9 / 40 = 2.25 g\n\nE = 0.00225 kg × 43.4 MJ/kg = 97.65 kJ\n\nFull coupon net chemical potential:\n\nE_full = 0.010 kg × 43.4 MJ/kg = 434 kJ\n\nThese are simulated mass consumption and reference-based chemical energies, not measured flight-part properties."
      },
      "links": [
        {
          "url": "rover-scorecard-files/Q4-response.json",
          "label": "Full FIRST FIRE action log and screen text"
        },
        {
          "url": "rover-scorecard-files/Q4-physics.json",
          "label": "Native file · Q4-physics.json"
        },
        {
          "url": "rover-scorecard-files/Q4-comparison.json",
          "label": "Native file · Q4-comparison.json"
        }
      ]
    },
    {
      "id": "Q5",
      "title": "When the cabin model must withhold a value",
      "prompt": "First open the crew deck. Then, in a separate run, seal the cabin and select a material of unknown composition. Can you report respectively a sealed-cabin final O2 fraction and a fuel energy? Name a mechanical quantity the rover can still compute in both runs.",
      "category": "science",
      "sources": [
        "MODEL"
      ],
      "criteria": [
        {
          "label": "sealed final O2 withheld for open deck",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "open-cabin | oxygenPct = null",
            "chatgpt": "Withholds closed-cabin oxygen for the open deck."
          }
        },
        {
          "label": "fuel energy withheld for unknown material",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "unknown-material | chemicalKJ = null | couponKJ = null",
            "chatgpt": "Withholds energy for an unknown composition and heat of combustion."
          }
        },
        {
          "label": "static support load still available in both runs",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "open deck support 2689.20 N | unknown material support 2689.20 N",
            "chatgpt": "Names static support force and explains that both cases retain it."
          }
        }
      ],
      "answers": {
        "firstfire": "Instrument readouts and extracted fields from the original run:\n\nopen-cabin | oxygenPct = null\n\nunknown-material | chemicalKJ = null | couponKJ = null\n\nopen deck support 2689.20 N | unknown material support 2689.20 N",
        "chatgpt": "Separate run | Requested result | Can it be reported?\nOpen crew deck | Sealed-cabin final O2 fraction | No. The closed-volume assumption is invalid.\nSealed cabin, unknown material | Fuel chemical energy | No. Composition and reference heat are unknown.\n\nBoth runs can still calculate the static support force on the Moon:\n\nF = 1660 × 1.62 = 2689.2 N\n\nThis mechanical result does not require fuel composition or a sealed cabin."
      },
      "links": [
        {
          "url": "rover-scorecard-files/Q5-response.json",
          "label": "Full FIRST FIRE action log and screen text"
        },
        {
          "url": "rover-scorecard-files/Q5-open.json",
          "label": "Native file · Q5-open.json"
        },
        {
          "url": "rover-scorecard-files/Q5-unknown.json",
          "label": "Native file · Q5-unknown.json"
        }
      ]
    },
    {
      "id": "Q6",
      "title": "Switch the rover from Moon to Mars",
      "prompt": "At 50 s change only the surface from Moon to Mars. Give both static support forces and both front distances. Explain what determines the change or invariance of the front.",
      "category": "science",
      "sources": [
        "MODEL",
        "NTRS"
      ],
      "criteria": [
        {
          "label": "2689.2 N Moon and 6158.6 N Mars",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "2689.2 N; 6158.6 N",
            "chatgpt": "Reports 2,689.2 N and 6,158.6 N."
          }
        },
        {
          "label": "9 cm on both surfaces",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "9 cm; 9 cm",
            "chatgpt": "Reports 9.0 cm on both surfaces."
          }
        },
        {
          "label": "prescribed front rate independent of gravity",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "Surface gravity changes chassis weight and the displayed buoyant velocity scale. Real flame propagation also depends on flow, material and gravity. The chamber balance uses the front speed you enter. The Mars setting has lower confidence for transferring a surface-fire interpretation. Neither setting has experimental calibration here.",
            "chatgpt": "Explains that rate and elapsed time determine travel in this model."
          }
        }
      ],
      "answers": {
        "firstfire": "Instrument readouts and extracted fields from the original run:\n\n2689.2 N; 6158.6 N\n\n9 cm; 9 cm\n\nSurface gravity changes chassis weight and the displayed buoyant velocity scale. Real flame propagation also depends on flow, material and gravity. The chamber balance uses the front speed you enter. The Mars setting has lower confidence for transferring a surface-fire interpretation. Neither setting has experimental calibration here.",
        "chatgpt": "Quantity | Moon | Mars\nLocal gravitational acceleration | 1.62 m/s² | 3.71 m/s²\nSimulated static support force | 2,689.2 N | 6,158.6 N\nModeled concurrent front distance | 9.0 cm | 9.0 cm\n\nSupport-force difference:\n\n6158.6 − 2689.2 = 3469.4 N\n\nThe static support force increases because local gravity increases.\n\nThe modeled front distance remains unchanged because the stipulated rate law depends only on rate and elapsed time, not gravity. This is a property of the teaching model, not evidence that real combustion behaves identically on the Moon and Mars."
      },
      "links": [
        {
          "url": "rover-scorecard-files/Q6-response.json",
          "label": "Full FIRST FIRE action log and screen text"
        },
        {
          "url": "rover-scorecard-files/Q6-comparison.json",
          "label": "Native file · Q6-comparison.json"
        }
      ]
    },
    {
      "id": "W1",
      "title": "Export a reusable comparison",
      "prompt": "Return a reusable machine-readable record for Q1. Include the two NASA row IDs and rates/directions, the common trial time and rate/distance units, both distances and the signed difference. Native JSON downloads and inline JSON are both admissible.",
      "category": "workflow",
      "sources": [
        "PSI",
        "NTRS",
        "MODEL"
      ],
      "criteria": [
        {
          "label": "parseable JSON identifies both source row IDs alongside correct rates and directions",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "[('PSI-98:1:2', 1.8, 'concurrent'), ('PSI-98:1:3', 1.3, 'opposed')]",
            "chatgpt": "Parsed both NASA IDs, speeds and directions from the returned JSON."
          }
        },
        {
          "label": "time 37 s and rate/distance units recoverable",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "37 s; imposedRate.speedMmS; units.positionCm = cm",
            "chatgpt": "Parsed 37 s, mm/s and cm from the returned JSON."
          }
        },
        {
          "label": "two distances and signed delta recoverable with correct values",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "6.66, 4.81, -1.85 cm",
            "chatgpt": "Parsed 6.66 cm, 4.81 cm and −1.85 cm in the defined order."
          }
        }
      ],
      "answers": {
        "firstfire": "{\n  \"schema\": \"first-fire.coupled-trial.v1\",\n  \"created\": \"2026-11-15T04:52:39.947Z\",\n  \"state\": {\n    \"baseline\": {\n      \"material\": \"cellulose\",\n      \"flow\": \"concurrent\",\n      \"cabin\": \"sealed\",\n      \"oxygen\": 30,\n      \"world\": \"Moon\",\n      \"time\": 37,\n      \"volume\": 16,\n      \"speedMmS\": null,\n      \"couponMassG\": 10\n    },\n    \"current\": {\n      \"material\": \"cellulose\",\n      \"flow\": \"opposed\",\n      \"cabin\": \"sealed\",\n      \"oxygen\": 30,\n      \"world\": \"Moon\",\n      \"time\": 37,\n      \"volume\": 16,\n      \"speedMmS\": null,\n      \"couponMassG\": 10\n    },\n    \"level\": \"beginner\",\n    \"display\": \"auto\",\n    \"question\": \"Return a reusable machine-readable record for Q1. Include the two NASA row IDs and rates/directions, the common trial time and rate/distance units, both distances and the signed difference. Native JSON downloads and inline JSON are both admissible.\",\n    \"intentOverride\": \"auto\",\n    \"edits\": [\n      {\n        \"at\": \"2026-11-15T04:52:39.852Z\",\n        \"field\": \"time\",\n        \"from\": 50,\n        \"to\": 49\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.858Z\",\n        \"field\": \"time\",\n        \"from\": 49,\n        \"to\": 48\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.862Z\",\n        \"field\": \"time\",\n        \"from\": 48,\n        \"to\": 47\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.867Z\",\n        \"field\": \"time\",\n        \"from\": 47,\n        \"to\": 46\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.870Z\",\n        \"field\": \"time\",\n        \"from\": 46,\n        \"to\": 45\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.874Z\",\n        \"field\": \"time\",\n        \"from\": 45,\n        \"to\": 44\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.877Z\",\n        \"field\": \"time\",\n        \"from\": 44,\n        \"to\": 43\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.880Z\",\n        \"field\": \"time\",\n        \"from\": 43,\n        \"to\": 42\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.884Z\",\n        \"field\": \"time\",\n        \"from\": 42,\n        \"to\": 41\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.887Z\",\n        \"field\": \"time\",\n        \"from\": 41,\n        \"to\": 40\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.890Z\",\n        \"field\": \"time\",\n        \"from\": 40,\n        \"to\": 39\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.893Z\",\n        \"field\": \"time\",\n        \"from\": 39,\n        \"to\": 38\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.897Z\",\n        \"field\": \"time\",\n        \"from\": 38,\n        \"to\": 37\n      },\n      {\n        \"at\": \"2026-11-15T04:52:39.930Z\",\n        \"field\": \"flow\",\n        \"from\": \"concurrent\",\n        \"to\": \"opposed\"\n      }\n    ],\n    \"baselineFrozen\": true\n  },\n  \"units\": {\n    \"positionCm\": \"cm\",\n    \"chemicalKJ\": \"kJ\",\n    \"couponKJ\": \"kJ\",\n    \"oxygenPct\": \"%\",\n    \"initialO2KPa\": \"kPa\",\n    \"supportN\": \"N\"\n  },\n  \"baseline\": {\n    \"settings\": {\n      \"material\": \"cellulose\",\n      \"flow\": \"concurrent\",\n      \"cabin\": \"sealed\",\n      \"oxygen\": 30,\n      \"world\": \"Moon\",\n      \"time\": 37,\n      \"volume\": 16,\n      \"speedMmS\": null,\n      \"couponMassG\": 10\n    },\n    \"physicallyModeledInputs\": {\n      \"planet\": \"Moon\",\n      \"fuel\": \"cellulose\",\n      \"volume\": 16,\n      \"pressure\": 70,\n      \"oxygen\": 30,\n      \"cutoff\": 18,\n      \"length\": 40,\n      \"density\": 0.25,\n      \"speed\": 0.18,\n      \"chassisMass\": 800,\n      \"capacity\": 0,\n      \"power\": 0\n    },\n    \"status\": \"modeled\",\n    \"modelState\": \"Prescribed spread\",\n    \"metrics\": {\n      \"positionCm\": 6.66,\n      \"chemicalKJ\": 25.308,\n      \"couponKJ\": 152,\n      \"oxygenPct\": 29.982849751654282,\n      \"supportN\": 2689.2000000000003,\n      \"initialO2KPa\": 21\n    },\n    \"sources\": [\n      {\n        \"id\": \"PSI-98:1:2\",\n        \"title\": \"Saffire-I S1 · concurrent flow\",\n        \"url\": \"https://doi.org/10.60555/0t15-1z43\",\n        \"locator\": \"Original CSV row 2 · SIBAL fabric · 20 cm/s air · 21.5–21.7% O₂ · 420 s\",\n        \"boundary\": \"S2 used the material remaining after S1. The CSV records the conditions of each burn.\",\n        \"localUrl\": \"data/raw/PSI-98-experimental.csv\",\n        \"atlasUrl\": \"index.html#atlas?record=PSI-98%3A1%3A2\"\n      },\n      {\n        \"id\": \"flow-measurement\",\n        \"title\": \"Large-scale spacecraft fire safety experiments, SIBAL results\",\n        \"url\": \"https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21\",\n        \"locator\": \"Slide 21 and Table I on PDF page 29 · 1.8 mm/s in microgravity\",\n        \"boundary\": \"The reported front speed supplies a prescribed input to this trial.\"\n      },\n      {\n        \"id\": \"NBS-TN-1128:table-1\",\n        \"title\": \"NBS Technical Note 1128 · fuel chemistry\",\n        \"url\": \"https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf\",\n        \"locator\": \"Table 1 · Cellulose · net heat 15.2 MJ/kg\",\n        \"boundary\": \"The energy calculation uses a reference fuel composition. Testing would establish the properties of a particular rover material.\"\n      },\n      {\n        \"id\": \"moon-env\",\n        \"title\": \"Moon Facts\",\n        \"url\": \"https://science.nasa.gov/moon/facts/\",\n        \"locator\": \"Structure, surface and atmosphere sections, including sunlit/dark temperatures\",\n        \"boundary\": \"Surface temperature does not determine radiator sink temperature or cabin gas temperature.\"\n      }\n    ],\n    \"imposedRate\": {\n      \"kind\": \"orbital-analogue\",\n      \"speedMmS\": 1.8,\n      \"sourceRow\": \"PSI-98:1:2\",\n      \"observedDurationS\": 420\n    },\n    \"boundary\": \"The orbital study used cotton–fiberglass. Applying its rate to a different material, atmosphere or gravity is an assumption. Ignition, sustained spread and flight qualification need separate measurements.\",\n    \"roverModelSHA256\": \"d2a9b0d206fa419d15242d489aa3cb6716cb24283461124f0c6f8be75e0cd8e2\"\n  },\n  \"current\": {\n    \"settings\": {\n      \"material\": \"cellulose\",\n      \"flow\": \"opposed\",\n      \"cabin\": \"sealed\",\n      \"oxygen\": 30,\n      \"world\": \"Moon\",\n      \"time\": 37,\n      \"volume\": 16,\n      \"speedMmS\": null,\n      \"couponMassG\": 10\n    },\n    \"physicallyModeledInputs\": {\n      \"planet\": \"Moon\",\n      \"fuel\": \"cellulose\",\n      \"volume\": 16,\n      \"pressure\": 70,\n      \"oxygen\": 30,\n      \"cutoff\": 18,\n      \"length\": 40,\n      \"density\": 0.25,\n      \"speed\": 0.13,\n      \"chassisMass\": 800,\n      \"capacity\": 0,\n      \"power\": 0\n    },\n    \"status\": \"modeled\",\n    \"modelState\": \"Prescribed spread\",\n    \"metrics\": {\n      \"positionCm\": 4.8100000000000005,\n      \"chemicalKJ\": 18.278000000000002,\n      \"couponKJ\": 152,\n      \"oxygenPct\": 29.987613316130492,\n      \"supportN\": 2689.2000000000003,\n      \"initialO2KPa\": 21\n    },\n    \"sources\": [\n      {\n        \"id\": \"PSI-98:1:3\",\n        \"title\": \"Saffire-I S2 · opposed flow\",\n        \"url\": \"https://doi.org/10.60555/0t15-1z43\",\n        \"locator\": \"Original CSV row 3 · SIBAL fabric · 20 cm/s air · about 21.5% O₂ · 70 s\",\n        \"boundary\": \"S2 used the material remaining after S1. The CSV records the conditions of each burn.\",\n        \"localUrl\": \"data/raw/PSI-98-experimental.csv\",\n        \"atlasUrl\": \"index.html#atlas?record=PSI-98%3A1%3A3\"\n      },\n      {\n        \"id\": \"flow-measurement\",\n        \"title\": \"Large-scale spacecraft fire safety experiments, SIBAL results\",\n        \"url\": \"https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21\",\n        \"locator\": \"Slide 21 and Table I on PDF page 29 · 1.3 mm/s in microgravity\",\n        \"boundary\": \"The reported front speed supplies a prescribed input to this trial.\"\n      },\n      {\n        \"id\": \"NBS-TN-1128:table-1\",\n        \"title\": \"NBS Technical Note 1128 · fuel chemistry\",\n        \"url\": \"https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf\",\n        \"locator\": \"Table 1 · Cellulose · net heat 15.2 MJ/kg\",\n        \"boundary\": \"The energy calculation uses a reference fuel composition. Testing would establish the properties of a particular rover material.\"\n      },\n      {\n        \"id\": \"moon-env\",\n        \"title\": \"Moon Facts\",\n        \"url\": \"https://science.nasa.gov/moon/facts/\",\n        \"locator\": \"Structure, surface and atmosphere sections, including sunlit/dark temperatures\",\n        \"boundary\": \"Surface temperature does not determine radiator sink temperature or cabin gas temperature.\"\n      }\n    ],\n    \"imposedRate\": {\n      \"kind\": \"orbital-analogue\",\n      \"speedMmS\": 1.3,\n      \"sourceRow\": \"PSI-98:1:3\",\n      \"observedDurationS\": 70\n    },\n    \"boundary\": \"The orbital study used cotton–fiberglass. Applying its rate to a different material, atmosphere or gravity is an assumption. Ignition, sustained spread and flight qualification need separate measurements.\",\n    \"roverModelSHA256\": \"d2a9b0d206fa419d15242d489aa3cb6716cb24283461124f0c6f8be75e0cd8e2\"\n  },\n  \"deltas\": {\n    \"positionCm\": -1.8499999999999996,\n    \"chemicalKJ\": -7.029999999999998,\n    \"couponKJ\": 0,\n    \"oxygenPct\": 0.004763564476210291,\n    \"supportN\": 0,\n    \"initialO2KPa\": 0\n  },\n  \"changed\": [\n    \"flow\"\n  ],\n  \"nextMeasurement\": \"Test fresh matched specimens in both flow directions and counterbalance the order. The Saffire-I directions were tested in sequence on one specimen.\",\n  \"effectiveDeviceMode\": \"standard\",\n  \"decisionTrace\": [\n    {\n      \"id\": \"user\",\n      \"label\": \"Reader\",\n      \"observed\": \"beginner\",\n      \"response\": \"Compare how far the front travels and how much oxygen is left. The cabin calculation starts with the speed you give it.\"\n    },\n    {\n      \"id\": \"intent\",\n      \"label\": \"Question\",\n      \"observed\": \"Detected intent · Evidence needed\",\n      \"response\": \"No supported instrument answers this question as written. Identify a measurable quantity and an applicable experiment.\"\n    },\n    {\n      \"id\": \"state\",\n      \"label\": \"Experiment state\",\n      \"observed\": \"Current trial at 37 s · baseline available\",\n      \"response\": \"Only airflow direction differs from baseline A. Inspect the result, then record the comparison.\"\n    },\n    {\n      \"id\": \"device\",\n      \"label\": \"Device\",\n      \"observed\": \"standard · The measured memory, graphics and storage signals do not together qualify for automatic Pro.\",\n      \"response\": \"Show the time series.\"\n    },\n    {\n      \"id\": \"evidence\",\n      \"label\": \"Evidence\",\n      \"observed\": \"PSI-98:1:3\",\n      \"response\": \"Saffire-I S2 supplies the 1.3 mm/s orbital rate. Rover travel and cabin oxygen are calculated for the selected conditions.\"\n    }\n  ]\n}",
        "chatgpt": "{\n  \"schema\": \"rover-fire-q1-v1\",\n  \"source_settings\": \"NASA PSI-98 experimental table v1\",\n  \"source_rates\": \"NASA NTRS 20170008805, slide 21\",\n  \"time_s\": 37,\n  \"rate_unit\": \"mm/s\",\n  \"distance_unit\": \"cm\",\n  \"baseline\": {\n    \"row_id\": \"PSI-98:1:2\",\n    \"test\": \"S1\",\n    \"direction\": \"concurrent\",\n    \"rate_mm_s\": 1.8,\n    \"distance_cm\": 6.66\n  },\n  \"current\": {\n    \"row_id\": \"PSI-98:1:3\",\n    \"test\": \"S2\",\n    \"direction\": \"opposed\",\n    \"rate_mm_s\": 1.3,\n    \"distance_cm\": 4.81\n  },\n  \"difference\": {\n    \"definition\": \"current_minus_baseline\",\n    \"signed_distance_cm\": -1.85\n  },\n  \"distance_type\": \"modeled\",\n  \"rate_type\": \"observed_orbital\"\n}"
      },
      "links": [
        {
          "url": "rover-scorecard-files/W1-response.json",
          "label": "Full FIRST FIRE action log and screen text"
        },
        {
          "url": "rover-scorecard-files/W1-comparison.json",
          "label": "Native file · W1-comparison.json"
        },
        {
          "url": "rover-scorecard-files/returned-record.json",
          "label": "Original ChatGPT JSON"
        }
      ]
    },
    {
      "id": "W2",
      "title": "Catch a changed distance",
      "prompt": "Provide a reusable check that accepts a fresh consistent record and rejects one whose reported front distance has been altered. For plain JavaScript use function valid(rateMmS,timeS,travelCm) returning a boolean (finite nonnegative inputs, no strip-end clipping within this test, tolerance 0.000001 cm). A native validator that replays and checks the corresponding full trial files is equally acceptable. We will test two genuine records and one altered distance. A description alone is insufficient.",
      "category": "workflow",
      "sources": [
        "MODEL"
      ],
      "criteria": [
        {
          "label": "valid(2,17,3.4) accepted",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "2 mm/s, 17 s, 3.4 cm. Replay verified. Both trials, their differences, model fingerprint and source records match.",
            "chatgpt": "The returned function executed and returned true."
          }
        },
        {
          "label": "valid(2,17,3.8) rejected",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "2 mm/s, 17 s, 3.8 cm. File not applied. Recorded inputs, results or source records differ from this rerun. The current experiment is unchanged.",
            "chatgpt": "The returned function executed and returned false."
          }
        },
        {
          "label": "valid(1.3,63,8.19) accepted",
          "max": 1,
          "firstfire": 1,
          "chatgpt": 1,
          "notes": {
            "firstfire": "1.3 mm/s, 63 s, 8.19 cm. Replay verified. Both trials, their differences, model fingerprint and source records match.",
            "chatgpt": "The returned function executed and returned true."
          }
        }
      ],
      "answers": {
        "firstfire": "Instrument readouts and extracted fields from the original run:\n\n2 mm/s, 17 s, 3.4 cm. Replay verified. Both trials, their differences, model fingerprint and source records match.\n\n2 mm/s, 17 s, 3.8 cm. File not applied. Recorded inputs, results or source records differ from this rerun. The current experiment is unchanged.\n\n1.3 mm/s, 63 s, 8.19 cm. Replay verified. Both trials, their differences, model fingerprint and source records match.",
        "chatgpt": "function valid(rateMmS, timeS, travelCm) {\n  if (\n    !Number.isFinite(rateMmS) ||\n    !Number.isFinite(timeS) ||\n    !Number.isFinite(travelCm)\n  ) {\n    return false;\n  }\n\n  if (rateMmS < 0 || timeS < 0 || travelCm < 0) {\n    return false;\n  }\n\n  const expectedCm = rateMmS * timeS / 10;\n\n  // This validator applies only before strip-end clipping.\n  if (!Number.isFinite(expectedCm) || expectedCm > 40) {\n    return false;\n  }\n\n  return Math.abs(travelCm - expectedCm) <= 0.000001;\n}\n\n// Tests\nconsole.log(valid(1.8, 37, 6.66)); // true\nconsole.log(valid(1.3, 37, 4.81)); // true\nconsole.log(valid(1.8, 37, 6.67)); // false\n\nThe validator uses the stipulated rate law, rejects nonfinite and negative inputs, excludes distances requiring strip-end clipping, and applies the specified absolute tolerance of 0.000001 cm."
      },
      "links": [
        {
          "url": "rover-scorecard-files/W2-response.json",
          "label": "Full FIRST FIRE action log and screen text"
        },
        {
          "url": "rover-scorecard-files/returned-validator.txt",
          "label": "Original ChatGPT JavaScript"
        },
        {
          "url": "rover-scorecard-files/executed-checks.json",
          "label": "Actual execution results"
        }
      ]
    }
  ],
  "links": [
    {
      "url": "rover-scorecard-files/shared-prompt.txt",
      "label": "Shared prompt and sources"
    },
    {
      "url": "rover-scorecard-files/marking-key.json",
      "label": "Fixed marking key"
    },
    {
      "url": "rover-scorecard-files/rendered-transcript.txt",
      "label": "ChatGPT original browser text"
    },
    {
      "url": "rover-scorecard-files/response.jpg",
      "label": "ChatGPT screenshot"
    },
    {
      "url": "rover-scorecard-files/evidence.zip",
      "label": "Download reproducible evidence bundle"
    }
  ]
};
