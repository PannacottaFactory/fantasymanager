/**
 * The player's bestiary (Encyclopedia tab, during a game): every species as a card to collect — unknown until met in a
 * match, « met » once faced, « owned » once it has been in the stable — with the reward tiers of both lists.
 * Display only; the bookkeeping and rewards live in engine/team/record.ts.
 */
import { useState, type CSSProperties } from 'react';
import { SPECIES, SPECIES_IDS } from '../../data/species.ts';
import type { GameState } from '../../engine/league/types.ts';
import { bestiaryTiers, ownedSpecies, seenSpecies } from '../../engine/team/record.ts';
import { speciesText } from '../../engine/text/localize.ts';
import { ElementDots } from '../components/common.tsx';
import { useT } from '../i18n/index.ts';
import { SpeciesIcon, UiIcon } from '../icons/Icon.tsx';
import type { Link } from './EncyclopediaScreen.tsx';

type Filter = 'all' | 'owned' | 'seen' | 'unknown';

/** Rarity of a species from its frequency in generation (1 = rarest). */
export function rarityOf(id: string): 'rare' | 'uncommon' | 'common' {
  const r = SPECIES[id]?.rarity ?? 5;
  return r <= 2 ? 'rare' : r <= 4 ? 'uncommon' : 'common';
}

function TierBar({ list, count, total }: { list: 'seen' | 'owned'; count: number; total: number }) {
  const tr = useT();
  const { t, money } = tr;
  const tiers = bestiaryTiers(list);
  const next = tiers.find((x) => x.n > count);
  return (
    <div className={`bst-progress ${list}`}>
      <div className="bst-progress-head">
        <UiIcon name={list === 'seen' ? 'bestiary-seen' : 'bestiary-owned'} size="1.2em" />
        <b>{t(list === 'seen' ? 'bestiary.seen' : 'bestiary.owned')}</b>
        <span className="bst-count">
          {count}
          <small>/{total}</small>
        </span>
        <span className="spacer" />
        {next ? (
          <small className="muted">
            {t('bestiary.nextTier', { n: next.n })} · <span className="gold-text">{money(next.gold)}</span>
            {next.rep ? ` · ${t('bestiary.repShort', { rep: next.rep })}` : ''}
          </small>
        ) : (
          <small className="gold-text">{t('bestiary.complete')}</small>
        )}
      </div>
      <div className="bst-bar" style={{ '--fill': count / total } as CSSProperties}>
        <i />
        {tiers.map((x) => (
          <span
            key={x.n}
            className={`bst-tick ${count >= x.n ? 'done' : ''}`}
            style={{ left: `${(x.n / total) * 100}%` }}
            title={`${x.n} — ${money(x.gold)}${x.rep ? ` · ${t('bestiary.repShort', { rep: x.rep })}` : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

export function BestiaryView({ game, go }: { game: GameState; go: (l: Link) => void }) {
  const tr = useT();
  const { t, lang } = tr;
  const [filter, setFilter] = useState<Filter>('all');
  const owned = ownedSpecies(game);
  const seen = seenSpecies(game);
  const total = SPECIES_IDS.length;
  const since = game.bestiary;
  const status = (id: string) => (owned.has(id) ? 'owned' : seen.has(id) ? 'seen' : 'unknown');
  const ids = [...SPECIES_IDS]
    .sort((a, b) => speciesText(a, lang).name.localeCompare(speciesText(b, lang).name, lang))
    .filter((id) => filter === 'all' || status(id) === filter);
  const counts: Record<Filter, number> = { all: total, owned: owned.size, seen: seen.size - owned.size, unknown: total - seen.size };
  return (
    <div className="stack bestiary">
      <div className="bst-head">
        <div>
          <h3 className="enc-title" style={{ margin: 0 }}>
            <UiIcon name="bestiary" /> {t('bestiary.title')}
          </h3>
          <p className="muted" style={{ margin: '4px 0 0' }}>{t('bestiary.intro')}</p>
        </div>
      </div>
      <div className="bst-progress-grid">
        <TierBar list="seen" count={seen.size} total={total} />
        <TierBar list="owned" count={owned.size} total={total} />
      </div>
      <div className="enc-tabs">
        {(['all', 'owned', 'seen', 'unknown'] as Filter[]).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {t(`bestiary.filter.${f}`)} <span className="faint">{counts[f]}</span>
          </button>
        ))}
      </div>
      <div className="bst-grid">
        {ids.map((id) => {
          const st = status(id);
          const name = speciesText(id, lang).name;
          const when = st === 'owned' ? since?.owned[id] : since?.seen[id];
          if (st === 'unknown')
            return (
              <div key={id} className={`bst-card unknown r-${rarityOf(id)}`} title={t('bestiary.unknownHint')}>
                <span className="bst-icon"><SpeciesIcon id={id} size="2.4em" /></span>
                <b>???</b>
                <small className="faint"><UiIcon name="locked" size="0.9em" /> {t(`bestiary.rarity.${rarityOf(id)}`)}</small>
              </div>
            );
          return (
            <button key={id} className={`bst-card ${st} r-${rarityOf(id)}`} onClick={() => go({ tab: 'species', id })} title={t('bestiary.openSpecies')}>
              {st === 'owned' && <span className="bst-badge"><UiIcon name="bestiary-owned" size="0.85em" /></span>}
              <span className="bst-icon"><SpeciesIcon id={id} size="2.4em" /></span>
              <b>{name}</b>
              <span className="row" style={{ gap: 6 }}>
                <ElementDots speciesId={id} />
                <small className={`bst-rarity r-${rarityOf(id)}`}>{t(`bestiary.rarity.${rarityOf(id)}`)}</small>
              </span>
              <small className="faint">{st === 'owned' ? t('bestiary.ownedSince', { s: when ?? game.season }) : t('bestiary.seenSince', { s: when ?? game.season })}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
