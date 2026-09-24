import sqlite3InitModule from './vendor/sqlite-wasm/sqlite3.mjs';

const DB_URL = 'data/academy.db';
const STOP_WORDS = new Set([
  'a', 'an', 'any', 'are', 'about', 'and', 'at', 'can', 'class', 'classes',
  'course', 'courses', 'do', 'does', 'for', 'from', 'have', 'i', 'in', 'is',
  'me', 'of', 'on', 'or', 'our', 'please', 'show', 'tell', 'the', 'there',
  'to', 'what', 'which', 'with', 'you'
]);

let dbPromise;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function formatMoney(value) {
  return `S$${new Intl.NumberFormat('en-SG', {
    maximumFractionDigits: 0
  }).format(value)}`;
}

function tokenize(question) {
  return question
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(term => term.length > 1 && !STOP_WORDS.has(term)) || [];
}

function ftsQuery(question) {
  return tokenize(question).slice(0, 8).map(term => `${term}*`).join(' OR ');
}

function queryRows(db, sql, bind = []) {
  const rows = [];
  db.exec({ sql, bind, rowMode: 'object', resultRows: rows });
  return rows;
}

function courseFilters(question) {
  const filters = [];
  const bind = [];
  const lower = question.toLowerCase();
  const budgetMatch = lower.match(/(?:under|below|less than|max(?:imum)?|budget)\s*(?:s\$|\$)?\s*(\d{2,4})/);

  if (/\bbak(e|ing|ery|bread|pastry|cake|cookie|macaron|chocolate|tart)\b/.test(lower)) {
    filters.push('cat = ?');
    bind.push('Bakery');
  }
  if (/\bcook(ing)?\b|\bculinary\b|\bthai\b|\bitalian\b|\bjapanese\b|\bvegan\b|\bwok\b|\bcurry\b|\bknife\b|\bbbq\b/.test(lower)) {
    filters.push('cat = ?');
    bind.push('Cooking');
  }
  if (/\bbeginner\b/.test(lower)) {
    filters.push('level = ?');
    bind.push('Beginner');
  }
  if (/\bintermediate\b/.test(lower)) {
    filters.push('level = ?');
    bind.push('Intermediate');
  }
  if (/\badvanced\b/.test(lower)) {
    filters.push('level = ?');
    bind.push('Advanced');
  }
  if (/\borchard\b/.test(lower)) {
    filters.push('campus = ?');
    bind.push('Orchard Road');
  }
  if (/\bbukit\b|\btimah\b/.test(lower)) {
    filters.push('campus = ?');
    bind.push('Bukit Timah');
  }
  if (/\bweekend\b|\bsaturday\b|\bsunday\b/.test(lower)) {
    filters.push('(when_text LIKE ? OR when_text LIKE ?)');
    bind.push('%Saturday%', '%Sunday%');
  }
  if (/\bevening\b|\bnight\b|\bafter work\b/.test(lower)) {
    filters.push('when_text LIKE ?');
    bind.push('%7:00pm%');
  }
  if (budgetMatch) {
    filters.push('fee <= ?');
    bind.push(Number(budgetMatch[1]));
  }

  return { where: filters.length ? `WHERE ${filters.join(' AND ')}` : '', bind };
}

function courseQuestion(question) {
  return /\bcourse|courses|class|classes|fee|fees|price|cost|budget|under|below|intake|schedule|beginner|intermediate|advanced|campus|orchard|bukit|timah|baking|bakery|cooking\b/i.test(question);
}

function knowledgeQuestion(question) {
  return /\brefund|refunds|cancel|cancellation|parking|park|allergy|allergies|allergen|nut|nuts|bring|address|nearest|mrt|faq|policy|policies|transfer|make[- ]?up|replacement\b/i.test(question);
}

function answerFromCourses(db, question) {
  const { where, bind } = courseFilters(question);
  const [{ total }] = queryRows(
    db,
    `SELECT COUNT(*) AS total
     FROM courses
     ${where}`,
    bind
  );
  const rows = queryRows(
    db,
    `SELECT code, title, cat, level, weeks, fee, campus, when_text, intakes
     FROM courses
     ${where}
     ORDER BY cat, code
     LIMIT 6`,
    bind
  );

  if (!rows.length) return null;

  return {
    type: 'courses',
    rows,
    html: `
      <p class="assistant-message assistant-message-answer">I found ${total} matching course${total === 1 ? '' : 's'} in the database${total > rows.length ? `, showing the first ${rows.length}` : ''}.</p>
      <ul class="assistant-results">
        ${rows.map(course => {
          const intakes = JSON.parse(course.intakes).join(', ');
          return `
            <li>
              <a href="#course-${escapeHtml(course.code)}" data-assistant-result>
                <strong>${escapeHtml(course.code)} · ${escapeHtml(course.title)}</strong>
                <span>${escapeHtml(course.level)} · ${escapeHtml(course.campus)} · ${escapeHtml(course.when_text)}</span>
                <span>${course.weeks} week${course.weeks === 1 ? '' : 's'} · ${formatMoney(course.fee)} · Intakes: ${escapeHtml(intakes)}</span>
              </a>
            </li>`;
        }).join('')}
      </ul>`
  };
}

function answerFromKnowledge(db, question) {
  const query = ftsQuery(question);
  if (!query) return null;

  const rows = queryRows(
    db,
    `SELECT title, section, url, body
     FROM chunks
     WHERE chunks MATCH ?
     ORDER BY bm25(chunks)
     LIMIT 3`,
    [query]
  );

  if (!rows.length) return null;

  return {
    type: 'knowledge',
    rows,
    html: `
      <p class="assistant-message assistant-message-answer">${escapeHtml(rows[0].body)}</p>
      <ul class="assistant-sources">
        ${rows.map(row => `
          <li>
            <strong>${escapeHtml(row.section)}</strong>
            <span>${escapeHtml(row.title)}</span>
          </li>`).join('')}
      </ul>`
  };
}

async function loadDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const [sqlite3, response] = await Promise.all([
      sqlite3InitModule({
        locateFile: file => `js/vendor/sqlite-wasm/${file}`
      }),
      fetch(DB_URL)
    ]);
    if (!response.ok) throw new Error(`Database request failed (${response.status})`);

    const bytes = new Uint8Array(await response.arrayBuffer());
    const db = new sqlite3.oo1.DB(':memory:', 'c');
    const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
    const rc = sqlite3.capi.sqlite3_deserialize(
      db.pointer,
      'main',
      pointer,
      bytes.length,
      bytes.length,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
    );
    db.checkRc(rc);
    return db;
  })();

  return dbPromise;
}

export async function askKnowledgeBase(question) {
  const db = await loadDatabase();
  return (knowledgeQuestion(question) && answerFromKnowledge(db, question))
    || (courseQuestion(question) && answerFromCourses(db, question))
    || answerFromKnowledge(db, question)
    || answerFromCourses(db, question)
    || {
      type: 'empty',
      rows: [],
      html: '<p class="assistant-message assistant-message-answer">I could not find that in the SQLite database. Try asking about refunds, parking, allergies, fees, dates, campuses, or a course topic.</p>'
    };
}
