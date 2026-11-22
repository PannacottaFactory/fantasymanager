/**
 * Encyclopedia: every species, ability, effect, trait, role, element, attribute and injury, plus the combat
 * rules — all generated from the game data and config, so the numbers are always the real ones.
 * Play styles are never named: only mechanics.
 */
import { ScreenTitle } from '../components/common.tsx';
import { useEffect, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Lang } from '../../core/i18n.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { ATTRIBUTE_CATEGORIES, ATTRIBUTE_KEYS, type AttributeCategory, type AttributeKey } from '../../data/attributes.ts';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { EFFECTS } from '../../data/effects.ts';
import { ELEMENTS, ELEMENT_IDS } from '../../data/elements.ts';
import { INJURIES } from '../../data/injuries.ts';
import { ROLES } from '../../data/roles.ts';
import { SPECIES, SPECIES_IDS } from '../../data/species.ts';
import { TRAITS } from '../../data/traits.ts';
import type { AbilityDef, EffectDef, EffectMods, ElementId, RoleId } from '../../data/schema.ts';
import {
  abilityKindName, abilityText, attributeText, categoryName, effectText, elementName, injuryText, roleText, sizeName,
  scarText, speciesText, traitText,
} from '../../engine/text/localize.ts';
import { RoleIcon, SpeciesIcon, UiIcon } from '../icons/Icon.tsx';
import { ENC_DICTS, encT, type EncKey } from '../i18n/encyclopedia.ts';
import { useT } from '../i18n/index.ts';
import { AbilityCard, durationLabel, effectDuration, KindIcon } from '../components/AbilityCard.tsx';
import { skillLevel, skillUnlockLevel } from '../../engine/creature/derived.ts';
import { coverReduction } from '../../engine/combat/formulas.ts';
import { useGame } from '../store/gameStore.ts';
import { useScarEffects, useTraitEffects } from '../traitEffects.ts';
import { scarsOfInjury } from '../../engine/progression/scars.ts';
import { BestiaryView } from './BestiaryView.tsx';
import { ArenaConditionList } from '../components/ArenaCondition.tsx';

const cfg = DEFAULT_CONFIG;
export type Tab = 'bestiary' | 'species' | 'abilities' | 'effects' | 'traits' | 'roles' | 'elements' | 'attributes' | 'injuries' | 'rules';
const TABS: Tab[] = ['species', 'abilities', 'effects', 'traits', 'roles', 'elements', 'attributes', 'injuries', 'rules'];
const ROLE_IDS = Object.keys(ROLES) as RoleId[];
export const RULES = ['match', 'turn', 'hit', 'damage', 'cover', 'guard', 'orders', 'talks', 'stamina', 'morale', 'injury', 'levels', 'age', 'traits', 'arena'] as const;

/**
 * Accent-insensitive, case-insensitive form of a text, one character for one character (so a position found in the
 * normalised text is the same in the original: snippets and highlights).
 */
const norm = (s: string) =>
  s
    .split('')
    .map((ch) => (ch.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() || ch)[0])
    .join('');

/** One page of the encyclopedia as plain text, for the search across every tab. */
interface Doc {
  tab: Tab;
  id: string;
  label: string;
  text: string;
}

/** Entries of a tab: [id, label, icon]. */
function entriesOf(tab: Tab, lang: Lang): { id: string; label: string; icon?: ReactNode }[] {
  const e = encT(lang);
  switch (tab) {
    case 'species':
      return SPECIES_IDS.map((id) => ({ id, label: speciesText(id, lang).name, icon: <SpeciesIcon id={id} /> }));
    case 'abilities':
      return Object.values(ABILITIES).map((a) => ({ id: a.id, label: abilityText(a.id, lang).name, icon: <span style={{ color: elColor(a.element) }}><KindIcon kind={a.kind} /></span> }));
    case 'effects':
      return Object.values(EFFECTS).map((x) => ({ id: x.id, label: effectText(x.id, lang).name, icon: <span className={x.beneficial ? 'good-text' : 'bad-text'}>{x.beneficial ? '▲' : '▼'}</span> }));
    case 'traits':
      return Object.values(TRAITS).map((x) => ({ id: x.id, label: traitText(x.id, lang).name }));
    case 'roles':
      return ROLE_IDS.map((id) => ({ id, label: roleText(id, lang).name, icon: <RoleIcon role={id} /> }));
    case 'attributes':
      return ATTRIBUTE_KEYS.map((k) => ({ id: k, label: attributeText(k, lang).name }));
    case 'injuries':
      return Object.values(INJURIES).map((i) => ({ id: i.id, label: injuryText(i.id, lang).short }));
    case 'rules':
      return RULES.map((r) => ({ id: r, label: e(`ru.${r}.title` as EncKey) }));
    case 'elements':
      return [{ id: 'chart', label: e('tab.elements') }];
    default:
      return [];
  }
}

function pageOf(tab: Tab, id: string): ReactElement | null {
  const go = () => {};
  switch (tab) {
    case 'species':
      return <SpeciesEntry id={id} go={go} />;
    case 'abilities':
      return <AbilityEntry id={id} go={go} />;
    case 'effects':
      return <EffectEntry id={id} go={go} />;
    case 'traits':
      return <TraitEntry id={id} go={go} />;
    case 'roles':
      return <RoleEntry id={id as RoleId} go={go} />;
    case 'attributes':
      return <AttributeEntry id={id as AttributeKey} go={go} />;
    case 'injuries':
      return <InjuryEntry id={id} />;
    case 'rules':
      return <RuleEntry id={id as (typeof RULES)[number]} />;
    case 'elements':
      return <ElementsChart />;
    default:
      return null;
  }
}

/** Every page rendered once, off screen, to plain text (per language; the numbers are the real ones). */
const INDEX = new Map<Lang, Doc[]>();
function searchIndex(lang: Lang): Doc[] {
  const done = INDEX.get(lang);
  if (done) return done;
  const host = document.createElement('div');
  const root = createRoot(host);
  const docs: Doc[] = [];
  for (const tab of TABS)
    for (const { id, label } of entriesOf(tab, lang)) {
      const page = pageOf(tab, id);
      if (!page) continue;
      flushSync(() => root.render(page));
      // A copy with a space after every element, so words of different lines never stick together.
      const copy = host.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('*').forEach((el) => el.append(' '));
      docs.push({ tab, id, label, text: (copy.textContent ?? '').replace(/\s+/g, ' ').trim() });
    }
  root.unmount();
  INDEX.set(lang, docs);
  return docs;
}

/** « … words around the match … » with the match marked. */
function Snippet({ text, q }: { text: string; q: string }) {
  const at = norm(text).indexOf(q);
  if (at < 0) return null;
  const from = Math.max(0, at - 40);
  const to = Math.min(text.length, at + q.length + 60);
  return (
    <span className="enc-snippet">
      {from > 0 && '…'}
      {text.slice(from, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length, to)}
      {to < text.length && '…'}
    </span>
  );
}

