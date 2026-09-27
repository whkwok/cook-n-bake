const SIGNUPS_KEY = 'cb_workshop_signups';
const SEEN_KEY = 'cb_workshop_invite_seen';
const OPEN_DELAY = 10000;

const dialog = document.querySelector('#workshop-dialog');
const form = document.querySelector('#workshop-form');
const formView = document.querySelector('#workshop-form-view');
const successView = document.querySelector('#workshop-success');
const nameInput = form.elements.name;

let returnFocus = null;
let inviteTimer = null;

function loadSignups() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIGNUPS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function markSeen() {
  localStorage.setItem(SEEN_KEY, 'yes');
}

function clearValidation() {
  form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error').forEach(error => { error.textContent = ''; });
}

function normalizedMobile(value) {
  const digits = value.replace(/\D/g, '').replace(/^65(?=[89]\d{7}$)/, '');
  return /^[89]\d{7}$/.test(digits) ? `+65 ${digits}` : null;
}

function firstProblem(data) {
  if (data.get('name').trim().length < 2) {
    return { name: 'name', message: 'Enter your name using at least 2 characters.' };
  }
  if (!normalizedMobile(data.get('mobile'))) {
    return { name: 'mobile', message: 'Enter 8 digits starting with 8 or 9.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.get('email').trim())) {
    return { name: 'email', message: 'Enter a valid email address.' };
  }
  return null;
}

function showProblem(problem) {
  const field = form.elements[problem.name];
  field.setAttribute('aria-invalid', 'true');
  form.querySelector(`[data-error-for="workshop-${problem.name}"]`).textContent = problem.message;
  field.focus();
}

function openWorkshop() {
  if (localStorage.getItem(SEEN_KEY) || dialog.open) return;
  if (document.querySelector('dialog[open]')) {
    inviteTimer = window.setTimeout(openWorkshop, 1000);
    return;
  }
  returnFocus = document.activeElement;
  form.reset();
  clearValidation();
  formView.hidden = false;
  successView.hidden = true;
  dialog.showModal();
  nameInput.focus();
}

function closeWorkshop() {
  markSeen();
  dialog.close();
  returnFocus?.focus();
}

form.addEventListener('input', event => {
  if (!event.target.matches('[aria-invalid="true"]')) return;
  event.target.removeAttribute('aria-invalid');
  form.querySelector(`[data-error-for="workshop-${event.target.name}"]`).textContent = '';
});

form.addEventListener('submit', event => {
  event.preventDefault();
  clearValidation();
  const data = new FormData(form);
  const problem = firstProblem(data);
  if (problem) {
    showProblem(problem);
    return;
  }

  const signups = loadSignups();
  signups.push({
    submitted: new Date().toISOString(),
    workshop_title: 'Free 1-hour Pastries Workshop & Treat',
    when: 'Next Wednesday, 1:00-2:00 PM',
    where: 'Our Bukit Timah campus',
    name: data.get('name').trim(),
    mobile: normalizedMobile(data.get('mobile')),
    email: data.get('email').trim()
  });
  localStorage.setItem(SIGNUPS_KEY, JSON.stringify(signups));
  markSeen();

  formView.hidden = true;
  successView.hidden = false;
  successView.querySelector('button').focus();
});

dialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeWorkshop();
});
dialog.addEventListener('close', () => returnFocus?.focus());
document.querySelectorAll('[data-close-workshop]').forEach(button => {
  button.addEventListener('click', closeWorkshop);
});

if (!localStorage.getItem(SEEN_KEY)) {
  inviteTimer = window.setTimeout(openWorkshop, OPEN_DELAY);
  window.addEventListener('pagehide', () => window.clearTimeout(inviteTimer), { once: true });
}
