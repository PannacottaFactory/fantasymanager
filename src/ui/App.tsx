import { useEffect, useState } from 'react';
import { LANGS } from '../core/i18n.ts';
import { lastMatchday, seasonOver } from '../engine/league/season.ts';
import { useSettings, useT } from './i18n/index.ts';
import type { StringKey } from './i18n/strings.ts';
import { ArenaScreen } from './screens/arena/ArenaScreen.tsx';
import { ReportView } from './screens/arena/ReportView.tsx';
import { InboxScreen } from './screens/game/InboxScreen.tsx';
import { LeagueScreen } from './screens/game/LeagueScreen.tsx';
import { MatchScreen } from './screens/game/MatchScreen.tsx';
import { SquadScreen } from './screens/game/SquadScreen.tsx';
import { StartScreen } from './screens/game/StartScreen.tsx';
import { TacticsScreen } from './screens/game/TacticsScreen.tsx';
import { GameSheet } from './screens/game/CreatureSheet.tsx';
import { RecruitScreen } from './screens/game/RecruitScreen.tsx';
import { FinancesScreen } from './screens/game/FinancesScreen.tsx';
import { useGame, type Screen } from './store/gameStore.ts';

/** Screens planned for later phases are shown disabled so the final structure is visible. */
const SCREENS: { id: Screen | string; label: StringKey; phase?: number; needsGame?: boolean }[] = [
  { id: 'inbox', label: 'nav.inbox', needsGame: true },
  { id: 'squad', label: 'nav.squad', needsGame: true },
  { id: 'tactics', label: 'nav.tactics', needsGame: true },
  { id: 'league', label: 'nav.league', needsGame: true },
  { id: 'recruit', label: 'nav.scouting', needsGame: true },
  { id: 'finances', label: 'nav.finances', needsGame: true },
  { id: 'training', label: 'nav.training', phase: 4 },
  { id: 'staff', label: 'nav.staff', phase: 4 },
  { id: 'facilities', label: 'nav.facilities', phase: 5 },
  { id: 'history', label: 'nav.history', phase: 5 },
  { id: 'arena', label: 'nav.arena' },
];

function ContinueButton() {
  const { t, money } = useT();
  const game = useGame((s) => s.game);
  const match = useGame((s) => s.match);
  if (!game) return null;
  const over = seasonOver(game);
  const onClick = () => {
    const st = useGame.getState();
    if (match && match.phase !== 'report') return st.setScreen('match');
    if (match) st.closeMatch();
    st.continueGame();
  };
  const club = game.clubs[game.playerTeamId];
  return (
    <div className="continue">
      {club && (
        <button className={`balance ${club.balance < 0 ? 'neg' : ''}`} title={t('topbar.balance')} onClick={() => useGame.getState().setScreen('finances')}>
          {money(club.balance, true)}
        </button>
      )}
      <span className="muted status">
        {over ? t('status.seasonOver', { season: game.season }) : t('status.season', { season: game.season, d: game.matchday, n: lastMatchday(game) })}
      </span>
      <button className="btn primary" onClick={onClick} title={t('continue.title')}>
        {over ? t('continue.nextSeason') : t('continue')} ▶
      </button>
    </div>
  );
}

export function App() {
  const { t } = useT();
  const { lang, theme, setLang, setTheme } = useSettings();
  const { ready, game, screen, viewing, saveError } = useGame();
  const { init, setScreen, viewReport } = useGame.getState();
  const [newGameOpen, setNewGameOpen] = useState(false);
  const unread = game?.inbox.filter((m) => !m.read).length ?? 0;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('app.title');
  }, [lang, t]);
  useEffect(() => {
    void init();
  }, [init]);

  let content;
  if (!ready) content = <div className="muted">{t('start.loading')}</div>;
  else if (viewing)
    content = (
      <ReportView
        result={viewing}
        actions={
          <button className="btn primary" onClick={() => viewReport(null)}>
            {t('match.back')}
          </button>
        }
      />
    );
  else if (screen === 'arena') content = <ArenaScreen />;
  else if (!game || newGameOpen) content = <StartScreen onCancel={game ? () => setNewGameOpen(false) : undefined} />;
  else if (screen === 'squad') content = <SquadScreen />;
  else if (screen === 'tactics') content = <TacticsScreen />;
  else if (screen === 'league') content = <LeagueScreen />;
  else if (screen === 'recruit') content = <RecruitScreen />;
  else if (screen === 'finances') content = <FinancesScreen />;
  else if (screen === 'match') content = <MatchScreen />;
  else content = <InboxScreen />;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => (game ? setNewGameOpen(true) : setScreen('inbox'))} title={t('start.new')}>
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z" fill="var(--accent)" />
            <path d="M11 21 L21 11 M11 11 L21 21" stroke="var(--panel)" strokeWidth="3" />
          </svg>
          <div>
            <h1>{t('app.title')}</h1>
            <small>{t('app.subtitle')}</small>
          </div>
        </button>
        <nav className="nav" aria-label="Screens">
          {SCREENS.map((s) => {
            const disabled = !!s.phase || (s.needsGame && !game);
            const title = s.phase ? t('nav.comingInPhase', { n: s.phase }) : disabled ? t('nav.needsGame') : undefined;
            return (
              <button
                key={s.id}
                className={`${s.id === screen && !newGameOpen ? 'on' : ''} ${s.phase ? 'future' : ''}`}
                disabled={disabled}
                title={title}
                onClick={() => {
                  setNewGameOpen(false);
                  setScreen(s.id as Screen);
                }}
              >
                {t(s.label)}
                {s.id === 'inbox' && unread > 0 && <span className="badge">{unread}</span>}
              </button>
            );
          })}
        </nav>
        <ContinueButton />
        <div className="seg" role="radiogroup" aria-label={t('lang.title')} title={t('lang.title')}>
          {LANGS.map((l) => (
            <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)} role="radio" aria-checked={l === lang}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button className="btn small ghost" onClick={() => setTheme(theme === 'dark' ? 'parchment' : 'dark')} title={t('theme.switch')}>
          {theme === 'dark' ? t('theme.parchment') : t('theme.dark')}
        </button>
      </header>
      {saveError && <div className="save-error">{t('save.failed')}</div>}
      <main className="main">{content}</main>
      {game && !newGameOpen && screen !== 'arena' && <GameSheet />}
    </div>
  );
}
