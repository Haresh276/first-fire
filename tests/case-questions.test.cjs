const {test} = require('node:test');
const assert = require('node:assert/strict');
const {ask} = require('../site/case-questions.js');
const cases = require('../data/cases.json');
const getCase = id => cases.find(c => c.id === id);

test('free wording retrieves the correct type of evidence and an attributable source across the case library', () => {
  const questions = [
    ['same', 'How frequently did the ISS detector miss Teflon smoke?', /two-thirds/i],
    ['saffire', 'What was damaged on the Nomex fabric after the acrylic burned?', /blackened/i],
    ['sibal', 'How did the fabric flame speed change at lunar gravity?', /1\.5 at 1 g/],
    ['flex', 'How large was the heptane droplet at visible extinction?', /2\.52 mm/],
    ['cfig', 'Which gas was flowing inside the oxygen burner during the inverse tests?', /85% oxygen burner/],
    ['ices', 'How did polycarbonate and tape compare in lunar gravity?', /WSTF/],
    ['fm2', 'What oxygen levels are planned for the fabric on the moon?', /37%, 33%, 29% and 25%/]
  ];
  for (const [id, question, expected] of questions) {
    const reply = ask(getCase(id), question);
    assert.equal(reply.status, 'evidence', question);
    assert.match(reply.entries.map(entry => entry.text).join(' '), expected);
    for (const entry of reply.entries) {
      assert(entry.sources.length);
      assert(entry.sources.every(s => s.title && s.locator && s.url));
    }
  }
});

test('an unavailable measurement and unrelated queries cannot silently become detector answers', () => {
  const same = getCase('same');
  const timing = ask(same, 'How many seconds before a Teflon smoke alarm in the crew cabin?');
  assert.equal(timing.status, 'gap');
  assert.match(timing.message, /time to alarm/);
  assert.equal(ask(same, 'What temperature did the Teflon smoke reach?').status, 'gap');
  for (const q of ['', 'Who won the cricket match?', 'What happened to the Apollo 13 astronauts?', 'Who manufactured the smoke detector?', 'Does Teflon smoke kill pets?', 'What was the smoke detector signal on run 99999?']) {
    assert.equal(ask(same, q).status, 'gap');
  }
});

test('next-test requests distinguish suggested work from observed evidence', () => {
  const follow = ask(getCase('same'), 'Which detector experiment should we test next?');
  assert.equal(follow.status,'evidence');
  assert.equal(follow.entries[0].label,'Suggested next test');
  assert.match(follow.entries[0].text,/nuisance alarms/);
  const dust = ask(getCase('same'), 'How would you test whether dust causes false alarms?');
  assert.equal(dust.entries[0].label, 'Suggested next test');
});

test('matching one side of a comparison keeps its own NASA row locator', () => {
  const c = getCase('same');
  const rows = [['A comparison', 'Teflon specimen 56', 'The unaged microscopy specimen is run 56.', 'Detector verdict', 'Run-level sensitivity is unresolved.', '#data?study=PSI-101&q=PSI-101%3A1%3A74', c.sources[0].url]];
  const reply = ask(c, 'Where is the unaged microscopy specimen for Teflon run 56?', rows);
  assert.equal(reply.entries[0].title, 'Teflon specimen 56');
  assert.match(reply.entries[0].sources[0].locator, /PSI-101:1:74/);
});
