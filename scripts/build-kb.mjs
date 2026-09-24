import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3InitModule from '../node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3-node.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const kbDir = path.join(rootDir, 'kb');
const coursesPath = path.join(rootDir, 'data', 'courses.json');
const outPath = path.join(rootDir, 'data', 'academy.db');

async function listMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(fullPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) return [fullPath];
    return [];
  }));

  return files.flat().sort((a, b) => a.localeCompare(b));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function relativeUrl(filePath, section) {
  const rel = path.relative(kbDir, filePath).replaceAll(path.sep, '/');
  const withoutExt = rel.replace(/\.md$/i, '');
  return `kb/${withoutExt}/#${slugify(section)}`;
}

function parseMarkdownChunks(filePath, markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const titleMatch = normalized.match(/^#\s+(.+?)\s*$/m);
  const title = titleMatch?.[1]?.trim() || path.basename(filePath, '.md');
  const headingRegex = /^##\s+(.+?)\s*$/gm;
  const headings = [...normalized.matchAll(headingRegex)];

  if (headings.length === 0) {
    return [{
      section: title,
      title,
      body: normalized.replace(/^#\s+.+?\s*$/m, '').trim(),
      url: relativeUrl(filePath, title)
    }];
  }

  return headings.map((heading, index) => {
    const bodyStart = heading.index + heading[0].length;
    const bodyEnd = headings[index + 1]?.index ?? normalized.length;
    const section = heading[1].trim();

    return {
      section,
      title,
      body: normalized.slice(bodyStart, bodyEnd).trim(),
      url: relativeUrl(filePath, section)
    };
  });
}

async function loadChunks() {
  const files = await listMarkdownFiles(kbDir);
  if (files.length === 0) {
    throw new Error(`No Markdown files found in ${kbDir}`);
  }

  const documents = await Promise.all(files.map(async (filePath) => ({
    filePath,
    markdown: await fs.readFile(filePath, 'utf8')
  })));

  return documents.flatMap(({ filePath, markdown }) => {
    const rel = path.relative(kbDir, filePath).replaceAll(path.sep, '/');
    return parseMarkdownChunks(filePath, markdown).map((chunk) => ({
      docId: rel,
      ...chunk
    }));
  });
}

function bindInsert(db, sql, rows, valuesForRow) {
  const stmt = db.prepare(sql);
  try {
    for (const row of rows) {
      stmt.bind(valuesForRow(row));
      stmt.step();
      stmt.reset();
    }
  } finally {
    stmt.finalize();
  }
}

async function main() {
  const [chunks, coursesRaw] = await Promise.all([
    loadChunks(),
    fs.readFile(coursesPath, 'utf8')
  ]);
  const courses = JSON.parse(coursesRaw);
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(':memory:', 'c');

  try {
    db.exec([
      'PRAGMA journal_mode=OFF;',
      'CREATE VIRTUAL TABLE chunks USING fts5(doc_id UNINDEXED, title, section, body, url UNINDEXED, tokenize = "porter unicode61");',
      `CREATE TABLE courses (
        code TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        cat TEXT NOT NULL,
        level TEXT NOT NULL,
        weeks INTEGER NOT NULL,
        fee INTEGER NOT NULL,
        campus TEXT NOT NULL,
        when_text TEXT NOT NULL,
        summary TEXT NOT NULL,
        allergens TEXT NOT NULL,
        intakes TEXT NOT NULL
      );`
    ]);

    bindInsert(
      db,
      'INSERT INTO chunks(doc_id, title, section, body, url) VALUES (?, ?, ?, ?, ?)',
      chunks,
      (chunk) => [chunk.docId, chunk.title, chunk.section, chunk.body, chunk.url]
    );

    bindInsert(
      db,
      `INSERT INTO courses(code, title, cat, level, weeks, fee, campus, when_text, summary, allergens, intakes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      courses,
      (course) => [
        course.code,
        course.title,
        course.cat,
        course.level,
        course.weeks,
        course.fee,
        course.campus,
        course.when,
        course.summary,
        course.allergens,
        JSON.stringify(course.intakes)
      ]
    );

    const bytes = sqlite3.capi.sqlite3_js_db_export(db.pointer);
    await fs.writeFile(outPath, Buffer.from(bytes));
    console.log(`Wrote ${path.relative(rootDir, outPath)} with ${chunks.length} chunks and ${courses.length} courses.`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
