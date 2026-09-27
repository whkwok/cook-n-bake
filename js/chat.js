import sqlite3InitModule from './vendor/sqlite-wasm/sqlite3.mjs';
import { answerQuestion } from './rag.js';

const DB_URL = 'data/academy.db';

let dbPromise;

function appendText(parent, tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function sourceLabel(hit) {
  return `${hit.source} — ${hit.section || hit.title}`;
}

async function loadDb() {
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

function renderSources(log, hits) {
  if (!hits.length) return;

  const list = document.createElement('ul');
  list.className = 'assistant-sources';
  hits.forEach(hit => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = hit.href || '#';
    link.dataset.assistantResult = '';
    link.textContent = sourceLabel(hit);
    item.append(link);
    list.append(item);
  });
  log.append(list);
}

export async function askCourseAssistant(question, log) {
  log.replaceChildren();
  appendText(log, 'p', 'assistant-message', 'Searching the academy database…');

  try {
    const db = await loadDb();
    const result = answerQuestion(db, question, 3);
    log.replaceChildren();
    appendText(log, 'p', 'assistant-message assistant-message-answer', result.answer);
    renderSources(log, result.hits);
  } catch (error) {
    console.error(error);
    log.replaceChildren();
    appendText(log, 'p', 'assistant-message', 'The course assistant could not load its SQLite database. Please email enrol@cookbakeacademy.sg.');
  }
}
