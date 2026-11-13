import { listEvents } from '../api.js';
import { el, formatDate, formatPrice } from '../ui.js';

const form = document.querySelector('#filters-form');
const city = document.querySelector('#city');
const list = document.querySelector('#events-list');
const count = document.querySelector('#results-count');
let allEvents = [];
function eventCard(event) { const cheapest = Math.min(...event.tiers.map((tier) => tier.priceCents)); const available = event.tiers.some((tier) => tier.remaining > 0); return el('article', { className: 'event-card' }, [el('div', {}, [el('p', { className: 'eyebrow', text: event.city }), el('h3', { text: event.title }), el('p', { className: 'muted', text: `${event.venue} · ${formatDate(event.date)}` }), el('p', { className: 'price', text: `From ${formatPrice(cheapest)}` })]), el('a', { className: 'button button-secondary', href: `/event.html?id=${encodeURIComponent(event.id)}`, 'aria-label': `View ${event.title}` }, [available ? 'View event' : 'Sold out'])]); }
function render(events) { list.replaceChildren(...(events.length ? events.map(eventCard) : [el('p', { className: 'empty-state', text: 'No events match those filters.' })])); count.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`; }
function populateCities() { city.append(...[...new Set(allEvents.map((event) => event.city))].sort().map((value) => el('option', { value, text: value }))); }
async function refresh() { const data = new FormData(form); const maxPrice = data.get('maxPrice'); render(await listEvents({ q: data.get('search'), city: data.get('city'), maxPriceCents: maxPrice ? Number(maxPrice) * 100 : undefined, sort: data.get('sort') })); }
allEvents = await listEvents(); populateCities(); render(allEvents); form.addEventListener('input', refresh); form.addEventListener('change', refresh);
