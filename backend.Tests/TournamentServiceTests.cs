using Microsoft.EntityFrameworkCore;
using TableTennis.Api.Data;
using TableTennis.Api.Models;
using TableTennis.Api.Services;

namespace TableTennis.Tests;

public class TournamentServiceTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static AppDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(opts);
    }

    private static async Task<List<Player>> SeedPlayers(AppDbContext db, int count)
    {
        var players = Enumerable.Range(1, count)
            .Select(i => new Player { Name = $"Player {i}" })
            .ToList();
        db.Players.AddRange(players);
        await db.SaveChangesAsync();
        return players;
    }

    // Creates a tournament, seeds participants in order, starts it, and returns the DB id.
    private static async Task<int> CreateTournament(
        AppDbContext db, TournamentService svc,
        List<Player> players, TournamentFormat format)
    {
        var t = new Tournament { Name = "Test", Format = format };
        db.Tournaments.Add(t);
        await db.SaveChangesAsync();

        for (int i = 0; i < players.Count; i++)
            db.TournamentParticipants.Add(new TournamentParticipant
            {
                TournamentId = t.Id,
                PlayerId     = players[i].Id,
                Seed         = i + 1,
            });
        await db.SaveChangesAsync();

        var full = await db.Tournaments
            .Include(x => x.Participants)
            .FirstAsync(x => x.Id == t.Id);
        await svc.StartAsync(full);
        return t.Id;
    }

    private static List<TournamentMatch> GetMatches(AppDbContext db, int tournamentId,
        MatchBracket? bracket = null, int? round = null)
    {
        var q = db.TournamentMatches.Where(m => m.TournamentId == tournamentId);
        if (bracket.HasValue) q = q.Where(m => m.Bracket == bracket);
        if (round.HasValue)   q = q.Where(m => m.Round == round);
        return q.ToList();
    }

    private static bool IsVoid(TournamentMatch m) =>
        m.IsBye && !m.Player1Id.HasValue && !m.Player2Id.HasValue;

    // ── Single Elimination ───────────────────────────────────────────────────

    [Fact]
    public async Task SingleElim_4Players_CorrectMatchCount()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.SingleElim);

        var matches = GetMatches(db, tid);

        // 4 players, no byes needed → R1: 2 matches, Final: 1 = 3 total
        Assert.Equal(3, matches.Count);
        Assert.Equal(2, matches.Count(m => m.Round == 1));
        Assert.Equal(1, matches.Count(m => m.Round == 2));
    }

    [Fact]
    public async Task SingleElim_4Players_NoByes_PowerOf2HasFullR1()
    {
        // 4 is a power of 2: no byes at all, every R1 match has both players
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.SingleElim);

        var matches = GetMatches(db, tid);
        Assert.DoesNotContain(matches, m => m.IsBye);

        var r1 = GetMatches(db, tid, round: 1);
        Assert.All(r1, m =>
        {
            Assert.True(m.Player1Id.HasValue, "R1 Player1 must be set");
            Assert.True(m.Player2Id.HasValue, "R1 Player2 must be set for full bracket");
        });
    }

    [Fact]
    public async Task SingleElim_5Players_TopSeedsGetByes()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 5);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.SingleElim);

        var participants = db.TournamentParticipants
            .Where(p => p.TournamentId == tid)
            .OrderBy(p => p.Seed)
            .ToList();

        var r1 = GetMatches(db, tid, round: 1);
        var realMatches = r1.Where(m => !m.IsBye).ToList();
        var byeMatches  = r1.Where(m => m.IsBye).ToList();

        // 5 players, size=8 → 3 byes, 1 real match
        Assert.Single(realMatches);
        Assert.Equal(3, byeMatches.Count);

        // The only real match must be between seed 4 and seed 5
        int seed4Id = participants[3].PlayerId;
        int seed5Id = participants[4].PlayerId;
        var real = realMatches[0];
        Assert.True(
            (real.Player1Id == seed4Id && real.Player2Id == seed5Id) ||
            (real.Player1Id == seed5Id && real.Player2Id == seed4Id),
            "The only real R1 match must be seed 4 vs seed 5");

        // Byes must all have a real Player1 (top seeds never get null slot)
        Assert.All(byeMatches, m => Assert.True(m.Player1Id.HasValue));
    }

    // ── Double Elimination ───────────────────────────────────────────────────

    [Fact]
    public async Task DoubleElim_5Players_WBR1HasOneRealMatch()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 5);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        var wbR1 = GetMatches(db, tid, bracket: MatchBracket.Winners, round: 1);

        Assert.Equal(1, wbR1.Count(m => !m.IsBye));
        Assert.Equal(3, wbR1.Count(m => m.IsBye));
    }

    [Fact]
    public async Task DoubleElim_5Players_WBR2HasRealMatchBetweenSeed2AndSeed3()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 5);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        var participants = db.TournamentParticipants
            .Where(p => p.TournamentId == tid)
            .OrderBy(p => p.Seed)
            .ToList();

        int seed2Id = participants[1].PlayerId;
        int seed3Id = participants[2].PlayerId;

        var wbR2 = GetMatches(db, tid, bracket: MatchBracket.Winners, round: 2);

        // WB R2 must have a match with both seed2 and seed3 already set (pre-filled from byes)
        // and WinnerId must be null — it's a real match waiting to be played
        var seed2v3 = wbR2.FirstOrDefault(m =>
            (m.Player1Id == seed2Id || m.Player2Id == seed2Id) &&
            (m.Player1Id == seed3Id || m.Player2Id == seed3Id));

        Assert.NotNull(seed2v3);
        Assert.Null(seed2v3.WinnerId); // not auto-resolved
        Assert.False(seed2v3.IsBye);   // not treated as a bye
    }

    [Fact]
    public async Task DoubleElim_5Players_NoTBDvsTBDNonVoidMatches()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 5);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        // WB R1 and R2 are pre-populated at bracket generation; neither should have TBD vs TBD.
        // LB matches legitimately start with no players — they wait for WB losers to arrive.
        var earlyWb = GetMatches(db, tid, bracket: MatchBracket.Winners)
            .Where(m => m.Round <= 2).ToList();
        Assert.DoesNotContain(earlyWb, m =>
            !IsVoid(m) && !m.Player1Id.HasValue && !m.Player2Id.HasValue);
    }

    [Fact]
    public async Task DoubleElim_5Players_LBR1HasExactlyOneVoidMatch()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 5);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        var lbR1 = GetMatches(db, tid, bracket: MatchBracket.Losers, round: 1);

        // LBR1[0]: waiting for loser of Seed4vSeed5 (real match not played yet)
        // LBR1[1]: void — both feeders were WB R1 byes
        Assert.Equal(1, lbR1.Count(IsVoid));
        Assert.Equal(1, lbR1.Count(m => !IsVoid(m)));
    }

    [Fact]
    public async Task DoubleElim_5Players_AfterWBR1Result_LBR1AutoResolvesAndLoserReachesLBR2()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 5);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        // Find the one real WB R1 match (seed4 vs seed5)
        var wbR1Real = GetMatches(db, tid, bracket: MatchBracket.Winners, round: 1)
            .Single(m => !m.IsBye);

        // Record result: Player1 wins
        var matchEntity = await db.TournamentMatches.FindAsync(wbR1Real.Id);
        await svc.RecordResultAsync(matchEntity!, player1Sets: 3, player2Sets: 1);

        // LB R1 non-void match should now be auto-resolved as a bye
        var lbR1NonVoid = GetMatches(db, tid, bracket: MatchBracket.Losers, round: 1)
            .Single(m => !IsVoid(m));

        Assert.True(lbR1NonVoid.IsBye);
        Assert.True(lbR1NonVoid.WinnerId.HasValue);

        // The loser (Player2) should now appear in LB R2
        int loserId = wbR1Real.Player2Id!.Value;
        var lbR2 = GetMatches(db, tid, bracket: MatchBracket.Losers, round: 2);
        bool loserInLbR2 = lbR2.Any(m => m.Player1Id == loserId || m.Player2Id == loserId);
        Assert.True(loserInLbR2, "Loser of WB R1 real match should be placed in LB R2 after auto-bye");
    }

    [Fact]
    public async Task DoubleElim_4Players_FullBracket_NoVoidMatches()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        var matches = GetMatches(db, tid);

        // Power-of-2 count: no WB R1 byes, so no void LB matches
        Assert.DoesNotContain(matches, IsVoid);
    }

    [Fact]
    public async Task DoubleElim_8Players_FullBracket_NoVoidMatches()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 8);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        var matches = GetMatches(db, tid);
        Assert.DoesNotContain(matches, IsVoid);
    }

    [Fact]
    public async Task DoubleElim_4Players_CorrectTotalMatchCount()
    {
        // size=4, wbRounds=2: WB=3, LB=2, GF=1 → 6 total
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        var matches = GetMatches(db, tid);
        Assert.Equal(6, matches.Count);
        Assert.Equal(3, matches.Count(m => m.Bracket == MatchBracket.Winners));
        Assert.Equal(2, matches.Count(m => m.Bracket == MatchBracket.Losers));
        Assert.Equal(1, matches.Count(m => m.Bracket == MatchBracket.GrandFinal));
    }

    [Fact]
    public async Task DoubleElim_8Players_CorrectTotalMatchCount()
    {
        // size=8, wbRounds=3: WB=7, LB=6, GF=1 → 14 total
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 8);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        var matches = GetMatches(db, tid);
        Assert.Equal(14, matches.Count);
        Assert.Equal(7, matches.Count(m => m.Bracket == MatchBracket.Winners));
        Assert.Equal(6, matches.Count(m => m.Bracket == MatchBracket.Losers));
        Assert.Equal(1, matches.Count(m => m.Bracket == MatchBracket.GrandFinal));
    }

    [Fact]
    public async Task DoubleElim_4Players_GrandFinalExistsWithNoPlayersAtStart()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        var gf = GetMatches(db, tid, bracket: MatchBracket.GrandFinal);
        Assert.Single(gf);
        Assert.Null(gf[0].Player1Id);
        Assert.Null(gf[0].Player2Id);
    }

    [Fact]
    public async Task DoubleElim_4Players_AfterWBR1Results_LBR1HasBothLosers()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        foreach (var m in GetMatches(db, tid, bracket: MatchBracket.Winners, round: 1))
        {
            var match = await db.TournamentMatches.FindAsync(m.Id);
            await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 1);
        }

        var lbR1 = GetMatches(db, tid, bracket: MatchBracket.Losers, round: 1);
        Assert.Single(lbR1);
        Assert.True(lbR1[0].Player1Id.HasValue, "LBR1 Player1 should be set after both WBR1 results");
        Assert.True(lbR1[0].Player2Id.HasValue, "LBR1 Player2 should be set after both WBR1 results");
    }

    [Fact]
    public async Task DoubleElim_4Players_WBR1Winner_AdvancesToWBR2()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.DoubleElim);

        var wbR1Match = GetMatches(db, tid, bracket: MatchBracket.Winners, round: 1).First();
        var match = await db.TournamentMatches.FindAsync(wbR1Match.Id);
        await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 1);

        int winnerId = match!.WinnerId!.Value;
        var wbR2 = GetMatches(db, tid, bracket: MatchBracket.Winners, round: 2);
        Assert.Contains(wbR2, m => m.Player1Id == winnerId || m.Player2Id == winnerId);
    }

    // ── Single Elimination (additional) ─────────────────────────────────────

    [Fact]
    public async Task SingleElim_8Players_CorrectMatchCount()
    {
        // 8 players, power-of-2: R1=4, R2=2, R3=1 → 7 total, no byes
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 8);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.SingleElim);

        var matches = GetMatches(db, tid);
        Assert.Equal(7, matches.Count);
        Assert.Equal(4, matches.Count(m => m.Round == 1));
        Assert.Equal(2, matches.Count(m => m.Round == 2));
        Assert.Equal(1, matches.Count(m => m.Round == 3));
        Assert.DoesNotContain(matches, m => m.IsBye);
    }

    [Fact]
    public async Task SingleElim_6Players_TwoByes_InR1()
    {
        // 6 players, size=8: pairings (1,8),(4,5),(2,7),(3,6)
        // Seeds 7 and 8 don't exist → 2 bye matches
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 6);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.SingleElim);

        var r1 = GetMatches(db, tid, round: 1);
        Assert.Equal(4, r1.Count);
        Assert.Equal(2, r1.Count(m => m.IsBye));
        Assert.Equal(2, r1.Count(m => !m.IsBye));
    }

    [Fact]
    public async Task SingleElim_4Players_AfterR1Result_WinnerAppearsInR2()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.SingleElim);

        var r1Match = GetMatches(db, tid, round: 1).First();
        var match = await db.TournamentMatches.FindAsync(r1Match.Id);
        await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 1);

        int winnerId = match!.WinnerId!.Value;
        var r2 = GetMatches(db, tid, round: 2);
        Assert.Contains(r2, m => m.Player1Id == winnerId || m.Player2Id == winnerId);
    }

    [Fact]
    public async Task SingleElim_4Players_AllResults_TournamentCompleted()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.SingleElim);

        foreach (var m in GetMatches(db, tid, round: 1))
        {
            var match = await db.TournamentMatches.FindAsync(m.Id);
            await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 1);
        }
        foreach (var m in GetMatches(db, tid, round: 2))
        {
            var match = await db.TournamentMatches.FindAsync(m.Id);
            await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 1);
        }

        var tournament = await db.Tournaments.FindAsync(tid);
        Assert.Equal(TournamentStatus.Completed, tournament!.Status);
    }

    // ── Swiss ────────────────────────────────────────────────────────────────

    [Fact]
    public void Swiss_DefaultRoundCounts_MatchExpected()
    {
        Assert.Equal(3, TournamentService.DefaultSwissRounds(4));  // max(3, 2+1)
        Assert.Equal(4, TournamentService.DefaultSwissRounds(5));  // max(3, 3+1)
        Assert.Equal(4, TournamentService.DefaultSwissRounds(8));  // max(3, 3+1)
        Assert.Equal(3, TournamentService.DefaultSwissRounds(3));  // max(3, 2+1)
    }

    [Fact]
    public async Task Swiss_4Players_Round1_TwoMatchesNoByes()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.Swiss);

        var r1 = GetMatches(db, tid, round: 1);
        Assert.Equal(2, r1.Count);
        Assert.DoesNotContain(r1, m => m.IsBye);
        Assert.All(r1, m =>
        {
            Assert.True(m.Player1Id.HasValue);
            Assert.True(m.Player2Id.HasValue);
        });
    }

    [Fact]
    public async Task Swiss_5Players_Round1_HasOneBye()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 5);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.Swiss);

        var r1 = GetMatches(db, tid, round: 1);
        Assert.Equal(3, r1.Count);
        Assert.Single(r1, m => m.IsBye);
        Assert.Equal(2, r1.Count(m => !m.IsBye));

        var bye = r1.Single(m => m.IsBye);
        Assert.True(bye.Player1Id.HasValue);
        Assert.True(bye.WinnerId.HasValue);
        Assert.False(bye.Player2Id.HasValue);
    }

    [Fact]
    public async Task Swiss_4Players_PartialR1_DoesNotGenerateR2()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.Swiss);

        // Record only one of the two R1 matches
        var r1 = GetMatches(db, tid, round: 1);
        var first = await db.TournamentMatches.FindAsync(r1[0].Id);
        await svc.RecordResultAsync(first!, player1Sets: 3, player2Sets: 0);

        Assert.Empty(GetMatches(db, tid, round: 2));
    }

    [Fact]
    public async Task Swiss_4Players_AfterAllR1Results_Round2Generated()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.Swiss);

        foreach (var m in GetMatches(db, tid, round: 1))
        {
            var match = await db.TournamentMatches.FindAsync(m.Id);
            await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 0);
        }

        var r2 = GetMatches(db, tid, round: 2);
        Assert.Equal(2, r2.Count);
        Assert.All(r2, m =>
        {
            Assert.True(m.Player1Id.HasValue);
            Assert.True(m.Player2Id.HasValue);
        });
    }

    [Fact]
    public async Task Swiss_4Players_R2AvoidsR1Rematches()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.Swiss);

        var r1 = GetMatches(db, tid, round: 1);
        var r1Pairs = r1.Where(m => !m.IsBye)
            .Select(m => (Math.Min(m.Player1Id!.Value, m.Player2Id!.Value),
                          Math.Max(m.Player1Id!.Value, m.Player2Id!.Value)))
            .ToHashSet();

        foreach (var m in r1)
        {
            var match = await db.TournamentMatches.FindAsync(m.Id);
            await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 0);
        }

        var r2Pairs = GetMatches(db, tid, round: 2).Where(m => !m.IsBye)
            .Select(m => (Math.Min(m.Player1Id!.Value, m.Player2Id!.Value),
                          Math.Max(m.Player1Id!.Value, m.Player2Id!.Value)))
            .ToHashSet();

        Assert.Empty(r1Pairs.Intersect(r2Pairs));
    }

    [Fact]
    public async Task Swiss_RecordResult_UpdatesWinsAndPoints()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.Swiss);

        var r1Match = GetMatches(db, tid, round: 1).First(m => !m.IsBye);
        var match = await db.TournamentMatches.FindAsync(r1Match.Id);
        await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 1);

        var winner = db.TournamentParticipants.First(p => p.TournamentId == tid && p.PlayerId == r1Match.Player1Id!.Value);
        var loser  = db.TournamentParticipants.First(p => p.TournamentId == tid && p.PlayerId == r1Match.Player2Id!.Value);

        Assert.Equal(1, winner.Wins);
        Assert.Equal(1, winner.Points);
        Assert.Equal(0, loser.Wins);
        Assert.Equal(1, loser.Losses);
    }

    [Fact]
    public async Task Swiss_4Players_R2PairsWinnersWithWinners()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.Swiss);

        var r1 = GetMatches(db, tid, round: 1);
        var r1Winners = new HashSet<int>();
        var r1Losers  = new HashSet<int>();
        foreach (var m in r1)
        {
            var match = await db.TournamentMatches.FindAsync(m.Id);
            await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 0);
            r1Winners.Add(m.Player1Id!.Value);
            r1Losers.Add(m.Player2Id!.Value);
        }

        foreach (var m in GetMatches(db, tid, round: 2).Where(x => !x.IsBye))
        {
            bool allWinners = r1Winners.Contains(m.Player1Id!.Value) && r1Winners.Contains(m.Player2Id!.Value);
            bool allLosers  = r1Losers.Contains(m.Player1Id!.Value)  && r1Losers.Contains(m.Player2Id!.Value);
            Assert.True(allWinners || allLosers, "R2 should pair players with the same R1 record");
        }
    }

    [Fact]
    public async Task Swiss_4Players_AllRoundsComplete_StatusIsCompleted()
    {
        using var db = CreateDb();
        var svc = new TournamentService(db);
        var players = await SeedPlayers(db, 4);
        int tid = await CreateTournament(db, svc, players, TournamentFormat.Swiss);

        int totalRounds = TournamentService.DefaultSwissRounds(4); // 3
        for (int round = 1; round <= totalRounds; round++)
        {
            foreach (var m in GetMatches(db, tid, round: round).Where(x => !x.IsBye))
            {
                var match = await db.TournamentMatches.FindAsync(m.Id);
                await svc.RecordResultAsync(match!, player1Sets: 3, player2Sets: 0);
            }
        }

        var tournament = await db.Tournaments.FindAsync(tid);
        Assert.Equal(TournamentStatus.Completed, tournament!.Status);
    }
}
