import { EFFECTS } from '../../../data/effects.ts';
import type { RosterEntry, Side } from '../../../engine/combat/types.ts';
import type { MatchView } from '../../../engine/combat/view.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { Bar, Sigil } from '../../components/common.tsx';
import { hpColor, moraleLabel, roleShort, speciesName } from '../../format.ts';

const ORDER: Record<string, number> = { active: 0, ko: 1, fled: 1, withdrawn: 2, bench: 3 };

export function Scoreboard({ side, name, roster, view }: { side: Side; name: string; roster: Record<string, RosterEntry>; view: MatchView }) {
  const mine = Object.values(view.creatures)
    .filter((c) => c.side === side)
    .sort((a, b) => ORDER[a.state]! - ORDER[b.state]! || (a.line === b.line ? 0 : a.line === 'front' ? -1 : 1));
  const standing = mine.filter((c) => c.state === 'active').length;
  return (
    <section className={`panel ${side === 0 ? 'side-home' : 'side-away'}`}>
      <div className="panel-head" style={{ marginBottom: 6 }}>
        <h3 className={side === 0 ? 'home-text' : 'away-text'}>{name}</h3>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>
          {standing} standing · subs {view.subsUsed[side]}/{DEFAULT_CONFIG.match.maxSubstitutions}
        </span>
      </div>
      <div className="scoreboard">
        {mine.map((c) => {
          const r = roster[c.id]!;
          const down = c.state === 'ko' || c.state === 'fled' || c.state === 'withdrawn';
          return (
            <div key={c.id} className={`fighter ${down ? 'down' : ''} ${c.state === 'bench' ? 'bench' : ''}`}>
              <Sigil speciesId={r.speciesId} />
              <div style={{ minWidth: 0 }}>
                <div className="top">
                  <span className="name" title={r.name}>
                    {r.name}
                  </span>
                  <span className="tag">{roleShort[r.role]}</span>
                  {c.state === 'active' && <span className="tag">{c.line === 'front' ? 'FRONT' : 'BACK'}</span>}
                  {c.state === 'ko' && <span className="tag" style={{ color: 'var(--bad)' }}>KO</span>}
                  {c.state === 'fled' && <span className="tag" style={{ color: 'var(--bad)' }}>FLED</span>}
                  {c.state === 'withdrawn' && <span className="tag">OFF</span>}
                  {c.state === 'bench' && <span className="tag">BENCH</span>}
                  <span className="spacer" />
                  <span className="faint" style={{ fontSize: 11 }}>
                    {speciesName(r.speciesId)}
                  </span>
                </div>
                {c.state !== 'bench' && (
                  <div className="bars">
                    <Bar value={c.hp} max={c.maxHp} color={hpColor(c.hp / c.maxHp)} title={`Health ${c.hp}/${c.maxHp}`} />
                    <span className="mono">
                      {c.hp}/{c.maxHp}
                    </span>
                    <Bar value={c.stamina} max={c.maxStamina} color="var(--stamina)" thin title={`Stamina ${c.stamina}/${c.maxStamina}`} />
                    <span title="Morale" style={{ color: c.morale < 30 ? 'var(--bad)' : c.morale >= 70 ? 'var(--good)' : undefined }}>
                      {moraleLabel(c.morale)}
                    </span>
                  </div>
                )}
                {c.effects.length > 0 && c.state === 'active' && (
                  <div className="fx">
                    {c.effects.map((e) => (
                      <span key={e} className={EFFECTS[e]?.beneficial ? 'good' : 'bad'} title={EFFECTS[e]?.description}>
                        {EFFECTS[e]?.name ?? e}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
