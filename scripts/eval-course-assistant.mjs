import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3InitModule from '../node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3-node.mjs';
import { answerQuestion } from '../js/rag.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(rootDir, 'data', 'academy.db');
const csvPath = path.join(rootDir, 'eval', 'golden-questions.csv');

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const fields = parseCsvLine(header);
  return lines.map(line => Object.fromEntries(parseCsvLine(line).map((value, index) => [fields[index], value])));
}

async function openDb() {
  const file = await fs.readFile(dbPath);
  const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  const sqlite3 = await sqlite3InitModule();
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
}

function sourceMatches(actual, expected) {
  if (expected === '*') return actual.length > 0;
  if (expected === 'REFUSE') return actual.length === 0;
  const options = expected.split('|');
  return actual.some(source => options.includes(source));
}

function textMatches(answer, mustContain) {
  if (!mustContain) return true;
  return answer.toLowerCase().includes(mustContain.toLowerCase());
}

const db = await openDb();
const cases = parseCsv(await fs.readFile(csvPath, 'utf8'));
const failures = [];

for (const item of cases) {
  const result = answerQuestion(db, item.question, 3);
  const sources = result.hits.map(hit => hit.source);
  const sourceOk = sourceMatches(sources, item.expected_source);
  const textOk = item.expected_source === 'REFUSE'
    ? result.refused
    : textMatches(result.answer, item.must_contain);

  if (!sourceOk || !textOk) {
    failures.push({
      id: item.id,
      question: item.question,
      expected_source: item.expected_source,
      must_contain: item.must_contain,
      sources,
      answer: result.answer
    });
  }
}

db.close();

const passed = cases.length - failures.length;
console.log(`${passed}/${cases.length}`);

if (failures.length) {
  for (const failure of failures) {
    console.log(JSON.stringify(failure));
  }
  process.exitCode = 1;
}
