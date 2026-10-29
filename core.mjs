export const LIMITS = { passages: 32, passageChars: 500, queryChars: 240 };
export function parseArchive(text) {
  if (typeof text !== 'string' || text.length > 18000) throw new Error('Archive is too large. Use at most 32 short passages.');
  const lines = text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
  if (!lines.length || lines.length > LIMITS.passages) throw new Error('Use 1–32 passages, separated by blank lines.');
  if (lines.some(x=>x.length > LIMITS.passageChars)) throw new Error('Each passage must be at most 500 characters.');
  return lines.map((text,i)=>({id:`P${i+1}`,room:'Your archive',title:`Passage ${i+1}`,text}));
}
export function validateQuery(q) {
  if (typeof q !== 'string' || !q.trim() || q.trim().length > LIMITS.queryChars) throw new Error('Enter a question of 1–240 characters.');
  return q.trim();
}
export function dot(a,b) {
  if (a.length !== b.length || !a.length || a.some(x=>!Number.isFinite(x)) || b.some(x=>!Number.isFinite(x))) throw new Error('Invalid embeddings.');
  return a.reduce((sum,x,i)=>sum+x*b[i],0);
}
export function semanticRank(records, vectors, queryVector) {
  if (records.length !== vectors.length) throw new Error('Passage/vector count differs.');
  return records.map((record,i)=>({...record,score:dot(vectors[i],queryVector)})).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id)).slice(0,3);
}
const stops = new Set('a an the what why how is did do i it after to of and in someone'.split(' '));
function words(s) { return new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(w=>!stops.has(w))); }
export function keywordRank(records,query) {
  const q=words(query);
  return records.map(r=>({...r,score:[...q].filter(w=>words(r.text).has(w)).length})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id)).slice(0,3);
}
export function exportTrail(pinned) {
  return '# Ghostlight evidence trail\n\n'+pinned.map(r=>`## [${r.id}] ${r.title}\nQuery: ${r.query.replace(/\n/g,' ')}\n\n${r.text}\n`).join('\n')+'\nRetrieved passages are leads, not proof of an answer.\n';
}
