/* Replay frozen model responses through the same browser gate and original Python scoring rubric. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=(...name)=>fs.readFileSync(path.join(root,...name),'utf8');
const json=(...name)=>JSON.parse(read(...name));
const hash=string=>crypto.createHash('sha256').update(string).digest('hex');
globalThis.window=globalThis;
require('../dist/records.js');
require('../dist/forecast-ui.js');
require('../dist/referee-reviews.js');
require('../dist/referee-passages.js');
require('../dist/referee-deck.js');
globalThis.FFLoadAsset=async name=>{
  if(name==='observation-rows.js')require('../dist/observation-rows.js');
};
async function run(){
  const suite=json('tests/chat/questions.json'), input=read('research/chat-runs/incident-v21/responses.jsonl');
  if(hash(read('tests/chat/questions.json'))!==read('tests/chat/questions.sha256').split(/\s+/)[0])throw Error('Question checksum mismatch.');
  const originals=new Map(input.trim().split('\n').map(row=>{const r=JSON.parse(row);return [r.id,r.response];}));
  const rows=[];
  for(const question of suite.questions){
    const raw=originals.get(question.id);
    if(!raw)throw Error('Missing '+question.id);
    const answer=FFDeckReferee.forecastAnswer(question.message)||await FFDeckReferee.checkedReply(question.message,
      {answer:raw.answer,sources:raw.citations,status:raw.status,mode:'local'});
    rows.push({id:question.id,difficulty:question.difficulty,question:question.message,status:answer.status,
      kind:answer.evidenceKind,answer:answer.answer,citations:answer.sources});
  }
  const scorer=[
    'import json,sys','from benchmark_chat import load_suite,score','s=load_suite()','r=json.load(sys.stdin)',
    'print(json.dumps([score(q,a,s["sources"]) for q,a in zip(s["questions"],r)]))'
  ].join('\n');
  const proc=spawnSync('python3',['-c',scorer],{cwd:__dirname,input:JSON.stringify(rows),encoding:'utf8',maxBuffer:1e7});
  if(proc.status!==0)throw Error(proc.stderr);
  const scores=JSON.parse(proc.stdout);
  const summary={total:rows.length};
  if(summary.total!==100)throw Error('Expected 100 answers');
  for(const key of ['strict_pass','answer_content_pass','behavior_pass','citation_pass']){
    const eligible=scores.filter(s=>s[key]!==null);summary[key]={passed:eligible.filter(s=>s[key]).length,eligible:eligible.length};
  }
  for(const key of ['difficulty','kind','status']){
    summary[key]={};
    for(const [i,row] of rows.entries()){
      const id=row[key]||'unclassified';
      const group=summary[key][id]||={n:0,strict:0};group.n++;group.strict+=Number(scores[i].strict_pass);
    }
  }
  for(const [i,row] of rows.entries()){
    const score=scores[i];row.strict=score.strict_pass;row.content=score.answer_content_pass;row.citation=score.citation_pass;row.behavior=score.behavior_pass;
  }
  const old=json('research/chat-runs/incident-v21/summary.json').overall.strict_pass;
  const metadata={method:'The saved Qwen responses from FIRST FIRE v2.1 were replayed through the browser gate and FM² calculator with the default reading level. The original model received the frozen dialogue histories. Each replay consumed the current question and its archived response. The original scoring code assessed the displayed answer and citations. No new retrieval or language-model inference was timed in this run.',source_strict:old,source_sha256:hash(input),suite_sha256:hash(read('tests/chat/questions.json')),scorer_sha256:hash(read('scripts/benchmark_chat.py')),renderer_sha256:hash(read('dist/referee-deck.js'))};
  fs.writeFileSync(path.join(root,'site/referee-replay.json'),JSON.stringify({metadata,summary,rows},null,2)+'\n');
  const labels={checked:'Independent review passed',calculation:'FM² model calculation','quote-only':'Verified quotation only','archive-note':'Attributed archival note','mission-note':'Attributed mission history',withheld:'Abstention','input-needed':'Clarification needed'};
  const table=data=>'\n| Group | Strict passes | Questions |\n|---|---:|---:|\n'+Object.entries(data).map(([key,value])=>'| '+(labels[key]||key)+' | '+value.strict+' | '+value.n+' |').join('\n')+'\n';
  const report=['# Research chat after evidence checks',metadata.method,
    'The original run passed '+old.passed+'/'+old.eligible+' on the full rubric. After checking and displaying the evidence, '+summary.strict_pass.passed+'/'+summary.strict_pass.eligible+' passed. These questions were used during development. A replay exposed off-target answers about FLEX droplet size and imaging, and developers corrected them before recording these results. Performance on new questions and against ordinary search requires separate testing.',
    '## What passed',
    'The rubric scored required content and absence of contradictions on '+summary.answer_content_pass.eligible+' answers ('+summary.answer_content_pass.passed+' passed), expected answer behavior on '+summary.behavior_pass.eligible+' ('+summary.behavior_pass.passed+' passed), and citation coverage on '+summary.citation_pass.eligible+' ('+summary.citation_pass.passed+' passed). A strict pass requires every applicable check. The published rubric accepts limited responses for some questions.',
    '## What the reader receives',table(summary.kind),
    'An attributed note reproduces a stored research note or normalized row. A source locator lets a reader inspect it. A checked interpretation also has a matched quotation, an independent judgment for that exact claim, and any applicable quantitative checks. A quotation-only reply supplies authenticated words when the proposed interpretation could not clear every check. An abstention withholds an unsupported answer.',
    '## Scores by question difficulty',table(summary.difficulty),
    '## An answer-level failure',
    'Question Q002 asks which LUCI fabric flame lasted longer. The checked sentence reports that extinction came earlier at Earth gravity. It preserves the meaning of the record, but the frozen content check expects the words “longer” or “later” with “lunar” or “partial”. Q090 asks for an invented material-level count. The gate withholds the figure. The rubric also requires a source-backed contrast, so the uncited abstention misses that item. These answer-level scores measure wording, coverage and behavior together.',
    '## Reproduce the replay',
    'Build the release with `python3 scripts/build.py`, then run `node scripts/replay_referee.cjs`. The per-question output includes displayed text, sources, individual scoring results, and SHA-256 fingerprints of the frozen inputs, scoring code and gate.',
    '[Download all 100 replayed answers and scores](referee-replay.json)'].join('\n\n')+'\n';
  fs.writeFileSync(path.join(root,'research/referee-replay.md'),report);
  console.log(JSON.stringify({summary,previous:old},null,2));
}
run().catch(error=>{console.error(error);process.exitCode=1;});
