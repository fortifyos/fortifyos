const grid = document.getElementById('g');
const search = document.getElementById('preorder-search');
const edition = document.getElementById('edition-filter');
const availability = document.getElementById('availability-filter');
const countLabel = document.getElementById('result-count');
const loadMore = document.getElementById('load-more');
const pageSize = 72;
let platform = 'all';
let visible = pageSize;
let catalog = [];

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

function filteredItems() {
  const query = search.value.trim().toLowerCase();
  return catalog.filter(item => {
    if (platform !== 'all' && item.platformKey !== platform) return false;
    if (edition.value !== 'all' && item.edition !== edition.value) return false;
    if (availability.value === 'open' && item.availability !== 'Preorder open') return false;
    if (availability.value === 'restock' && item.availability !== 'Sold out / restock watch') return false;
    if (availability.value === 'announced' && item.availability !== 'Announced · preorder TBD') return false;
    if (query && !`${item.title} ${item.edition} ${item.region} ${item.media}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

function card(item) {
  const open = item.availability === 'Preorder open';
  const announced = item.availability === 'Announced · preorder TBD';
  const mediaClass = item.media === 'Game-Key Card' || item.media === 'Download code' ? 'warning' : '';
  const alternatives = (item.alternatives || []).map(link => `<a class="alternate" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">Also at ${escapeHtml(link.seller)} ↗</a>`).join('');
  const ps5Edition = item.ps5Url ? `<a class="alternate" href="${escapeHtml(item.ps5Url)}" target="_blank" rel="noopener">Compare PS5 edition ↗</a>` : '';
  return `<article class="c preorder-card" data-p="${item.platformKey}">
    <div class="v"><img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)} physical cover" loading="lazy" decoding="async"><span class="availability ${open ? 'open' : announced ? 'announced' : 'restock'}">${open ? 'Open' : announced ? 'Preorder TBD' : 'Restock watch'}</span></div>
    <div class="i">
      <div class="p ${item.platformKey}">${escapeHtml(item.platform)}</div>
      <h2>${escapeHtml(item.title)}</h2>
      <div class="preorder-meta"><span>${escapeHtml(item.edition)}</span><span>${escapeHtml(item.region)}</span><span class="${mediaClass}">${escapeHtml(item.media)}</span><span>Release ${escapeHtml(item.release)}</span></div>
      <div class="language">English: ${escapeHtml(item.language)} · Checked ${escapeHtml(item.verified)}</div>
      <a class="buy" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${open ? 'View preorder' : announced ? 'Official details' : 'Check restock'} <span>${escapeHtml(item.seller)} ↗</span></a>${ps5Edition}${alternatives}
    </div>
  </article>`;
}

function render(reset = true) {
  if (reset) visible = pageSize;
  const matches = filteredItems();
  grid.innerHTML = matches.slice(0, visible).map(card).join('');
  countLabel.textContent = `${matches.length.toLocaleString()} editions found`;
  loadMore.hidden = visible >= matches.length;
  loadMore.textContent = `Show more (${Math.min(pageSize, matches.length - visible)})`;
}

document.querySelectorAll('[data-f]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-f]').forEach(item => item.classList.remove('a'));
  button.classList.add('a');
  platform = button.dataset.f;
  render();
}));
search.addEventListener('input', () => render());
edition.addEventListener('change', () => render());
availability.addEventListener('change', () => render());
loadMore.addEventListener('click', () => { visible += pageSize; render(false); });

fetch('./preorders.json?v=20260921a')
  .then(response => {
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  })
  .then(data => {
    catalog = data.items;
    document.getElementById('tracked-total').textContent = data.count.toLocaleString();
    document.getElementById('open-total').textContent = catalog.filter(item => item.availability === 'Preorder open').length.toLocaleString();
    document.getElementById('catalog-date').textContent = data.updated;
    render();
  })
  .catch(() => {
    grid.innerHTML = '<div class="catalog-error">The preorder catalog could not load. Refresh the page to try again.</div>';
    countLabel.textContent = 'Catalog unavailable';
  });
