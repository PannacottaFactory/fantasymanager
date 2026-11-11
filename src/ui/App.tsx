import { useEffect, useRef, useState } from 'react';
import { LANGS } from '../core/i18n.ts';
import { ICON_VIEWBOX, SPECIES_ICONS } from './icons/gameIcons.ts';
import { cupDue, lastMatchday, playerTeam, seasonOver } from '../engine/league/season.ts';
import { TEXT_SCALE, TEXT_SIZES, THEMES, useSettings, useT } from './i18n/index.ts';
import { ArenaScreen } from './screens/arena/ArenaScreen.tsx';
import { ReportView } from './screens/arena/ReportView.tsx';
import { InboxScreen } from './screens/game/InboxScreen.tsx';
import { LeagueScreen } from './screens/game/LeagueScreen.tsx';
import { MatchScreen } from './screens/game/MatchScreen.tsx';
import { SquadScreen } from './screens/game/SquadScreen.tsx';
import { StartScreen } from './screens/game/StartScreen.tsx';
import { TacticsScreen } from './screens/game/TacticsScreen.tsx';
import { GameSheet } from './screens/game/CreatureSheet.tsx';
import { IntroModal } from './screens/game/IntroModal.tsx';
import { DashboardScreen } from './screens/game/DashboardScreen.tsx';
import { useFirstStepsTracker } from './tutorial/FirstSteps.tsx';
import { FxLayer } from './fx/FxLayer.tsx';
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
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LiveMatch } from './screens/arena/LiveMatch.tsx';
import { EncyclopediaScreen } from './screens/EncyclopediaScreen.tsx';
import { TutorialOverlay } from './tutorial/TutorialOverlay.tsx';
import { RollingMoney } from './components/common.tsx';
import { centreOf, fxLayer } from './fx/FxLayer.tsx';
import { Celebrations } from './fx/Celebrations.tsx';

/** The treasury in the top bar: rolls to its new value; coins fly in when money comes, a red tick when it goes. */
function BalanceChip({ balance, worldSeed }: { balance: number; worldSeed: string }) {
  const { t, money } = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const prev = useRef<{ seed: string; v: number } | null>(null);
  const [delta, setDelta] = useState<{ v: number; n: number } | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = { seed: worldSeed, v: balance };
    if (!p || p.seed !== worldSeed || p.v === balance) return;
    const d = balance - p.v;
    setDelta({ v: d, n: Date.now() });
    const to = centreOf(ref.current);
    if (d > 0 && to) fxLayer()?.coins({ x: window.innerWidth / 2, y: window.innerHeight * 0.45 }, to, Math.min(14, 4 + Math.round(Math.log10(d + 1) * 2.5)));
  }, [balance, worldSeed]);
  return (
    <button ref={ref} className={`balance ${balance < 0 ? 'neg' : ''}`} title={t('topbar.balance')} onClick={() => useGame.getState().setScreen('finances')}>
      <RollingMoney v={balance} compact />
      {delta && (
        <span key={delta.n} className={`balance-delta ${delta.v > 0 ? 'up' : 'down'}`} aria-hidden="true">
          {delta.v > 0 ? '+' : '−'}
          {money(Math.abs(delta.v), true)}
        </span>
      )}
    </button>
  );
}

