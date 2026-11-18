/**
 * Contract talks: a few weeks before the end of the season, the creatures whose contract ends with it, side by side,
 * with what each asks to stay. Extend or let go in one place (the creature sheet still does the same, one at a time).
 */
import { useState } from 'react';
import { renew } from '../../../engine/economy/actions.ts';
import { renewalDemand } from '../../../engine/economy/market.ts';
import { creatureValue } from '../../../engine/economy/value.ts';
import { overallRating } from '../../../engine/creature/derived.ts';
import { levelOfAbility } from '../../../engine/progression/levels.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { Crest, Gold, Modal, Money } from '../../components/common.tsx';
import { useT } from '../../i18n/index.ts';
import { UiIcon } from '../../icons/Icon.tsx';
import { useGame } from '../../store/gameStore.ts';
import { errorText } from './CreatureSheet.tsx';

const YEARS = [1, 2, 3];

function Talks() {
  const tr = useT();
  const { t, lang, money } = tr;
  const game = useGame((s) => s.game)!;
  const { closeContractTalks, openSheet } = useGame.getState();
  const team = game.teams.find((x) => x.id === game.playerTeamId)!;
  // The list is fixed when the window opens, so an extended contract stays on screen with its new terms.
  const [ids] = useState(() =>
    team.creatures
      .filter((c) => c.contract && c.contract.untilSeason <= game.season)
      .sort((a, b) => overallRating(b) - overallRating(a))
      .map((c) => c.id),
  );
  const [years, setYears] = useState<Record<string, number>>({});
  const [gone, setGone] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, { text: string; tone: 'good' | 'bad' }>>({});
  const starters = new Set(team.tactic.lineup.map((x) => x.creatureId));
  const rows = ids.map((id) => team.creatures.find((c) => c.id === id)).filter((c) => !!c);

  return (
    <Modal
      title={
        <span className="row" style={{ gap: 8 }}>
          <UiIcon name="contract" /> {t('talks.title')}
        </span>
      }
      onClose={closeContractTalks}
      className="talks-dialog"
      wide
    >
      <p className="muted talks-intro">{t('talks.intro', { s: game.season })}</p>
      {rows.length === 0 ? (
        <p className="faint">{t('talks.none')}</p>
      ) : (
        <div className="talks-list">
          {rows.map((c) => {
            const y = years[c.id] ?? 2;
            const done = (c.contract?.untilSeason ?? 0) > game.season;
            const ask = renewalDemand(game, c, y);
            const wage = c.contract?.wage ?? 0;
            const note = notes[c.id];
            return (
              <div key={c.id} className={`talks-row ${done ? 'done' : ''} ${gone[c.id] ? 'gone' : ''}`}>
                <button className="talks-who" onClick={() => openSheet(c.id)} title={t('msg.openSheet')}>
                  <Crest speciesId={c.speciesId} size={34} level={levelOfAbility(c.ability)} />
                  <span>
                    <b className="ellipsis">{c.name}</b>
                    <small className="muted">
                      {speciesName(c.speciesId, lang)} · {t('sheet.age', { age: c.age })}
                      {starters.has(c.id) && <span className="tag good talks-starter">{t('talks.starter')}</span>}
                    </small>
                  </span>
                </button>
                <span className="talks-num">
                  <small>{t('talks.rating')}</small>
                  <b>{overallRating(c)}</b>
                </span>
                <span className="talks-num">
                  <small>{t('talks.value')}</small>
                  <Money v={creatureValue(c)} />
                </span>
                <span className="talks-num">
                  <small>{t('talks.wage')}</small>
                  <Money v={wage} />
                </span>
                {done ? (
                  <span className="talks-result good-text">
                    <UiIcon name="check" /> <Gold>{t('contract.renewed', { s: c.contract!.untilSeason, wage: money(c.contract!.wage) })}</Gold>
                  </span>
                ) : gone[c.id] ? (
                  <span className="talks-result muted">
                    {t('talks.letGo')}
                    <button className="btn small ghost" onClick={() => setGone({ ...gone, [c.id]: false })}>
                      {t('talks.undo')}
                    </button>
                  </span>
                ) : (
                  <span className="talks-offer">
                    <span className="seg" role="group" aria-label={t('bid.years')}>
                      {YEARS.map((n) => (
                        <button key={n} className={n === y ? 'on' : ''} onClick={() => setYears({ ...years, [c.id]: n })}>
                          {t('talks.years', { n })}
                        </button>
                      ))}
                    </span>
                    <span className="talks-ask">
                      <small>{t('talks.asks')}</small>
                      <span>
                        <Money v={ask} />
                        {ask !== wage && <span className={ask > wage ? 'bad-text' : 'good-text'}> {ask > wage ? '+' : '−'}{money(Math.abs(ask - wage))}</span>}
                      </span>
                    </span>
                    <button
                      className="btn primary small"
                      onClick={() => {
                        const o = useGame.getState().act((g) => renew(g, c.id, y));
                        if (!o) return;
                        if (o.kind === 'error') setNotes({ ...notes, [c.id]: { text: o.error === 'refused' ? t('contract.refused') : errorText(tr, o.error), tone: 'bad' } });
                      }}
                    >
                      {t('contract.renew')}
                    </button>
                    <button className="btn small ghost" onClick={() => setGone({ ...gone, [c.id]: true })}>
                      {t('talks.release')}
                    </button>
                  </span>
                )}
                {note && !done && <div className={`answer ${note.tone} talks-note`}>{note.text}</div>}
              </div>
            );
          })}
        </div>
      )}
      <div className="row reveal-actions">
        <span className="faint">{t('talks.later')}</span>
        <span className="spacer" />
        <button className="btn" onClick={closeContractTalks}>
          {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}

/** Opens once the match, training, weekly summary and reveal windows are closed. */
export function ContractTalks() {
  const open = useGame((s) => s.contractTalks);
  const game = useGame((s) => s.game);
  const blocked = useGame((s) => !!s.match || s.drill || !!s.progress || !!s.recap || !!s.sheet || s.reveals.length > 0 || s.signings.length > 0 || s.boardNotes.length > 0);
  if (!game || !open || blocked) return null;
  return <Talks />;
}
