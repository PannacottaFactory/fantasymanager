import { DEFAULT_CONFIG, type GameConfig } from '../../data/config/index.ts';
import type { Fixture, StandingRow } from './types.ts';

function emptyRow(teamId: string): StandingRow {
  return {
    teamId, played: 0, koWins: 0, pointsWins: 0, pointsLosses: 0, koLosses: 0, points: 0,
    scoreFor: 0, scoreAgainst: 0, kosFor: 0, kosAgainst: 0, form: [],
  };
}

/**
 * League table. Order: points, then judges' score difference, then KOs scored, then KO wins, then id
 * (fully deterministic).
 */
export function computeStandings(teamIds: readonly string[], fixtures: readonly Fixture[], cfg: GameConfig = DEFAULT_CONFIG): StandingRow[] {
  const rows = new Map(teamIds.map((id) => [id, emptyRow(id)]));
  const pts = cfg.match.points;
  const played = fixtures.filter((f) => f.result && f.competition !== 'cup').sort((a, b) => a.matchday - b.matchday);
  for (const f of played) {
    const r = f.result!;
    const sides = [rows.get(f.home), rows.get(f.away)] as const;
    sides.forEach((row, side) => {
      if (!row) return;
      const opp = side === 0 ? 1 : 0;
      const won = r.winner === side;
      row.played++;
      row.scoreFor += r.score[side];
      row.scoreAgainst += r.score[opp];
      row.kosFor += r.kos[side];
      row.kosAgainst += r.kos[opp];
      if (won && r.method === 'ko') {
        row.koWins++;
        row.points += pts.koWin;
        row.form.push('W');
      } else if (won) {
        row.pointsWins++;
        row.points += pts.pointsWin;
        row.form.push('w');
      } else if (r.method === 'points') {
        row.pointsLosses++;
        row.points += pts.pointsLoss;
        row.form.push('l');
      } else {
        row.koLosses++;
        row.points += pts.koLoss;
        row.form.push('L');
      }
    });
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.scoreFor - b.scoreAgainst - (a.scoreFor - a.scoreAgainst) ||
      b.kosFor - a.kosFor ||
      b.koWins - a.koWins ||
      a.teamId.localeCompare(b.teamId),
  );
}
