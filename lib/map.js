// Interactive map: Warden notes per place, Warden-added pins, and where each character is.
import crypto from 'node:crypto';
import { PLACES, MAP_SIZE } from './places.js';
import { EP_TOWN, X_POIS, X_SPOTS } from './expansion-places.js';

// The West map's places (+ the books' points of interest and each town's "places here"), and the East Portal town map.
const WEST = [...PLACES, ...X_POIS].map((p) => (X_SPOTS[p.id] ? { ...p, spots: X_SPOTS[p.id] } : p));
const KNOWN = new Set([...WEST, ...EP_TOWN.places].map((p) => p.id));
import { cleanKeepSpaces as clean } from './util.js'; // notes autosave while typed: keep their spaces

const coord = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

export function freshMap() {
  return { v: 0, notes: {}, pins: [], tokens: {} };
}

export function mapAction(state, a, { warden }) {
  switch (a.action) {
    case 'token': { // anyone can move a character token
      const id = clean(a.id, 12);
      if (!id) throw new Error('No character.');
      if (a.remove) delete state.tokens[id];
      else state.tokens[id] = { x: coord(a.x, MAP_SIZE.w), y: coord(a.y, MAP_SIZE.h), at: Date.now() };
      return;
    }
  }
  if (!warden) throw new Error('Warden PIN required.');
  switch (a.action) {
    case 'note': {
      const known = KNOWN.has(a.place) || state.pins.some((p) => p.id === a.place);
      if (!known) throw new Error('Unknown place.');
      const text = clean(a.text, 5000);
      if (!text.trim()) delete state.notes[a.place];
      else state.notes[a.place] = { text, shared: !!a.shared, at: Date.now() };
      return;
    }
    case 'pin': {
      const name = clean(a.name, 60).trim();
      if (!name) throw new Error('Name the place.');
      const pin = { id: 'pin-' + crypto.randomUUID().slice(0, 6), name, x: coord(a.x, MAP_SIZE.w), y: coord(a.y, MAP_SIZE.h), shared: a.shared !== false };
      state.pins.push(pin);
      return pin;
    }
    case 'pinEdit': {
      const pin = state.pins.find((p) => p.id === a.id);
      if (!pin) throw new Error('No such pin.');
      if (a.name !== undefined) pin.name = clean(a.name, 60).trim() || pin.name;
      if (a.shared !== undefined) pin.shared = !!a.shared;
      if (a.x !== undefined) { pin.x = coord(a.x, MAP_SIZE.w); pin.y = coord(a.y, MAP_SIZE.h); }
      return;
    }
    case 'pinRemove':
      state.pins = state.pins.filter((p) => p.id !== a.id);
      delete state.notes[a.id];
      return;
    default: throw new Error('Unknown action.');
  }
}

export function mapView(state, { warden, posse }) {
  const pins = warden ? state.pins : state.pins.filter((p) => p.shared);
  const notes = Object.fromEntries(Object.entries(state.notes).filter(([, n]) => warden || n.shared));
  return {
    v: state.v, pins, notes, tokens: state.tokens,
    posse: posse.map((p) => ({ id: p.id, name: p.name, trade: p.trade, dead: !!p.dead })),
  };
}

export const MAP_META = { places: WEST, size: MAP_SIZE, town: EP_TOWN };
