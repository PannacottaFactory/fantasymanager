import type { NewsItem } from '../../../engine/league/types.ts';
import { useT, type Translator } from '../../i18n/index.ts';
import { useGame } from '../../store/gameStore.ts';

const ICON: Record<NewsItem['kind'], string> = {
  upset: '⚡',
  quickKo: '💥',
  streak: '🔥',
  leader: '👑',
  bigTransfer: '💰',
  starInjury: '🩹',
  cupWinner: '🏆',
  champion: '👑',
  promotion: '⬆',
  relegation: '⬇',
  retirement: '🌅',
  death: '🕯',
};

export function newsText(tr: Translator, n: NewsItem): string {
  const { t, money } = tr;
  switch (n.kind) {
    case 'upset':
      return t(n.cup ? 'news.upsetCup' : 'news.upset', { winner: n.winner, loser: n.loser });
    case 'quickKo':
      return t('news.quickKo', { winner: n.winner, loser: n.loser, rounds: n.rounds });
    case 'streak':
      return t('news.streak', { team: n.team, wins: n.wins });
    case 'leader':
      return t('news.leader', { team: n.team, n: n.division + 1 });
    case 'bigTransfer':
      return n.from ? t('news.bigTransfer', { name: n.name, from: n.from, to: n.to, fee: money(n.fee) }) : t('news.bigTransferFree', { name: n.name, to: n.to, fee: money(n.fee) });
    case 'starInjury':
      return t('news.starInjury', { team: n.team, name: n.name, weeks: tr.weeks(n.weeks) });
    case 'cupWinner':
      return t('news.cupWinner', { team: n.team });
    case 'champion':
      return t('news.champion', { team: n.team, n: n.division + 1 });
    case 'promotion':
      return t('news.promotion', { n: n.division + 1, teams: n.teams.join(', ') });
    case 'relegation':
      return t('news.relegation', { n: n.division + 1, teams: n.teams.join(', ') });
    case 'retirement':
      return t('news.retirement', { name: n.name, team: n.team });
    case 'death':
      return t('news.death', { name: n.name, team: n.team });
  }
}

export function NewsScreen() {
  const tr = useT();
  const { t } = tr;
  const game = useGame((s) => s.game)!;
  const items = [...game.news].reverse();
  return (
    <div className="stack narrow">
      <section className="panel">
        <h2 style={{ marginBottom: 10 }}>📰 {t('news.title')}</h2>
        {items.length === 0 && <div className="muted">{t('news.empty')}</div>}
        <ul className="news">
          {items.map((n) => (
            <li key={n.id}>
              <span className="news-icon">{ICON[n.kind]}</span>
              <span className="grow">{newsText(tr, n)}</span>
              <span className="faint mono" style={{ fontSize: '0.786rem' }}>
                {t('inbox.matchday', { season: n.season, d: n.matchday })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
