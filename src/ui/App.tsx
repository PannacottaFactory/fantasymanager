import { useEffect, useState } from 'react';
import { LANGS } from '../core/i18n.ts';
import { cupDue, lastMatchday, seasonOver } from '../engine/league/season.ts';
import { THEMES, useSettings, useT } from './i18n/index.ts';
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
import { FacilitiesScreen } from './screens/game/FacilitiesScreen.tsx';
import { NewsScreen } from './screens/game/NewsScreen.tsx';
import { cupRoundKey } from './screens/game/LeagueScreen.tsx';
import { StaffScreen } from './screens/game/StaffScreen.tsx';
import { TrainingScreen } from './screens/game/TrainingScreen.tsx';
import { useGame } from './store/gameStore.ts';
import { NavBar } from './components/NavBar.tsx';
import { HelpScreen } from './screens/HelpScreen.tsx';
import { TutorialOverlay } from './tutorial/TutorialOverlay.tsx';

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
    <div className="continue" data-tip="continue">
      {club && (
        <button className={`balance ${club.balance < 0 ? 'neg' : ''}`} title={t('topbar.balance')} onClick={() => useGame.getState().setScreen('finances')}>
          {money(club.balance, true)}
        </button>
      )}
      <span className="muted status">
        {over
          ? t('status.seasonOver', { season: game.season })
          : cupDue(game)
            ? t('status.cup', { season: game.season, round: t(cupRoundKey(game.cup.round, game.cup.rounds)) })
            : t('status.season', { season: game.season, d: game.matchday, n: lastMatchday(game) })}
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
  else if (screen === 'help') content = <HelpScreen />;
  else if (screen === 'arena') content = <ArenaScreen />;
  else if (!game || newGameOpen) content = <StartScreen onCancel={game ? () => setNewGameOpen(false) : undefined} />;
  else if (screen === 'squad') content = <SquadScreen />;
  else if (screen === 'tactics') content = <TacticsScreen />;
  else if (screen === 'league') content = <LeagueScreen />;
  else if (screen === 'recruit') content = <RecruitScreen />;
  else if (screen === 'finances') content = <FinancesScreen />;
  else if (screen === 'training') content = <TrainingScreen />;
  else if (screen === 'staff') content = <StaffScreen />;
  else if (screen === 'facilities') content = <FacilitiesScreen />;
  else if (screen === 'news') content = <NewsScreen />;
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
        <NavBar
          screen={newGameOpen ? null : screen}
          hasGame={!!game}
          badges={{ inbox: unread, training: game?.youth.length ?? 0 }}
          onSelect={(id) => {
            setNewGameOpen(false);
            setScreen(id);
          }}
        />
        <ContinueButton />
        <div className="seg" role="radiogroup" aria-label={t('lang.title')} title={t('lang.title')}>
          {LANGS.map((l) => (
            <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)} role="radio" aria-checked={l === lang}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button className={`btn small ghost help-btn ${screen === 'help' ? 'active' : ''}`} data-tip="help-btn" title={t('help.btn')} aria-label={t('help.btn')} onClick={() => setScreen('help')}>
          ?
        </button>
        <div className="seg theme-seg" role="radiogroup" aria-label={t('theme.switch')}>
          {THEMES.map((th) => (
            <button key={th} className={th === theme ? 'on' : ''} onClick={() => setTheme(th)} role="radio" aria-checked={th === theme} title={t(`theme.${th}`)}>
              <i className={`swatch ${th}`} />
            </button>
          ))}
        </div>
      </header>
      {saveError && <div className="save-error">{t('save.failed')}</div>}
      <main className="main">{content}</main>
      {game && !newGameOpen && screen !== 'arena' && <GameSheet />}
      <TutorialOverlay active={!!game && !newGameOpen && ready && !viewing} />
    </div>
  );
}
