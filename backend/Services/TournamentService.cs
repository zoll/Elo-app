using TableTennis.Api.Data;
using TableTennis.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace TableTennis.Api.Services;

public class TournamentService(AppDbContext db)
{
    // Generates all matches for a tournament that has participants already saved.
    public async Task StartAsync(Tournament tournament)
    {
        var participants = tournament.Participants.OrderBy(p => p.Seed).ToList();

        // links: (from, winnerDest, loserDest) — IDs filled after first SaveChanges
        List<(TournamentMatch From, TournamentMatch? Winner, TournamentMatch? Loser)> links = [];

        switch (tournament.Format)
        {
            case TournamentFormat.SingleElim:
                links = GenerateSingleElim(tournament, participants);
                break;
            case TournamentFormat.DoubleElim:
                links = GenerateDoubleElim(tournament, participants);
                break;
            case TournamentFormat.Swiss:
                GenerateSwissRound1(tournament, participants);
                break;
            case TournamentFormat.TimeTrial:
                break;
        }

        // Phase 1: insert all matches → DB assigns IDs
        await db.SaveChangesAsync();

        // Phase 2: wire FK links now that IDs exist
        foreach (var (from, winDest, loseDest) in links)
        {
            from.NextWinnerMatchId = winDest?.Id;
            // WB bye matches produce no loser; don't link them to LB
            from.NextLoserMatchId = (!from.IsBye) ? loseDest?.Id : null;
        }

        // Phase 3: resolve void/single-player LB slots caused by WB R1 byes
        AutoResolveByes(tournament);

        tournament.Status = TournamentStatus.InProgress;
        await db.SaveChangesAsync();
    }

    // Records a match result and advances the bracket.
    public async Task<TournamentMatch> RecordResultAsync(TournamentMatch match, int player1Sets, int player2Sets)
    {
        if (match.Player1Id is null || match.Player2Id is null)
            throw new InvalidOperationException("Both players must be set before recording a result.");
        if (player1Sets == player2Sets)
            throw new ArgumentException("Sets cannot be tied — one player must win more sets.");

        int winnerId = player1Sets > player2Sets ? match.Player1Id.Value : match.Player2Id.Value;
        int loserId  = player1Sets > player2Sets ? match.Player2Id.Value : match.Player1Id.Value;

        match.Player1Sets = player1Sets;
        match.Player2Sets = player2Sets;
        match.WinnerId = winnerId;

        var tournament = await db.Tournaments
            .Include(t => t.Matches)
            .Include(t => t.Participants)
            .FirstAsync(t => t.Id == match.TournamentId);

        var wp = tournament.Participants.First(p => p.PlayerId == winnerId);
        var lp = tournament.Participants.First(p => p.PlayerId == loserId);
        wp.Wins++; wp.Points += 1;
        lp.Losses++;

        if (tournament.Format == TournamentFormat.Swiss)
            await AdvanceSwiss(tournament, match);
        else
        {
            AdvanceElim(tournament, match, winnerId, loserId);
            AutoResolveByes(tournament);
        }

        tournament.Status = IsTournamentComplete(tournament)
            ? TournamentStatus.Completed
            : TournamentStatus.InProgress;

        await db.SaveChangesAsync();
        return match;
    }

    // ── Single Elimination ───────────────────────────────────────────────────

    private static List<(TournamentMatch, TournamentMatch?, TournamentMatch?)> GenerateSingleElim(
        Tournament t, List<TournamentParticipant> seeds)
    {
        int size = NextPow2(seeds.Count);
        var slots = BuildSeededSlots(seeds, size);
        var links = new List<(TournamentMatch, TournamentMatch?, TournamentMatch?)>();

        var round1 = new List<TournamentMatch>();
        for (int i = 0; i < size / 2; i++)
        {
            var m = new TournamentMatch
            {
                TournamentId = t.Id,
                Round = 1,
                MatchNumber = i + 1,
                Bracket = MatchBracket.Winners,
                Player1Id = slots[i * 2]?.PlayerId,
                Player2Id = slots[i * 2 + 1]?.PlayerId,
                IsBye = slots[i * 2] is null || slots[i * 2 + 1] is null,
            };
            if (m.IsBye)
            {
                m.WinnerId = m.Player1Id ?? m.Player2Id;
                m.Player1Sets = m.Player1Id.HasValue ? 1 : 0;
                m.Player2Sets = m.Player2Id.HasValue ? 0 : 1;
            }
            t.Matches.Add(m);
            round1.Add(m);
        }

        BuildSingleElimLinks(t, round1, links);
        return links;
    }

