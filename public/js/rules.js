// Rules lookup: type a word ("dodge", "bleeding", "cover"…) and get the rule in plain words with its Guidebook page.
// Opened from the nav "?" button, and from anything marked data-rule="Term" (common.js wires that up everywhere).
// Entries are short summaries in our own words — the Guidebook is still the last word.
import { esc } from './common.js';
import { gl } from './glyphs.js';

export const RULES = [
  // ---- dice and Skills ----
  { term: 'Dice', aliases: 'black gold hit ace blank spur pool 1b 2g', page: '11',
    text: 'Black dice (B) have 2 Hits, 1 Ace, 1 Spur and 2 Blanks. Gold dice (G) are better: 3 Hits, 1 Ace, 1 Spur, 1 Blank. An Ace counts as 2 Hits. A pool like 2B1G means two Black and one Gold.' },
  { term: 'Talent', aliases: 'spur reroll', page: '11',
    text: 'If you have the Talent for what you are rolling (a Skill, Defense, a weapon type…), reroll every Spur. Without it, a Spur is just a miss.' },
  { term: 'Skill roll', aliases: 'skills charm finesse intuition nerve roll with', page: '12',
    text: 'The Warden says “roll with” a Skill: Charm to talk, Finesse for careful or sneaky work, Intuition to notice and figure things out, Nerve for strength and grit. Roll that Skill’s dice and count Hits.' },
  { term: 'Task difficulty', aliases: 'target number hits needed easy medium difficult', page: '12',
    text: 'Very Easy needs 1 Hit, Easy 2, Medium 3, Difficult 4, Very Difficult 5. A clever plan can talk the Warden down a step. Trying a failed roll again may come with a cost.' },
  { term: 'Challenge roll', aliases: 'contest versus vs opposed', page: '13',
    text: 'Two sides roll the same Skill; most Hits wins. A tie means it isn’t over — roll again.' },
  { term: 'Helping', aliases: 'help assist', page: '13',
    text: 'A helper rolls half their Skill dice (round up) and adds their Hits to yours. With several helpers, only the best helper roll counts. In a fight, helping is the Prepare Action.' },
  { term: 'Ace-in-the-Hole', aliases: 'abilities ability ace counter', page: '14',
    text: 'Count every Ace you roll in combat. At 6 Aces you can use your Trade’s Ace-in-the-Hole Ability, which resets the count to zero. Resting also resets it.' },
  // ---- combat basics ----
  { term: 'Grit', aliases: 'action points reload', page: '40',
    text: 'You get 6 Grit each round, and it fills back up at the start of your turn. Actions, Abilities and weapons cost Grit.' },
  { term: 'Fool’s Grit', aliases: 'fools grit health for grit', page: '40',
    text: 'Once a turn, trade 1 Health for 1 extra Grit.' },
  { term: 'Turn order', aliases: 'initiative order finesse who goes first', page: '40',
    text: 'Everyone rolls Finesse; most Hits goes first, and ties roll again. The Warden rolls once for all the enemies, and they take their turns together in that spot.' },
  { term: 'Surprise', aliases: 'ambush surprised', page: '40',
    text: 'Whoever catches the other side off guard before the fight starts gets the first turn.' },
  { term: 'Ranges', aliases: 'range arms reach short long distant inches', page: '41',
    text: 'Arm’s Reach is within 1″. Short Range is up to 6″ (and works at Arm’s Reach too). Long Range is 6–18″. Distant is past 18″. On the Battle Map, one hex is 1″.' },
  { term: 'Attack', aliases: 'shoot hit damage weapon', page: '41',
    text: 'Pay the weapon’s Grit and roll its dice for the target’s range. The target rolls Defense (plus Cover and Dodge); every Hit left over is 1 damage.' },
  { term: 'Aim', aliases: 'reroll', page: '41',
    text: 'Once a turn, spend 1 Grit to reroll one die from your attack. Not on horseback.' },
  { term: 'Move', aliases: 'movement speed fast normal slow walk run', page: '42',
    text: '1 Grit moves you up to Short Range (6″). Long Range takes at least 2 Grit; Distant takes 6 Grit over two turns. Lying down or getting up is a Move too. Horses go twice as far per Grit; monsters use their own Speed.' },
  { term: 'Rough Terrain', aliases: 'terrain difficult ground mud water', page: '42',
    text: 'Moving through Rough Terrain costs twice the Grit.' },
  { term: 'Dodge', aliases: 'evade', page: '42',
    text: 'Roll 1B for each Grit you spend. Your Hits come off the damage of the next attack against you; anything unused is gone when your next turn starts.' },
  { term: 'Use Item', aliases: 'item bandage first aid heal', page: '42',
    text: 'Pay the Item’s Grit cost and use it: first aid, tools, throwables and the like.' },
  { term: 'Prepare', aliases: 'hold ready overwatch help in combat', page: '42',
    text: 'Once a turn, pay for an Action now and hold it for a trigger you name (“I shoot if it comes through the door”). This is also how you Help someone in a fight.' },
  { term: 'Improvise', aliases: 'anything else creative', page: '43',
    text: 'Want to do something not on the list? Describe it; the Warden sets the Grit cost and the roll.' },
  { term: 'Defense', aliases: 'armor block', page: '43',
    text: 'When you’re attacked, roll your Defense dice. Each Hit cancels one Hit from the attack.' },
  { term: 'Cover', aliases: 'light cover heavy cover behind', page: '43',
    text: 'Behind something? Light Cover adds 1B to your Defense, Heavy Cover adds 2B.' },
  { term: 'Horseback', aliases: 'horse mounted riding', page: '42',
    text: 'You can’t Aim or Dodge while riding.' },
  // ---- statuses ----
  { term: 'Statuses', aliases: 'status severity condition', page: '48',
    text: 'Bad effects with a number, the Severity: how many Hits got through. They stack, up to 6 (Trapped can go higher). [2B] means roll two Black dice for the Severity.' },
  { term: 'Relieving a Status', aliases: 'relieve cure remove shake off', page: '49',
    text: 'On your turn, spend 1 Grit per die and roll the Status’s Skill. Each Hit lowers the Severity by 1. Once per Status per turn.' },
  { term: 'Afraid', aliases: 'fear scared', page: '48', skill: 'Charm',
    text: 'You can’t move closer to what scares you, and Actions against it use half your dice (round up, Gold first).' },
  { term: 'Burned', aliases: 'fire burn', page: '48', skill: 'Finesse',
    text: 'At the end of each of your turns, lose Health equal to the Severity. The first time in a fight, your Max Health also drops by 2 until you get proper care.' },
  { term: 'Dazed', aliases: 'stunned concussed', page: '48', skill: 'Intuition',
    text: 'After paying Grit for an Action, roll 1B: only a Hit or Ace lets it happen. Otherwise the Grit is lost. Doesn’t apply to relieving Dazed.' },
  { term: 'Electrocuted', aliases: 'shock electric battery', page: '48', skill: 'Nerve',
    text: 'No Aiming or Dodging, and Gold dice count as Black. Carrying a Battery makes it worse.' },
  { term: 'Poisoned', aliases: 'poison venom toxin', page: '49', skill: 'Nerve',
    text: 'Roll 2 fewer dice on every Skill roll. Even after it’s gone, you roll 1 fewer until you’re treated.' },
  { term: 'Trapped', aliases: 'net lasso captured bagged tagged', page: '48', skill: 'Finesse or Nerve',
    text: 'You can’t Move or Dodge. When the Severity reaches the target’s size limit (8 for a person), they’re Captured.' },
  { term: 'Unconscious', aliases: 'knocked out passed out', page: '49', skill: 'Intuition',
    text: 'You can’t spend Grit or act, except to try relieving Unconscious.' },
  // ---- health ----
  { term: 'Bleeding out', aliases: 'dying zero health 0 death die dead', page: '54',
    text: 'At 0 Health you can’t act. At the end of each ally’s turn, roll a Skill you haven’t used yet — you need 1 Hit to hang on. Miss, or run out of Skills, and you die. First Aid from a friend saves you: you get Unconscious [5], and relieving it brings back 1 Health.' },
  { term: 'Campfire rest', aliases: 'rest camp heal sleep', page: '52',
    text: 'Rest a few hours by a fire: roll any Skill and get back Health equal to your Hits. Also resets your Ace count.' },
  { term: 'Town rest', aliases: 'inn hotel town heal', page: '54',
    text: 'A night in a proper bed restores all your Health, clears all your Statuses, resets your Supplies and recharges Forstall batteries.' },
  { term: 'Max Health', aliases: 'health hp', page: '52',
    text: 'Characters start with 10. Healing can’t take you above it, though some things raise it until the end of the day (a hot cooked meal gives +1).' },
  // ---- forstalls ----
  { term: 'Scanning', aliases: 'scan kurtz frequency forstall green yellow red', page: '83',
    text: 'Spend 3 Grit and roll Intuition to tune your Forstall on a monster’s Kurtz Frequency. Green means you’re close, yellow somewhere near, red way off. One scanner per monster each round.' },
  { term: 'Bursting', aliases: 'burst forstall blast', page: '84',
    text: 'With the Crystal Burst Fuse upgrade and a monster’s full frequency, a Burst drives it away for at least two hours. The crystal shatters each time; no battery needed.' },
  { term: 'Sweeping', aliases: 'sweep forstall repel travel', page: '82',
    text: 'Set the Forstall to cycle frequencies. Pay its Grit and roll its dice: monsters in range lose that many Grit when their turn starts. One battery charge per two hours.' },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();
const DATA = RULES.map((r) => ({ ...r, key: norm(r.term), hay: norm(`${r.term} ${r.aliases} ${r.skill || ''} ${r.text}`) }));

// best matches first: exact name, name starts with it, name or alias contains it, then anywhere in the text
export function findRules(q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return DATA;
  const score = (r) => {
    const name = `${r.key} ${norm(r.aliases)}`;
    if (!words.every((w) => r.hay.includes(w))) return 0;
    const q2 = words.join(' ');
    return r.key === q2 ? 100 : r.key.startsWith(q2) ? 60 : words.every((w) => name.includes(w)) ? 30 : 5;
  };
  return DATA.map((r) => [r, score(r)]).filter(([, s]) => s).sort((a, b) => b[1] - a[1]).map(([r]) => r);
}

const card = (r) => `<article class="rule-card">
    <h3>${esc(r.term)}${r.skill ? ` <small class="rule-skill">relieve with ${esc(r.skill)}</small>` : ''}</h3>
    <p>${esc(r.text)}</p>
    <small class="rule-page">${gl('scroll')} Guidebook p. ${esc(r.page)}</small>
  </article>`;

export function openRules(query = '') {
  document.querySelector('.rules-back')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-back ask-back rules-back';
  back.innerHTML = `<div class="modal ask rules-modal" role="dialog" aria-modal="true" aria-label="Look up a rule">
    <div class="ho-kicker">${gl('scroll')} LOOK UP A RULE</div>
    <input type="search" class="ask-input rules-q" placeholder="Try dodge, cover, bleeding, Poisoned…" aria-label="Search the rules" autocomplete="off" value="${esc(query)}">
    <div class="rules-list" aria-live="polite"></div>
    <div class="ask-btns"><a class="btn secondary" href="/howto">How to Play</a><button type="button" class="btn" data-close>Done</button></div></div>`;
  document.body.append(back);
  const input = back.querySelector('.rules-q'), list = back.querySelector('.rules-list');
  const draw = () => {
    const hits = findRules(input.value);
    list.innerHTML = hits.length ? hits.map(card).join('') : '<p class="muted rules-none">Nothing by that name. Try a shorter word, or ask the Warden.</p>';
    list.scrollTop = 0;
  };
  input.addEventListener('input', draw);
  draw();
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  input.focus({ preventScroll: true });
  if (query) input.select();
}
