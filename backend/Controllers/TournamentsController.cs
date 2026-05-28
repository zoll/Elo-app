using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TableTennis.Api.Data;
using TableTennis.Api.Models;
using TableTennis.Api.Services;

namespace TableTennis.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TournamentsController(AppDbContext db, TournamentService svc) : ControllerBase
{
    // GET /api/tournaments
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var tournaments = await db.Tournaments
            .Include(t => t.Matches).ThenInclude(m => m.Winner)
            .Include(t => t.Participants).ThenInclude(p => p.Player)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        var list = tournaments.Select(t => new
        {
            t.Id, t.Name, t.Format, t.Status, t.SwissRounds, t.CreatedAt,
            PlayerCount = t.Participants.Count,
            WinnerName = GetWinnerName(t),
        });
        return Ok(list);
    }

    private static string? GetWinnerName(Tournament t)
    {
        if (t.Status != TournamentStatus.Completed) return null;
        return t.Format switch
        {
            TournamentFormat.DoubleElim =>
                t.Matches.FirstOrDefault(m => m.Bracket == MatchBracket.GrandFinal)?.Winner?.Name,
            TournamentFormat.SingleElim =>
                t.Matches.OrderByDescending(m => m.Round).FirstOrDefault(m => m.WinnerId.HasValue)?.Winner?.Name,
            TournamentFormat.Swiss =>
                t.Participants.OrderByDescending(p => p.Points).ThenByDescending(p => p.Wins).FirstOrDefault()?.Player?.Name,
            _ => null,
        };
    }

    // POST /api/tournaments
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTournamentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("Name is required.");

        var t = new Tournament
        {
            Name = req.Name.Trim(),
            Format = req.Format,
            Status = TournamentStatus.Pending,
        };
        db.Tournaments.Add(t);
        await db.SaveChangesAsync();
        return Ok(await GetDetailDto(t.Id));
    }

    // POST /api/tournaments/{id}/participants
    [HttpPost("{id}/participants")]
    public async Task<IActionResult> AddParticipant(int id, [FromBody] AddParticipantRequest req)
    {
        var t = await db.Tournaments.Include(x => x.Participants).FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();
        if (t.Status != TournamentStatus.Pending) return BadRequest("Tournament has already started.");
        if (t.Participants.Any(p => p.PlayerId == req.PlayerId)) return BadRequest("Player is already registered.");
        if (await db.Players.FindAsync(req.PlayerId) is null) return NotFound("Player not found.");

        db.TournamentParticipants.Add(new TournamentParticipant
        {
            TournamentId = id,
            PlayerId = req.PlayerId,
            Seed = t.Participants.Count + 1,
        });
        await db.SaveChangesAsync();
        return Ok(await GetDetailDto(id));
    }

    // DELETE /api/tournaments/{id}/participants/{playerId}
    [HttpDelete("{id}/participants/{playerId}")]
    public async Task<IActionResult> RemoveParticipant(int id, int playerId)
    {
        var t = await db.Tournaments.Include(x => x.Participants).FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();
        if (t.Status != TournamentStatus.Pending) return BadRequest("Tournament has already started.");
        var participant = t.Participants.FirstOrDefault(p => p.PlayerId == playerId);
        if (participant is null) return NotFound("Player not registered.");

        db.TournamentParticipants.Remove(participant);
        await db.SaveChangesAsync();

        // Re-number seeds so they stay sequential
        var remaining = await db.TournamentParticipants
            .Where(p => p.TournamentId == id).OrderBy(p => p.Seed).ToListAsync();
        for (int i = 0; i < remaining.Count; i++) remaining[i].Seed = i + 1;
        await db.SaveChangesAsync();

        return Ok(await GetDetailDto(id));
    }

    // POST /api/tournaments/{id}/start
    [HttpPost("{id}/start")]
    public async Task<IActionResult> StartTournament(int id)
    {
        var t = await db.Tournaments.Include(x => x.Participants).FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return NotFound();
        if (t.Status != TournamentStatus.Pending) return BadRequest("Tournament has already started.");
        if (t.Participants.Count < 2) return BadRequest("At least 2 players must be registered.");

        if (t.Format == TournamentFormat.Swiss)
            t.SwissRounds = TournamentService.DefaultSwissRounds(t.Participants.Count);

        await svc.StartAsync(t);
        return Ok(await GetDetailDto(id));
    }

    // GET /api/tournaments/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var dto = await GetDetailDto(id);
        return dto is null ? NotFound() : Ok(dto);
    }

    // POST /api/tournaments/{id}/matches/{matchId}/result
    [HttpPost("{id}/matches/{matchId}/result")]
    public async Task<IActionResult> RecordResult(int id, int matchId, [FromBody] MatchResultRequest req)
    {
        var match = await db.TournamentMatches
            .FirstOrDefaultAsync(m => m.Id == matchId && m.TournamentId == id);
        if (match is null) return NotFound();
        if (match.WinnerId.HasValue) return BadRequest("Result already recorded.");
        if (match.IsBye) return BadRequest("Cannot record a result for a bye.");
        if (match.Player1Id is null || match.Player2Id is null)
            return BadRequest("Match players are not yet determined.");

        try
        {
            await svc.RecordResultAsync(match, req.Player1Sets, req.Player2Sets);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }

        return Ok(await GetDetailDto(id));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<object?> GetDetailDto(int id)
    {
        var t = await db.Tournaments
            .Include(x => x.Participants).ThenInclude(p => p.Player)
            .Include(x => x.Matches).ThenInclude(m => m.Player1)
            .Include(x => x.Matches).ThenInclude(m => m.Player2)
            .Include(x => x.Matches).ThenInclude(m => m.Winner)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return null;

        return new
        {
            t.Id, t.Name,
            t.Format,
            t.Status,
            t.SwissRounds,
            t.CreatedAt,
            Participants = t.Participants
                .OrderBy(p => p.Seed)
                .Select(p => new
                {
                    p.Id, p.Seed, p.Wins, p.Losses, p.Points,
                    PlayerId = p.PlayerId,
                    PlayerName = p.Player.Name,
                }),
            Matches = t.Matches
                .OrderBy(m => m.Bracket.HasValue ? (int)m.Bracket : -1)
                .ThenBy(m => m.Round)
                .ThenBy(m => m.MatchNumber)
                .Select(m => new
                {
                    m.Id, m.Round, m.MatchNumber,
                    m.Bracket,
                    m.Player1Id, Player1Name = m.Player1?.Name,
                    m.Player2Id, Player2Name = m.Player2?.Name,
                    m.WinnerId, WinnerName = m.Winner?.Name,
                    m.Player1Sets, m.Player2Sets,
                    m.IsBye,
                    m.NextWinnerMatchId, m.NextLoserMatchId,
                }),
        };
    }
}

public record CreateTournamentRequest(string Name, TournamentFormat Format);
public record AddParticipantRequest(int PlayerId);
public record MatchResultRequest(int Player1Sets, int Player2Sets);
