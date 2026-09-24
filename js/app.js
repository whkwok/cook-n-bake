import { openSignup } from './signup.js';
import { askKnowledgeBase } from './kb-chat.js?v=chatbot3';

const COURSE_URL = 'data/courses.json';
const REQUIRED_FIELDS = ['code', 'title', 'cat', 'level', 'weeks', 'fee', 'campus', 'img', 'when', 'summary', 'allergens', 'intakes'];

const grid = document.querySelector('#course-grid');
const status = document.querySelector('#course-status');
const errorBox = document.querySelector('#course-error');
const emptyState = document.querySelector('#empty-state');
const searchInput = document.querySelector('#course-search');
const chips = [...document.querySelectorAll('.chip')];
const assistant = document.querySelector('#course-assistant');
const chatLauncher = document.querySelector('.chat-launcher');
const assistantInput = document.querySelector('#assistant-input');
const assistantLog = document.querySelector('#assistant-log');

let courses = [];
let activeFilter = 'All';
let assistantReturnFocus = null;

const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

const imageUrl = id => `https://images.unsplash.com/photo-${encodeURIComponent(id)}?auto=format&fit=crop&w=900&q=70`;
const money = value => `S$${new Intl.NumberFormat('en-SG', {
  maximumFractionDigits: 0
}).format(value)}`;

function isValidCourse(course) {
  return course && REQUIRED_FIELDS.every(field => course[field] !== undefined && course[field] !== null)
    && typeof course.fee === 'number' && Number.isFinite(course.fee)
    && Number.isInteger(course.weeks) && course.weeks > 0
    && ['Bakery', 'Cooking'].includes(course.cat);
}

function searchableText(course) {
  return [course.code, course.title, course.cat, course.level, course.campus, course.summary, course.when, course.fee]
    .join(' ').toLowerCase();
}

function visibleCourses() {
  const query = searchInput.value.trim().toLowerCase();
  return courses.filter(course =>
    (activeFilter === 'All' || course.cat === activeFilter) &&
    (!query || searchableText(course).includes(query))
  );
}

function cardMarkup(course) {
  const code = escapeHtml(course.code);
  const title = escapeHtml(course.title);
  const weeks = `${course.weeks} week${course.weeks === 1 ? '' : 's'}`;
  return `
    <article class="course-card" id="course-${code}" tabindex="-1">
      <img src="${imageUrl(course.img)}" alt="${title} course" width="900" height="600" loading="lazy">
      <div class="course-card-body">
        <p class="course-kicker">${code} · ${escapeHtml(course.level)} · ${escapeHtml(course.campus)}</p>
        <h3>${title}</h3>
        <p class="course-summary">${escapeHtml(course.summary)}</p>
        <div class="course-details">
          <p><span>Duration</span><strong>${weeks}</strong></p>
          <p><span>Schedule</span><span>${escapeHtml(course.when)}</span></p>
          <p class="course-price"><span>Course fee</span><strong>${money(course.fee)}</strong></p>
        </div>
        <button class="button course-signup" type="button" data-signup="${code}">Sign up</button>
      </div>
    </article>`;
}

function renderCourses() {
  const shown = visibleCourses();
  grid.innerHTML = shown.map(cardMarkup).join('');
  status.textContent = `${shown.length} of ${courses.length} courses`;
  emptyState.hidden = shown.length !== 0;
}

function setFilter(category) {
  activeFilter = category;
  chips.forEach(chip => {
    const selected = chip.dataset.filter === category;
    chip.classList.toggle('is-active', selected);
    chip.setAttribute('aria-pressed', String(selected));
  });
  renderCourses();
}

function openAssistant(trigger) {
  assistantReturnFocus = trigger || document.activeElement;
  assistant.hidden = false;
  chatLauncher.hidden = true;
  requestAnimationFrame(() => assistantInput.focus());
}

function closeAssistant() {
  assistant.hidden = true;
  chatLauncher.hidden = false;
  assistantReturnFocus?.focus();
}

async function showAssistantResults(question) {
  assistantLog.innerHTML = '<p class="assistant-message">Searching the academy database…</p>';
  try {
    const answer = await askKnowledgeBase(question);
    assistantLog.innerHTML = answer.html;
  } catch (error) {
    assistantLog.innerHTML = '<p class="assistant-message">The SQLite database could not be loaded. Please refresh the page and try again.</p>';
    console.error(error);
  }
}

chips.forEach(chip => chip.addEventListener('click', () => setFilter(chip.dataset.filter)));
searchInput.addEventListener('input', renderCourses);
grid.addEventListener('click', event => {
  const button = event.target.closest('[data-signup]');
  if (!button) return;
  const course = courses.find(item => item.code === button.dataset.signup);
  if (course) openSignup(course, button);
});

document.querySelectorAll('[data-open-assistant]').forEach(button =>
  button.addEventListener('click', () => openAssistant(button))
);
document.querySelector('[data-close-assistant]').addEventListener('click', closeAssistant);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !assistant.hidden) closeAssistant();
});

document.querySelector('#assistant-form').addEventListener('submit', event => {
  event.preventDefault();
  const question = assistantInput.value.trim();
  if (question) showAssistantResults(question);
});

assistantLog.addEventListener('click', event => {
  const link = event.target.closest('[data-assistant-result]');
  if (!link) return;
  closeAssistant();
  requestAnimationFrame(() => document.querySelector(link.getAttribute('href'))?.focus());
});

document.querySelectorAll('[data-campus-link]').forEach(link => link.addEventListener('click', () => {
  const campus = link.dataset.campusLink;
  activeFilter = campus === 'Orchard Road' ? 'Bakery' : 'Cooking';
  searchInput.value = '';
  setFilter(activeFilter);
}));

async function loadCourses() {
  try {
    const response = await fetch(COURSE_URL);
    if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Catalogue format is not a list');
    const invalidCount = data.filter(course => !isValidCourse(course)).length;
    courses = data.filter(isValidCourse);
    if (!courses.length) throw new Error('No valid course records were found');
    if (invalidCount) {
      errorBox.textContent = `${invalidCount} incomplete course record${invalidCount === 1 ? ' was' : 's were'} skipped to prevent incorrect details or pricing.`;
      errorBox.hidden = false;
    }
    renderCourses();
  } catch (error) {
    status.textContent = 'Course catalogue unavailable';
    errorBox.textContent = 'We could not load the course catalogue. Please refresh the page and try again.';
    errorBox.hidden = false;
    console.error(error);
  }
}

loadCourses();