function ContinueButton() {
  const { t } = useT();
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
        <BalanceChip balance={club.balance} worldSeed={game.worldSeed} />
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
  const { lang, theme, textSize, effects, setLang, setTheme, setTextSize, setEffects } = useSettings();
  const { ready, game, screen, viewing, saveError, replaying, intro, launch } = useGame();
  useFirstStepsTracker();
  const { init, setScreen, viewReport } = useGame.getState();
  const [newGameOpen, setNewGameOpen] = useState(false);
  const unread = game?.inbox.filter((m) => !m.read).length ?? 0;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.effects = effects;
  }, [effects]);
  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(TEXT_SCALE[textSize]));
  }, [textSize]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('app.title');
  }, [lang, t]);
  useEffect(() => {
    void init();
  }, [init]);

  let content;
  if (!ready) content = <div className="muted">{t('start.loading')}</div>;
  else if (replaying)
    content = (
      <div className="stack">
        <section className="panel row wrap" style={{ gap: 10 }}>
          <b>{t('replay.title', { home: replaying.setup.teams[0].name, away: replaying.setup.teams[1].name })}</b>
          <span className="muted">{t('replay.when', { s: replaying.season, d: replaying.matchday })}</span>
          <span className="spacer" />
          <button className="btn" onClick={() => useGame.getState().stopReplay()}>
            {t('match.back')}
          </button>
        </section>
        <LiveMatch key={replaying.fixtureId} setup={replaying.setup} playerControls={false} replay={replaying.decisions} onFinish={(r) => useGame.setState({ replaying: null, viewing: r })} />
      </div>
    );
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
  else if (screen === 'encyclopedia') content = <EncyclopediaScreen />;
  else if (screen === 'arena') content = <ArenaScreen />;
  else if (!game || newGameOpen || launch) content = <StartScreen onCancel={game && newGameOpen ? () => setNewGameOpen(false) : undefined} />;
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
  else if (screen === 'inbox') content = <InboxScreen />;
  else content = <DashboardScreen />;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => (game ? setNewGameOpen(true) : setScreen('dashboard'))} title={t('start.new')}>
          <svg className="brand-icon" width="30" height="30" viewBox={ICON_VIEWBOX} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPECIES_ICONS.dragon! }} />
          <div>
            <h1>{t('app.title')}</h1>
            <small>{game ? playerTeam(game).name : t('app.subtitle')}</small>
          </div>
        </button>
        <NavBar
          screen={newGameOpen || launch ? null : screen}
          hasGame={!!game}
          badges={{ inbox: unread, training: game?.youth.length ?? 0 }}
          onSelect={(id) => {
            setNewGameOpen(false);
            setScreen(id);
          }}
        />
        {!launch && <ContinueButton />}
        <div className="seg" role="radiogroup" aria-label={t('lang.title')} title={t('lang.title')}>
          {LANGS.map((l) => (
            <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)} role="radio" aria-checked={l === lang}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          className="btn small ghost text-size-btn"
          title={`${t('text.size')} : ${t(`text.${textSize}`)}`}
          aria-label={t('text.size')}
          onClick={() => setTextSize(TEXT_SIZES[(TEXT_SIZES.indexOf(textSize) + 1) % TEXT_SIZES.length]!)}
        >
          <span style={{ fontSize: '0.8em' }}>A</span>
          <span style={{ fontSize: '1.15em' }}>A</span>
          <i className={`size-dots s-${textSize}`} aria-hidden="true" />
        </button>
        <button
          className={`btn small ghost fx-btn ${effects === 'full' ? 'on' : ''}`}
          title={t(effects === 'full' ? 'effects.on' : 'effects.off')}
          aria-label={t('effects.title')}
          aria-pressed={effects === 'full'}
          onClick={() => setEffects(effects === 'full' ? 'reduced' : 'full')}
        >
          ✨
        </button>
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
      <main className="main">
        <ErrorBoundary key={`${screen}-${viewing ? 'report' : ''}-${replaying ? 'replay' : ''}`}>
          <div className="screen-enter">{content}</div>
        </ErrorBoundary>
      </main>
      {game && !newGameOpen && screen !== 'arena' && screen !== 'encyclopedia' && (
        <ErrorBoundary onReset={() => useGame.getState().openSheet(null)}>
          <GameSheet />
        </ErrorBoundary>
      )}
      {game && !newGameOpen && <IntroModal />}
      <FxLayer />
      <Celebrations />
      <TutorialOverlay active={!!game && !newGameOpen && !launch && ready && !viewing && !intro} />
    </div>
  );
}
