/**
 * End-of-week summary: the player's matches of the week, the league position, the money, the infirmary, the levels
 * gained, then what the next week holds. Built from the states at the start and at the end of the week.
 */
import { isInjured } from '../../../engine/creature/derived.ts';
import { playerDivision, playerTeam, seasonOver, standings } from '../../../engine/league/season.ts';
import type { GameState } from '../../../engine/league/types.ts';
import { Gold, Modal, Money } from '../../components/common.tsx';
import { CompIcon, DivIcon } from '../../icons/Icon.tsx';
import { useT } from '../../i18n/index.ts';
import { byWeek, completedWeek, itemLabel, playerSeason } from '../../season.ts';
import { useGame } from '../../store/gameStore.ts';
import { GrowthReel } from './GrowthReel.tsx';

function position(game: GameState) {
  const rows = standings(game, playerDivision(game));
  const i = rows.findIndex((r) => r.teamId === game.playerTeamId);
  return { pos: i + 1, pts: rows[i]?.points ?? 0, played: rows[i]?.played ?? 0 };
}

export function WeekRecap() {
  const tr = useT();
  const { t, ordinal, money } = tr;
  const recap = useGame((s) => s.recap);
  const match = useGame((s) => s.match);
  const viewing = useGame((s) => s.viewing);
  // Shown once the match report is closed.
  if (!recap || match || viewing) return null;
  const { before, after } = recap;
  const st = useGame.getState();
  const close = () => st.closeRecap();
  const go = () => {
    st.closeRecap();
    st.continueGame();
  };
  const week = completedWeek(after);
  const playedBefore = new Set(playerSeason(before).filter((x) => x.played).map((x) => x.fixtureId));
  const results = playerSeason(after).filter((x) => x.played && !playedBefore.has(x.fixtureId));
  const p0 = position(before);
  const p1 = position(after);
  const sameDivision = playerDivision(before) === playerDivision(after);
  const bal0 = before.clubs[before.playerTeamId]?.balance ?? 0;
  const bal1 = after.clubs[after.playerTeamId]?.balance ?? 0;
  const team0 = playerTeam(before);
  const team1 = playerTeam(after);
  const was = new Map(team0.creatures.map((c) => [c.id, c]));
  const injured = team1.creatures.filter((c) => isInjured(c) && !(was.get(c.id) && isInjured(was.get(c.id)!)));
  const healed = team1.creatures.filter((c) => !isInjured(c) && was.get(c.id) && isInjured(was.get(c.id)!));
  const messages = Math.max(0, after.nextMessageId - before.nextMessageId);
  const over = seasonOver(after);
  const coming = over ? undefined : byWeek(playerSeason(after).filter((x) => !x.played && !x.maybe))[0];
  const moved = sameDivision && p0.played > 0 ? p0.pos - p1.pos : 0;
  return (
    <Modal
      title={week <= 0 ? t('recap.titlePre') : t('recap.title', { d: week })}
      onClose={close}
      actions={
        <button className="btn primary" onClick={go} autoFocus>
          {t('recap.go')}
        </button>
      }
    >
      <div className="recap">
        <section className="recap-block wide">
          <h4>{t('recap.results')}</h4>
          {results.length === 0 ? (
            <p className="faint">{t('recap.noMatch')}</p>
          ) : (
            <ul className="recap-results">
              {results.map((x) => (
                <li key={x.fixtureId} className={x.outcome}>
                  <span className={`comp-badge def-${x.def}`}>
                    {x.league ? <DivIcon d={x.division ?? 0} /> : <CompIcon def={x.def} />} {itemLabel(t, x)}
                  </span>
                  <span className="grow">
                    {t('common.vs')} <b>{x.opp}</b>
                  </span>
                  <span className={`recap-outcome ${x.outcome}`}>
                    {t(x.outcome === 'win' ? 'recap.win' : 'recap.loss')} <small>{t(x.ko ? 'recap.ko' : 'recap.pts')}</small>
                  </span>
                  <span className="recap-score">
                    {x.score?.[0]}–{x.score?.[1]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="recap-block wide grow-block">
          <h4>{t('grow.title')}</h4>
          <GrowthReel before={before} after={after} />
        </section>
        {p1.played > 0 && (
          <section className="recap-block">
            <h4>{t('recap.table')}</h4>
            <div className="recap-big">
              {t('recap.position', { pos: ordinal(p1.pos), pts: p1.pts })}
              {moved !== 0 && <span className={moved > 0 ? 'good-text' : 'bad-text'}>{moved > 0 ? ` ▲${moved}` : ` ▼${-moved}`}</span>}
            </div>
          </section>
        )}
        <section className="recap-block">
          <h4>{t('recap.money')}</h4>
          <div className="recap-big">
            <Money v={bal1} />{' '}
            <span className={bal1 >= bal0 ? 'good-text' : 'bad-text'}>
              {bal1 >= bal0 ? '+' : '−'}
              {money(Math.abs(bal1 - bal0))}
            </span>
          </div>
        </section>
        <section className="recap-block">
          <h4>{t('recap.infirmary')}</h4>
          {injured.length > 0 && <p className="bad-text">{t('recap.injured', { names: injured.map((c) => c.name).join(', ') })}</p>}
          {healed.length > 0 && <p className="good-text">{t('recap.healed', { names: healed.map((c) => c.name).join(', ') })}</p>}
          {injured.length === 0 && healed.length === 0 && <p className="faint">{t('recap.noInjury')}</p>}
        </section>
        <section className="recap-block wide recap-next">
          {over ? (
            <p>{t('recap.seasonOver')}</p>
          ) : coming ? (
            <>
              <h4>{t('recap.next', { when: coming.week === 0 ? t('cal.before') : t('cal.week', { d: coming.week }) })}</h4>
              <ol className="recap-coming">
                {coming.items.map((x, i) => (
                  <li key={i}>
                    <span className="cal-step">{i + 1}</span>
                    <span className={`comp-badge def-${x.def}`}>
                      {x.league ? <DivIcon d={x.division ?? 0} /> : <CompIcon def={x.def} />} {itemLabel(t, x)}
                    </span>
                    <span>{x.opp ? <>{t('common.vs')} <b>{x.opp}</b></> : <span className="faint">{t('cal.tbd')}</span>}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {messages > 0 && (
            <button className="link" onClick={() => {
                close();
                st.setScreen('inbox');
              }}>
              <Gold>{t('recap.inbox', { n: messages })}</Gold>
            </button>
          )}
        </section>
      </div>
    </Modal>
  );
}