    private static void BuildSingleElimLinks(
        Tournament t,
        List<TournamentMatch> prevRound,
        List<(TournamentMatch, TournamentMatch?, TournamentMatch?)> links)
    {
        if (prevRound.Count == 1) return;

        int nextRoundNum = prevRound[0].Round + 1;
        var nextRound = new List<TournamentMatch>();

        for (int i = 0; i < prevRound.Count / 2; i++)
        {
            var next = new TournamentMatch
            {
                TournamentId = t.Id,
                Round = nextRoundNum,
                MatchNumber = i + 1,
                Bracket = MatchBracket.Winners,
            };

            // Pre-fill any bye winners from previous round
            var left  = prevRound[i * 2];
            var right = prevRound[i * 2 + 1];
            if (left.WinnerId.HasValue)  SetNextPlayer(next, left.WinnerId.Value);
            if (right.WinnerId.HasValue) SetNextPlayer(next, right.WinnerId.Value);

            t.Matches.Add(next);
            nextRound.Add(next);

            // Record link — IDs resolved after SaveChanges
            links.Add((left,  next, null));
            links.Add((right, next, null));
        }

        BuildSingleElimLinks(t, nextRound, links);
    }

    // ── Double Elimination ───────────────────────────────────────────────────

    private static List<(TournamentMatch, TournamentMatch?, TournamentMatch?)> GenerateDoubleElim(
        Tournament t, List<TournamentParticipant> seeds)
    {
        int size = NextPow2(seeds.Count);
        var slots = BuildSeededSlots(seeds, size);
        var links = new List<(TournamentMatch, TournamentMatch?, TournamentMatch?)>();

        // ── Winners bracket round 1
        var wbR1 = new List<TournamentMatch>();
        for (int i = 0; i < size / 2; i++)
        {
            var m = new TournamentMatch
            {
                TournamentId = t.Id,
                Round = 1,
                MatchNumber = i + 1,
                Bracket = MatchBracket.Winners,
                Player1Id = slots[i * 2]?.PlayerId,
                Player2Id = slots[i * 2 + 1]?.PlayerId,
                IsBye = slots[i * 2] is null || slots[i * 2 + 1] is null,
            };
            if (m.IsBye)
            {
                m.WinnerId = m.Player1Id ?? m.Player2Id;
                m.Player1Sets = m.Player1Id.HasValue ? 1 : 0;
                m.Player2Sets = m.Player2Id.HasValue ? 0 : 1;
            }
            t.Matches.Add(m);
            wbR1.Add(m);
        }

        int wbRounds = (int)Math.Log2(size);

        // ── Build all WB rounds
        var wbAll = new List<List<TournamentMatch>> { wbR1 };
        for (int r = 1; r < wbRounds; r++)
        {
            var prev = wbAll[r - 1];
            var next = new List<TournamentMatch>();
            for (int i = 0; i < prev.Count / 2; i++)
            {
                var m = new TournamentMatch
                {
                    TournamentId = t.Id,
                    Round = r + 1,
                    MatchNumber = i + 1,
                    Bracket = MatchBracket.Winners,
                };
                t.Matches.Add(m);
                next.Add(m);
            }
            wbAll.Add(next);
        }

        // ── Build all LB rounds: 2*(wbRounds-1) rounds
        // LB round 1 receives losers from WB round 1
        // LB odd rounds: receive WB losers drop-in (same count as previous LB round)
        // LB even rounds: LB vs LB (halves the count)
        var lbAll = new List<List<TournamentMatch>>();
        int lbCount = wbR1.Count / 2; // LB R1 match count
        for (int r = 0; r < 2 * (wbRounds - 1); r++)
        {
            var round = new List<TournamentMatch>();
            for (int i = 0; i < lbCount; i++)
            {
                var m = new TournamentMatch
                {
                    TournamentId = t.Id,
                    Round = r + 1,
                    MatchNumber = i + 1,
                    Bracket = MatchBracket.Losers,
                };
                t.Matches.Add(m);
                round.Add(m);
            }
            lbAll.Add(round);
            if (r % 2 == 1 && lbCount > 1) lbCount /= 2; // halve on even LB rounds
        }

        // ── Grand Final
        var gf = new TournamentMatch
        {
            TournamentId = t.Id,
            Round = 1,
            MatchNumber = 1,
            Bracket = MatchBracket.GrandFinal,
        };
        t.Matches.Add(gf);

        // Pre-fill bye winners from WB R1 into WB R2 (only when WB has >1 round)
        if (wbAll.Count > 1)
        {
            for (int i = 0; i < wbR1.Count / 2; i++)
            {
                var left  = wbR1[i * 2];
                var right = wbR1[i * 2 + 1];
                var next  = wbAll[1][i];
                if (left.WinnerId.HasValue)  SetNextPlayer(next, left.WinnerId.Value);
                if (right.WinnerId.HasValue) SetNextPlayer(next, right.WinnerId.Value);
            }
        }

        // ── WB links: winner → next WB round, loser → LB
        // WB R1 losers go to lbAll[0]; WB Rx (x≥2) losers go to lbAll[2x-3] (0-indexed: lbAll[2*r-1])
        // WB R1 has 2 losers per LB match (i/2); WB R2+ has 1 loser per LB match (i)
        for (int r = 0; r < wbRounds - 1; r++)
        {
            var cur    = wbAll[r];
            var nextWb = wbAll[r + 1];
            int lbDropIdx = r == 0 ? 0 : 2 * r - 1;
            var lbDrop = lbAll[lbDropIdx];
            for (int i = 0; i < cur.Count; i++)
            {
                var lbTarget = r == 0 ? lbDrop[i / 2] : lbDrop[i];
                links.Add((cur[i], nextWb[i / 2], lbTarget));
            }
        }
        if (lbAll.Count > 0)
        {
            // WB final winner → GF; WB final loser → LB final
            links.Add((wbAll[^1][0], gf, lbAll[^1][0]));

            // ── LB internal links: winner → next LB round
            // Even-indexed LB rounds feed into same-size rounds (1-to-1: next[i])
            // Odd-indexed LB rounds feed into halved rounds (2-to-1: next[i/2])
            for (int r = 0; r < lbAll.Count - 1; r++)
            {
                var cur  = lbAll[r];
                var next = lbAll[r + 1];
                for (int i = 0; i < cur.Count; i++)
                {
                    var target = r % 2 == 0 ? next[i] : next[i / 2];
                    links.Add((cur[i], target, null));
                }
            }
            // LB final → GF
            links.Add((lbAll[^1][0], gf, null));
        }
        else
        {
            // 2-player edge case: no LB rounds, WB loser goes directly to GF
            links.Add((wbAll[^1][0], gf, gf));
        }

        return links;
    }