/** Lights every occurrence of the search in the page shown (CSS highlights; nothing where unsupported). */
function useHighlight(container: HTMLElement | null, q: string, key: string) {
  useEffect(() => {
    const reg = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
    const H = (globalThis as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!reg || !H) return;
    reg.delete('enc-search');
    if (!container || !q) return;
    const ranges: Range[] = [];
    const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const s = norm(n.textContent ?? '');
      for (let i = s.indexOf(q); i >= 0; i = s.indexOf(q, i + q.length)) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + q.length);
        ranges.push(r);
      }
    }
    if (ranges.length) reg.set('enc-search', new H(...ranges));
    return () => void reg.delete('enc-search');
  }, [container, q, key]);
}

export interface Link {
  tab: Tab;
  id: string;
}

export function EncyclopediaScreen() {
  const tr = useT();
  const { lang } = tr;
  const e = encT(lang);
  const game = useGame((s) => s.game);
  // Opened from a bestiary message or the dashboard: start on the collection.
  // Opened on a given page (a bestiary or arena message, the dashboard): read once, then forgotten.
  const [opened] = useState(() => {
    const want = useGame.getState().encTab;
    if (want) useGame.setState({ encTab: null });
    return want;
  });
  const [tab, setTab] = useState<Tab>(() => (opened && (opened.tab !== 'bestiary' || game) ? (opened.tab as Tab) : 'species'));
  const tabs: Tab[] = game ? ['bestiary', ...TABS] : TABS;
  const [sel, setSel] = useState<string | null>(opened?.id ?? null);
  const [query, setQuery] = useState('');
  const go = (l: Link) => {
    setTab(l.tab);
    setSel(l.id);
    setQuery('');
  };

  const entries = useMemo(() => (tab === 'elements' ? [] : entriesOf(tab, lang)), [tab, lang]);
  const sorted = useMemo(() => [...entries].sort((a, b) => (tab === 'rules' ? 0 : a.label.localeCompare(b.label, lang))), [entries, tab, lang]);
  const q = norm(query.trim());

  // The search looks into every page of every tab (built once per language, after the first letter typed).
  const [index, setIndex] = useState<Doc[] | null>(() => INDEX.get(lang) ?? null);
  useEffect(() => {
    if (!q || (index && INDEX.get(lang) === index)) return;
    const id = window.setTimeout(() => setIndex(searchIndex(lang)), 0);
    return () => window.clearTimeout(id);
  }, [q, lang, index]);
  const results = useMemo(() => {
    if (!q || !index) return [];
    const inLabel = index.filter((d) => norm(d.label).includes(q));
    const inText = index.filter((d) => !norm(d.label).includes(q) && norm(d.text).includes(q));
    return [...inLabel, ...inText];
  }, [q, index]);
  const MAX_RESULTS = 80;

  const current = sel && (entries.some((x) => x.id === sel) || (tab === 'elements' && sel === 'chart')) ? sel : (results.find((r) => r.tab === tab)?.id ?? sorted[0]?.id ?? null);
  const hasList = !!q || (tab !== 'elements' && tab !== 'bestiary');
  const [detail, setDetail] = useState<HTMLElement | null>(null);
  useHighlight(detail, q, `${tab}/${current}`);

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <ScreenTitle icon="nav-encyclopedia">{e('title')}</ScreenTitle>
        </div>
        <div className="enc-tabs">
          {tabs.map((t) => (
            <button key={t} className={`chip ${t === tab ? 'on' : ''} ${t === 'bestiary' ? 'enc-bestiary-tab' : ''}`} onClick={() => go({ tab: t, id: '' })}>
              {t === 'bestiary' && <UiIcon name="bestiary" />}
              {e(`tab.${t}` as EncKey)}
            </button>
          ))}
        </div>
      </section>
      <div className={hasList ? 'enc-layout' : ''}>
        {hasList && (
          <section className="panel enc-list">
            <input type="search" value={query} placeholder={e('searchAll')} onChange={(ev) => setQuery(ev.target.value)} />
            {q ? (
              <>
                {index && <div className="faint enc-count">{results.length ? e('results', { n: results.length }) : e('none')}</div>}
                <ul className="enc-results">
                  {results.slice(0, MAX_RESULTS).map((d) => (
                    <li key={`${d.tab}/${d.id}`}>
                      <button
                        className={d.tab === tab && d.id === current ? 'on' : ''}
                        onClick={() => {
                          setTab(d.tab);
                          setSel(d.id);
                        }}
                      >
                        <span className="enc-res-head">
                          <b>{d.label}</b>
                          <span className="enc-res-tab">{e(`tab.${d.tab}` as EncKey)}</span>
                        </span>
                        {!norm(d.label).includes(q) && <Snippet text={d.text} q={q} />}
                      </button>
                    </li>
                  ))}
                  {results.length > MAX_RESULTS && <li className="faint enc-count">{e('resultsMore', { n: results.length - MAX_RESULTS })}</li>}
                </ul>
              </>
            ) : (
              <ul>
                {sorted.map((x) => (
                  <li key={x.id}>
                    <button className={x.id === current ? 'on' : ''} onClick={() => setSel(x.id)}>
                      {x.icon && <span className="enc-ico">{x.icon}</span>}
                      {x.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section className="panel enc-detail" ref={setDetail}>
          {tab === 'elements' && <ElementsChart />}
          {tab === 'bestiary' && game && <BestiaryView game={game} go={go} />}
          {current && tab === 'species' && <SpeciesEntry id={current} go={go} />}
          {current && tab === 'abilities' && <AbilityEntry id={current} go={go} />}
          {current && tab === 'effects' && <EffectEntry id={current} go={go} />}
          {current && tab === 'traits' && <TraitEntry id={current} go={go} />}
          {current && tab === 'roles' && <RoleEntry id={current as RoleId} go={go} />}
          {current && tab === 'attributes' && <AttributeEntry id={current as AttributeKey} go={go} />}
          {current && tab === 'injuries' && <InjuryEntry id={current} />}
          {current && tab === 'rules' && <RuleEntry id={current as (typeof RULES)[number]} />}
        </section>
      </div>
    </div>
  );
}

// ——— helpers ———

export function elColor(el: AbilityDef['element']): string {
  return el === 'physical' || el === 'innate' ? 'var(--muted)' : ELEMENTS[el].color;
}

/** Signed percentage with the right decimal separator ("+12 %", "−3 %"). */
function usePct() {
  const { dec } = useT();
  return (v: number, signed = true) => {
    const n = Math.round(v * 1000) / 10;
    const s = Number.isInteger(n) ? String(Math.abs(n)) : dec(Math.abs(n), 1);
    return `${signed ? (n < 0 ? '−' : '+') : n < 0 ? '−' : ''}${s}`;
  };
}

function useMult() {
  const { dec } = useT();
  return (v: number) => (Number.isInteger(v) ? String(v) : dec(v, 2).replace(/0$/, ''));
}

function A({ to, go, children }: { to: Link; go: (l: Link) => void; children: ReactNode }) {
  return (
    <button className="link" onClick={() => go(to)}>
      {children}
    </button>
  );
}

/** Labelled facts; `compact` = a dense four-column grid (species header) where a row may span 2 or 4 columns. */
function Facts({ rows, compact }: { rows: ([string, ReactNode] | [string, ReactNode, 2 | 4])[]; compact?: boolean }) {
  return (
    <dl className={`enc-facts ${compact ? 'compact' : ''}`}>
      {rows.map(([k, v, wide]) => (
        <div key={k} className={wide ? `span-${wide}` : undefined}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function List({ title, items }: { title: string; items: ReactNode[] }) {
  if (!items.length) return null;
  return (
    <>
      <h4>{title}</h4>
      <ul className="enc-lines">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </>
  );
}

function rarityKey(r: number): EncKey {
  const tier = r <= 1 ? 1 : r <= 2 ? 2 : r <= 3 ? 3 : r <= 5 ? 4 : r <= 7 ? 5 : 6;
  return `rarity.${tier}` as EncKey;
}

/** Effect modifier lines (exact values). */
function useModLines() {
  const { lang } = useT();
  const e = encT(lang);
  const pct = usePct();
  const mult = useMult();
  return (mods: EffectMods | undefined): string[] => {
    if (!mods) return [];
    const out: string[] = [];
    for (const [k, v] of Object.entries(mods) as [keyof EffectMods, number][]) {
      if (k === 'damageMult' || k === 'healingTaken' || k === 'staminaRegenMult' || k === 'singleTaken' || k === 'areaTaken' || k === 'physicalTaken')
        out.push(e(`mod.${k}`, { v: mult(v) }));
      else if (k === 'initiativeMult') out.push(e('mod.initiativeMult', { v: mult(v), when: e(v < 1 ? 'mod.later' : 'mod.earlier') }));
      else if (k === 'dodgeBonus') out.push(e('mod.dodgeBonus', { v: pct(-v) }));
      else if (k === 'thorns' || k === 'fury' || k === 'spellReflect' || k === 'riposte') out.push(e(`mod.${k}`, { v: pct(v, false) }));
      else out.push(e(`mod.${k}` as EncKey, { v: pct(v) }));
    }
    return out;
  };
}

// ——— Species ———

export function SpeciesEntry({ id, go }: { id: string; go: (l: Link) => void }) {
  const tr = useT();
  const { lang } = tr;
  const e = encT(lang);
  const mult = useMult();
  const sp = SPECIES[id]!;
  const txt = speciesText(id, lang);
  const lc = sp.lifeCurve;
  const traitsMore = Object.entries(sp.traitWeights ?? {}).filter(([, w]) => w > 1);
  const traitsLess = Object.entries(sp.traitWeights ?? {}).filter(([, w]) => w < 1);
  return (
    <div>
      <h3 className="enc-title">
        <SpeciesIcon id={id} size="1.6em" /> {txt.name}
      </h3>
      <p>{txt.description}</p>
      <Facts
        compact
        rows={[
          [e('sp.size'), sizeName(sp.size, lang)],
          [
            e('sp.elements'),
            sp.elements.map((el) => (
              <span key={el} style={{ color: ELEMENTS[el].color, marginRight: 8 }}>
                ● {elementName(el, lang)}
              </span>
            )),
          ],
          [e('sp.rarity'), e(rarityKey(sp.rarity))],
          [e('sp.upkeep'), e('sp.upkeepText', { v: tr.money(sp.upkeep) })],
          [
            e('sp.roles'),
            sp.roles.map((r) => (
              <span key={r} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>
                <A to={{ tab: 'roles', id: r }} go={go}>
                  <RoleIcon role={r} /> {roleText(r, lang).name}
                </A>
              </span>
            )),
          ],
          [e('sp.price'), e('sp.priceText', { v: mult(sp.valueMult ?? 1) })],
          [e('sp.growth'), e('sp.growthText', { p: mult(sp.growth.physical), c: mult(sp.growth.combat), m: mult(sp.growth.mental) }), 2],
          [e('sp.life'), e('sp.lifeText', { min: lc.minAge, peak: lc.peakStart, end: lc.peakEnd, decline: Math.round(lc.declineRate * cfg.training.ageing.lossMult * 100), max: lc.maxAge }), 4],
        ]}
      />
      {sp.flying && <p className="muted"><UiIcon name="flying" /> {e('sp.flying')}</p>}
      {sp.passives?.length ? (
        <List
          title={e('sp.passives')}
          items={sp.passives.map((p) => (
            <>
              <A to={{ tab: 'effects', id: p }} go={go}>
                {effectText(p, lang).name}
              </A>{' '}
              — {effectText(p, lang).description}
            </>
          ))}
        />
      ) : null}
      <h4>{e('sp.abilities')}</h4>
      {/* The whole kit in full: basic attack, then the five skills in unlock order (name = link to the ability's entry). */}
      <div className="ability-grid enc-skills">
        {[...sp.basic.map((id) => ({ id, lv: 0 })), ...sp.skills.map((id, i) => ({ id, lv: skillLevel(i, cfg) }))].map((a) => (
          <AbilityCard
            key={a.id}
            id={a.id}
            elements={sp.elements}
            badge={tr.t('sk.level', { n: Math.max(1, a.lv) })}
            badgeTitle={a.lv === 0 ? e('sp.basic') : a.lv > 1 ? e('sp.unlock', { n: a.lv }) : e('sp.always')}
            name={
              <A to={{ tab: 'abilities', id: a.id }} go={go}>
                {abilityText(a.id, lang).name}
              </A>
            }
          />
        ))}
      </div>
      <h4>{e('sp.attributes')}</h4>
      <div className="enc-attrs">
        {(Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[]).map((cat) => (
          <div key={cat}>
            <div className="faint" style={{ marginBottom: 4 }}>
              {categoryName(cat, lang)}
            </div>
            {ATTRIBUTE_CATEGORIES[cat].map((k) => {
              const [lo, hi] = sp.attributes[k];
              return (
                <div key={k} className="enc-attr" title={attributeText(k, lang).description}>
                  <span>{attributeText(k, lang).name}</span>
                  <span className="enc-range">
                    <i style={{ left: `${((lo - 1) / 19) * 100}%`, width: `${((hi - lo) / 19) * 100}%` }} />
                  </span>
                  <span className="mono faint">
                    {lo}–{hi}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {(traitsMore.length > 0 || traitsLess.length > 0) && (
        <>
          <h4>{e('sp.traits')}</h4>
          {traitsMore.length > 0 && (
            <p>
              <b>{e('sp.traitsMore')} :</b>{' '}
              {traitsMore.map(([tid], i) => (
                <span key={tid}>
                  {i > 0 && ', '}
                  <A to={{ tab: 'traits', id: tid }} go={go}>
                    {traitText(tid, lang).name}
                  </A>
                </span>
              ))}
            </p>
          )}
          {traitsLess.length > 0 && (
            <p>
              <b>{e('sp.traitsLess')} :</b>{' '}
              {traitsLess.map(([tid], i) => (
                <span key={tid}>
                  {i > 0 && ', '}
                  <A to={{ tab: 'traits', id: tid }} go={go}>
                    {traitText(tid, lang).name}
                  </A>
                </span>
              ))}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ——— Abilities ———

export function AbilityEntry({ id, go }: { id: string; go: (l: Link) => void }) {
  const { lang, t } = useT();
  const e = encT(lang);
  const pct = usePct();
  const mult = useMult();
  const a = ABILITIES[id]!;
  const txt = abilityText(id, lang);
  const el = a.element === 'innate' ? e('ab.innate') : a.element === 'physical' ? e('ab.physical') : elementName(a.element as ElementId, lang);
  const special: string[] = [];
  if (a.reachBack) special.push(e('spec.reachBack'));
  if (a.lifesteal) special.push(e('spec.lifesteal', { v: pct(a.lifesteal, false) }));
  if (a.cleanse) special.push(e('spec.cleanse'));
  if (a.execute) special.push(e('spec.execute', { v: mult(1 + a.execute), t: Math.round(cfg.combat.damage.executeBelow * 100) }));
  if (a.staminaDrain) special.push(e('spec.staminaDrain', { v: a.staminaDrain }));
  if (a.hits && a.hits > 1) special.push(e('spec.hits', { n: a.hits }));
  if (a.chain) special.push(e('spec.chain', { n: a.chain, v: Math.round(cfg.combat.damage.chainFalloff * 100) }));
  if (a.steal) special.push(e('spec.steal'));
  else if (a.dispel) special.push(e('spec.dispel'));
  if (a.raise) special.push(e('spec.raise', { v: pct(a.raise, false) }));
  if (a.pack) special.push(e('spec.pack', { v: pct(a.pack, false), max: cfg.combat.damage.packMax }));
  if (a.hpCost) special.push(e('spec.hpCost', { v: pct(a.hpCost, false) }));
  if (a.fear) special.push(e('spec.fear', { v: a.fear }));
  if (a.accuracyMod) special.push(e('spec.accuracy', { v: pct(a.accuracyMod) }));
  if (a.critMod) special.push(e('spec.crit', { v: pct(a.critMod, false) }));
  if (a.effects?.some((x) => !EFFECTS[x.effect]?.beneficial && x.on === 'target')) special.push(e('spec.resist'));
  const learners = SPECIES_IDS.flatMap((sid) => {
    const sp = SPECIES[sid]!;
    if (sp.basic.includes(id)) return [{ sid, lv: 0 }];
    const lv = skillUnlockLevel(sid, id, cfg);
    return lv !== undefined ? [{ sid, lv }] : [];
  });
  return (
    <div>
      <h3 className="enc-title">
        <span style={{ color: elColor(a.element) }}><KindIcon kind={a.kind} /></span> {txt.name}
      </h3>
      <p>{txt.description}</p>
      <Facts
        rows={[
          [e('ab.kind'), abilityKindName(a.kind, lang)],
          [e('ab.element'), <span style={{ color: elColor(a.element) }}>{el}</span>],
          [e('ab.target'), e(`target.${a.target}` as EncKey)],
          ...(a.power > 0 ? ([[e('ab.power'), <span><span style={{ color: 'var(--bad)' }}>✸</span> {a.power}</span>]] as [string, ReactNode][]) : []),
          [e('ab.cost'), <span><UiIcon name="stamina" /> {a.staminaCost}</span>],
          [e('ab.cooldown'), a.cooldown ? e('ab.cooldownText', { n: a.cooldown }) : e('ab.noCooldown')],
        ]}
      />
      <List
        title={e('ab.effects')}
        items={(a.effects ?? []).map((x) => {
          return (
            <>
              {e('ab.effectChance', {
                chance: Math.round(x.chance * 100),
                effect: '§',
                stacks: (x.stacks ?? 1) > 1 ? e('ab.effectStacks', { n: x.stacks! }) : '',
                // Always said: rounds, the target's next turns, until the break, or the whole match.
                duration: ` (${durationLabel(t, effectDuration(x))})`,
                self: x.on === 'self' ? e('ab.effectSelf') : '',
              })
                .split('§')
                .flatMap((part, i) =>
                  i === 0
                    ? [part]
                    : [
                        <A key={i} to={{ tab: 'effects', id: x.effect }} go={go}>
                          {effectText(x.effect, lang).name}
                        </A>,
                        part,
                      ],
                )}
            </>
          );
        })}
      />
      <List title={e('ab.special')} items={special} />
      <List
        title={e('ab.learnedBy')}
        items={learners.map((l) => (
          <>
            <SpeciesIcon id={l.sid} />{' '}
            <A to={{ tab: 'species', id: l.sid }} go={go}>
              {speciesText(l.sid, lang).name}
            </A>{' '}
            <span className="faint">— {l.lv === 0 ? e('sp.basic') : l.lv > 1 ? e('sp.unlock', { n: l.lv }) : e('sp.always')}</span>
          </>
        ))}
      />
    </div>
  );
}

// ——— Effects ———

export function EffectEntry({ id, go }: { id: string; go: (l: Link) => void }) {
  const { lang } = useT();
  const e = encT(lang);
  const pct = usePct();
  const modLines = useModLines();
  const fx = EFFECTS[id]! as EffectDef;
  const txt = effectText(id, lang);
  const permanent = fx.defaultDuration >= 999;
  const duration = permanent
    ? e('fx.permanent')
    : fx.curse
      ? e('fx.untilBreak')
      : fx.kind === 'stun'
        ? e('fx.durationTurns', { n: fx.defaultDuration })
        : e('fx.durationRounds', { n: fx.defaultDuration });
  const lines: ReactNode[] = [];
  if (fx.kind === 'dot') lines.push(e('fx.dot', { v: pct(fx.magnitude ?? 0, false), per: fx.maxStacks ? e('fx.dotPerStack') : '' }));
  if (fx.kind === 'hot') lines.push(e('fx.hot', { v: pct(fx.magnitude ?? 0, false) }));
  if (fx.kind === 'shield') lines.push(e('fx.shield', { v: pct(fx.magnitude ?? 0, false) }));
  if (fx.kind === 'stun') lines.push(e('fx.stun'));
  if (fx.revive) lines.push(e('fx.revive', { v: pct(fx.revive, false) }));
  lines.push(...modLines(fx.mods));
  if (fx.moralePerRound) lines.push(e('fx.morale', { v: `${fx.moralePerRound > 0 ? '+' : ''}${fx.moralePerRound}` }));
  if (fx.maxStacks) lines.push(e('fx.stacks', { n: fx.maxStacks }));
  if (fx.onMaxStacks)
    lines.push(
      <>
        {e('fx.converts', { n: fx.maxStacks ?? 0, to: '§' }).split('§')[0]}
        <A to={{ tab: 'effects', id: fx.onMaxStacks }} go={go}>
          {effectText(fx.onMaxStacks, lang).name}
        </A>
        {e('fx.converts', { n: fx.maxStacks ?? 0, to: '§' }).split('§')[1]}
      </>,
    );
  if (fx.undying) lines.push(e('fx.undying'));
  if (fx.charm) lines.push(e('fx.charm'));
  if (fx.detonate) lines.push(e('fx.detonate', { v: pct(fx.detonate, false) }));
  if (fx.images) lines.push(e('fx.images'));
  if (fx.burrowed) lines.push(e('fx.burrowed'));
  if (fx.steadfast) lines.push(e('fx.steadfast', { v: Math.round(cfg.combat.damage.steadfastMult * 100) }));
  if (fx.silence) lines.push(e('fx.silence'));
  if (fx.taunt) lines.push(e('fx.taunt'));
  if (fx.hidden && !fx.burrowed) lines.push(e('fx.hidden'));

  if (fx.consumedOnAttack) lines.push(e('fx.consumed'));
  if (fx.rechargeAtBreak) lines.push(e('fx.recharge'));
  if (fx.transformInto)
    lines.push(
      <>
        {e('fx.transform', { v: pct(fx.transformBelow ?? 0, false), to: '§' }).split('§')[0]}
        <A to={{ tab: 'effects', id: fx.transformInto }} go={go}>
          {effectText(fx.transformInto, lang).name}
        </A>
        {e('fx.transform', { v: pct(fx.transformBelow ?? 0, false), to: '§' }).split('§')[1]}
      </>,
    );
  if (fx.curse) lines.push(e('fx.curse'));
  if (fx.endsOnHeal) lines.push(e('fx.endsOnHeal'));
  if (!fx.beneficial && !permanent && !fx.curse) lines.push(e('fx.cleansable'));
  const sources = Object.values(ABILITIES).filter((a) => a.effects?.some((x) => x.effect === id));
  const holders = SPECIES_IDS.filter((sid) => SPECIES[sid]!.passives?.includes(id));
  return (
    <div>
      <h3 className="enc-title">
        <span className={fx.beneficial ? 'good-text' : 'bad-text'}>{fx.beneficial ? '▲' : '▼'}</span> {txt.name}
      </h3>
      <p>{txt.description}</p>
      <Facts
        rows={[
          [e('fx.kind'), `${e(`fx.kind.${fx.kind}` as EncKey)} · ${e(fx.beneficial ? 'fx.good' : 'fx.bad')}`],
          [e('fx.duration'), duration],
        ]}
      />
      <List title={e('fx.numbers')} items={lines} />
      <List
        title={e('fx.appliedBy')}
        items={sources.map((a) => (
          <A to={{ tab: 'abilities', id: a.id }} go={go}>
            {abilityText(a.id, lang).name}
          </A>
        ))}
      />
      <List
        title={e('fx.passiveOf')}
        items={holders.map((sid) => (
          <>
            <SpeciesIcon id={sid} />{' '}
            <A to={{ tab: 'species', id: sid }} go={go}>
              {speciesText(sid, lang).name}
            </A>
          </>
        ))}
      />
    </div>
  );
}

// ——— Traits ———

export function TraitEntry({ id, go }: { id: string; go: (l: Link) => void }) {
  const { lang } = useT();
  const e = encT(lang);
  const tdef = TRAITS[id]!;
  const txt = traitText(id, lang);
  const lines = useTraitEffects()(id);
  return (
    <div>
      <h3 className="enc-title">{txt.name}</h3>
      <p>{txt.description}</p>
      <Facts rows={[[e('tr.polarity'), e(`tr.${tdef.polarity}` as EncKey)], ...(tdef.acquired ? [[e('tr.origin'), e('tr.acquired')] as [string, string]] : [])]} />
      <List title={e('tr.effects')} items={lines} />
      <List
        title={e('tr.excludes')}
        items={(tdef.excludes ?? []).map((x) => (
          <A to={{ tab: 'traits', id: x }} go={go}>
            {traitText(x, lang).name}
          </A>
        ))}
      />
    </div>
  );
}

// ——— Roles ———

export function RoleEntry({ id, go }: { id: RoleId; go: (l: Link) => void }) {
  const { lang } = useT();
  const e = encT(lang);
  const pct = usePct();
  const mult = useMult();
  const r = ROLES[id];
  const txt = roleText(id, lang);
  const m = cfg.combat.roles[id];
  const lines: string[] = [];
  for (const k of ['melee', 'ranged', 'spell', 'heal'] as const) if (m[k] !== 1) lines.push(e(`ro.${k}`, { v: mult(m[k]) }));
  if (m.mitigation) lines.push(e('ro.mitigation', { v: pct(m.mitigation) }));
  const rf = cfg.combat.roleFit;
  const fit = Object.entries(r.fit)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([k]) => attributeText(k as AttributeKey, lang).name);
  const natural = SPECIES_IDS.filter((sid) => SPECIES[sid]!.roles.includes(id));
  return (
    <div>
      <h3 className="enc-title">
        <RoleIcon role={id} size="1.4em" /> {txt.name}
      </h3>
      <p>{txt.description}</p>
      <Facts
        rows={[
          [e('ro.line'), e(r.defaultLine === 'front' ? 'ro.front' : 'ro.back')],
          [e('ro.ai'), e(`ro.ai.${id}` as EncKey)],
          [e('ro.fit'), fit.join(', ')],
        ]}
      />
      <List title={e('ro.bonus')} items={lines} />
      <p className="muted">{e('ro.scaling', { min: mult(rf.min), max: mult(rf.max), off: Math.round(rf.offRoleBonus * 100) })}</p>
      <List
        title={e('sp.roles')}
        items={[
          <span className="enc-inline">
            {natural.map((sid) => (
              <A key={sid} to={{ tab: 'species', id: sid }} go={go}>
                <SpeciesIcon id={sid} /> {speciesText(sid, lang).name}
              </A>
            ))}
          </span>,
        ]}
      />
    </div>
  );
}

// ——— Elements, attributes, injuries, rules ———

/** An element as a round medallion in its colour (icon), with its name or not. */
function ElementBadge({ id, named, size = 'md' }: { id: ElementId; named?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const { lang } = useT();
  return (
    <span className={`el-badge ${size}`} style={{ '--el': ELEMENTS[id].color } as CSSProperties} title={named ? undefined : elementName(id, lang)}>
      <span className="el-medal">
        <UiIcon name={`el-${id}`} size="1em" />
      </span>
      {named && <span className="el-badge-name">{elementName(id, lang)}</span>}
    </span>
  );
}

export function ElementsChart() {
  const { lang } = useT();
  const e = encT(lang);
  const mult = useMult();
  const el = cfg.elements;
  // Row / column under the pointer in the chart (both light up).
  const [hover, setHover] = useState<{ a: ElementId | null; d: ElementId | null }>({ a: null, d: null });
  const fears = (d: ElementId) => ELEMENT_IDS.filter((a) => el.strong[a].includes(d));
  const resists = (d: ElementId) => ELEMENT_IDS.filter((a) => el.weak[a].includes(d));
  const speciesWith = (x: ElementId) => SPECIES_IDS.filter((sid) => SPECIES[sid]!.elements.includes(x)).length;
  const line = (label: string, tone: string, list: ElementId[]) => (
    <div className={`el-line ${tone}`}>
      <span className="el-line-label">{label}</span>
      <span className="el-line-list">
        {list.length ? list.map((x) => <ElementBadge key={x} id={x} named size="sm" />) : <span className="faint">{e('el.none')}</span>}
      </span>
    </div>
  );
  return (
    <div className="el-page">
      <h3 className="enc-title">{e('tab.elements')}</h3>
      <p>{e('el.intro', { strong: mult(el.strongMult), weak: mult(el.weakMult), min: mult(el.minMult), max: mult(el.maxMult) })}</p>
      <div className="el-legend">
        <span className="el-cell strong">▲ ×{mult(el.strongMult)}</span> {e('el.effective')}
        <span className="el-cell weak">▼ ×{mult(el.weakMult)}</span> {e('el.resisted')}
        <span className="el-cell neutral">·</span> {e('el.neutral')}
      </div>

      <p className="faint" style={{ marginTop: 0 }}>
        {e('el.matrixHint')} {e('el.dual', { max: mult(el.maxMult), min: mult(el.minMult) })}
      </p>
      <div className="el-matrix-wrap">
        <table className="el-matrix" onMouseLeave={() => setHover({ a: null, d: null })}>
          <thead>
            <tr>
              <th className="el-corner">{e('el.attacker')}</th>
              {ELEMENT_IDS.map((d) => (
                <th key={d} className={hover.d === d ? 'lit' : ''}>
                  <ElementBadge id={d} />
                  <small>{elementName(d, lang)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ELEMENT_IDS.map((a) => (
              <tr key={a} className={hover.a === a ? 'lit' : ''}>
                <th>
                  <ElementBadge id={a} named />
                </th>
                {ELEMENT_IDS.map((d) => {
                  const strong = el.strong[a].includes(d);
                  const weak = el.weak[a].includes(d);
                  return (
                    <td key={d} className={hover.d === d ? 'lit' : ''} onMouseEnter={() => setHover({ a, d })}>
                      <span className={`el-cell ${strong ? 'strong' : weak ? 'weak' : 'neutral'}`}>
                        {strong ? `▲ ×${mult(el.strongMult)}` : weak ? `▼ ×${mult(el.weakMult)}` : '·'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="el-section">{e('el.each')}</h4>
      <div className="el-cards">
        {ELEMENT_IDS.map((x) => (
          <article key={x} className="el-card" style={{ '--el': ELEMENTS[x].color } as CSSProperties}>
            <header className="el-card-head">
              <ElementBadge id={x} size="lg" />
              <span>
                <b>{elementName(x, lang)}</b>
                <small className="faint">{e('el.species', { n: speciesWith(x) })}</small>
              </span>
            </header>
            {line(e('el.hitsHard'), 'good', el.strong[x])}
            {line(e('el.hitsPoorly'), 'bad', el.weak[x])}
            {line(e('el.fears'), 'bad', fears(x))}
            {line(e('el.resists'), 'good', resists(x))}
          </article>
        ))}
      </div>
    </div>
  );
}

/** What an attribute does, with the numbers the simulation uses. */
function attributeVars(id: AttributeKey, pct: (v: number, signed?: boolean) => string, mult: (v: number) => string, num: (v: number) => string): Record<string, string | number> {
  const c = cfg.combat;
  const p = (v: number) => pct(v, false);
  const hit = c.hit.perPoint;
  const o = c.orders;
  const disobey = (d: number) => p(o.disobeyBase * Math.pow(1 - d / 20, o.disobeyExponent));
  switch (id) {
    case 'strength':
      return { s: Math.round(c.mix.meleePower.strength * 100), t: Math.round(c.mix.meleePower.technique * 100), base: mult(c.damage.statBase), per: mult(c.damage.statPerPoint), v10: mult(Math.round((c.damage.statBase + 10 * c.damage.statPerPoint) * 100) / 100), v20: mult(Math.round((c.damage.statBase + 20 * c.damage.statPerPoint) * 100) / 100), hp: num(c.hp.perStrength) };
    case 'stamina':
      return { base: c.stamina.base, per: c.stamina.perStamina, p10: c.stamina.base + 10 * c.stamina.perStamina, p20: c.stamina.base + 20 * c.stamina.perStamina, regen: num(c.stamina.regenPerStamina) };
    case 'speed':
      return { per: num(c.initiative.perSpeed), noise: c.initiative.noise, dodge: p(c.hit.dodgePerSpeed) };
    case 'agility':
      return { melee: p(hit * 0.4), ranged: p(hit * 0.7) };
    case 'toughness':
      return { hp: num(c.hp.perToughness), arm: p(c.damage.physMitigationPerToughness), min: pct(c.damage.minMitigation), max: p(c.damage.maxMitigation) };
    case 'recovery':
      return { regen: num(c.stamina.regenPerRecovery), r10: num(Math.round((c.stamina.regenBase + 10 * c.stamina.regenPerRecovery + 10 * c.stamina.regenPerStamina) * 10) / 10), rest: c.stamina.restMult, base: cfg.league.week.fatigueRecovery, week: num(cfg.league.week.fatigueRecoveryPerAttr) };
    case 'attack':
      return { p: p(hit * c.mix.meleeHit.attack), a: Math.round(c.mix.meleeHit.attack * 100), c: Math.round(c.mix.meleeHit.accuracy * 100), t: Math.round(c.mix.meleeHit.technique * 100) };
    case 'accuracy':
      return { p: p(hit * c.mix.rangedHit.accuracy), pm: p(hit * c.mix.meleeHit.accuracy), r: Math.round(c.mix.rangedHit.accuracy * 100), rt: Math.round(c.mix.rangedHit.technique * 100), c: Math.round(c.mix.meleeHit.accuracy * 100), base: mult(c.damage.statBase), per: mult(c.damage.statPerPoint) };
    case 'defense':
      return { p: p(hit * 0.6) };
    case 'magic':
      return { base: mult(c.damage.statBase), per: mult(c.damage.statPerPoint), hbase: mult(c.heal.statBase), hper: mult(c.heal.statPerPoint), p: p(hit * 0.3) };
    case 'focus':
      return { p: p(hit * 0.7), dodge: p(hit * 0.5), arm: p(c.damage.spellMitigationPerPoint / 2) };
    case 'technique':
      return { crit: p(c.damage.critPerTechnique), mult: mult(c.damage.critMult), p: p(hit * c.mix.rangedHit.technique), pm: p(hit * c.mix.meleeHit.technique), tp: Math.round(c.mix.meleePower.technique * 100) };
    case 'courage':
      return { c: p(c.morale.courageReductionPerPoint), arm: p(c.damage.spellMitigationPerPoint / 2), front: p(c.damage.courageFrontPerPoint), g: mult((c.grace.courageFloor + 20) / (c.grace.courageFloor + 10)) };
    case 'composure':
      return { hit: p(c.hit.perComposure), crit: p(c.damage.critPerComposure), h: p(c.morale.composureReductionPerPoint), low: p(c.damage.lowHpThreshold), pen: p(c.damage.lowHpPenalty) };
    case 'aggression':
      return { d: p(c.damage.aggressionPerPoint), a: p(c.damage.aggressionMitigationPenalty), inst: 14 };
    case 'tactics':
      return { noise: p(c.ai.noiseMax), inst: 14 };
    case 'discipline':
      return { d5: disobey(5), d10: disobey(10), d15: disobey(15), cost: p(c.stamina.disciplinePerPoint) };
    case 'anticipation':
      return { init: num(c.initiative.perAnticipation), p: p(hit * 0.4), g: p(c.guard.perAnticipation) };
    case 'determination':
      return { d: p(c.damage.determinationMax), f: p(c.fatigue.determinationPerPoint) };
    case 'teamwork':
      return { c: p(c.hit.comboPerTeamwork), g: p(c.guard.perTeamwork) };
    case 'leadership':
      return { min: c.morale.minLeadership, a: num(c.morale.leadershipAuraPerPoint), below: c.morale.minLeadership - 1, hit: p(c.hit.perLeadership) };
  }
}

export function AttributeEntry({ id, go }: { id: AttributeKey; go?: (l: Link) => void }) {
  const { lang } = useT();
  const e = encT(lang);
  const pct = usePct();
  const mult = useMult();
  const num = (v: number) => (lang === 'fr' ? String(v).replace('.', ',') : String(v));
  const txt = attributeText(id, lang);
  const cat = (Object.keys(ATTRIBUTE_CATEGORIES) as AttributeCategory[]).find((c) => ATTRIBUTE_CATEGORIES[c].includes(id))!;
  const roles = ROLE_IDS.map((r) => ({ r, w: (ROLES[r].fit as Partial<Record<AttributeKey, number>>)[id] ?? 0 }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w);
  const best = SPECIES_IDS.map((s) => ({ s, v: SPECIES[s]!.attributes[id][1] }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);
  const link = (to: Link, label: ReactNode) => (go ? <A to={to} go={go}>{label}</A> : label);
  return (
    <div>
      <h3 className="enc-title">
        {txt.name} <span className="faint">({txt.short} · {categoryName(cat, lang)})</span>
      </h3>
      <p>{txt.description}</p>
      <h4>{e('at.effects')}</h4>
      {e(`at.${id}` as EncKey, attributeVars(id, pct, mult, num))
        .split('\n')
        .map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      {roles.length > 0 && (
        <>
          <h4>{e('at.roles')}</h4>
          <div className="enc-links">
            {roles.map((x) => (
              <span key={x.r}>{link({ tab: 'roles', id: x.r }, <><RoleIcon role={x.r} /> {roleText(x.r, lang).name}</>)}</span>
            ))}
          </div>
        </>
      )}
      <h4>{e('at.species')}</h4>
      <div className="enc-links">
        {best.map((x) => (
          <span key={x.s}>{link({ tab: 'species', id: x.s }, <><SpeciesIcon id={x.s} /> {speciesText(x.s, lang).name} ({x.v})</>)}</span>
        ))}
      </div>
      <p className="faint small">{e('at.scale')}</p>
    </div>
  );
}

export function InjuryEntry({ id }: { id: string }) {
  const { lang } = useT();
  const e = encT(lang);
  const scarFx = useScarEffects();
  const inj = INJURIES[id]!;
  const scars = cfg.scars.chance[inj.severity] > 0 ? scarsOfInjury(id) : [];
  return (
    <div>
      <h3 className="enc-title">{injuryText(id, lang).short}</h3>
      <Facts
        rows={[
          [e('inj.weeks'), `${inj.weeks[0]}–${inj.weeks[1]}`],
          [e('inj.severity'), e(`sev.${inj.severity}` as EncKey)],
          [e('inj.cause'), inj.cause === 'any' ? e('inj.any') : inj.cause === 'physical' || inj.cause === 'innate' ? e('ab.physical') : elementName(inj.cause, lang)],
          [e('inj.scars'), scars.length ? scars.map((x) => `${scarText(x, lang).name} (${scarFx(x).join(', ')})`).join(' ; ') : e('inj.noScar'), 2],
        ]}
      />
    </div>
  );
}

export function RuleEntry({ id }: { id: (typeof RULES)[number] }) {
  const { lang } = useT();
  const e = encT(lang);
  const pct = usePct();
  const mult = useMult();
  const c = cfg.combat;
  const m = cfg.match;
  const p = (v: number) => pct(v, false);
  const num = (v: number) => (lang === 'fr' ? String(v).replace('.', ',') : String(v));
  const vars: Record<(typeof RULES)[number], Record<string, string | number>> = {
    match: {
      starters: m.starters, bench: m.benchSize, rounds: m.maxRounds, breaks: m.breakRounds.join(', '), subs: m.maxSubstitutions,
      koWin: m.points.koWin, pointsWin: m.points.pointsWin, pointsLoss: m.points.pointsLoss, koLoss: m.points.koLoss,
    },
    turn: { antic: mult(c.initiative.perAnticipation), small: c.initiative.sizeMod.small, large: c.initiative.sizeMod.large, huge: c.initiative.sizeMod.huge, noise: c.initiative.noise },
    hit: {
      base: p(c.hit.base), per: p(c.hit.perPoint), min: p(c.hit.min), max: p(c.hit.max), huge: p(c.hit.sizeMod.huge), small: pct(c.hit.sizeMod.small), spell: p(-c.hit.spellBonus),
      mA: p(c.mix.meleeHit.attack), mAc: p(c.mix.meleeHit.accuracy), mT: p(c.mix.meleeHit.technique), rAc: p(c.mix.rangedHit.accuracy), rT: p(c.mix.rangedHit.technique),
      comp: p(c.hit.perComposure), spd: p(c.hit.dodgePerSpeed), lead: p(c.hit.perLeadership), fat: p(c.fatigue.maxPenalty * c.fatigue.hitShare),
    },
    damage: {
      base: mult(c.damage.statBase), per: mult(c.damage.statPerPoint), variance: p(c.damage.variance), minM: pct(c.damage.minMitigation), maxM: p(c.damage.maxMitigation), crit: mult(c.damage.critMult),
      pS: p(c.mix.meleePower.strength), pT: p(c.mix.meleePower.technique),
    },
    cover: {
      one: p(coverReduction(1, cfg)), tank: p(coverReduction(c.cover.tankWeight, cfg)), two: p(coverReduction(2, cfg)),
      three: p(coverReduction(3, cfg)), four: p(coverReduction(4, cfg)), max: p(c.cover.max),
      reach: p(c.hit.reachPenalty), flank: p(c.hit.flankPenalty), base: p(c.hit.base), ex: p(c.hit.base - c.hit.reachPenalty),
      flankMin: p(c.hit.flankPenalty * (2 - c.roleFit.max)), flankMax: p(c.hit.flankPenalty * (2 - c.roleFit.min)),
      tw: num(c.cover.tankWeight),
    },
    guard: { passive: p(c.guard.passiveBase), active: p(c.guard.activeBase), max: p(c.guard.max), gm: p(c.guard.guardMitigation) },
    orders: {
      cd: mult(c.orders.cautious.damageMult), cm: p(c.orders.cautious.mitigation), cs: mult(c.orders.cautious.staminaCostMult),
      ad: mult(c.orders.aggressive.damageMult), am: pct(c.orders.aggressive.mitigation), as: mult(c.orders.aggressive.staminaCostMult),
      asc: p(c.orders.ascendancy.bonus),
      sad: mult(c.stances.allOut.damageMult), sam: pct(c.stances.allOut.mitigation), sas: mult(c.stances.allOut.staminaCostMult),
      scd: mult(c.stances.conserve.damageMult), scs: mult(c.stances.conserve.staminaCostMult),
    },
    talks: {
      rp: p(c.orders.talks.rally.share), rt: c.orders.talks.rally.target, sw: p(c.orders.talks.secondWind.share), fo: p(c.orders.talks.focus.hit),
      rm: p(c.orders.talks.ranks.mitigation), ri: p(c.orders.talks.ranks.intercept), ev: p(c.orders.talks.evade.dodge),
      fd: p(c.orders.talks.fury.damage), fc: p(c.orders.talks.fury.cost),
    },
    stamina: {
      large: mult(c.stamina.sizeCostMult.large), huge: mult(c.stamina.sizeCostMult.huge), threshold: p(c.fatigue.threshold), max: p(c.fatigue.maxPenalty),
      pre: mult(c.stamina.preMatchFatigueLoss), inj: mult(1 + c.fatigue.injuryFromFatigue), hitMax: p(c.fatigue.maxPenalty * c.fatigue.hitShare),
    },
    morale: {
      allyKo: c.morale.allyKo, enemyKo: c.morale.enemyKo, heavy: c.morale.heavyHitTaken, crit: c.morale.critDealt, lead: c.morale.minLeadership,
      swing: p(c.morale.performanceSwing), hes: c.morale.hesitateBelow, flee: c.morale.fleeBelow, fleeHp: p(c.morale.fleeHpBelow),
      gTrail: c.grace.trailBy, gRound: c.grace.minRound, gDmg: p((EFFECTS.graced?.mods?.damageMult ?? 1) - 1), gHit: p(EFFECTS.graced?.mods?.hitBonus ?? 0),
      gDodge: p(EFFECTS.graced?.mods?.dodgeBonus ?? 0), gHeal: p(c.grace.heal),
      gLow: mult((c.grace.courageFloor + 1) / (c.grace.courageFloor + 10)), gHigh: mult((c.grace.courageFloor + 20) / (c.grace.courageFloor + 10)),
    },
    injury: {
      ko: p(c.injury.onKo), heavyHit: p(c.morale.heavyHitFraction), heavy: pct(c.injury.onHeavyHit, false),
      moderate: p(cfg.league.death.chance.moderate!), severe: p(cfg.league.death.chance.severe!), career: p(cfg.league.death.chance.career!),
      sMod: p(cfg.scars.chance.moderate), sSev: p(cfg.scars.chance.severe), sCar: p(cfg.scars.chance.career), sMax: cfg.scars.max,
    },
    arena: { start: cfg.arena.startWeek, clear: p(cfg.arena.clearChance) },
    levels: {
      max: cfg.training.levels.max, xp: cfg.training.levels.xpPerLevel, sk: cfg.combat.skills.unlockLevels.join(', '), eq: cfg.combat.skills.equipped, played: num(cfg.training.xp.played), starter: num(cfg.training.xp.starter),
      rating: num(cfg.training.xp.perRatingPoint), win: num(cfg.training.xp.win),
      young: mult(cfg.training.stage.young), prime: mult(cfg.training.stage.prime), old: mult(cfg.training.stage.declining),
    },
    age: { young: mult(cfg.training.stage.young), prime: mult(cfg.training.stage.prime), old: mult(cfg.training.stage.declining) },
    traits: { chance: Math.round(cfg.traitEvolution.chance * 100), gain: Math.round(cfg.traitEvolution.gainShare * 100), max: cfg.traitEvolution.maxTraits },
  };
  return (
    <div className="rule-page">
      <h3 className="enc-title">{e(`ru.${id}.title` as EncKey)}</h3>
      <RuleText text={markNumbers(ENC_DICTS[lang][`ru.${id}.body` as EncKey], vars[id])} />
      {id === 'arena' && <ArenaConditionList />}
    </div>
  );
}

// Rule bodies use a tiny markup, one block per line: « # » a heading, « - » a list item, « > » an assistant's tip,
// anything else a paragraph (the first one is the lede); « **…** » bolds a label. Filled-in numbers are marked
// (with their sign and « % ») so they stand out.
const NUM_OPEN = '\u0001';
const NUM_CLOSE = '\u0002';

/** Fills the placeholders, wrapping each value (with a sign before and a « % » after) in number marks. */
function markNumbers(template: string, vars: Record<string, string | number>) {
  return template.replace(/([+−×±-]?)\{(\w+)\}(\s?%)?/g, (m, sign: string, k: string, unit?: string) =>
    vars[k] === undefined ? m : `${NUM_OPEN}${sign}${vars[k]}${unit ?? ''}${NUM_CLOSE}`,
  );
}

/** Inline text: numbers stand out, « **label** » is bold. */
function RuleInline({ text }: { text: string }) {
  const numbers = (s: string, key: string) =>
    s.split(new RegExp(`(${NUM_OPEN}[^${NUM_CLOSE}]*${NUM_CLOSE})`)).map((part, i) =>
      part.startsWith(NUM_OPEN) ? (
        <span key={`${key}-${i}`} className="rule-num">
          {part.slice(1, -1).replace(/\s%/, ' %').replace(/^-/, '−')}
        </span>
      ) : (
        part
      ),
    );
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{numbers(part.slice(2, -2), `b${i}`)}</strong> : numbers(part, `t${i}`),
      )}
    </>
  );
}

function RuleText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let items: string[] = [];
  let lede = true;
  const flush = () => {
    if (!items.length) return;
    blocks.push(
      <ul key={blocks.length} className="rule-list">
        {items.map((it, i) => (
          <li key={i}>
            <RuleInline text={it} />
          </li>
        ))}
      </ul>,
    );
    items = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('- ')) {
      items.push(line.slice(2));
      lede = false;
      continue;
    }
    flush();
    if (line.startsWith('# ')) {
      blocks.push(
        <h4 key={blocks.length} className="rule-head">
          {line.slice(2)}
        </h4>,
      );
    } else if (line.startsWith('> ')) {
      blocks.push(
        <div key={blocks.length} className="rule-tip">
          <span className="rule-tip-ico">
            <UiIcon name="tip" />
          </span>
          <span>
            <RuleInline text={line.slice(2)} />
          </span>
        </div>,
      );
    } else {
      blocks.push(
        <p key={blocks.length} className={lede ? 'rule-lede' : undefined}>
          <RuleInline text={line} />
        </p>,
      );
    }
    lede = false;
  }
  flush();
  return <>{blocks}</>;
}
