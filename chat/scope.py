"""Evidence and capability checks independent of the language model's wording.

The endpoint answers questions about the local research material. It cannot read
attachments or external URLs, execute a simulation, certify hardware or create
a verifiable new quote from a paraphrase.
"""
import re
from dataclasses import dataclass
from .retrieval import norm, topics


@dataclass(frozen=True)
class Boundary:
    answer: str
    kind: str


def search(pattern,text):
    return re.search(pattern,text,re.I|re.S) is not None


DOMAIN = re.compile(r"\b(?:fires?|flamm(?:e|es|ability|able)|flames?|burn(?:s|ed|ing|er|ers)?|combust\w*|extin\w*|ignit\w*|oxidiz\w*|oxygen|oxidat\w*|gravity|gravit\w*|microgravity|lunar|aerosols?|smoke|buoyan\w*|propagat\w*|spread|diffusion|particle|soot|ventilat\w*|habitat|spacecraft|space|nasa|orbit\w*|sibal|luci|saffire|flex|s[aā]me[- ]r|cfi|fm2|ices|bass|psi|nomex|pmma|polycarbonate|p213|kapton|teflon|heptane|droplet|igniter|detector|alarm|archive|dataset|evidence|citation|benchmark|experiment|test cases|first fire|blind test|forecast|brier|threshold|material|apparatus|fluence|suppression|convection|fireproof|diffus\w*|research desk|assessor|source|catalog(?:ue)?|data explorer|cygnus|suit|same|thermal|degrees|flow|gas|earth|moon|mar[s,t]\w*)\b",re.I)
OFF_DOMAIN = re.compile(r"\b(?:stock price|astrology|horoscope|league|soccer|football|basketball|cricket|baseball|tennis|hockey|championship|bitcoin|cryptocurrency|movie|film director|novel|album|song|lyrics|pizza|recipe|president|poker|election|bank account|celebrity|movie star|world cup|box office|grammy|weather forecast|wicket|olympic medals?)\b",re.I)
GREETING = re.compile(r"^(?:hi|hey|hello|good afternoon|good morning)[\s!.?]*$",re.I)
ATTACHMENT = re.compile(r"\b(?:my|attached|uploaded|provided|this|following|above|below|enclosed)\s+(?:(?:raw|new|own|unseen|high[- ]resolution)\s+)*(?:file|image|photo(?:graph)?|attachment|video|spectrum|spectrogram|telemetry|screenshot|spreadsheet|csv|recording|logfile)\b|\b(?:file|image|photo|video|telemetry|trace|spreadsheet)\s+(?:I|we)\s+(?:attached|uploaded|sent)\b",re.I)
TRACE = re.compile(r"\b(?:spectrum|wavelengths?|spectral (?:line|peak)|telemetry stream|frame[- ]by[- ]frame|pixel (?:values|coordinates)|raw (?:sensor trace|waveform)|code signing key)\b",re.I)
AUTHORIZE = re.compile(r"\b(?:issue|grant|sign|give|write|certify|approve|declare|guarantee|authorize|stamp)\b.{0,65}\b(?:flight clearance|certificate|airworthiness|certification|flight[- ]ready|flight[- ]approved|safe to (?:fly|use)|safe for (?:crew|flight)|approved for (?:crew|flight)|launch clearance|qualification certificate)\b|\b(?:certify|approve|authorize|guarantee)\b.{0,65}\b(?:material|fabric|spacecraft|habitat|suit|cabin|textile|flight|safe)\b",re.I)
RECONSTRUCT = re.compile(r"(?:\b(?:actual|measured|observed|official|real|final|flight)\b.{0,50}\b(?:results?|outcomes?|launch date|land(?:ing|ed) date|burn date|extinction point|threshold|probabilit(?:y|ies))\b|\b(?:did|was|were|when)\b.{0,50}\b(?:land|launch|finish|resolve|happen|did burn|actually burn|happened on the moon)\b|\b(?:measured|actual|observed)\b.{0,35}\b(?:lunar surface|on the moon))",re.I)
SIMULATION = re.compile(r"\b(?:run|execute|solve|simulate|render|generate)\b.{0,70}\b(?:CFD|digital twin|simulation|trajectory|mesh|Navier.Stokes|heat flux map|temperature field|exact (?:time|temperature|flame))\b",re.I)
HARDWARE_INVENTION = re.compile(r"\b(?:unmeasured|fictional|unpublished|invented|made[- ]up|hypothetical|untested|imaginary|not yet tested|never tested)\b",re.I)
QUANTITATIVE = re.compile(r"\b(?:exact|numeric(?:al)?|number|probability|temperature|duration|delay|threshold|speed|pressure|seconds?|certif\w*|measure\w*)\b",re.I)
QUOTE = re.compile(r"(?:\b(?:provide|give|invent|extract|make|write|create|show|supply)\b.{0,20}\b(?:verbatim|direct quote|an? exact quote|quotation)\b|\bquote\b.{0,30}\bverbatim\b)",re.I)