    // ── Swiss ────────────────────────────────────────────────────────────────

    private static void GenerateSwissRound1(Tournament t, List<TournamentParticipant> seeds)
    {
        var shuffled = seeds.OrderBy(_ => Random.Shared.Next()).ToList();
        for (int i = 0; i < shuffled.Count / 2; i++)
        {
            t.Matches.Add(new TournamentMatch
            {
                TournamentId = t.Id,
                Round = 1,
                MatchNumber = i + 1,
                Player1Id = shuffled[i * 2].PlayerId,
                Player2Id = shuffled[i * 2 + 1].PlayerId,
            });
        }
        if (shuffled.Count % 2 == 1)
        {
            var byePlayer = shuffled[^1];
            t.Matches.Add(new TournamentMatch
            {
                TournamentId = t.Id,
                Round = 1,
                MatchNumber = shuffled.Count / 2 + 1,
                Player1Id = byePlayer.PlayerId,
                IsBye = true,
                WinnerId = byePlayer.PlayerId,
                Player1Sets = 1,
                Player2Sets = 0,
            });
        }
    }

    private async Task AdvanceSwiss(Tournament tournament, TournamentMatch completedMatch)
    {
        int currentRound = completedMatch.Round;
        int totalRounds  = tournament.SwissRounds ?? DefaultSwissRounds(tournament.Participants.Count);

        var roundMatches = tournament.Matches.Where(m => m.Round == currentRound).ToList();
        if (!roundMatches.All(m => m.WinnerId.HasValue) || currentRound >= totalRounds) return;

        var participants = tournament.Participants
            .OrderByDescending(p => p.Points)
            .ThenBy(p => p.Seed)
            .ToList();

        var played = tournament.Matches
            .Where(m => m.WinnerId.HasValue && !m.IsBye && m.Player1Id.HasValue && m.Player2Id.HasValue)
            .Select(m => (Math.Min(m.Player1Id!.Value, m.Player2Id!.Value),
                          Math.Max(m.Player1Id!.Value, m.Player2Id!.Value)))
            .ToHashSet();

        var paired = new HashSet<int>();
        var pairs  = new List<(int, int)>();
        foreach (var p in participants)
        {
            if (paired.Contains(p.PlayerId)) continue;
            var opponent = participants.FirstOrDefault(q =>
                !paired.Contains(q.PlayerId) &&
                q.PlayerId != p.PlayerId &&
                !played.Contains((Math.Min(p.PlayerId, q.PlayerId), Math.Max(p.PlayerId, q.PlayerId))));
            opponent ??= participants.FirstOrDefault(q => !paired.Contains(q.PlayerId) && q.PlayerId != p.PlayerId);
            if (opponent is null) continue;
            pairs.Add((p.PlayerId, opponent.PlayerId));
            paired.Add(p.PlayerId);
            paired.Add(opponent.PlayerId);
        }

        int nextRound = currentRound + 1;
        for (int i = 0; i < pairs.Count; i++)
        {
            tournament.Matches.Add(new TournamentMatch
            {
                TournamentId = tournament.Id,
                Round = nextRound,
                MatchNumber = i + 1,
                Player1Id = pairs[i].Item1,
                Player2Id = pairs[i].Item2,
            });
        }

        var unpairedPlayer = participants.FirstOrDefault(p => !paired.Contains(p.PlayerId));
        if (unpairedPlayer is not null)
        {
            var wp = tournament.Participants.First(p => p.PlayerId == unpairedPlayer.PlayerId);
            wp.Wins++; wp.Points += 1;
            tournament.Matches.Add(new TournamentMatch
            {
                TournamentId = tournament.Id,
                Round = nextRound,
                MatchNumber = pairs.Count + 1,
                Player1Id = unpairedPlayer.PlayerId,
                IsBye = true,
                WinnerId = unpairedPlayer.PlayerId,
                Player1Sets = 1,
                Player2Sets = 0,
            });
        }
    }

