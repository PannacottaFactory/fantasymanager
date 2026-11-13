/**
 * Pre-match face-off: the two crests slide in on their colours, « VS » clashes in between, then the duel of the stars
 * (each side's best creature, public numbers only for the opponent) and the last meeting of the two stables.
 * Display only.
 */
import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { overallRating } from '../../../engine/creature/derived.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { standings } from '../../../engine/league/season.ts';
import type { Fixture, GameState } from '../../../engine/league/types.ts';
import type { Creature, Team } from '../../../engine/model.ts';
import { defaultCrest } from '../../../engine/team/crest.ts';
import { managerName } from '../../../engine/team/identity.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { DEFAULT_CONFIG } from '../../../data/config/index.ts';
import { StableCrest } from '../../components/TeamCrest.tsx';
import { divName } from '../../competitions.ts';
import { useT } from '../../i18n/index.ts';
import { SpeciesIcon, UiIcon } from '../../icons/Icon.tsx';
import { play } from '../../sound/sfx.ts';
import { FormDots } from './LeagueScreen.tsx';
import type { ArenaConditionId } from '../../../data/config/arena.ts';
import { ArenaConditionCard } from '../../components/ArenaCondition.tsx';

/** The opponent's star from what anyone can see: its record (best of the match, KOs, matches). */
function publicStar(team: Team): Creature | undefined {
  const ids = new Set(team.tactic.lineup.map((s) => s.creatureId));
  const pool = team.creatures.filter((c) => ids.has(c.id));
  const score = (c: Creature) => (c.record ? c.record.mvp * 5 + c.record.kos * 2 + c.record.matches * 0.2 : 0);
  return pool.slice().sort((a, b) => score(b) - score(a))[0];
}

function Side({ game, team, side, home, star }: { game: GameState; team: Team; side: 0 | 1; home: boolean; star: React.ReactNode }) {
  const tr = useT();
  const { t } = tr;
  const d = divisionOf(game, team.id);
  const table = standings(game, d);
  const row = table.find((r) => r.teamId === team.id);
  const pos = table.findIndex((r) => r.teamId === team.id) + 1;
  const showManager = side === 1 && team.identity && DEFAULT_CONFIG.identity.difficulties[game.difficulty ?? 'normal'].identities;
  return (
    <div className={`vs-side vs-${side === 0 ? 'home' : 'away'}`}>
      <div className="vs-crest">
        <StableCrest team={team} size={60} />
      </div>
      <div className="vs-info">
        <h2 className="vs-name">{team.name}</h2>
        <span className="vs-meta">
          {home ? t('common.home') : t('common.away')} · {divName(t, d)}
        </span>
        {row && (
          <span className="vs-meta">
            {t('match.position', { pos: tr.ordinal(pos), pts: row.points })} {row.form.length > 0 && <FormDots form={row.form} />}
          </span>
        )}
        {showManager && (
          <span className="vs-manager" title={t(`manager.${team.identity!.manager}.desc`)}>
            {t('match.manager', { name: managerName(team), m: t(`manager.${team.identity!.manager}`) })}
          </span>
        )}
      </div>
      {star}
    </div>
  );
}

function StarCard({ c, side, own }: { c?: Creature; side: 0 | 1; own: boolean }) {
  const tr = useT();
  const { t, lang } = tr;
  if (!c) return <div className="vs-star empty" />;
  const r = c.record;
  return (
    <div className={`vs-star vs-star-${side === 0 ? 'home' : 'away'}`} title={t('vs.duel')}>
      <span className="vs-star-icon">
        <SpeciesIcon id={c.speciesId} size="1.9em" />
      </span>
      <span className="vs-star-text">
        <b>{c.name}</b>
        <small>{speciesName(c.speciesId, lang)}</small>
        <small className="vs-star-stats">
          {own && <>{t('col.ovr')} <b>{overallRating(c)}</b> · </>}
          {r && r.matches > 0 ? t('vs.starStats', { m: r.matches, k: r.kos, s: r.mvp }) : t('vs.debut')}
        </small>
      </span>
    </div>
  );
}

/** Last played meeting between the two stables (any competition), from the player's side. */
function lastMeeting(game: GameState, oppId: string): Fixture | undefined {
  const me = game.playerTeamId;
  return game.fixtures.filter((f) => f.result && ((f.home === me && f.away === oppId) || (f.away === me && f.home === oppId))).at(-1);
}

export function Versus({ game, mine, opp, home, title, arena, showArena }: {
  game: GameState;
  mine: Team;
  opp: Team;
  home: boolean;
  title: React.ReactNode;
  /** Arena condition of the match (none = clear day). */
  arena?: ArenaConditionId;
  /** Conditions have started in this game (before that, nothing is shown). */
  showArena?: boolean;
}) {
  const { t } = useT();
  useEffect(() => {
    // The swords meet when the « VS » lands.
    const timer = window.setTimeout(() => play('clash'), 380);
    return () => window.clearTimeout(timer);
  }, [opp.id]);
  const c1 = (mine.crest ?? defaultCrest(mine.id)).field[0];
  const c2 = (opp.crest ?? defaultCrest(opp.id)).field[0];
  const myIds = new Set(mine.tactic.lineup.map((s) => s.creatureId));
  const myStar = mine.creatures.filter((c) => myIds.has(c.id)).sort((a, b) => overallRating(b) - overallRating(a))[0];
  const theirStar = publicStar(opp);
  const last = lastMeeting(game, opp.id);
  const lastText = (() => {
    if (!last?.result) return null;
    const side = last.home === game.playerTeamId ? 0 : 1;
    const won = last.result.winner === side;
    const sc = side === 0 ? last.result.score : [last.result.score[1], last.result.score[0]];
    return { won, text: t(won ? 'vs.lastWin' : 'vs.lastLoss', { a: sc[0], b: sc[1] }) };
  })();
  return (
    <section className="versus" style={{ '--vs-home': c1, '--vs-away': c2 } as CSSProperties}>
      <div className="vs-bg" aria-hidden="true" />
      <div className="vs-title">
        {title}
        {showArena && (
          <div className="vs-arena" title={t('arena.condHint')}>
            <ArenaConditionCard id={arena} compact />
          </div>
        )}
      </div>
      <div className="vs-stage">
        <Side game={game} team={mine} side={0} home={home} star={<StarCard c={myStar} side={0} own />} />
        <div className="vs-mid">
          <span className="vs-swords" aria-hidden="true">
            <UiIcon name="versus" size="2.4em" />
          </span>
          <span className="vs-word" aria-hidden="true">VS</span>
          {lastText && <small className={`vs-last ${lastText.won ? 'good-text' : 'bad-text'}`}>{lastText.text}</small>}
        </div>
        <Side game={game} team={opp} side={1} home={!home} star={<StarCard c={theirStar} side={1} own={false} />} />
      </div>
    </section>
  );
}
