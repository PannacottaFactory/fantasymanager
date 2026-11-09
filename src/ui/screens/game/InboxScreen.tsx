import { useEffect } from 'react';
import { playerFixture, seasonOver, standings, teamById } from '../../../engine/league/season.ts';
import type { GameState, InboxMessage } from '../../../engine/league/types.ts';
import { injuryText } from '../../../engine/text/localize.ts';
import { useT, type Translator } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';

function wording(tr: Translator, m: InboxMessage): { title: string; body: string; tone: 'good' | 'bad' | 'info' } {
  const { t } = tr;
  switch (m.kind) {
    case 'welcome':
      return { title: t('msg.welcome.title', { team: m.teamName }), body: t('msg.welcome.body', { teams: m.teams, matchdays: m.matchdays }), tone: 'info' };
    case 'matchResult': {
      const score = `${m.score[0]}–${m.score[1]}`;
      return {
        title: t(m.won ? 'msg.win.title' : 'msg.loss.title', { opp: m.opponent }),
        body: m.method === 'ko' ? t('msg.result.ko', { round: m.rounds }) : t('msg.result.points', { score }),
        tone: m.won ? 'good' : 'bad',
      };
    }
    case 'injury':
      return { title: t('msg.injury.title', { name: m.name }), body: t('msg.injury.body', { injury: injuryText(m.injuryId, tr.lang).name, weeks: tr.weeks(m.weeks) }), tone: 'bad' };
    case 'recovered':
      return { title: t('msg.recovered.title', { name: m.name }), body: t('msg.recovered.body', { name: m.name }), tone: 'good' };
    case 'tired':
      return { title: t('msg.tired.title'), body: t('msg.tired.body', { names: m.names.join(', ') }), tone: 'info' };
    case 'seasonEnd':
      return { title: t('msg.seasonEnd.title'), body: t('msg.seasonEnd.body', { pos: tr.ordinal(m.position), points: m.points, champion: m.champion }), tone: m.position === 1 ? 'good' : 'info' };
    case 'newSeason':
      return { title: t('msg.newSeason.title', { season: m.season }), body: t('msg.newSeason.body'), tone: 'info' };
  }
}

function NextMatch({ game }: { game: GameState }) {
  const tr = useT();
  const { t } = tr;
  const f = playerFixture(game);
  if (!f || seasonOver(game)) return null;
  const home = f.home === game.playerTeamId;
  const opp = teamById(game, home ? f.away : f.home);
  const table = standings(game);
  const pos = table.findIndex((r) => r.teamId === opp.id) + 1;
  const row = table[pos - 1]!;
  return (
    <section className="panel next-match">
      <h4>{t('inbox.nextMatch')}</h4>
      <div className="row wrap" style={{ gap: 10 }}>
        <span className="tag">{home ? t('common.home') : t('common.away')}</span>
        <b style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem' }}>{opp.name}</b>
        <span className="muted">{t('match.position', { pos: tr.ordinal(pos), pts: row.points })}</span>
        <span className="spacer" />
        <button className="btn primary" onClick={() => useGame.getState().continueGame()}>
          {t('continue')} ▶
        </button>
      </div>
    </section>
  );
}

export function InboxScreen() {
  const tr = useT();
  const { t } = tr;
  const game = useGame((s) => s.game)!;
  const { viewReport, markAllRead } = useGame.getState();
  const messages = [...game.inbox].reverse();
  // Unread markers are shown once, then cleared.
  const unread = new Set(game.inbox.filter((m) => !m.read).map((m) => m.id));
  useEffect(() => {
    const id = setTimeout(markAllRead, 1500);
    return () => clearTimeout(id);
  }, [game.inbox.length, markAllRead]);

  return (
    <div className="stack narrow">
      <NextMatch game={game} />
      <section className="panel">
        <h2 style={{ marginBottom: 10 }}>{t('inbox.title')}</h2>
        {messages.length === 0 && <div className="muted">{t('inbox.empty')}</div>}
        <ul className="inbox">
          {messages.map((m) => {
            const w = wording(tr, m);
            const canReport = m.kind === 'matchResult' && game.lastMatch?.fixtureId === m.fixtureId;
            return (
              <li key={m.id} className={`msg ${w.tone} ${unread.has(m.id) ? 'unread' : ''}`}>
                <div className="msg-head">
                  <b>{w.title}</b>
                  <span className="spacer" />
                  <span className="faint mono" style={{ fontSize: 11 }}>
                    {t('inbox.matchday', { season: m.season, d: m.matchday })}
                  </span>
                </div>
                <div className="muted">{w.body}</div>
                {canReport && (
                  <button className="btn small" style={{ marginTop: 6 }} onClick={() => viewReport(game.lastMatch!.result)}>
                    {t('msg.report')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