def boundary(question,context,passages):
    q=norm(question); domain=bool(DOMAIN.search(context) or topics(context))
    if GREETING.fullmatch(q):
        return Boundary("Ask me about a spacecraft fire experiment, a source row, a material comparison, or the planned FM² burns.","greeting")
    if OFF_DOMAIN.search(q) or not domain:
        return Boundary("This local collection covers spacecraft combustion experiments and FIRST FIRE research methods. I have no source here for that question.","outside collection")
    if ATTACHMENT.search(q):
        return Boundary("I can read the text of this conversation and the frozen research records. I cannot inspect an attachment from this message. A NASA run ID and the measured values with their units would let me look for a matching record.","missing user data")
    if TRACE.search(q):
        return Boundary("The local evidence index does not contain the requested raw signal or spectral measurement. The original instrument record, calibration and timestamps are needed for that result.","missing instrument measurement")
    if AUTHORIZE.search(q):
        return Boundary("I cannot issue flight clearance or certify this material. That decision requires the applicable qualification procedure and authorized review of the actual assembly and operating conditions.","certification")
    if "fm2" in topics(context) and RECONSTRUCT.search(q) and not search(r"\b(?:hypothetical|planned|illustrative|assumed|expectation)\b",q):
        return Boundary("The reviewed FM² documents describe a planned experiment. There are no verified lunar outcomes in this archive and no confirmed launch date. An observed result needs a dated official flight record identifying the burn and its conditions.","unobserved mission result")
    if SIMULATION.search(q):
        return Boundary("This research chat has no validated physics solver attached. A numerical simulation requires the geometry, boundary conditions, material properties, transport and reaction models, and a validation case.","unavailable physics solver")
    if HARDWARE_INVENTION.search(q) and QUANTITATIVE.search(q) and not search(r"\b(?:brier|forecast|model|next test|how (?:to|would)|why|if we)\b",q):
        return Boundary("The properties requested for this untested or hypothetical case are unmeasured. No numerical value can be established from a related experiment without a validated transfer model or a matched test.","unmeasured material")
    if QUOTE.search(q):
        return Boundary("I can summarize the indexed records. To verify exact quoted wording, use the Quotation referee with the original source page. A paraphrase cannot establish a verbatim quotation.","verbatim verification")
    return None


def scope_limit(question,passages):
    q=norm(question)
    named=set(topics(question)); cited={p.topic for p in passages}
    if len(named)>1 and not named.issubset(cited):
        return "The selected sources cover only part of the requested comparison."
    fragments=" ".join(p.text for p in passages)
    warning=search(r"\b(?:unreported|unknown|unresolved|inconclusive|cannot (?:establish|certify|predict|give|isolate|identify|determine)|no verified|insufficient|unmeasured|unavailable)\b",fragments)
    if warning and search(r"\b(?:exact|prove|confirm|guarantee|always|every|universal|safe|certif\w*|rate for|validat\w*|caus\w*|appropriate|determine|threshold for|be sure|single|transfer)\b",q):
        return "The cited evidence leaves the requested conclusion unresolved."
    if search(r"\b(?:always|every|universal|guarantee|fireproof|flight[- ]safe)\b",q):
        return "The evidence applies to the reported tests. A general claim needs additional data."
    return ""
