import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { answerRequest, recordLineup, starsOf, weeklyRequests } from '../src/engine/club/requests.ts';
import { locate } from '../src/engine/economy/market.ts';
import { newGame, playerTeam } from '../src/engine/league/season.ts';
import type { CreatureRequest, GameState } from '../src/engine/league/types.ts';

const Q = DEFAULT_CONFIG.club.requests;
const game = (seed = 'requests') => newGame({ seed, teamName: 'Test', lang: 'en' });

/** An open request for the player's best creature. */
function open(g: GameState, kind: CreatureRequest['kind'], extra: Partial<CreatureRequest> = {}): CreatureRequest {
  const c = starsOf(g)[0]!;
  const r: CreatureRequest = { id: `rq-${kind}`, kind, creatureId: c.id, name: c.name, season: g.season, matchday: g.matchday, until: g.matchday + Q.answerWeeks, status: 'open', ...extra };
  (g.requests ??= []).push(r);
  return r;
}
const moraleOf = (g: GameState, id: string) => locate(g, id)!.creature.condition.morale;

describe('star requests', () => {
  it('a star left on the bench while fit asks for playing time', () => {
    const g = game();
    const star = starsOf(g)[0]!;
    // No other reason to ask (no ambition to leave, well paid): only playing time is left.
    for (const c of playerTeam(g).creatures) {
      c.hidden.ambition = 0;
      if (c.contract) c.contract.wage = 99999;
    }
    const others = playerTeam(g).creatures.filter((c) => c.id !== star.id).map((c) => c.id);
    for (let i = 0; i < Q.playtime.window; i++) recordLineup(g, others.slice(0, 5));
    // Try weeks until the weekly roll lets someone speak (deterministic per week).
    for (let w = 0; w < 20 && !g.requests?.length; w++) {
      g.matchday = 1 + w * Q.gapWeeks;
      weeklyRequests(g);
    }
    const asked = g.requests?.find((r) => r.creatureId === star.id && r.kind === 'playtime');
    expect(asked).toBeDefined();
    expect(g.inbox.some((m) => m.kind === 'request' && m.requestId === asked!.id)).toBe(true);
  });

  it('a kept promise lifts morale; a broken one costs morale, friends included', () => {
    const g = game();
    const r = open(g, 'playtime');
    const kept = answerRequest(g, r.id, 'promise').state;
    expect(kept.requests![0]!.status).toBe('promised');
    const m0 = moraleOf(kept, r.creatureId);
    for (let i = 0; i < Q.playtime.need; i++) recordLineup(kept, [r.creatureId]);
    expect(kept.requests![0]!.status).toBe('kept');
    expect(moraleOf(kept, r.creatureId)).toBe(Math.min(100, m0 + Q.playtime.kept));

    const broken = answerRequest(g, r.id, 'promise').state;
    const team = playerTeam(broken);
    const friend = team.creatures.find((c) => c.id !== r.creatureId)!;
    friend.relations[r.creatureId] = 100;
    const f0 = friend.condition.morale;
    const b0 = moraleOf(broken, r.creatureId);
    for (let i = 0; i < Q.playtime.of - Q.playtime.need + 1; i++) recordLineup(broken, []);
    expect(broken.requests![0]!.status).toBe('broken');
    expect(moraleOf(broken, r.creatureId)).toBe(Math.max(0, b0 + Q.playtime.broken));
    expect(locate(broken, friend.id)!.creature.condition.morale).toBe(Math.max(0, f0 + Q.playtime.friendsBroken));
  });

  it('a raise sets the new wage; a compromise meets halfway', () => {
    const g = game();
    const c = starsOf(g)[0]!;
    const wage = c.contract!.wage;
    const r = open(g, 'raise', { wage, asked: wage * 2 });
    expect(locate(answerRequest(g, r.id, 'accept').state, c.id)!.creature.contract!.wage).toBe(wage * 2);
    expect(locate(answerRequest(g, r.id, 'compromise').state, c.id)!.creature.contract!.wage).toBe(Math.round((wage * 1.5) / 10) * 10);
    expect(answerRequest(g, r.id, 'sell').outcome).toEqual({ kind: 'error', error: 'closed' });
  });

  it('selling a star that asked to leave moves it to the bigger stable for the fee', () => {
    const g = game();
    const buyer = g.teams.find((t) => t.id !== g.playerTeamId)!;
    const r = open(g, 'leave', { fromTeamId: buyer.id, fee: 5000 });
    const next = answerRequest(g, r.id, 'sell').state;
    expect(locate(next, r.creatureId)!.team!.id).toBe(buyer.id);
    expect(next.clubs[next.playerTeamId]!.balance).toBe(g.clubs[g.playerTeamId]!.balance + 5000);
  });

  it('silence counts as a refusal; at most one open request and a few per season', () => {
    const g = game();
    const r = open(g, 'raise', { wage: 100, asked: 200 });
    const m0 = moraleOf(g, r.creatureId);
    g.matchday = r.until + 1;
    weeklyRequests(g);
    expect(g.requests![0]!.status).toBe('expired');
    expect(moraleOf(g, r.creatureId)).toBe(Math.max(0, m0 + Q.raise.refused));
    const h = game();
    for (let i = 0; i < Q.maxPerSeason; i++) Object.assign(open(h, 'raise'), { id: `x${i}`, status: 'answered' });
    h.matchday = 40;
    weeklyRequests(h);
    expect(h.requests!.length).toBe(Q.maxPerSeason);
  });
});
