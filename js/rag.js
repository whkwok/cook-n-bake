const REFUSAL = "I can only answer questions about Cook & Bake's courses, schedules, fees, campuses and policies… Please contact us at enrol@cookbakeacademy.sg.";

const STOPWORDS = new Set([
  'a', 'an', 'any', 'are', 'as', 'at', 'be', 'can', 'do', 'does', 'for',
  'from', 'give', 'have', 'i', 'if', 'in', 'is', 'it', 'me', 'my', 'now',
  'of', 'on', 'or', 'our', 'print', 'the', 'there', 'to', 'what', 'which',
  'with', 'you', 'your'
]);

const COURSE_CODES = /\b(?:BAK|CUL)-\d{3}\b/gi;

function rows(db, sql, bind = []) {
  const resultRows = [];
  db.exec({ sql, bind, rowMode: 'object', resultRows });
  return resultRows;
}

function quoteTerm(term) {
  return `"${term.replaceAll('"', '""')}"`;
}

function tokens(text) {
  return String(text).toLowerCase().match(/[a-z0-9]+/g) || [];
}

function expandedTokens(text) {
  const lower = String(text).toLowerCase();
  const terms = tokens(lower).filter(term => term.length > 1 && !STOPWORDS.has(term));

  const expansions = [
    [/\bhow long\b|\bduration\b/, ['duration', 'weeks']],
    [/\bwhen\b|\bstart\b|\bstarts\b|\bintake\b|\bintakes\b/, ['intakes', 'schedule']],
    [/\bhow much\b|\bprice\b|\bcost\b|\bfee\b|\bfees\b/, ['fee']],
    [/\bwhere\b|\blocation\b|\bcampus\b/, ['address', 'campus']],
    [/\ballerg(?:y|ies|en|ens)\b|\bnut\b|\bnuts\b|\bpeanut\b|\bpeanuts\b/, ['allergens', 'ingredients']],
    [/\bbak(?:e|ing|ery)\b/, ['bakery']],
    [/\bcook(?:ing)?\b|\bculinary\b/, ['cooking', 'culinary']],
    [/\bskillfuture\b/, ['skillsfuture']],
    [/\bbring\b|\bwear\b|\bapron\b/, ['bring', 'wear', 'aprons']],
    [/\bpay\b|\bpayment\b/, ['pay', 'payment']],
    [/\bsharpen(?:ing)?\b|\bknife\b/, ['sharpen', 'sharpening', 'whetstone']]
  ];

  for (const [pattern, words] of expansions) {
    if (pattern.test(lower)) terms.push(...words);
  }

  for (const code of String(text).match(COURSE_CODES) || []) {
    terms.push(code.toLowerCase());
  }

  return [...new Set(terms)].slice(0, 12);
}

export function buildQuery(text) {
  return expandedTokens(text).map(quoteTerm).join(' OR ');
}

function isOffTopic(text) {
  return /\bweather\b|\btokyo\b|\brestaurant\b|\bpython\b|\bscript\b|\bsystem prompt\b|\bhidden instructions\b|\badmin\b/i.test(text)
    && !/\bcourse|courses|cook|bake|bakery|cooking|campus|refund|discount|fee|fees|class|classes\b/i.test(text);
}

function courseUrl(code) {
  return code ? `#course-${code}` : '#courses';
}

function sourceFromHit(hit) {
  if (hit.code) return hit.code;
  const code = `${hit.title || ''} ${hit.doc_id || ''}`.match(COURSE_CODES)?.[0];
  if (code) return code.toUpperCase();
  if ((hit.doc_id || '').includes('campuses')) return 'campuses';
  if ((hit.doc_id || '').includes('policies')) return 'policies';
  if ((hit.doc_id || '').includes('faq')) return 'faq';
  return hit.doc_id || hit.title || '';
}

function normalizeChunk(row) {
  const source = sourceFromHit(row);
  const code = source.match(COURSE_CODES)?.[0] || '';
  return {
    ...row,
    source,
    text: `${row.section}\n\n${row.body}`,
    href: code ? courseUrl(code) : (source === 'campuses' ? '#campuses' : source === 'faq' ? '#faq' : row.url || '#')
  };
}

