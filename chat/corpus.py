"""Build the evidence index exclusively from the frozen project archive.

A unit of retrieval is a scoped passage with a hand-checked source location.
Structured NASA rows are looked up separately by accession, run or instrument ID.
"""
import csv
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


@dataclass(frozen=True)
class Passage:
    id: str
    title: str
    url: str
    locator: str
    text: str
    hints: str = ""

    @property
    def topic(self):
        return self.id.split(":", 1)[0]

    def cite(self):
        return {k: getattr(self, k) for k in ("id", "title", "url", "locator")}

    def index_text(self):
        return f"{self.hints}. {self.text}"


def read(name):
    return json.loads((DATA / name).read_text())


NAMES = {
    "sibal": "LUCI SIBAL cotton fiberglass fabric Lunar Combustion Investigation partial simulated gravity",
    "saffire": "Saffire II sample 2-7 Nomex HT90-40 adjacent acrylic PMMA composite",
    "flex": "FLEX Flame Extinguishment Experiment liquid heptane droplet cool flame",
    "same": "SAME SAME-R Smoke Aerosol Measurement Experiment spacecraft alarms Kapton Teflon PTFE",
    "cfig": "CFI-G gaseous cool flames inverse burner and chamber oxygen A1 A2",
    "ices": "ICES lunar flammability P213 adhesive tape polycarbonate Nomex Velcro WSTF",
    "fm2": "FM² FM2 planned Moon lunar Flammability of Materials on the Moon Synergy Pro Navy",
}
# Sources needed for specific fields, independent of the top-level document order.
FACET_SOURCE = {
    "sibal": (0,1,0,0), "saffire": (0,0,0,0), "flex": (0,0,1,0),
    "same": (0,0,0,0), "cfig": (0,0,1,1), "ices": (0,0,4,0), "fm2": (0,0,0,0),
}


