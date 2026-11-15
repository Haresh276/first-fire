globalThis.FFSourceClaims={
  "documents": {
    "acrylic-rods": {
      "title": "NASA · Burning and Suppression of Solids, BASS-II technical memorandum",
      "filename": "acrylic-rods.pdf",
      "url": "https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf",
      "canonical_url": "https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf",
      "format": "pdf",
      "sha256": "5ffa911fd9b6356f204646003fb9342e341810dcdfdf5cb15756e7f01ec5f770"
    }
  },
  "model": "gemma3:1b",
  "digest": "8648f39daa8fbf5b18c7b4e6a8fb4990c692751d49917417b8842ca5758e7ffc",
  "promptSHA256": "6c8a650448ed5d6bdd9883ab914e9dcfc5070e81c50bfd6aba222725766002d8",
  "cards": [
    {
      "id": "acrylic-name",
      "doc": "acrylic-rods",
      "location": 57,
      "facets": "what does pmma mean|stand for|what (?:shape|material)|specimen shape|rod shape",
      "quote": "black polymethylmethacrylate rods in microgravity",
      "claim": "The BASS-II specimens were cylindrical rods of acrylic, polymethyl methacrylate (PMMA).",
      "binding": "1b5e814d497f86f6195ecc0bc9359bce9aaf25ba92b79adb03b290187c747445",
      "verdict": "supported"
    },
    {
      "id": "acrylic-coverage",
      "doc": "acrylic-rods",
      "location": 57,
      "facets": "21%|21 percent|near.*21|did not overlap|diameter.*missing|diameter.*lack",
      "quote": "only the two largest diameter rods were tested at near 21 percent O2 by volume, with the highest O2 concentration tested for the 6.35-mm-diameter rods being approximately 19 percent by volume.",
      "claim": "The 6.35 mm rod was tested in microgravity up to about 19% oxygen. Only the two larger rods were measured near 21% oxygen.",
      "binding": "0c4bd12ffd741802fc3dad5544c4909e95c33ccd9df500762d0fb60b8dc59b0f",
      "verdict": "contradicted"
    },
    {
      "id": "acrylic-diameters",
      "doc": "acrylic-rods",
      "location": 57,
      "facets": "17.5|all three|all.*thickness|all.*diameters",
      "quote": "The only O2 concentration at which all three rod diameters employed in the microgravity experiments were tested was at approximately 17.5 percent O2 by volume.",
      "claim": "All three rod diameters were tested together only near 17.5% oxygen in microgravity.",
      "binding": "ca70ba09c15e807a92b56e7796d6a73999a58a77adfe4153639b88943019d10b",
      "verdict": "contradicted"
    },
    {
      "id": "acrylic-spread",
      "doc": "acrylic-rods",
      "location": 58,
      "facets": "17.5|propagat|spread.*oxygen|lowest",
      "quote": "in microgravity, flame spread was observed at O2 concentrations as low as 17.5 percent, in normal gravity, flame spread was not observed below 19 percent.",
      "claim": "The study observed flame spread down to 17.5% oxygen in microgravity. Under normal gravity it did not observe spread below 19% oxygen.",
      "binding": "86d796b8dc357f197ed743e727ee0f349682ee6811b466918032b306fa727bcc",
      "verdict": "supported"
    },
    {
      "id": "sibal-fabric",
      "doc": "luci",
      "location": 16,
      "facets": "fabric|material|specimen|spreading over|burning over|what.*burn",
      "quote": "SIBAL fabric (cotton-fiberglass blend) burning downward in Lunar-g",
      "claim": "The LUCI specimen was SIBAL, a cotton-fiberglass fabric burning downward in simulated lunar gravity.",
      "binding": "8a3896079b29a0991294265523a5417b9f644dbcba9de76f5e7360a4a5b4d60b",
      "verdict": "supported"
    },
    {
      "id": "sibal-dimensions",
      "doc": "luci",
      "location": 4,
      "facets": "how big|size|dimensions|wide|width|length of.*strip",
      "quote": "Fabric 5 cm wide x 30 cm long",
      "claim": "The LUCI fabric was 5 cm wide and 30 cm long.",
      "binding": "cbc45e1e80cd9f90062fc624cb89ed538e17bd1a19643c3790a59f83c2ceb398",
      "verdict": "supported"
    },
    {
      "id": "sibal-base",
      "doc": "luci",
      "location": 33,
      "facets": "base|quantitatively|spread fit",
      "quote": "Partial- G (mm/s) 1-G (mm/s) Ratio Flame Base .9 1.5 .6 Flame Tip 1.1 2.8 .39",
      "claim": "The LUCI fabric flame base advanced at 0.9 mm/s in partial gravity and 1.5 mm/s at Earth gravity.",
      "binding": "122cca11902c8da7021531f7cd9077d3563f98b67904f3db031753bad59a709f",
      "verdict": "supported"
    },
    {
      "id": "sibal-tip",
      "doc": "luci",
      "location": 33,
      "facets": "tip|edge|quantitatively|spread fit",
      "quote": "Partial- G (mm/s) 1-G (mm/s) Ratio Flame Base .9 1.5 .6 Flame Tip 1.1 2.8 .39",
      "claim": "The LUCI fabric flame tip advanced at 1.1 mm/s in partial gravity and 2.8 mm/s at Earth gravity.",
      "binding": "fc20338515741ccb6eeb8a736cbf155d74bfab523169c21d36c6b379cfeed5cc",
      "verdict": "supported"
    },
    {
      "id": "sibal-extinction",
      "doc": "luci",
      "location": 34,
      "facets": "longer|later|sooner|lifetime|extinction|remain.*visible",
      "quote": "1-g extinction happens ~ 45 seconds sooner than partial-g extinction",
      "claim": "The SIBAL flame lasted about 45 seconds longer in partial gravity than at Earth gravity.",
      "binding": "bf58bfbfaf076fd7f8ae61f6458f2bc7649fe2566cefd90750df3ff72552a79d",
      "verdict": "supported"
    },
    {
      "id": "sibal-oxygen",
      "doc": "luci",
      "location": 42,
      "facets": "atmospher|oxygen|attribute|confound",
      "quote": "O2 concentration decreases from ~20% to ~18%.",
      "claim": "Oxygen fell from about 20% to 18% during the partial-gravity SIBAL burn.",
      "binding": "2bfa72334de13b0d9658da2b15dbcd7e33772f8da6061566dcad99222e22868c",
      "verdict": "supported"
    },
    {
      "id": "saffire-blackening",
      "doc": "saffire",
      "location": 25,
      "facets": "blacken|color|discol|damage|streak|soot",
      "quote": "The first 1-cm of the fabric was significantly damaged, the first 5-cm was completely blackened, and the remainder had a black streak down its center.",
      "claim": "About 1 cm of Nomex was significantly damaged and 5 cm was completely blackened. The rest had a black streak.",
      "binding": "c254af7a33848c32582c292fac0eab96ed0d2059b953d816f258ef3db060ae31",
      "verdict": "contradicted"
    },
    {
      "id": "saffire-soot",
      "doc": "saffire",
      "location": 25,
      "facets": "blacken|soot|pyroly|color|discol",
      "quote": "some of this discoloration may have been caused by deposition of soot from the PMMA flame on the fabric, and not necessarily pyrolysis of the fabric itself.",
      "claim": "PMMA soot could have discolored the Nomex. Blackening alone cannot establish that the fabric burned.",
      "binding": "279ba91a3e6958d64f784454d8a0b1d447bbbb42c1600678feef60e04b7169f9",
      "verdict": "contradicted"
    },
    {
      "id": "saffire-duration",
      "doc": "saffire",
      "location": 25,
      "facets": "timed|what.*duration|consumed|burn.length",
      "quote": "It took about two minutes for the PMMA to be consumed, all the while the flame plume was extending over and heating the base of the Nomex® fabric.",
      "claim": "The PMMA was consumed in about two minutes while its plume heated the downstream Nomex.",
      "binding": "7e95086b546f059bcabb1e0163419d8d8fa584de9630cd08a528c39ce202de54",
      "verdict": "supported"
    },
    {
      "id": "saffire-flow",
      "doc": "saffire",
      "location": 29,
      "facets": "concurrent|chamber oxygen|ambient oxygen|airflow",
      "quote": "2-7 PMMA & Nomex 5 cm 0.85 & 0.37 mm 5 & 24 cm 20 cm/s Concurrent ~ 22.1",
      "claim": "The PMMA–Nomex specimen had concurrent flow of 20 cm/s and approximately 22.1% initial oxygen.",
      "binding": "04cdae7bf08db0f00ecf7538812572a40d3a832811566241c87701f35817adc2",
      "verdict": "contradicted"
    },
    {
      "id": "flex-observation",
      "doc": "flex_tp",
      "location": 189,
      "facets": "vapor|post.visible|diagnos|plateau|invisible|diameter history|after.*visible",
      "quote": "The vaporization rate was high after the visible flame extinguished, and there was an eventual plateau late in the HiBMs Image Processing and Storage Unit (IPSU) recording time coincident with the formation of a large vapor cloud.",
      "claim": "After visible extinction the droplet continued to vaporize rapidly. A late plateau coincided with a large vapor cloud; the report interpreted the post-visible behavior as cool-flame burning.",
      "binding": "998a08153998f2860b92a0073d810c2ff72b2ce61ffb8c7eb404b6ae3640c9cc",
      "verdict": "supported"
    },
    {
      "id": "flex-instrument",
      "doc": "flex_tp",
      "location": 154,
      "facets": "instrument|ultraviolet|imaging|infrared|vapor cloud|124",
      "quote": "The Low Light Level Ultra-Violet (LLUV) Image Processing and Storage Unit (IPSU) did not record any images during the burn.",
      "claim": "The low-light-level ultraviolet imaging unit recorded no images. For this run the available data did not establish cool-flame burning.",
      "binding": "b3e0a944553ce5b8c999efb8748c1905808021684738cb80f1e511b05c5dd9eb",
      "verdict": "contradicted"
    },
    {
      "id": "flex-gases",
      "doc": "flex_tp",
      "location": 189,
      "facets": "gas fractions|composition|co2 fraction|initial gas",
      "quote": "Free-floating heptane droplet burning in a 0.18/0.67/0.15 O2/N2/CO2, 1.0-atm ambient environment.",
      "claim": "The initial heptane test atmosphere was 18% oxygen, 67% nitrogen and 15% carbon dioxide at 1.0 atm.",
      "binding": "1815571e984d7717dc30bab81910d14efc29192a15424d79602019e3977665c3",
      "verdict": "insufficient"
    },
    {
      "id": "same-iss",
      "doc": "same-cdc",
      "location": 2,
      "facets": "principle|sort of detector|type of detector|technology|optical",
      "quote": "smoke detectors use near-IR forward light scattering",
      "claim": "The ISS detector uses near-infrared forward light scattering.",
      "binding": "1a2e3fbae22dcad56ede4f7657732a8cae1326194fea0e12c1c71ad770f45b0a",
      "verdict": "supported"
    },
    {
      "id": "same-generation",
      "doc": "same-cdc",
      "location": 3,
      "facets": "produc|generat|how.*made|overheat.*material",
      "quote": "smoke generated by overheated spacecraft materials with rigorously controlled sample temperature, flow field, and particle aging time.",
      "claim": "Researchers generated smoke by overheating spacecraft materials and controlled temperature, flow and particle aging.",
      "binding": "e5e9eaa33574d7f1676013ec7b1428cbb507a6669e292952eb3a3698d741e605",
      "verdict": "supported"
    },
    {
      "id": "same-shuttle",
      "doc": "same-cdc",
      "location": 8,
      "facets": "shuttle|pump|intermittent|compar.*dataset",
      "quote": "There is a much smaller data set for the Space Shuttle detector as it was only operated intermittently because its required flow rate (driven by an internal pump) consumed three liters per minute of aerosol making it impossible to do aging tests.",
      "claim": "The Shuttle detector ran intermittently. Its pump consumed three liters of aerosol per minute, preventing comparable aging tests and leaving a smaller dataset.",
      "binding": "c8db820395488822e320a8133528db07e593a9600327a3d379bba6a75457cdeb",
      "verdict": "contradicted"
    },
    {
      "id": "ices-pressure",
      "doc": "ices",
      "location": 6,
      "facets": "pressure|psia|kpa",
      "quote": "planned NASA lunar habitat pressure of 56.5 kPa (8.2 psia)",
      "claim": "The lunar-habitat comparison used a nominal pressure of 56.5 kPa, or 8.2 psia.",
      "binding": "29775d5924061fed3e7ca9f14822e710b554dbe2fe8c160ad994f950fbc236c2",
      "verdict": "supported"
    },
    {
      "id": "ices-endpoints",
      "doc": "ices",
      "location": 6,
      "facets": "five.second|5.second|test 1|endpoint|drop tower|qualification",
      "quote": "based on a 5 second extinction limit rather than the 15 cm (6 inch) burn limit in NASA Test 1",
      "claim": "The short drop used a 5 second extinction endpoint. NASA Test 1 used a 15 cm burn-length endpoint.",
      "binding": "c62aff32feb365abef7f63f5b8b4e00194715f11a8ff63aaa0d358d597f750b6",
      "verdict": "contradicted"
    },
    {
      "id": "ices-tape",
      "doc": "ices",
      "location": 9,
      "facets": "p213|tape|opposite|reference|materials|arrows",
      "quote": "The lower extinction concentration for the lunar-g testing for PMMA, P213 and flaming Beefy-T suggest that the buoyant velocity is very low, but it does not correlate with the WSTF data.",
      "claim": "The lunar-gravity oxygen extinction limit for P213 tape was below the extrapolated ground forced-flow result.",
      "binding": "62ecc3bb919d697768a641bbbfad96a114aee4715e3a4601aecdc0125db7c4aa",
      "verdict": "supported"
    },
    {
      "id": "ices-plastic",
      "doc": "ices",
      "location": 11,
      "facets": "polycarbonate|velcro|opposite|reference|materials|arrows",
      "quote": "For both of these materials, the lunar-g buoyant extinction is at substantially higher oxygen concentrations that the WSTF data.",
      "claim": "The polycarbonate and Nomex Velcro lunar-gravity extinction levels were higher than the ground comparison levels.",
      "binding": "12e5bbb56cb57d589de1e498ffc5beb79f2a8b11022174a3a267a2e27cae2b71",
      "verdict": "supported"
    },
    {
      "id": "ices-slope",
      "doc": "ices",
      "location": 10,
      "facets": "slope|confidence|velocity|buoyant air speed",
      "quote": "To get a conservative estimate of the slope (and thus the compensation factor) we used the one- tailed 95 percent confidence interval.",
      "claim": "The conservative slope used a one-tailed 95 percent confidence interval. It is an estimate from the forced-flow fit, not a direct measurement of lunar buoyant velocity.",
      "binding": "75014bf6f756a730dc896ccdd66415791a7b77e58d82709630ae583143672352",
      "verdict": "supported"
    },
    {
      "id": "fm2-family",
      "doc": "fm2",
      "location": 10,
      "facets": "fabric|textile|material|mount|sample name",
      "quote": "Fabric sheets (Synergy Pro “Navy”) mounted between thin metal frames",
      "claim": "The planned FM² specimens are sheets of Synergy Pro Navy fabric held in thin metal frames.",
      "binding": "c3a437ac691a89455e28b1895c1b6ac00d25d7fd93f92b4c69f170a68a3367ce",
      "verdict": "supported"
    },
    {
      "id": "fm2-pressure",
      "doc": "fm2",
      "location": 10,
      "facets": "pressure|psia|kpa|uncertainty band|tolerance",
      "quote": "8.2 psia (+/- 0.3 psi)",
      "claim": "The planned chamber pressure is 8.2 psia with a tolerance of ±0.3 psi.",
      "binding": "b892aa52c790bb3a32e22585e1d51354597e0bed04427e46ab09a71b0cf190bc",
      "verdict": "supported"
    },
    {
      "id": "fm2-start",
      "doc": "fm2",
      "location": 5,
      "facets": "starting oxygen|concentrations|initial oxygen|starting atmosphere|oxygen percentage",
      "quote": "1. Start at 37% should burn to threshold 2. Start at 33% should burn to threshold 3. Start at 29% should burn to threshold 4. Start at 25% not expected to ignite",
      "claim": "The four planned starting oxygen concentrations are 37%, 33%, 29% and 25%. The design describes expectations for future tests.",
      "binding": "37254b7329fb942097a3f27914db2733ca5200e41d84d62e17079d6901ee5089",
      "verdict": "supported"
    },
    {
      "id": "fm2-limit",
      "doc": "fm2",
      "location": 5,
      "facets": "expect.*limit|expect.*threshold|limiting oxygen|expected.*range",
      "quote": "expected Lunar LOC of 24-26%",
      "claim": "The NASA concept expects a lunar limiting oxygen concentration of 24–26%.",
      "binding": "06f70c98cf43c88f852c8126b83a833f700eae8fd2e528a530a00097afba4e23",
      "verdict": "supported"
    },
    {
      "id": "fm2-reset",
      "doc": "fm2",
      "location": 10,
      "facets": "next burn|atmosphere.*next|vent|reset|between tests",
      "quote": "Each of the four tests requires its own chamber initial atmosphere as follows with venting to vacuum between tests",
      "claim": "The chamber vents to vacuum between tests and each burn receives its own starting atmosphere.",
      "binding": "e015dc4da01ffe166429b66e86a623694c1488caddc055151b8fa054f7b84aef",
      "verdict": "supported"
    },
    {
      "id": "fm2-consumption",
      "doc": "fm2",
      "location": 14,
      "facets": "consumption|oxygen.*extinction|oxygen.*fall|oxygen.*decrease|oxygen.*scan",
      "quote": "Expect oxygen concentration to decrease by up to 0.08 mol fraction in a test.",
      "claim": "The design allows oxygen concentration to fall by up to 0.08 mole fraction during a test.",
      "binding": "696c3aab1655dda253ca6d83d58ce05251d343af1ddb6f604a0b07d6baf7401e",
      "verdict": "supported"
    },
    {
      "id": "cfig-direction",
      "doc": "kimber",
      "location": 21,
      "facets": "normal|inverse|feed|supplied|burner|ambient|surrounding|chamber",
      "quote": "normal flames, with the fuel flowing from the burner toward the oxidizer, and inverse flames, w ith the oxidizer flowing toward the fuel.",
      "claim": "In the inverse configuration oxidizer flowed out of the burner toward the fuel. A burner oxygen concentration describes the feed stream.",
      "binding": "6ba9adbc3332940718e432c77451ad43f5666ed253255f08cf8b538ab0ee967e",
      "verdict": "contradicted"
    }
  ]
};
