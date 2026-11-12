/**
 * Encyclopedia: every species, ability, effect, trait, role, element, attribute and injury, plus the combat
 * rules — all generated from the game data and config, so the numbers are always the real ones.
 * Play styles are never named: only mechanics.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ABILITIES } from '../../data/abilities.ts';
import { ATTRIBUTE_CATEGORIES, ATTRIBUTE_KEYS, type AttributeCategory, type AttributeKey } from '../../data/attributes.ts';
import { DEFAULT_CONFIG } from '../../data/config/index.ts';
import { EFFECTS } from '../../data/effects.ts';
import { ELEMENTS, ELEMENT_IDS } from '../../data/elements.ts';
import { INJURIES } from '../../data/injuries.ts';
import { ROLES } from '../../data/roles.ts';
import { SPECIES, SPECIES_IDS } from '../../data/species.ts';
import { TRAITS } from '../../data/traits.ts';
import type { AbilityDef, EffectDef, EffectMods, ElementId, RoleId, TraitCombatEffects } from '../../data/schema.ts';
import {
  abilityKindName, abilityText, attributeText, categoryName, effectText, elementName, injuryText, roleText, sizeName,
  speciesText, traitText,
} from '../../engine/text/localize.ts';
import { RoleIcon, SpeciesIcon, UiIcon } from '../icons/Icon.tsx';
import { encT, type EncKey } from '../i18n/encyclopedia.ts';
import { useT } from '../i18n/index.ts';
import { KindIcon } from '../components/AbilityCard.tsx';
import { unlockLevel } from '../../engine/progression/levels.ts';
import { coverReduction } from '../../engine/combat/formulas.ts';
import { useGame } from '../store/gameStore.ts';
import { BestiaryView } from './BestiaryView.tsx';
import { ArenaConditionList } from '../components/ArenaCondition.tsx';

const cfg = DEFAULT_CONFIG;
export type Tab = 'bestiary' | 'species' | 'abilities' | 'effects' | 'traits' | 'roles' | 'elements' | 'attributes' | 'injuries' | 'rules';
const TABS: Tab[] = ['species', 'abilities', 'effects', 'traits', 'roles', 'elements', 'attributes', 'injuries', 'rules'];
const ROLE_IDS = Object.keys(ROLES) as RoleId[];
export const RULES = ['match', 'turn', 'hit', 'damage', 'cover', 'guard', 'orders', 'stamina', 'morale', 'injury', 'levels', 'arena'] as const;

/** Accent-insensitive, case-insensitive match. */
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

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

  // Entries of the current tab: [id, label, icon].
  const entries = useMemo((): { id: string; label: string; icon?: ReactNode }[] => {
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
      default:
        return [];
    }
  }, [tab, lang, e]);
  const sorted = useMemo(() => [...entries].sort((a, b) => (tab === 'rules' ? 0 : a.label.localeCompare(b.label, lang))), [entries, tab, lang]);
  const q = norm(query.trim());
  const shown = q ? sorted.filter((x) => norm(x.label).includes(q)) : sorted;
  const current = sel && entries.some((x) => x.id === sel) ? sel : (shown[0]?.id ?? null);
  const hasList = tab !== 'elements' && tab !== 'bestiary';

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <h2><UiIcon name="nav-encyclopedia" /> {e('title')}</h2>
          <span className="muted">{e('intro')}</span>
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
            <input type="search" value={query} placeholder={e('search')} onChange={(ev) => setQuery(ev.target.value)} />
            {shown.length === 0 && <div className="muted">{e('none')}</div>}
            <ul>
              {shown.map((x) => (
                <li key={x.id}>
                  <button className={x.id === current ? 'on' : ''} onClick={() => setSel(x.id)}>
                    {x.icon && <span className="enc-ico">{x.icon}</span>}
                    {x.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="panel enc-detail">
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

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="enc-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
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
      if (k === 'damageMult' || k === 'healingTaken' || k === 'staminaRegenMult') out.push(e(`mod.${k}`, { v: mult(v) }));
      else if (k === 'initiativeMult') out.push(e('mod.initiativeMult', { v: mult(v), when: e(v < 1 ? 'mod.later' : 'mod.earlier') }));
      else if (k === 'dodgeBonus') out.push(e('mod.dodgeBonus', { v: pct(-v) }));
      else if (k === 'thorns' || k === 'fury' || k === 'spellReflect') out.push(e(`mod.${k}`, { v: pct(v, false) }));
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
          [
            e('sp.roles'),
            sp.roles.map((r) => (
              <span key={r} style={{ marginRight: 8 }}>
                <A to={{ tab: 'roles', id: r }} go={go}>
                  <RoleIcon role={r} /> {roleText(r, lang).name}
                </A>
              </span>
            )),
          ],
          [e('sp.life'), e('sp.lifeText', { min: lc.minAge, peak: lc.peakStart, end: lc.peakEnd, decline: Math.round(lc.declineRate * 100), max: lc.maxAge })],
          [e('sp.growth'), e('sp.growthText', { p: mult(sp.growth.physical), c: mult(sp.growth.combat), m: mult(sp.growth.mental) })],
          [e('sp.upkeep'), e('sp.upkeepText', { v: tr.money(sp.upkeep) })],
          [e('sp.rarity'), e(rarityKey(sp.rarity))],
          [e('sp.price'), e('sp.priceText', { v: mult(sp.valueMult ?? 1) })],
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
      <ul className="enc-lines">
        {sp.abilities.map((a) => {
          const def = ABILITIES[a.id]!;
          return (
            <li key={a.id}>
              <span style={{ color: elColor(def.element) }}><KindIcon kind={def.kind} /></span>{' '}
              <A to={{ tab: 'abilities', id: a.id }} go={go}>
                {abilityText(a.id, lang).name}
              </A>{' '}
              <span className="faint">— {a.minAbility && unlockLevel(a.minAbility) > 1 ? e('sp.unlock', { n: unlockLevel(a.minAbility) }) : e('sp.always')}</span>
            </li>
          );
        })}
      </ul>
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
  const { lang } = useT();
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
  if (a.pack) special.push(e('spec.pack', { v: pct(a.pack, false), max: cfg.combat.damage.packMax }));
  if (a.hpCost) special.push(e('spec.hpCost', { v: pct(a.hpCost, false) }));
  if (a.fear) special.push(e('spec.fear', { v: a.fear }));
  if (a.accuracyMod) special.push(e('spec.accuracy', { v: pct(a.accuracyMod) }));
  if (a.critMod) special.push(e('spec.crit', { v: pct(a.critMod, false) }));
  if (a.effects?.some((x) => !EFFECTS[x.effect]?.beneficial && x.on === 'target')) special.push(e('spec.resist'));
  const learners = SPECIES_IDS.flatMap((sid) => {
    const ref = SPECIES[sid]!.abilities.find((x) => x.id === id);
    return ref ? [{ sid, min: ref.minAbility }] : [];
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
          const def = EFFECTS[x.effect];
          return (
            <>
              {e('ab.effectChance', {
                chance: Math.round(x.chance * 100),
                effect: '§',
                stacks: (x.stacks ?? 1) > 1 ? e('ab.effectStacks', { n: x.stacks! }) : '',
                duration: x.duration && def && x.duration !== def.defaultDuration ? e('ab.effectDuration', { n: x.duration }) : '',
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
            <span className="faint">— {l.min && unlockLevel(l.min) > 1 ? e('sp.unlock', { n: unlockLevel(l.min) }) : e('sp.always')}</span>
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
  if (fx.silence) lines.push(e('fx.silence'));
  if (fx.taunt) lines.push(e('fx.taunt'));
  if (fx.hidden) lines.push(e('fx.hidden'));
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
  const pct = usePct();
  const mult = useMult();
  const tdef = TRAITS[id]!;
  const txt = traitText(id, lang);
  const c: TraitCombatEffects = tdef.combat ?? {};
  const lines: string[] = [];
  for (const [k, v] of Object.entries(c.attrMods ?? {})) lines.push(e('trc.attr', { attr: attributeText(k as AttributeKey, lang).name, v: `${v! > 0 ? '+' : ''}${v}` }));
  if (c.moraleLossMult) lines.push(e('trc.moraleLossMult', { v: mult(c.moraleLossMult) }));
  if (c.moraleGainMult) lines.push(e('trc.moraleGainMult', { v: mult(c.moraleGainMult) }));
  if (c.disobeyMult) lines.push(e('trc.disobeyMult', { v: mult(c.disobeyMult) }));
  if (c.enrageBelowHp) lines.push(e('trc.enrageBelowHp', { v: Math.round(c.enrageBelowHp * 100) }));
  if (c.enrageOnAllyKo) lines.push(e('trc.enrageOnAllyKo'));
  if (c.auraMorale) lines.push(e('trc.auraMorale', { v: c.auraMorale }));
  if (c.interceptBonus) lines.push(e('trc.interceptBonus', { v: pct(c.interceptBonus, false) }));
  if (c.critBonus) lines.push(e('trc.critBonus', { v: pct(c.critBonus, false) }));
  if (c.damageMult) lines.push(e('trc.damageMult', { v: mult(c.damageMult) }));
  if (c.breakThresholdMod) lines.push(e('trc.breakThresholdMod', { v: Math.abs(c.breakThresholdMod), dir: e(c.breakThresholdMod > 0 ? 'trc.sooner' : 'trc.later') }));
  if (c.instinctTarget) lines.push(e('trc.instinctTarget', { v: e(`prio.${c.instinctTarget}` as EncKey) }));
  if (c.showboatChance) lines.push(e('trc.showboatChance', { v: Math.round(c.showboatChance * 100) }));
  if (c.soloDamageMult) lines.push(e('trc.soloDamageMult', { v: mult(c.soloDamageMult) }));
  if (c.comboBonus) lines.push(e('trc.comboBonus', { v: pct(c.comboBonus, false) }));
  if (tdef.training?.gainMult) lines.push(e('trc.gainMult', { v: mult(tdef.training.gainMult) }));
  if (tdef.training?.injuryMult) lines.push(e('trc.injuryMult', { v: mult(tdef.training.injuryMult) }));
  if (tdef.personality?.moraleVolatility) lines.push(e('trc.moraleVolatility', { v: mult(tdef.personality.moraleVolatility) }));
  return (
    <div>
      <h3 className="enc-title">{txt.name}</h3>
      <p>{txt.description}</p>
      <Facts rows={[[e('tr.polarity'), e(`tr.${tdef.polarity}` as EncKey)]]} />
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
      <p className="muted">{e('ro.scaling', { min: mult(rf.min), max: mult(rf.max), off: mult(rf.offRole) })}</p>
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

export function ElementsChart() {
  const { lang } = useT();
  const e = encT(lang);
  const mult = useMult();
  const el = cfg.elements;
  return (
    <div>
      <h3 className="enc-title">{e('tab.elements')}</h3>
      <p>{e('el.intro', { strong: mult(el.strongMult), weak: mult(el.weakMult), min: mult(el.minMult), max: mult(el.maxMult) })}</p>
      <div style={{ overflowX: 'auto' }}>
        <table className="data enc-elements">
          <thead>
            <tr>
              <th>{e('el.attacker')}</th>
              {ELEMENT_IDS.map((d) => (
                <th key={d} style={{ color: ELEMENTS[d].color }}>
                  {elementName(d, lang)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ELEMENT_IDS.map((a) => (
              <tr key={a}>
                <th style={{ color: ELEMENTS[a].color, textAlign: 'left' }}>{elementName(a, lang)}</th>
                {ELEMENT_IDS.map((d) => {
                  const strong = el.strong[a].includes(d);
                  const weak = el.weak[a].includes(d);
                  return (
                    <td key={d} className={`num ${strong ? 'good-text' : weak ? 'bad-text' : 'faint'}`}>
                      {strong ? `×${mult(el.strongMult)}` : weak ? `×${mult(el.weakMult)}` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
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
      return { base: mult(c.damage.statBase), per: mult(c.damage.statPerPoint), v10: mult(Math.round((c.damage.statBase + 10 * c.damage.statPerPoint) * 100) / 100), v20: mult(Math.round((c.damage.statBase + 20 * c.damage.statPerPoint) * 100) / 100), hp: num(c.hp.perStrength) };
    case 'stamina':
      return { base: c.stamina.base, per: c.stamina.perStamina, p10: c.stamina.base + 10 * c.stamina.perStamina, p20: c.stamina.base + 20 * c.stamina.perStamina, regen: num(c.stamina.regenPerStamina) };
    case 'speed':
      return { per: num(c.initiative.perSpeed), noise: c.initiative.noise };
    case 'agility':
      return { melee: p(hit * 0.4), ranged: p(hit * 0.7) };
    case 'toughness':
      return { hp: num(c.hp.perToughness), arm: p(c.damage.physMitigationPerToughness), min: pct(c.damage.minMitigation), max: p(c.damage.maxMitigation) };
    case 'recovery':
      return { regen: num(c.stamina.regenPerRecovery), rest: c.stamina.restMult, base: cfg.league.week.fatigueRecovery, week: num(cfg.league.week.fatigueRecoveryPerAttr) };
    case 'attack':
      return { p: p(hit * 0.7) };
    case 'accuracy':
      return { p: p(hit * 0.7), base: mult(c.damage.statBase), per: mult(c.damage.statPerPoint) };
    case 'defense':
      return { p: p(hit * 0.6) };
    case 'magic':
      return { base: mult(c.damage.statBase), per: mult(c.damage.statPerPoint), hbase: mult(c.heal.statBase), hper: mult(c.heal.statPerPoint), p: p(hit * 0.3) };
    case 'focus':
      return { p: p(hit * 0.7), dodge: p(hit * 0.5), arm: p(c.damage.spellMitigationPerPoint / 2) };
    case 'technique':
      return { crit: p(c.damage.critPerTechnique), mult: mult(c.damage.critMult), p: p(hit * 0.3) };
    case 'courage':
      return { c: p(c.morale.courageReductionPerPoint), arm: p(c.damage.spellMitigationPerPoint / 2) };
    case 'composure':
      return { crit: p(c.damage.critPerComposure), h: p(c.morale.composureReductionPerPoint), low: p(c.damage.lowHpThreshold), pen: p(c.damage.lowHpPenalty) };
    case 'aggression':
      return { d: p(c.damage.aggressionPerPoint), a: p(c.damage.aggressionMitigationPenalty), inst: 14 };
    case 'tactics':
      return { noise: p(c.ai.noiseMax), inst: 14 };
    case 'discipline':
      return { d5: disobey(5), d10: disobey(10), d15: disobey(15), fav: mult(1 + c.favorites.bonus) };
    case 'anticipation':
      return { init: num(c.initiative.perAnticipation), p: p(hit * 0.4), g: p(c.guard.perAnticipation) };
    case 'determination':
      return { d: p(c.damage.determinationMax) };
    case 'teamwork':
      return { c: p(c.hit.comboPerTeamwork), g: p(c.guard.perTeamwork) };
    case 'leadership':
      return { min: c.morale.minLeadership, a: num(c.morale.leadershipAuraPerPoint), below: c.morale.minLeadership - 1 };
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
  const inj = INJURIES[id]!;
  return (
    <div>
      <h3 className="enc-title">{injuryText(id, lang).short}</h3>
      <Facts
        rows={[
          [e('inj.weeks'), `${inj.weeks[0]}–${inj.weeks[1]}`],
          [e('inj.severity'), e(`sev.${inj.severity}` as EncKey)],
          [e('inj.cause'), inj.cause === 'any' ? e('inj.any') : inj.cause === 'physical' || inj.cause === 'innate' ? e('ab.physical') : elementName(inj.cause, lang)],
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
    hit: { base: p(c.hit.base), per: p(c.hit.perPoint), min: p(c.hit.min), max: p(c.hit.max), huge: p(c.hit.sizeMod.huge), small: pct(c.hit.sizeMod.small), spell: p(-c.hit.spellBonus) },
    damage: { base: mult(c.damage.statBase), per: mult(c.damage.statPerPoint), variance: p(c.damage.variance), minM: pct(c.damage.minMitigation), maxM: p(c.damage.maxMitigation), crit: mult(c.damage.critMult) },
    cover: {
      one: p(coverReduction(1, cfg)), tank: p(coverReduction(c.cover.tankWeight, cfg)), two: p(coverReduction(2, cfg)),
      three: p(coverReduction(3, cfg)), four: p(coverReduction(4, cfg)), max: p(c.cover.max),
      reach: p(c.hit.reachPenalty), flank: p(c.hit.flankPenalty),
    },
    guard: { passive: p(c.guard.passiveBase), active: p(c.guard.activeBase), max: p(c.guard.max), gm: p(c.guard.guardMitigation) },
    orders: {
      cd: mult(c.orders.cautious.damageMult), cm: p(c.orders.cautious.mitigation), cs: mult(c.orders.cautious.staminaCostMult),
      ad: mult(c.orders.aggressive.damageMult), am: pct(c.orders.aggressive.mitigation), as: mult(c.orders.aggressive.staminaCostMult),
      asc: p(c.orders.ascendancy.bonus),
      sad: mult(c.stances.allOut.damageMult), sam: pct(c.stances.allOut.mitigation), sas: mult(c.stances.allOut.staminaCostMult),
      scd: mult(c.stances.conserve.damageMult), scs: mult(c.stances.conserve.staminaCostMult),
      rhc: p(c.orders.riskHigh.critBonus), rhh: pct(c.orders.riskHigh.hitBonus), rlc: pct(c.orders.riskLow.critBonus), rlh: p(c.orders.riskLow.hitBonus),
    },
    stamina: {
      large: mult(c.stamina.sizeCostMult.large), huge: mult(c.stamina.sizeCostMult.huge), threshold: p(c.fatigue.threshold), max: p(c.fatigue.maxPenalty),
      pre: mult(c.stamina.preMatchFatigueLoss), inj: mult(1 + c.fatigue.injuryFromFatigue),
    },
    morale: {
      allyKo: c.morale.allyKo, enemyKo: c.morale.enemyKo, heavy: c.morale.heavyHitTaken, crit: c.morale.critDealt, lead: c.morale.minLeadership,
      swing: p(c.morale.performanceSwing), hes: c.morale.hesitateBelow, flee: c.morale.fleeBelow, fleeHp: p(c.morale.fleeHpBelow),
    },
    injury: {
      ko: p(c.injury.onKo), heavyHit: p(c.morale.heavyHitFraction), heavy: pct(c.injury.onHeavyHit, false),
      moderate: p(cfg.league.death.chance.moderate!), severe: p(cfg.league.death.chance.severe!), career: p(cfg.league.death.chance.career!),
    },
    arena: { start: cfg.arena.startWeek, clear: p(cfg.arena.clearChance) },
    levels: {
      max: cfg.training.levels.max, xp: cfg.training.levels.xpPerLevel, played: num(cfg.training.xp.played), starter: num(cfg.training.xp.starter),
      rating: num(cfg.training.xp.perRatingPoint), win: num(cfg.training.xp.win),
      young: mult(cfg.training.stage.young), prime: mult(cfg.training.stage.prime), old: mult(cfg.training.stage.declining),
    },
  };
  return (
    <div>
      <h3 className="enc-title">{e(`ru.${id}.title` as EncKey)}</h3>
      {e(`ru.${id}.body` as EncKey, vars[id])
        .split('\n')
        .map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      {id === 'arena' && <ArenaConditionList />}
    </div>
  );
}