def corpus():
    docs = []
    cases = {c["id"]: c for c in read("cases.json")}

    def add(topic, key, fact, hints, source):
        docs.append(Passage(f"{topic}:{key}", source["title"], source["url"], source["locator"],
                            fact, f"{NAMES.get(topic,topic)} {hints}"))

    def source(topic, number):
        return cases[topic]["sources"][number]

    for topic, case in cases.items():
        for field, hints, n in zip(("record","reason","limit","next"),
                ("what happened experiment observation result", "evidence interpretation why decision",
                 "limits can we compare scope confounding unknown", "what should a researcher test next matched experiment recommendation"),
                 FACET_SOURCE[topic]):
            val = case[field]
            if field == "next":
                val = "A proposed research test is to " + val[0].lower() + val[1:]
            if topic == "flex" and field == "record":
                val = val.split(" In FLEX-120")[0]
            if topic == "ices" and field == "record":
                val = val.split(" For polycarbonate")[0]
            add(topic, field, val, hints, source(topic,n))

        add(topic, "decision", case["decision"], "how to decide choose comparison infer evidence", source(topic,0))

    def local(topic,key,fact,hints,report,section):
        add(topic,key,fact,hints,dict(title="FIRST FIRE · "+section,url="#report/"+report,locator=section))

    def primary(topic,key,fact,hints,num):
        add(topic,key,fact,hints,source(topic,num))

    add("saffire", "fiber",
        "Nomex is a family of heat-resistant fibers. Its meta-aramid polymer gives the fiber its flame resistance. One familiar use is protective clothing for firefighters.",
        "what is Nomex material fiber definition", {
            "title": "DuPont · Technical guide for Nomex fiber",
            "url": "https://www.dupont.com/content/dam/dupont/amer/us/en/personal-protection/public/documents/en/Nomex%28R%29%20Fiber%20Technical%20Guide.pdf",
            "locator": "Section I, printed p. 1, What is Nomex? and Molecular structure of Nomex fiber."
        })
    primary("sibal","instrument","LUCI compared SIBAL, a cotton–fiberglass composite fabric, burning downward in simulated lunar gravity with the same material at 1 g. SIBAL flame-base speed and flame-tip speed describe different moving boundaries. Time to visible extinction is a separate endpoint.","what is SIBAL LUCI meaning flame speed duration difference",0)
    primary("saffire","time","In Saffire-II sample 2-7 the 140 s duration belongs to the composite test. The upstream PMMA (acrylic) burned. The downstream Nomex was damaged and blackened but did not ignite. Its reported burn length was zero.","what burned 140 seconds Nomex ignite blackened charred discoloration flame duration",0)
    primary("saffire","ground","Externally heated Nomex HT90-40 can burn under other conditions in 1-g experiments. The orbital sample 2-7 observation cannot certify Nomex as fireproof or safe in every atmosphere.","universal fireproof safe proof on Earth lunar fabric ground externally heated",1)
    primary("flex","unresolved","In FLEX-120 (C12H201), a vapor cloud was observed but the ultraviolet instrument recorded no images. The authors judged the later cool-flame evidence inconclusive. Figure 124 does not give a confirmed second burning phase.","FLEX-120 C12H201 Figure 124 cool flame cloud missing ultraviolet",1)
    primary("flex","diagnostics","FLEX-155 (C03H201) burned visibly for 2.7 seconds. NASA's Figure 159 interprets later rapid droplet vaporization, a plateau and cloud formation as evidence of cool-flame burning. The visible flame's disappearance does not establish the time all combustion stopped.","FLEX 155 C03H201 duration 2.7 visible extinction total reaction camera dark after",0)
    primary("same","instrument","The ISS light-scattering detector would have missed over half the Kapton smoke tests and about two-thirds of the Teflon tests in the reported subset. Those fractions describe crossings of that detector's alarm threshold. They do not predict a cabin alarm time or a general failure probability.","light scattering missed proportions Teflon Kapton wire insulation detector alarm boundary percentages",0)
    primary("same","smoke","The SAME investigation heated spacecraft materials to generate smoke before ignition. Light-scattering and ionization detectors respond differently to aerosol size and material. A detector that responds to one smoke source can miss another.","what is SAME types of sensors smoke aerosols particles overheated before fire",0)
    primary("cfig","pressure","Normal CFI-G run 21088A1 reported 39.39% initial ambient oxygen. Inverse runs 21202 A1 and A2 reported 85% oxygen in the burner stream, with 6% ethane in the chamber. PSI lists an approximate initial pressure of 2.2066 bar for the inverse pair. The source location and unit must stay with each value.","normal and inverse chamber atmospheric oxygen fraction burner 39.39 pressure 2.2066 bar",1)
    primary("cfig","flows","CFI-G inverse PSI rows 18–19 report 0.931 and 1.862 mg/s oxygen flow. Run 21202 A1 had no hot ignition. A2 ignited and self-extinguished after 2 seconds (SE). Both used 85% oxygen in the burner. These two attempts alone cannot identify a causal flow threshold.","A1 A2 oxygen delivery flow rate 0.931 1.862 hot ignition SE termination threshold",1)
    primary("ices","opposite","At 8.2 psia P213 tape's lunar extinction oxygen limit was below its 1-g forced-flow extrapolation. Polycarbonate and Nomex Velcro had lunar limits above their WSTF ground measurements. The Earth comparator differs by material. A single oxygen correction cannot represent all three.","opposite direction tape plastics Velcro below above WSTF ground measurement extrapolation",1)
    primary("ices","table","Table 2 gives conservative modeled oxygen adjustments of 1.4 percentage points for P213 and 2.3 for polycarbonate using a worst-case slope method. These are extrapolations. The investigators reported uncertainty about local buoyant velocity in simulated lunar gravity.","1.4 2.3 percentage points Table 2 measured or conservative slope extrapolation speed",4)
    primary("ices","qualification","NASA-STD-6001B Change 3 Test 1 uses at least five specimens, burn length and flaming-debris criteria. The research apparatus used a five-second extinction criterion. A short research test does not establish material qualification for a crewed vehicle.","qualification certify material flight approved five specimens 15 centimetres debris standard test protocol safety",2)
    primary("fm2","date","The April 2026 NASA FY 2027 budget request describes planned lunar FM² work in 2027. This review has no verified launch date or actual flight outcome. A budget year does not establish a launch commitment.","official launch dates completed expected 2027 flight schedule planning status",2)
    f=read("forecast.json")
    burns=f["burns"]; probabilities=", ".join(f"{b['oxygen_pct']}% O₂: " + (">99.99%" if b["p_sustain"]>.9999 else f"{100*b['p_sustain']:.2f}%") for b in burns)
    local("fm2","probability","The registered FIRST FIRE v1 shared-threshold forecast adopts a mean limiting oxygen of 26% with standard deviation 1.5 percentage points. Its probabilities of sustained spread are "+probabilities+". These are conditional model probabilities. NASA gave qualitative expectations and an expected 24–26% limit, without numerical probabilities.","model probabilities illustrative 25 percent value sigma mean normal distribution likelihood","forecast","Reproduce the illustrative model")
    local("fm2","scoring","A Brier score is the mean squared difference between the predicted probability and the observed binary outcome. Lower is better. Score only burns with resolved outcomes on the same indices and report coverage. Hypothetical yes/yes/yes/no gives 0.0161 for the model and 0.0100 for the guide's illustrative comparator. There are no observed FM² scores.","Brier score formula hypothetical missing comparator 90 10 scoring calibration dependent four burns","forecast","Reproduce the illustrative model")
    local("fm2","event","A scored yes means sustained flame spread after the igniter turns off. A nominal attempt with no ignition scores no. Hardware failure, invalid conditions, abort or unclassifiable observations are void. All four official outcomes in this release are pending. The learner guide's 90/10 numbers are an illustrative encoding of NASA's qualitative expectations.","scoring missing null no ignition abort void preregistration official observed team forecast","forecast","One event per burn")
    local("fm2","test","The four modeled tests share a latent limiting oxygen concentration. Their outcomes are dependent. With no outcomes, the most informative next oxygen setting on the candidate grid is 26%, the median assumed threshold. Four burns cannot establish calibration across materials or habitats.","information gain next test dependence shared uncertain threshold optimal assumptions","forecast","Choosing the next oxygen test")
    local("evaluation","design","The planned blind study compares FIRST FIRE with ordinary search under equal time limits across six independent, previously unpublished prompts. The facilitator assigns each participant three cases per method. Independent assessors grade decision, primary evidence with a locator, and scope. Practice tasks are excluded. No human performance advantage has been established.","blind test ordinary search correct call 100 questions pilot graders randomized balanced four minutes research decision","evaluation","A practical six-case pilot")
    local("evaluation","search","On 18 authored retrieval queries, hybrid semantic plus keyword search and keyword-only search both placed the intended case first 15 times and in the top three 17 times. Those public-case results measure retrieval. Human decision quality has not been measured.","search benchmark hybrid versus keyword top 1 retrieval beats baseline 15 18","search","Public retrieval benchmark")
    studies=read("investigations.json")
    with (DATA/"tests.csv").open() as stream:
        rows=list(csv.DictReader(stream))
    local("archive","coverage",f"The frozen NASA Physical Sciences Informatics (PSI) snapshot contains {len(rows):,} normalized observation rows from {len(set(r['accession'] for r in rows))} investigations, with {len(studies)} investigations in its catalog and 20 original CSV tables. The other ten studies remain catalog-only. Every normalized observation is from orbital microgravity. It includes no direct lunar-surface measurements.","archive coverage how many records dataset experiments observations source catalog downloadable raw data 1058 NASA PSI","data","NASA PSI data audit")
    local("archive","provenance","Each normalized record retains the original NASA accession, versioned source URL, CSV record number (header counts as 1), DOI and original file identifier. The data explorer exposes the original CSV row. Missing values stay blank and are not replaced with zero. Nominal zero gravity labels orbital microgravity rather than an accelerometer measurement.","data provenance original source reproducibility missing unreported records zero g DOI inspect source rows","data","Measuring conditions and endpoints")
    local("archive","rank","Habitat ranking compares material or subject, nominal gravity, ambient oxygen and absolute pressure. Rows with more reported conditions rank before less complete rows, followed by weighted distance. Inverse burner oxygen is excluded from atmospheric matching. The nearest orbital record still requires a transfer check for material, shape, airflow and endpoint.","evidence distance ranking simulated lunar habitat weights missing normalized conditions match score sensitivity","data","Measuring conditions and endpoints")
    for study in studies:
        acc=study["accession"].lower()
        add(acc,"catalog",f"{study['name']} ({study['accession']}). {study['title']}. {study['summary']} This release has {study['rows']} normalized rows. {study['coverage']}",
            f"{study['category']} {study['hardware']}",dict(title=study["title"],url="https://doi.org/"+study["doi"],locator=study["accession"]+" investigation catalog and experimental table"))
    link="https://pmc.ncbi.nlm.nih.gov/articles/PMC5760683/#Fig8"
    add("acrylic","rod","For the 9.53 and 12.7 mm cast black PMMA rods near 21% oxygen, the measured Earth spread rates were higher than in orbit under these flow conditions. The 6.35 mm orbital series extends only to about 19% oxygen. At roughly 17.5% oxygen, all three diameters spread in orbit. Earth flames did not spread below 19% in this comparison without added radiation. Buoyancy changes the local opposed flow.","BASS-II acrylic oxygen plastic PMMA rod geometry spread reversal diameters 17.5 21 oxygen Earth ISS material",dict(title="Link et al., The Effect of Gravity on Flame Spread over PMMA Cylinders",url=link,locator="Figure 8(a–c), oxygen and rod diameter"))
    add("acrylic","panel","Saffire V tested a ribbed PMMA panel at 26.9% oxygen and 76.1 kPa in orbit. The flames advanced along rib edges. The observed downstream ignition was preceded by an upstream attempt with apparent loss of igniter contact. These observations cannot supply a rod spread speed, a panel ignition probability or a general cabin safety rating.","Saffire V panel geometry rib sheet spark acrylic versus rod oxygen ignition failed upstream test",dict(title="Opposed Flame Spreading Along a Structured PMMA Sample",url="https://ntrs.nasa.gov/citations/20210017785",locator="Figs. 6–9, 14–15, specimen, ignition and edge speeds"))
    incident_archive = read("incidents.json")
    for record in incident_archive["records"]:
        for facet, facts in record["facts"].items():
            for number, fact in enumerate(facts, 1):
                source = incident_archive["sources"][fact["source"]]
                add(record["id"], f"{facet}-{number}", fact["text"], record["name"] + " " + facet, source)
    extend_methods(docs)
    extend_reports(docs)
    return docs, rows


