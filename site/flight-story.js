/* Keep the caption and every review attached to the same frozen source row. */
'use strict';

const FlightCaption = (() => {
  const format = 'FIRST-FIRE/Saffire-caption/v1';
  const record = 'PSI-99:1:8';
  const fingerprint = '3c24390b9ef86f3d1ebaab911a1a3cc95a8759aebf42062371370e6d4b31b8ac';
  const limit = 20;
  const judgments = ['agree', 'dispute', 'uncertain'];

  function field(value, max, required = true) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
      throw Error('A required entry is missing or too long.');
    }
    return value.trim();
  }

  function create(caption, locator, author) {
    return {format, record, fingerprint, caption: field(caption,1200), locator: field(locator,400),
      author: field(author,100,false), reviews: []};
  }

  function checkedReview(review) {
    if (!judgments.includes(review?.judgment)) throw Error('Unrecognized reviewer judgment.');
    return {judgment: review.judgment, note: field(review.note,1200), credit: field(review.credit,100,false)};
  }

  function read(data) {
    if (data?.format !== format || data.record !== record || data.fingerprint !== fingerprint ||
        !Array.isArray(data.reviews) || data.reviews.length > limit) {
      throw Error('Choose a FIRST FIRE caption for this sample and source revision.');
    }
    return {...create(data.caption, data.locator, data.author), reviews: data.reviews.map(checkedReview)};
  }

  function append(data, review) {
    const original = read(data);
    if (original.reviews.length >= limit) throw Error('This copy already contains twenty reviews.');
    return {...original, reviews: [...original.reviews, checkedReview(review)]};
  }
  return {create, read, append};
})();

if (typeof module !== 'undefined') module.exports = FlightCaption;
if (typeof document !== 'undefined') {
  const el = id => document.getElementById(id);
  const feedback = {
    fabric: 'Read note 2 in NASA’s table. The acrylic was consumed and the Nomex had zero burn length. The 140 seconds timed the assembly.',
    assembly: 'This caption matches the component measurements. The acrylic burned, the fabric was damaged, and the stopwatch covered the assembly.',
    rating: 'This was one orbital exposure at about 22.1% oxygen and 20 cm/s airflow. A lunar rating needs measurements under the intended cabin conditions.'
  };
  el('choose').addEventListener('submit', event => {
    event.preventDefault();
    el('feedback').textContent = feedback[new FormData(event.currentTarget).get('interpretation')];
    el('evidence').open = true;
  });

  function download(record) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(record,null,2)+'\n'], {type:'application/json'}));
    const link = Object.assign(document.createElement('a'), {href:url, download:'saffire-2-7-review-'+record.reviews.length+'.json'});
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  el('write-caption').addEventListener('submit', event => {
    event.preventDefault();
    try {
      download(FlightCaption.create(el('caption-text').value, el('locator').value, el('author').value));
      el('written').textContent = 'Caption file prepared. Share the file with a second reader for review.';
    } catch (error) { el('written').textContent = error.message; }
  });

  let peer, selection = 0;
  function showPeer() {
    el('their-caption').textContent = peer.caption;
    el('their-source').textContent = (peer.author || 'Anonymous reader')+' · '+peer.locator;
    const history = peer.reviews.map(review => {
      const item = document.createElement('li');
      item.textContent = (review.credit || 'Anonymous reviewer')+' · '+review.judgment+' · '+review.note;
      return item;
    });
    el('review-history').replaceChildren(...history);
    el('loaded').hidden = false;
  }

  el('peer-file').addEventListener('change', async () => {
    const current = ++selection;
    peer = null; el('loaded').hidden = true; el('reply-status').textContent = ''; el('file-status').textContent = '';
    const file = el('peer-file').files[0];
    if (!file) return;
    try {
      if (file.size > 150000) throw Error('Choose a smaller caption JSON file.');
      const parsed = FlightCaption.read(JSON.parse(await file.text()));
      if (current !== selection) return;
      peer = parsed; el('reply').reset(); showPeer();
      el('file-status').textContent = 'Loaded this sample and source revision.';
    } catch (error) {
      if (current === selection) el('file-status').textContent = error instanceof SyntaxError ? 'Choose a valid caption JSON file.' : error.message;
    }
  });

  el('reply').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const result = FlightCaption.append(peer,{judgment:el('verdict').value, note:el('review-note').value, credit:el('credit').value});
      download(result);
      el('reply-status').textContent = 'Reviewed copy prepared with the original caption and your judgment.';
    } catch (error) { el('reply-status').textContent = error.message; }
  });
}
