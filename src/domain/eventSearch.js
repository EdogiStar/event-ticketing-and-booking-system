import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) return false;
  if (value.length === 10) return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  return true;
}
function cheapest(event) {
  const tiers = Array.isArray(event.tiers) ? event.tiers : [];
  return tiers.length ? Math.min(...tiers.map((tier) => tier.priceCents)) : undefined;
}
function seatsLeft(event) {
  return (Array.isArray(event.tiers) ? event.tiers : []).reduce((sum, tier) => sum + (tier.remaining ?? tier.seatsLeft ?? 0), 0);
}
function compareText(a, b) { return String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base' }); }

export function filterEvents(summaries, { q, city, from, to, maxPriceCents, onlyAvailable } = {}) {
  if (from !== undefined && !validDate(from)) throw new DomainError('VALIDATION', 'from must be a valid ISO date');
  if (to !== undefined && !validDate(to)) throw new DomainError('VALIDATION', 'to must be a valid ISO date');
  if (maxPriceCents !== undefined && !Number.isSafeInteger(maxPriceCents)) throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number');
  const lower = from === undefined ? undefined : Date.parse(from.length === 10 ? `${from}T00:00:00.000Z` : from);
  const upper = to === undefined ? undefined : Date.parse(to.length === 10 ? `${to}T23:59:59.999Z` : to);
  const query = q === undefined ? undefined : String(q).toLocaleLowerCase();
  const wantedCity = city === undefined ? undefined : String(city).toLocaleLowerCase();
  return Array.from(summaries).filter((event) => {
    if (query && !`${event.title ?? event.name ?? ''} ${event.venue ?? ''}`.toLocaleLowerCase().includes(query)) return false;
    if (wantedCity !== undefined && String(event.city ?? '').toLocaleLowerCase() !== wantedCity) return false;
    const date = event.date === undefined ? NaN : Date.parse(event.date);
    if (lower !== undefined && (Number.isNaN(date) || date < lower)) return false;
    if (upper !== undefined && (Number.isNaN(date) || date > upper)) return false;
    if (maxPriceCents !== undefined) { const price = cheapest(event); if (price === undefined || price > maxPriceCents) return false; }
    if (onlyAvailable && seatsLeft(event) <= 0) return false;
    return true;
  });
}

export function sortEvents(summaries, sortBy) {
  if (!['date', 'price', 'availability'].includes(sortBy)) throw new DomainError('VALIDATION', `Unknown sort option: ${String(sortBy)}`);
  const compare = (a, b) => {
    let order = 0;
    if (sortBy === 'date') {
      const day = (value) => typeof value === 'string' && validDate(value) ? value.slice(0, 10) : '\uffff-\uffff-\uffff';
      order = day(a.date).localeCompare(day(b.date));
    }
    if (sortBy === 'price') { const ap = cheapest(a) ?? Infinity; const bp = cheapest(b) ?? Infinity; order = ap - bp; }
    if (sortBy === 'availability') order = seatsLeft(b) - seatsLeft(a);
    return order || compareText(a.title ?? a.name, b.title ?? b.name) || String(a.id ?? '').localeCompare(String(b.id ?? ''));
  };
  return mergeSort(summaries, compare);
}

export function searchEvents(summaries, criteria, sortBy) {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