def extend_methods(docs):
    """Include additional source-linked research context; local reports supply research methods."""
    known = {"1. LUCI": "sibal", "2. Saffire": "saffire", "3. FLEX": "flex", "4. SAME":"same", "5. CFI":"cfig", "6. ICES":"ices", "7. FM":"fm2"}
    lines=(ROOT/"research/review.md").read_text().splitlines()
    topic=None
    for i,line in enumerate(lines):
        if line.startswith("##"):
            topic=None
        for prefix, key in known.items():
            if line.startswith("**"+prefix):
                topic=key
        if not topic or not line.strip():
            continue
        links=re.findall(r"\[([^\]]+)\]\((https?://[^\s)]+)\)",line)
        if not links:
            continue
        prose=re.sub(r"\[[^\]]+\]\([^\s)]+\)","",line).replace("**","").strip(" ,·")
        if len(prose)<100:
            continue
        # Cite the local synthesis so its multiple supporting primary links stay together.
        docs.append(Passage(topic+f":review{i}","FIRST FIRE research review","#report/review",
                            "Experiments and counterevidence · "+NAMES[topic].split()[0],
                            prose, NAMES[topic]+" scope published analysis"))

def extend_reports(docs):
    """Index complete, attributable scientific paragraphs. Evaluation banks are never input."""
    reports = {
        "data": ("archive", {"Measuring conditions and endpoints", "Consequential counterexamples"}),
        "forecast": ("fm2", {"One event per burn", "Reproduce the illustrative model", "How uncertain is the travel estimate?"}),
        "advanced-methods": ("methods", {"Match before revealing the outcomes", "Model a remote tracer sensor", "Choose the next experiment"}),
        "master-physics": ("physics-lab", None),
        "video-measurement": ("imaging", None),
        "transport-fit": ("transport", {"What the model estimates", "Read the synthetic example"}),
        "world-model": ("world-model", {"Compare the model with the Saffire-I record", "Validation with sensor traces", "Tracer transport experiment", "Chat-to-solver boundary"}),
    }
    for name, (topic, sections) in reports.items():
        title = heading = ""
        code = False
        for line_no, line in enumerate((ROOT / "research" / (name + ".md")).read_text().splitlines(), 1):
            if line.startswith("```"):
                code = not code
                continue
            if code:
                continue
            if line.startswith("# "):
                title = line[2:].strip()
            if line.startswith(("## ", "### ")):
                heading = line.lstrip("# ").strip()
                continue
            if not heading or (sections is not None and heading not in sections):
                continue
            if line.startswith(("|", "!", "    ")):
                continue
            # The linked local report retains original tables, equations and primary sources.
            text = re.sub(r"\s*\[[^\]]+\]\([^\s)]+\)", "", line)
            text = text.replace("**", "").replace("`", "").lstrip("*- ").strip(" ·")
            if not 85 <= len(text) <= 1550 or not re.match(r"[A-Za-z0-9]", text):
                continue
            docs.append(Passage(f"{topic}:{name}-{line_no}", "FIRST FIRE · " + title,
                                "#report/" + name, heading + f" · source line {line_no}",
                                text, heading))

