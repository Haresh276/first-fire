# Additional Flame repositories from the event-wide search

Four additional repositories outside the original 469 describe projects relevant to spacecraft combustion. Their current default branches add **298 tracked paths and 267 eligible full-text paths**, bringing November 15 coverage to **473 distinct candidates, 466 nonempty repositories, seven empty branches, 67,395 tracked paths and 55,086 eligible text paths read in full**. The broader event search screened 5,623 available full root READMEs from 5,870 metadata matches. A project without a retrievable or descriptive README could still be relevant. The inclusion of a repository does not verify that its authors submitted an official entry.

[Supplemental file ledger, compressed CSV](flame-supplement-files.csv.gz) · [Original full-file audit and inclusion rules](flame-file-audit.md) · [How the broader search was run](github-research.md)

| November 15 project | Commit prefix | Tracked paths | Whole-text paths | Program/notebook | Web markup/style |
| --- | --- | ---: | ---: | ---: | ---: |
| [Asayil-alarifi/NASA-Space-App-2026-](https://github.com/Asayil-alarifi/NASA-Space-App-2026-/tree/c93846f10e474a23509b2d39d094dec7a3db2a99) | c93846f10e47 | 4 | 4 | 0 | 0 |
| [FawadAhmedBaig/PyroSafe](https://github.com/FawadAhmedBaig/PyroSafe/tree/8db5cd93e3d31787b98db42960300503457e9f79) | 8db5cd93e3d3 | 2 | 2 | 0 | 0 |
| [enigmahacker/flamescope](https://github.com/enigmahacker/flamescope/tree/6bdc38fb59318eabda86d24afaf050df9babb5ab) | 6bdc38fb5931 | 74 | 72 | 17 | 2 |
| [nourannasser2210/zero-flare](https://github.com/nourannasser2210/zero-flare/tree/166dbfdab978a82276848e2338e3a2dfc302cbe1) | 166dbfdab978 | 218 | 189 | 127 | 1 |

Each included blob was checked against its Git identifier. Program, notebook and web paths show the types of artifact available for inspection. The short PyroSafe and Asayil trees are included because of direct project evidence. Their small size should not be read as the full scope of their teams' work.

## Two detector traces worth following to their source

Aero Shield Sentinel publishes NASA PSI-102-derived data with synchronized detector scatter, obscuration, ion readings and particle measurements. I read every CSV row. Its dibutyl phthalate run 2 has 602 rows and its silicone run 1 has 806. I compared both runs, row by row on every original column, with their corresponding material rows in the 1,408-row combined file. They agree exactly. Counting the combined CSV as an independent experiment would duplicate every observation. The numbered elapsed-time field takes 575 distinct values in the first file and 776 in the second. The original timestamp also repeats once in the DBP file. Identify time discontinuities and duplicates before calculating a response delay or fitting a model. [Aero Shield source files](https://github.com/Asayil-alarifi/NASA-Space-App-2026-/tree/c93846f10e474a23509b2d39d094dec7a3db2a99)

**NASA’s graphing and housekeeping tabs use opposite scatter signs.** I downloaded both analyzed workbooks from NASA and compared all 1,408 cleaned rows using the numerical `Time`, ISS detector scatter and ISS detector obscuration jointly, preserving the multiplicities of duplicate keys. Every cleaned row matched an available NASA graphing row exactly. In the corresponding housekeeping pages, all 1,408 matched after multiplying the scatter channel by −1 and retaining the original obscuration sign. For example, DBP timestamp 1189522924 has −0.190125 V scatter in the housekeeping channel and +0.190125 V in the graphing/cleaned channel. Its obscuration is 3.43933 V in both. A displayed positive threshold must identify the selected channel convention. These two traces establish a difference in published representations. Alarm events, response thresholds and spacecraft transfer need separate evidence. [NASA PSI-102](https://doi.org/10.60555/gd4k-8h62) · [DBP run 2, NASA workbook](https://psi.nasa.gov/geode-py/ws/studies/PSI-102/download?file=PSI-102_Analyzed+Data_Run+2+DBP+GMT+254+with+averages.xls&version=2&studyVersion=4) · [Silicone run 1, NASA workbook](https://psi.nasa.gov/geode-py/ws/studies/PSI-102/download?file=PSI-102_Analyzed+Data_GMT252run1testhkp+with+plots.xls&version=2&studyVersion=4)

To reproduce, use the `for graphing` and `Copy of GMT254run2testhkp` tabs for DBP. In the silicone file, the `For Graphing Instruments` and `Housekeeping` tabs have 1,840 aligned rows each. Use the same-row housekeeping `Time` for its graphing values. Select the first `ISSDetectorScatterMeasurement(Volts)` column on each graphing sheet. Compare the multiset of (timestamp, scatter V, obscuration V) in each CSV against the NASA triples, allowing each NASA row to be consumed once. The NASA workbook SHA-256 fingerprints are `637fadb2c06c248170f794d9929fbe22596a2139dd685c51e3308f726543f0a9` for DBP and `64044dd8e2cc7a91f7cc9174d7e552a7e55ecb595c4ddc07db930fb9a38ed183` for silicone. The verification covers these two channels and timestamps. Other sensor columns and the derivation of elapsed time remain unaudited.

## Earlier project names

Of the 14 older names outside the 469, three are general references (Cantera, CFAST and the program's nasa/spaceapps repository). Two previously used ownership or repository names redirect to current names that were already counted. [arjunvirmani7/jarvis-flame-in-freefall](https://github.com/arjunvirmani7/jarvis-flame-in-freefall) was recorded as Priyankv18/jarvis-flame-in-freefall. [zainabraza06/Ember](https://github.com/zainabraza06/Ember) was recorded as zainabraza06/Nasa_Challange.

Nine earlier track-project names had no accessible repository metadata at refresh. Their archived November 14 Git trees and hash-verified files were available locally. Those archives add 933 tracked paths and 863 eligible full-text paths to the historical comparison only. Source code in any of these snapshots may have changed, moved or become unavailable since collection. The ledger's `snapshot` column distinguishes these rows from the November 15 extension.

| Historical project name | November 14 commit prefix | Tracked paths | Whole-text paths | Program/notebook | Web markup/style |
| --- | --- | ---: | ---: | ---: | ---: |
| Harry-Pyae/IGNIS | 5bc9f4bad2fc | 163 | 141 | 103 | 4 |
| Moa-01/flame-in-freefall | 781968176454 | 86 | 83 | 29 | 2 |
| Qambar-12/firelens | 5185fb62ccf1 | 2 | 2 | 0 | 0 |
| hibawaheed/ember-atlas | 0b8ba75d39d4 | 68 | 66 | 44 | 4 |
| itsamirkhon/EMBER | a6d6bd7ae28f | 238 | 217 | 43 | 2 |
| leandro-elias-fontes/hackathon-2026-demo | 0801b17b031a | 12 | 12 | 0 | 0 |
| marcosdevin04-bit/Flight-Dynamics---NASA | 8c5ed89a81a2 | 4 | 3 | 0 | 0 |
| nergisRahimzade/NASA-Space-Apps-Challenges-2026---Flame-in-Freefall | 3a1793767814 | 151 | 148 | 94 | 0 |
| yk445kauod-coder/azura-anime | 953f668323c5 | 209 | 191 | 161 | 12 |