    // ── Elim Advancement ─────────────────────────────────────────────────────

    private static void AdvanceElim(Tournament tournament, TournamentMatch match, int winnerId, int loserId)
    {
        if (match.NextWinnerMatchId.HasValue)
        {
            var next = tournament.Matches.First(m => m.Id == match.NextWinnerMatchId.Value);
            SetNextPlayer(next, winnerId);
        }
        if (match.NextLoserMatchId.HasValue)
        {
            var next = tournament.Matches.First(m => m.Id == match.NextLoserMatchId.Value);
            SetNextPlayer(next, loserId);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    // Void match: IsBye with no players (both WB feeder matches were byes, so no real loser arrived).
    private static bool IsVoid(TournamentMatch m) =>
        m.IsBye && !m.Player1Id.HasValue && !m.Player2Id.HasValue;

    private static bool IsResolved(TournamentMatch m) =>
        m.WinnerId.HasValue || IsVoid(m);

    // After recording results or wiring links, some LB slots may never receive both players
    // because WB bye matches produce no loser. Detect and fix:
    //   • Void matches (0 players, no source can arrive) → mark IsBye, leave WinnerId null
    //   • Single-player matches (1 player, no more can arrive) → auto-advance as bye
    private static void AutoResolveByes(Tournament tournament)
    {
        var matches = tournament.Matches.ToList();
        bool changed = true;

        while (changed)
        {
            changed = false;
            foreach (var m in matches.Where(x => !IsResolved(x)))
            {
                // Both players already known → real match, never auto-resolve
                if (m.Player1Id.HasValue && m.Player2Id.HasValue) continue;

                var sources = matches.Where(s =>
                    s.NextWinnerMatchId == m.Id || s.NextLoserMatchId == m.Id).ToList();

                if (sources.Any(s => !IsResolved(s))) continue; // still expecting a player

                // No open source — determine what we have
                if (!m.Player1Id.HasValue && !m.Player2Id.HasValue)
                {
                    // Void: no players will ever arrive
                    m.IsBye = true;
                    // WinnerId stays null; IsVoid() recognises this state
                }
                else
                {
                    // Single player: auto-advance as bye
                    m.IsBye    = true;
                    m.WinnerId = m.Player1Id ?? m.Player2Id;
                    m.Player1Sets = m.Player1Id.HasValue ? 1 : 0;
                    m.Player2Sets = m.Player2Id.HasValue ? 1 : 0;

                    if (m.NextWinnerMatchId.HasValue)
                    {
                        var next = matches.First(x => x.Id == m.NextWinnerMatchId.Value);
                        SetNextPlayer(next, m.WinnerId!.Value);
                    }
                    // LB matches never have NextLoserMatchId; losers are eliminated
                }
                changed = true;
            }
        }
    }

    private static bool IsTournamentComplete(Tournament t) =>
        t.Format != TournamentFormat.TimeTrial && t.Matches.All(m => IsResolved(m));

    private static void SetNextPlayer(TournamentMatch match, int playerId)
    {
        if (!match.Player1Id.HasValue) match.Player1Id = playerId;
        else if (!match.Player2Id.HasValue) match.Player2Id = playerId;
    }

    private static int NextPow2(int n)
    {
        int p = 1;
        while (p < n) p <<= 1;
        return p;
    }

    private static List<TournamentParticipant?> BuildSeededSlots(List<TournamentParticipant> seeds, int size)
    {
        // Pairs are ordered so adjacent pairs feed into the same next-round match.
        // Top seeds always get the "s1" slot (never null), byes only appear as "s2".
        var pairs = GetSeedPairings(size);
        var slots = new TournamentParticipant?[size];
        for (int i = 0; i < pairs.Count; i++)
        {
            var (s1, s2) = pairs[i];
            slots[i * 2]     = s1 <= seeds.Count ? seeds[s1 - 1] : null;
            slots[i * 2 + 1] = s2 <= seeds.Count ? seeds[s2 - 1] : null;
        }
        return [.. slots];
    }

    // Returns (seed1, seed2) pairs in bracket order for round 1.
    // Produces standard seeding: 1v(size), 4v(size-3), 2v(size-1), 3v(size-2), ...
    // Guarantees: seed1 ≤ size/2 so Player1 is never a bye; byes only fall on Player2.
    private static List<(int, int)> GetSeedPairings(int size)
    {
        if (size == 2) return [(1, 2)];
        var half = GetSeedPairings(size / 2);
        var result = new List<(int, int)>(half.Count * 2);
        foreach (var (s1, s2) in half)
        {
            result.Add((s1, size + 1 - s1));
            result.Add((s2, size + 1 - s2));
        }
        return result;
    }

    public static int DefaultSwissRounds(int playerCount) =>
        Math.Max(3, (int)Math.Ceiling(Math.Log2(playerCount)) + 1);
}
