/**
 * Welcome window shown once, right after a new game is created: who the player is, what the board expects,
 * the money, the stars of the squad and the first opponent.
 */
import { divisionOf } from '../../../engine/league/divisions.ts';
import { playerFixture, playerTeam, teamById } from '../../../engine/league/season.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { Crest, Gold, Modal } from '../../components/common.tsx';
import { useT } from '../../i18n/index.ts';
import { divName } from '../../competitions.ts';
import { useGame } from '../../store/gameStore.ts';
import { objectiveText } from './InboxScreen.tsx';

export function IntroModal() {
  const tr = useT();
  const { t, lang, money } = tr;
  const game = useGame((s) => s.game);
  const open = useGame((s) => s.intro);
  if (!game || !open) return null;
  const close = useGame.getState().closeIntro;
  const team = playerTeam(game);
  const stars = [...team.creatures].sort((a, b) => b.ability - a.ability).slice(0, 3);
  const fixture = playerFixture(game);
  const opponent = fixture ? teamById(game, fixture.home === team.id ? fixture.away : fixture.home).name : null;
  return (
    <Modal
      title={
        <span className="row">
          <Crest speciesId={stars[0]?.speciesId ?? 'dragon'} name={team.name} size={30} /> {t('intro.title')}
        </span>
      }
      onClose={close}
      actions={
        <button className="btn primary" onClick={close} autoFocus>
          {t('intro.go')}
        </button>
      }
    >
      <div className="stack intro">
        <p>{t('intro.p1', { team: team.name, n: team.creatures.length, div: divName(t, divisionOf(game, team.id)) })}</p>
        <p>
          <Gold>{t('intro.p2', { objective: objectiveText(tr, game.board.objective), money: money(game.clubs[team.id]!.balance) })}</Gold>
        </p>
        <p>{t('intro.p3', { names: stars.map((c) => `${c.name} (${speciesName(c.speciesId, lang)})`).join(', ') })}</p>
        <p className="muted">✎ {t('intro.rename')}</p>
        {opponent && <p>{t('intro.p4', { opponent })}</p>}
        <p className="muted">{t('intro.p5')}</p>
      </div>
    </Modal>
  );
}
