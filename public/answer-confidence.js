/* Estimate whether the entire displayed reply would pass an independent answer rubric. */
(() => {
  'use strict';
  const stopWords = new Set(('a an the is are was were be been being has have had did do does how what when which where who can could would should may might we us our i me my you your they them their as of by from in on into to at for with about this these those that it its and or but if than then also tell give please question answer experiment experimenter study test source archive results result').split(' '));
  const featureNames = ['quantitativeReceipt','reviewed','quotationOnly','withheld','targetedBoundary','questionOverlap','multiPart','sourceCount'];
  function terms(text) {
    const words = String(text || '').normalize('NFKC').toLowerCase().match(/[a-z0-9]+/g) || [];
    return new Set(words.filter(word => !stopWords.has(word)).map(word => word.length > 4 && word.endsWith('s') ? word.slice(0,-1) : word));
  }
  function features(question, turn) {
    const answer = turn.answer || '', kind = turn.evidenceKind || '', sources = turn.sources || [];
    const status = turn.status || '';
    const withheld = ['withheld','input-needed'].includes(kind) || status === 'abstained';
    const quantitative = ['archive-row','calculation','tool-calculation','archive-calculation'].includes(kind);
    const words = terms(question), supplied = terms(answer);
    const overlap = [...words].filter(word => supplied.has(word)).length / Math.max(1, words.size);
    // A specific, explained boundary is distinguishable from an unsuccessful source search.
    const concreteBoundary = /(?:no (?:observed|measured|verified|recorded|published)|cannot (?:certify|infer|derive|determine)|would require|outside (?:the|this)|not (?:reported|measured|published|recorded|observed)|unresolved|would need|not yet)/i.test(answer);
    return [Number(quantitative), Number(kind === 'checked' || turn.verification?.checks?.interpretation?.state === 'pass'),
      Number(kind === 'quote-only' || kind === 'mission-note'), Number(withheld),
      Number((withheld || status === 'limited') && concreteBoundary), overlap,
      Number(/\b(?:compare|comparison|reconcile|whereas|versus|respectively|difference|both|counterfactual|extrapolat\w*)\b/i.test(question) || (question.match(/\?/g) || []).length > 1),
      Math.min(3,sources.length) / 3];
  }
  function sigmoid(logit) {
    return 1 / (1 + Math.exp(-Math.max(-30,Math.min(30,logit))));
  }
  function predict(question,turn,fit) {
    if (!fit) throw new Error('Answer calibration fit is unavailable');
    if (fit.features.join('|') !== featureNames.join('|') || fit.weights.length !== featureNames.length || fit.centers.length !== featureNames.length) throw new Error('Incompatible answer calibration fit');
    const x=features(question,turn);
    const linear=fit.weights.reduce((sum,weight,i)=>sum+weight*(x[i]-fit.centers[i]),fit.intercept);
    return {probability:Number(sigmoid(linear).toFixed(6)),model:fit.version,event:'full-reply-rubric-pass'};
  }
  const api={featureNames,features,predict,sigmoid};
  if(typeof module !== 'undefined')module.exports=api;
  if(typeof globalThis !== 'undefined')globalThis.FFAnswerConfidence=api;
})();
