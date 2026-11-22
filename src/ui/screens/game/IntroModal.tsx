/**
 * Welcome window shown once, right after a new game is created: the stable in its colours, where it starts in the
 * pyramid, what the board expects, the money, the stars of the squad and the first opponent.
 */
import type { CSSProperties } from 'react';
import { capitalize } from '../../../core/text.ts';
import { bestRole } from '../../../engine/creature/derived.ts';
import { crestOf } from '../../../engine/team/crest.ts';
import { divisionOf } from '../../../engine/league/divisions.ts';
import { playerFixture, playerTeam, teamById } from '../../../engine/league/season.ts';
import { levelOf } from '../../../engine/progression/levels.ts';
import { speciesName } from '../../../engine/text/localize.ts';
import { Crest, ElementDots, Modal, Money } from '../../components/common.tsx';
import { CrestShield, StableCrest } from '../../components/TeamCrest.tsx';
import { useT } from '../../i18n/index.ts';
import { BadgeIcon, DivIcon, RoleIcon } from '../../icons/Icon.tsx';
import { divName } from '../../competitions.ts';
import { useGame } from '../../store/gameStore.ts';
import { objectiveText } from './InboxScreen.tsx';

export function IntroModal() {
  const tr = useT();
  const { t, lang } = tr;
  const game = useGame((s) => s.game);
  const open = useGame((s) => s.intro);
  if (!game || !open) return null;
  const close = useGame.getState().closeIntro;
  const team = playerTeam(game);
  const crest = crestOf(team);
  const div = divisionOf(game, team.id);
  const divs = game.divisions.length;
  const stars = [...team.creatures].sort((a, b) => b.ability - a.ability).slice(0, 3);
  const fixture = playerFixture(game);
  const opponent = fixture ? teamById(game, fixture.home === team.id ? fixture.away : fixture.home) : null;
  const style = { '--c1': crest.field[0], '--c2': crest.field[1] } as CSSProperties;
  return (
    <Modal
      title={
        <span className="row">
          <BadgeIcon name="new-game" /> {t('intro.title')}
        </span>
      }
      onClose={close}
      className="intro-dialog"
    >
      <div className="intro">
        <header className="intro-hero" style={style}>
          <span className="intro-crest">
            <CrestShield crest={crest} size={88} />
          </span>
          <div className="intro-id">
            <small className="intro-kicker">{t('intro.kicker', { season: game.season })}</small>
            <h3>{team.name}</h3>
            {game.manager?.name && <span className="intro-manager">{t('intro.manager', { name: game.manager.name })}</span>}
            <p>{t('intro.lede', { n: team.creatures.length })}</p>
          </div>
        </header>

        <div className="intro-grid">
          <section className="intro-climb">
            <h4>{t('intro.climb')}</h4>
            <ol className="intro-pyramid">
              {Array.from({ length: divs }, (_, d) => (
                <li key={d} className={`tier-${d} ${d === div ? 'here' : ''}`} style={{ '--w': `${58 + (42 * d) / Math.max(1, divs - 1)}%` } as CSSProperties}>
                  <DivIcon d={d} />
                  <span>{divName(t, d)}</span>
                  {d === div && <em>{t('intro.youStart')}</em>}
                </li>
              ))}
            </ol>
          </section>

          <div className="intro-facts">
            <div className="intro-fact goal">
              <span className="intro-fact-ico">
                <BadgeIcon name="board" />
              </span>
              <div>
                <small>{t('intro.objective')}</small>
                <b>{capitalize(objectiveText(tr, game.board.objective))}</b>
              </div>
            </div>
            <div className="intro-fact money">
              <span className="intro-fact-ico">
                <BadgeIcon name="money" />
              </span>
              <div>
                <small>{t('intro.treasury')}</small>
                <b>
                  <Money v={game.clubs[team.id]!.balance} />
                </b>
                <span className="muted">{t('intro.treasuryNote')}</span>
              </div>
            </div>
            {opponent && (
              <div className="intro-fact foe">
                <span className="intro-fact-ico">
                  <BadgeIcon name="versus" />
                </span>
                <div>
                  <small>{t('intro.first')}</small>
                  <b className="row">
                    <StableCrest team={opponent} size={22} /> {opponent.name}
                  </b>
                </div>
              </div>
            )}
          </div>
        </div>

        <section className="intro-stars">
          <h4>{t('intro.stars')}</h4>
          <div className="intro-star-row">
            {stars.map((c) => (
              <div key={c.id} className="intro-star">
                <Crest speciesId={c.speciesId} name={c.name} size={44} level={levelOf(c)} />
                <div>
                  <b>{c.name}</b>
                  <span className="muted row">
                    <RoleIcon role={bestRole(c)} /> {speciesName(c.speciesId, lang)} <ElementDots speciesId={c.speciesId} />
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="intro-rename muted">✎ {t('intro.rename')}</p>
        </section>

        <footer className="intro-foot">
          <p>
            <BadgeIcon name="tip" /> {t('intro.tip')}
          </p>
          <button className="btn primary intro-go" onClick={close} autoFocus>
            {t('intro.go')}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
