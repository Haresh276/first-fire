globalThis.FFRefereeReviews={
  "model": "gemma3:1b",
  "digest": "8648f39daa8fbf5b18c7b4e6a8fb4990c692751d49917417b8842ca5758e7ffc",
  "prompt_sha256": "6c8a650448ed5d6bdd9883ab914e9dcfc5070e81c50bfd6aba222725766002d8",
  "cases": [
    {
      "id": "nomex",
      "anchor": "saff25",
      "quote": "Despite this significant heating load, the fabric was not ignited.",
      "claim": "The Nomex fabric did not ignite in Saffire-II sample 2-7.",
      "verdict": "supported",
      "binding": "07db75cd44dff5b0467751cd0e82b7d305abdd2dfa5770e63e79ee6636765cb5",
      "numeric": "sample-id",
      "fixture": false
    },
    {
      "id": "acrylic",
      "anchor": "saff25",
      "quote": "the flame plume was extending over and heating the base of the Nomex® fabric.",
      "claim": "PMMA burned while its flame heated the Nomex fabric.",
      "verdict": "supported",
      "binding": "2c9531c6f01b17e29870a8ec3cf103d60dc1ad5c701ce42c0689a4c0acac2eb8",
      "numeric": null,
      "fixture": false
    },
    {
      "id": "flex-155",
      "anchor": "flex189",
      "quote": "behavior is indicative of cool flame burning and extinction.",
      "claim": "After the visible flame went out, the researchers interpreted the later behavior as evidence of cool-flame burning.",
      "verdict": "supported",
      "binding": "cd63d2f94d79d55289b69af6f79bd568e2ab3a542a84d4c0c619a219b561c8a1",
      "numeric": null,
      "fixture": false
    },
    {
      "id": "flex-120",
      "anchor": "flex154",
      "quote": "It is difficult to determine whether there was cool flame burning",
      "claim": "The investigators could not establish cool-flame burning from the available measurements.",
      "verdict": "contradicted",
      "binding": "e05851a384f1f4e341b3e7f58783ad6a375584435362a39fdc1a083688b3545d",
      "numeric": null,
      "fixture": false
    },
    {
      "id": "extinction",
      "anchor": "luci34",
      "quote": "1-g extinction happens ~ 45 seconds sooner than partial-g extinction",
      "claim": "The fabric flame went out about 45 seconds earlier at Earth gravity than at partial gravity.",
      "verdict": "supported",
      "binding": "a364795ef49ccddfb7c8879ecd448a9efb1a603a165af6fb9d46da3328c9120c",
      "numeric": "extinction",
      "fixture": false
    },
    {
      "id": "teflon",
      "anchor": "sameS8",
      "quote": "The ISS detector would not have alarmed for over half of the Kapton smoke tests, and 2/3 of the Teflon tests.",
      "claim": "The ISS detector would have missed about 66.7% of the Teflon smoke tests.",
      "verdict": "contradicted",
      "binding": "c6bbdc1e5e2ad9cc027038b36ff58fc6b40b8c5db99ba742b696c3e8dc235f57",
      "numeric": "teflon",
      "fixture": false
    },
    {
      "id": "kapton",
      "anchor": "sameS8",
      "quote": "The ISS detector would not have alarmed for over half of the Kapton smoke tests, and 2/3 of the Teflon tests.",
      "claim": "The ISS detector signal would have stayed below the alarm threshold in over half of the Kapton smoke tests.",
      "verdict": "supported",
      "binding": "9465290f88a97a1ab5c1779cd8437a5485e13d82c6ab846fa5bf32dfd1411574",
      "numeric": null,
      "fixture": false
    },
    {
      "id": "burner",
      "anchor": "cfig21",
      "quote": "The chamber was filled with its target atmosphere prior to the burner gas flow.",
      "claim": "The chamber atmosphere was set before the burner gas began to flow.",
      "verdict": "supported",
      "binding": "7be4a7d5572f3ca4d628e7ddf1a4985b7d266f936b60e8d8c2116277ae47e19e",
      "numeric": null,
      "fixture": false
    },
    {
      "id": "tape",
      "anchor": "ices9",
      "quote": "the lunar-g buoyant limit was found to be less",
      "claim": "The lunar-gravity buoyant limit was below the extrapolated ground-test value in the reported comparison.",
      "verdict": "contradicted",
      "binding": "83f11384645f48e0c578bdf0f284fa83b4855880cc4e70590b95fa7e07110063",
      "numeric": null,
      "fixture": false
    },
    {
      "id": "plastic",
      "anchor": "ices11",
      "quote": "the lunar-g buoyant extinction is at substantially higher oxygen concentrations",
      "claim": "For polycarbonate and Nomex Velcro the lunar-gravity extinction oxygen concentration was higher than in the cited ground tests.",
      "verdict": "supported",
      "binding": "821d627cd6625f10cd9aab48af450bc91d4f8f6da7e1e1f442a35134b6792e45",
      "numeric": null,
      "fixture": false
    },
    {
      "id": "velocity",
      "anchor": "ices10",
      "quote": "lunar gravity velocity is not known.",
      "claim": "The lunar-gravity flow velocity was unknown in this analysis.",
      "verdict": "contradicted",
      "binding": "558645713f965f96b4613f89f337bfa1d00cc94c99e20df9d3a4a90a105bcf63",
      "numeric": null,
      "fixture": false
    },
    {
      "id": "lunar",
      "anchor": "fm25",
      "quote": "Start at 25% not expected to ignite but would provide a margin of safety",
      "claim": "The planned lunar test at 25% starting oxygen was expected to be unlikely to ignite.",
      "verdict": "contradicted",
      "binding": "985feca86abe63c88775ed9e33227cc0b2952a9b1a500165adfea34a4da669c8",
      "numeric": "starting-oxygen",
      "fixture": false
    },
    {
      "id": "lunar-design",
      "anchor": "fm25",
      "quote": "Conduct four tests at 8.2 psi:",
      "claim": "NASA described four planned tests at different starting oxygen concentrations.",
      "verdict": "supported",
      "binding": "96f71ac7a37f4cdd0bcbbc9e9ab0d9fb6b6fbe144dd07f698723ef6f9b03c1b6",
      "numeric": "burn-count",
      "fixture": false
    },
    {
      "id": "fake-ignition",
      "anchor": "saff25",
      "quote": "Despite this significant heating load, the fabric was not ignited.",
      "claim": "The Nomex fabric ignited in the composite test.",
      "verdict": "insufficient",
      "binding": "066eb27392a33b3ef72c2fd2f98dc8a93a8dc3e42db2800635211d93eb21732d",
      "numeric": null,
      "fixture": true
    },
    {
      "id": "fake-time",
      "anchor": "luci34",
      "quote": "1-g extinction happens ~ 45 seconds sooner than partial-g extinction",
      "claim": "The fabric flame went out about 450 seconds earlier at Earth gravity than at partial gravity.",
      "verdict": "supported",
      "binding": "b5ec5048a36258e9d1c1b3a058c61f32523fd2ecb279c389105dcd7dc5c2278e",
      "numeric": "extinction",
      "fixture": true
    },
    {
      "id": "fake-alarm",
      "anchor": "sameS8",
      "quote": "The ISS detector would not have alarmed for over half of the Kapton smoke tests, and 2/3 of the Teflon tests.",
      "claim": "The ISS detector would have missed about 6.7% of the Teflon smoke tests.",
      "verdict": "contradicted",
      "binding": "98c4a8abe2fbc5c2795a6408b9be42c1ce7a3e701212fc8c5363072ee9e55e2f",
      "numeric": "teflon",
      "fixture": true
    },
    {
      "id": "fake-flight",
      "anchor": "fm25",
      "quote": "Start at 25% not expected to ignite but would provide a margin of safety",
      "claim": "A lunar flight test has already demonstrated ignition at 25% oxygen.",
      "verdict": "supported",
      "binding": "db48a78b3b6f5a0d3a5389c76ecc62e8de6d841499a51cefb92563bcd3336b78",
      "numeric": "starting-oxygen",
      "fixture": true
    }
  ]
};
