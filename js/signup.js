const STORAGE_KEY = 'cb_signups';
const EMAIL_TO = 'enrol@cookbakeacademy.sg';

const dialog = document.querySelector('#signup-dialog');
const form = document.querySelector('#signup-form');
const formView = document.querySelector('#signup-form-view');
const successView = document.querySelector('#signup-success');
const courseDetails = document.querySelector('#signup-course-details');
const intakeSelect = form.elements.intake;
const allergiesInput = form.elements.allergies;
const allergyWarning = document.querySelector('#allergy-warning');
const referenceOutput = document.querySelector('#signup-reference');
const mailtoLink = document.querySelector('#signup-mailto');

let selectedCourse = null;
let returnFocus = null;

const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);
const money = value => `S$${Number(value).toLocaleString('en-SG')}`;
const readableDate = value => new Intl.DateTimeFormat('en-SG', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
}).format(new Date(`${value}T00:00:00Z`));

function detailsMarkup(course) {
  return `
    <div><dt>Course</dt><dd>${escapeHtml(course.code)} · ${escapeHtml(course.title)}</dd></div>
    <div><dt>Fee</dt><dd>${money(course.fee)}</dd></div>
    <div><dt>Duration</dt><dd>${course.weeks} week${course.weeks === 1 ? '' : 's'}</dd></div>
    <div><dt>Schedule</dt><dd>${escapeHtml(course.when)}</dd></div>
    <div><dt>Campus</dt><dd>${escapeHtml(course.campus)}</dd></div>`;
}

function clearValidation() {
  form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error').forEach(error => { error.textContent = ''; });
}

function closeSignup() {
  dialog.close();
  returnFocus?.focus();
}

export function openSignup(course, trigger) {
  selectedCourse = course;
  returnFocus = trigger;
  form.reset();
  clearValidation();
  allergyWarning.hidden = true;
  formView.hidden = false;
  successView.hidden = true;
  courseDetails.innerHTML = detailsMarkup(course);
  intakeSelect.innerHTML = course.intakes.map(date =>
    `<option value="${escapeHtml(date)}">${escapeHtml(readableDate(date))}</option>`
  ).join('');
  dialog.showModal();
  intakeSelect.focus();
}

function normalizedMobile(value) {
  const digits = value.replace(/\D/g, '').replace(/^65(?=[689]\d{7}$)/, '');
  return /^[689]\d{7}$/.test(digits) ? `+65 ${digits}` : null;
}

function firstProblem(data) {
  if (!data.get('intake') || !selectedCourse.intakes.includes(data.get('intake'))) {
    return { name: 'intake', message: 'Choose one of the available intake dates.' };
  }
  if (data.get('full_name').trim().length < 2) {
    return { name: 'full_name', message: 'Enter your full name using at least 2 characters.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.get('email').trim())) {
    return { name: 'email', message: 'Enter a valid email address.' };
  }
  if (!normalizedMobile(data.get('mobile'))) {
    return { name: 'mobile', message: 'Enter a Singapore mobile starting with 6, 8 or 9.' };
  }
  if (!data.get('consent')) {
    return { name: 'consent', message: 'Consent is required so we may contact you about this sign-up.' };
  }
  return null;
}

function showProblem(problem) {
  const field = form.elements[problem.name];
  field.setAttribute('aria-invalid', 'true');
  form.querySelector(`[data-error-for="${problem.name}"]`).textContent = problem.message;
  field.focus();
}

function hasNutConflict(allergies, courseAllergens) {
  return /\b(nut|nuts|peanut|peanuts|almond|almonds)\b/i.test(allergies)
    && /\b(nut|nuts|peanut|peanuts|almond|almonds)\b/i.test(courseAllergens);
}

function updateAllergyWarning() {
  if (!selectedCourse) return;
  const conflict = hasNutConflict(allergiesInput.value, selectedCourse.allergens);
  allergyWarning.hidden = !conflict;
  allergyWarning.textContent = conflict
    ? `Allergy notice: ${selectedCourse.title} uses or may contain nuts. Please contact us before attending.`
    : '';
}

function loadSignups() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function referenceFor(date, existing) {
  const datePart = date.replaceAll('-', '');
  let reference;
  do {
    reference = `CB-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (existing.some(signup => signup.ref === reference));
  return reference;
}

function mailtoFor(signup) {
  const subject = `Course sign-up ${signup.ref} — ${signup.course_code}`;
  const body = [
    `Reference: ${signup.ref}`,
    `Course: ${signup.course_code} — ${signup.course_title}`,
    `Intake: ${signup.intake}`,
    `Name: ${signup.full_name}`,
    `Email: ${signup.email}`,
    `Mobile: ${signup.mobile}`,
    `Experience: ${signup.experience}`,
    `Allergies: ${signup.allergies || 'None stated'}`,
    `Newsletter: ${signup.marketing_opt_in}`
  ].join('\n');
  return `mailto:${EMAIL_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

form.addEventListener('input', event => {
  if (event.target.matches('[aria-invalid="true"]')) {
    event.target.removeAttribute('aria-invalid');
    form.querySelector(`[data-error-for="${event.target.name}"]`).textContent = '';
  }
  if (event.target === allergiesInput) updateAllergyWarning();
});
form.addEventListener('change', event => {
  if (event.target.matches('[aria-invalid="true"]')) {
    event.target.removeAttribute('aria-invalid');
    form.querySelector(`[data-error-for="${event.target.name}"]`).textContent = '';
  }
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
  const submitted = new Date().toISOString().slice(0, 10);
  const signup = {
    ref: referenceFor(submitted, signups),
    submitted,
    course_code: selectedCourse.code,
    course_title: selectedCourse.title,
    intake: data.get('intake'),
    full_name: data.get('full_name').trim(),
    email: data.get('email').trim(),
    mobile: normalizedMobile(data.get('mobile')),
    experience: data.get('experience'),
    allergies: data.get('allergies').trim(),
    marketing_opt_in: data.get('marketing_opt_in') ? 'yes' : 'no',
    paid: 'no'
  };
  signups.push(signup);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signups));

  referenceOutput.textContent = signup.ref;
  mailtoLink.href = mailtoFor(signup);
  formView.hidden = true;
  successView.hidden = false;
  successView.querySelector('a').focus();
});

allergiesInput.addEventListener('input', updateAllergyWarning);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeSignup();
});
dialog.addEventListener('close', () => returnFocus?.focus());
document.querySelectorAll('[data-close-signup]').forEach(button => button.addEventListener('click', closeSignup));
