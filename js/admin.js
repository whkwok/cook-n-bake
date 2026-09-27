const STORAGE_KEY = 'cb_signups';
const COLUMNS = ['ref', 'submitted', 'course_code', 'course_title', 'intake', 'full_name', 'email', 'mobile', 'experience', 'allergies', 'marketing_opt_in', 'paid'];

const head = document.querySelector('#admin-head');
const body = document.querySelector('#admin-body');
const status = document.querySelector('#admin-status');
const empty = document.querySelector('#admin-empty');
const exportButton = document.querySelector('#export-csv');

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

function loadSignups() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function render() {
  const signups = loadSignups();
  head.innerHTML = COLUMNS.map(column => `<th scope="col">${escapeHtml(column)}</th>`).join('');
  body.innerHTML = signups.map(signup => `<tr>${COLUMNS.map(column => `<td>${escapeHtml(signup[column])}</td>`).join('')}</tr>`).join('');
  status.textContent = `${signups.length} sign-up${signups.length === 1 ? '' : 's'} saved on this device.`;
  empty.hidden = signups.length !== 0;
  exportButton.disabled = signups.length === 0;
}

exportButton.addEventListener('click', () => {
  const signups = loadSignups();
  const rows = [COLUMNS, ...signups.map(signup => COLUMNS.map(column => signup[column] ?? ''))];
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `cook-bake-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

render();
