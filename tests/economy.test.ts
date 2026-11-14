import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS } from '../src/data/attributes.ts';
import { DEFAULT_CONFIG } from '../src/data/config/index.ts';
import { answerOffer, bid, release, releaseCost, renew, sendScout, signFreeAgent } from '../src/engine/economy/actions.ts';
import { askingPrice, locate } from '../src/engine/economy/market.ts';
import { attributeRange, knowledgeOf, overallRange } from '../src/engine/economy/scouting.ts';
import { askingWage, creatureValue } from '../src/engine/economy/value.ts';
import { newGame, playMatchday, playerTeam, seasonOver, startNextSeason } from '../src/engine/league/season.ts';
import type { GameState } from '../src/engine/league/types.ts';
import { overallRating } from '../src/engine/creature/derived.ts';

const game = (seed = 'eco') => newGame({ seed, teamName: 'Test', lang: 'en' });
const balance = (g: GameState, id = g.playerTeamId) => g.clubs[id]!.balance;
const aiCreature = (g: GameState) => {
  const team = g.teams.find((t) => t.id !== g.playerTeamId)!;
  return { team, c: [...team.creatures].sort((a, b) => a.ability - b.ability)[0]! };
};

describe('economy setup', () => {
  it('every stable has a club, every creature a contract; the free agent pool is filled', () => {
    const g = game();
    expect(Object.keys(g.clubs).length).toBe(g.teams.length);
    for (const t of g.teams) for (const c of t.creatures) expect(c.contract?.wage).toBeGreaterThan(0);
    expect(g.freeAgents.length).toBe(DEFAULT_CONFIG.economy.freeAgents.pool);
    expect(g.freeAgents.every((c) => !c.contract && c.stableId === null)).toBe(true);
  });

  it('is deterministic over several weeks (market, finances, scouting)', () => {
    let a = game('det');
    let b = game('det');
    for (let i = 0; i < 6; i++) {
      a = playMatchday(a);
      b = playMatchday(b);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

});

describe('value & wages', () => {
  it('better creatures are worth more and ask more', () => {
    const g = game();
    const all = g.teams.flatMap((t) => t.creatures);
    const sorted = [...all].sort((a, b) => a.ability - b.ability);
    const weak = sorted[0]!;
    const strong = sorted[sorted.length - 1]!;
    expect(creatureValue(strong)).toBeGreaterThan(creatureValue(weak));
    expect(askingWage(strong, 50)).toBeGreaterThan(askingWage(weak, 50));
    // Small clubs pay a premium.
    expect(askingWage(strong, 20)).toBeGreaterThan(askingWage(strong, 80));
  });
});

describe('imperfect information', () => {
  it('ranges always contain the truth and narrow with knowledge', () => {
    const g = game();
    const others = g.teams.filter((t) => t.id !== g.playerTeamId).flatMap((t) => t.creatures);
    for (const c of others.slice(0, 30)) {
      let prev = Infinity;
      for (const k of [0, 25, 50, 75, 100]) {
        let width = 0;
        for (const key of ATTRIBUTE_KEYS) {
          const r = attributeRange(c, key, k);
          expect(r.low).toBeLessThanOrEqual(c.attributes[key]);
          expect(r.high).toBeGreaterThanOrEqual(c.attributes[key]);
          width += r.high - r.low;
        }
        const o = overallRange(c, k);
        expect(o.low <= overallRating(c) && o.high >= overallRating(c)).toBe(true);
        expect(width).toBeLessThanOrEqual(prev);
        prev = width;
      }
      expect(prev).toBe(0);
    }
  });

  it('own creatures are fully known; a scout mission reveals a creature', () => {
    let g = game();
    expect(knowledgeOf(g, playerTeam(g).creatures[0]!.id)).toBe(100);
    const { c } = aiCreature(g);
    expect(knowledgeOf(g, c.id)).toBe(DEFAULT_CONFIG.economy.scouting.leagueBaseline);
    g = sendScout(g, 'creature', c.id).state;
    // Scouts work during league weeks.
    const md = g.matchday;
    while (g.matchday < md + DEFAULT_CONFIG.economy.scouting.creatureWeeks) g = playMatchday(g);
    expect(knowledgeOf(g, c.id)).toBeGreaterThanOrEqual(DEFAULT_CONFIG.economy.scouting.creatureKnowledge);
    expect(g.inbox.some((m) => m.kind === 'scoutReport')).toBe(true);
  });
});

describe('transfers', () => {
  it('a generous bid is accepted: creature, fee and contract move', () => {
    const g = game();
    // A delighted board lets the whole treasury go on one purchase.
    g.board.confidence = 90;
    const { team, c } = aiCreature(g);
    const price = askingPrice(team, c);
    const before = balance(g);
    const r = bid(g, c.id, Math.round(price * 1.2), 2);
    expect(r.outcome.kind).toBe('accepted');
    expect(locate(r.state, c.id)?.team?.id).toBe(g.playerTeamId);
    expect(balance(r.state)).toBe(before - Math.round(price * 1.2));
    expect(balance(r.state, team.id)).toBe(balance(g, team.id) + Math.round(price * 1.2));
    expect(locate(r.state, c.id)?.creature.contract?.untilSeason).toBe(g.season + 1);
  });

  it('a low bid is rejected, a close one gets a counter-offer that can be met', () => {
    const g = game();
    const { team, c } = aiCreature(g);
    const price = askingPrice(team, c);
    expect(bid(g, c.id, Math.round(price * 0.3), 1).outcome.kind).toBe('rejected');
    const r = bid(g, c.id, Math.round(price * 0.85), 1);
    expect(r.outcome.kind).toBe('counter');
    if (r.outcome.kind !== 'counter') return;
    const r2 = bid(r.state, c.id, r.outcome.fee, 1);
    expect(r2.outcome.kind).toBe('accepted');
  });

  it('the other stable stops answering after too many bids in a week', () => {
    let g = game();
    const { team, c } = aiCreature(g);
    const low = Math.round(askingPrice(team, c) * 0.2);
    for (let i = 0; i < DEFAULT_CONFIG.economy.transfers.maxBidsPerWeek; i++) g = bid(g, c.id, low, 1).state;
    expect(bid(g, c.id, low, 1).outcome).toEqual({ kind: 'error', error: 'closed' });
  });

  it('cannot bid more than the treasury', () => {
    const g = game();
    const { c } = aiCreature(g);
    expect(bid(g, c.id, balance(g) + 1, 1).outcome).toEqual({ kind: 'error', error: 'noMoney' });
  });

  it('signing a free agent costs the bonus and adds a contract', () => {
    const g = game();
    const fa = g.freeAgents.find((c) => c.hidden.ambition < 16)!;
    const r = signFreeAgent(g, fa.id, 1);
    expect(r.outcome.kind).toBe('signed');
    expect(playerTeam(r.state).creatures.some((c) => c.id === fa.id)).toBe(true);
    expect(r.state.freeAgents.some((c) => c.id === fa.id)).toBe(false);
    if (r.outcome.kind === 'signed') expect(balance(r.state)).toBe(balance(g) - r.outcome.fee);
  });

  it('selling to an AI offer and releasing with compensation', () => {
    // AI offers are rare events: try a few worlds until one comes in.
    let g = game('offers');
    for (let w = 0; w < 6 && !g.offers.length; w++) {
      g = game(`offers-${w}`);
      for (let i = 0; i < 18 && !g.offers.length; i++) g = playMatchday(g);
    }
    expect(g.offers.length).toBeGreaterThan(0);
    const o = g.offers[0]!;
    const r = answerOffer(g, o.id, true);
    expect(r.outcome).toEqual({ kind: 'sold', fee: o.fee });
    expect(locate(r.state, o.creatureId)?.team?.id).toBe(o.fromTeamId);

    const victim = playerTeam(r.state).creatures[0]!;
    const cost = releaseCost(r.state, victim.id);
    const rel = release(r.state, victim.id);
    expect(rel.outcome).toEqual({ kind: 'released', cost });
    expect(rel.state.freeAgents.some((c) => c.id === victim.id)).toBe(true);
  });
});

describe('contracts & seasons', () => {
  it('unrenewed contracts end; renewed ones carry on; the squad stays playable', () => {
    let g = game('contracts');
    while (!seasonOver(g)) g = playMatchday(g);
    const expiring = playerTeam(g).creatures.filter((c) => c.contract!.untilSeason <= g.season);
    expect(expiring.length).toBeGreaterThan(0);
    const keep = expiring[0]!;
    g = renew(g, keep.id, 2).state;
    const next = startNextSeason(g);
    const ids = new Set(playerTeam(next).creatures.map((c) => c.id));
    expect(ids.has(keep.id)).toBe(true);
    for (const c of expiring.slice(1)) expect(ids.has(c.id)).toBe(false);
    expect(playerTeam(next).creatures.length).toBeGreaterThanOrEqual(DEFAULT_CONFIG.match.starters + DEFAULT_CONFIG.match.benchSize);
    for (const t of next.teams) expect(t.creatures.length).toBeGreaterThanOrEqual(DEFAULT_CONFIG.economy.club.minSquad);
  });
});