function courseAnswer(db, text, k) {
  const lower = String(text).toLowerCase();
  const code = String(text).match(COURSE_CODES)?.[0]?.toUpperCase();

  if (/\bcampus\b|\bwhere\b/.test(lower) && /\bteach(?:es)?\b/.test(lower)) {
    return [];
  }

  if (/\bcheapest\b/.test(lower)) {
    return rows(db, 'SELECT code, title, level, weeks, fee, campus, when_text, summary, allergens, intakes FROM courses ORDER BY fee ASC LIMIT ?', [k])
      .map(courseHit);
  }

  if (/\bmost expensive\b|\bhighest\b/.test(lower)) {
    return rows(db, 'SELECT code, title, level, weeks, fee, campus, when_text, summary, allergens, intakes FROM courses ORDER BY fee DESC LIMIT ?', [k])
      .map(courseHit);
  }

  const budget = lower.match(/(?:under|below|less than|max(?:imum)?|budget)\s*(?:s\$|\$)?\s*(\d{2,4})/);
  if (budget) {
    return rows(db, 'SELECT code, title, level, weeks, fee, campus, when_text, summary, allergens, intakes FROM courses WHERE fee <= ? ORDER BY fee ASC LIMIT ?', [Number(budget[1]), k])
      .map(courseHit);
  }

  if (/\bhow much\b|\bfee\b|\bprice\b|\bcost\b/.test(lower)) {
    const terms = expandedTokens(text).filter(term => !['fee', 'course', 'courses'].includes(term));
    if (terms.length) {
      const clauses = terms.map(() => '(LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(code) = ?)');
      const termBind = terms.flatMap(term => [`%${term}%`, `%${term}%`, term.toUpperCase()]);
      const matches = rows(
        db,
        `SELECT code, title, level, weeks, fee, campus, when_text, summary, allergens, intakes
         FROM courses
         WHERE ${clauses.join(' OR ')}
         ORDER BY code
         LIMIT ?`,
        [...termBind, k]
      ).map(courseHit);
      if (matches.length) return matches;
    }
  }

  const filters = [];
  const bind = [];
  if (code) {
    filters.push('code = ?');
    bind.push(code);
  }
  if (/\bbeginner\b/.test(lower)) {
    filters.push('level = ?');
    bind.push('Beginner');
  }
  if (/\bbak(?:e|ing|ery)\b/.test(lower)) {
    filters.push('cat = ?');
    bind.push('Bakery');
  }
  if (/\bcook(?:ing)?\b|\bculinary\b/.test(lower)) {
    filters.push('cat = ?');
    bind.push('Cooking');
  }
  if (/\bvegan\b/.test(lower)) {
    filters.push('(title LIKE ? OR summary LIKE ? OR allergens LIKE ?)');
    bind.push('%Vegan%', '%vegan%', '%vegan%');
  }

  if (!filters.length) return [];

  bind.push(k);
  return rows(
    db,
    `SELECT code, title, level, weeks, fee, campus, when_text, summary, allergens, intakes
     FROM courses
     WHERE ${filters.join(' AND ')}
     ORDER BY code
     LIMIT ?`,
    bind
  ).map(courseHit);
}

function campusAnswer(db, text, k) {
  const lower = String(text).toLowerCase();
  if (!/\bcampus\b|\bwhere\b|\baddress\b|\bteach(?:es)?\b/.test(lower)) return [];

  let section = '';
  if (/\bbak(?:e|ing|ery)\b/.test(lower)) section = 'Orchard Road Bakehouse';
  if (/\bcook(?:ing)?\b|\bculinary\b/.test(lower)) section = 'Bukit Timah Culinary Campus';
  if (!section) return [];

  return rows(
    db,
    `SELECT doc_id, title, section, body, url
     FROM chunks
     WHERE doc_id = ? AND section = ?
     LIMIT ?`,
    ['campuses.md', section, k]
  ).map(normalizeChunk);
}

function courseHit(course) {
  const intakes = JSON.parse(course.intakes || '[]').join(', ');
  return {
    ...course,
    source: course.code,
    title: `${course.title} (${course.code})`,
    section: 'Course details',
    text: `${course.code} ${course.title}. ${course.level}. Duration: ${course.weeks} week${course.weeks === 1 ? '' : 's'}. Course fee: S$${Number(course.fee).toLocaleString('en-SG')}. Campus: ${course.campus}. Schedule: ${course.when_text}. Next intakes: ${intakes}. Allergens: ${course.allergens}. ${course.summary}`,
    href: courseUrl(course.code)
  };
}

export function search(db, text, k = 3) {
  if (isOffTopic(text)) return [];

  const campusHits = campusAnswer(db, text, k);
  if (campusHits.length) return campusHits;

  const courseHits = courseAnswer(db, text, k);
  if (courseHits.length) return courseHits.slice(0, k);

  const query = buildQuery(text);
  if (!query) return [];

  return rows(
    db,
    `SELECT doc_id, title, section, body, url, bm25(chunks, 0, 6, 3, 1, 0) AS score
     FROM chunks
     WHERE chunks MATCH ?
     ORDER BY score
     LIMIT ?`,
    [query, k]
  ).map(normalizeChunk);
}

export function extractiveAnswer(hits) {
  if (!hits.length) return REFUSAL;
  return hits[0].text;
}

export function answerQuestion(db, question, k = 3) {
  const hits = search(db, question, k);
  return {
    answer: extractiveAnswer(hits),
    hits,
    refused: hits.length === 0
  };
}

export { REFUSAL };