def fundamentals():
    title="NASA OCHMO · Fire Protection technical brief"
    url="https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-008-fire-protection.pdf"
    return [
        Passage("physics:fire",title,url,"Overview and Fire Prevention, OCHMO-TB-008",
          "A fire needs fuel, an oxidizer such as oxygen, and sufficient heat for ignition and continued reaction. Heat release can sustain the flame. Removing a necessary condition can extinguish it.",
          "what is combustion fire triangle heat fuel oxygen ignition and extinction"),
        Passage("physics:flow",title,url,"Overview, natural convection and ventilation",
          "On Earth, heated gas rises through buoyancy and draws cooler oxygen-bearing air toward a flame. Orbital microgravity greatly reduces this natural convection. Oxygen can diffuse toward the flame, and cabin ventilation can provide forced airflow that changes its shape, spread and persistence.",
          "why fire burns in space oxygen buoyancy diffusion ventilation fan air flame direction smoke"),
        Passage("physics:candle","NASA Glenn · Candle Flame, 1 g versus microgravity",
          "https://www.nasa.gov/image-article/candle-flame-1g-vs-microgravity/","Candle comparison image and caption",
          "An Earth candle tends toward a pointed flame as hot gases rise. In weak flow in orbital microgravity, reduced buoyant convection lets oxygen diffuse in from many directions and the flame can become rounder, blue and less sooty. Ventilation or a different fuel can change that behavior.",
          "round spherical shape blue yellow candle flame microgravity astronaut space"),
        Passage("physics:gravity","NASA Glenn · Zero Gravity Research Facility",
          "https://www.nasa.gov/podcasts/small-steps-giant-leaps/small-steps-giant-leaps-episode-161-nasas-zero-gravity-research-facility/","Discussion of free fall and drop-tower flame research",
          "Orbiting spacecraft and their contents fall together, producing apparent weightlessness or microgravity. The Moon's surface has partial gravity of about one-sixth of Earth's. Researchers can approximate different regimes using free fall, parabolic aircraft and rotating apparatus. Gravity and observation duration must be recorded separately.",
          "what is microgravity versus lunar or zero gravity moon ISS drop tower free fall"),
        Passage("physics:risks","NASA · Why NASA is studying flames in space",
          "https://science.nasa.gov/biological-physical/resources/explainers-infographics/why-nasa-is-studying-flames-in-space/","How to study fire in microgravity",
          "Ground and space experiments help researchers understand flame spread, extinguishment and material behavior, informing spacecraft fire detection, prevention and suppression. Results transfer only within the tested fuel, geometry, atmosphere, gravity, ventilation and measured endpoint.",
          "why study fire safety astronauts habitats researchers work compare different experiments basics"),
    ]
