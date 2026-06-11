using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TableTennis.Api.Data;
using TableTennis.Api.Models;

namespace TableTennis.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PlayersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var players = await db.Players
            .OrderByDescending(p => p.EloRating)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.EloRating,
                p.GamesWon,
                p.GamesLost,
                GamesPlayed = p.GamesWon + p.GamesLost,
                WinRate = (p.GamesWon + p.GamesLost) == 0
                    ? 0.0
                    : Math.Round((double)p.GamesWon / (p.GamesWon + p.GamesLost) * 100, 1),
                p.CreatedAt
            })
            .ToListAsync();

        return Ok(players);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var player = await db.Players
            .Include(p => p.GamesAsWinner).ThenInclude(g => g.Loser)
            .Include(p => p.GamesAsLoser).ThenInclude(g => g.Winner)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (player is null) return NotFound();

        var games = player.GamesAsWinner
            .Select(g => new
            {
                g.Id,
                g.PlayedAt,
                IsWin = true,
                Opponent = g.Loser.Name,
                OpponentId = g.LoserId,
                MySets = g.WinnerSets,
                OpponentSets = g.LoserSets,
                EloBefore = g.WinnerEloBefore,
                EloAfter = g.WinnerEloAfter,
                EloChange = g.WinnerEloAfter - g.WinnerEloBefore
            })
            .Cast<object>()
            .Concat(player.GamesAsLoser
                .Select(g => new
                {
                    g.Id,
                    g.PlayedAt,
                    IsWin = false,
                    Opponent = g.Winner.Name,
                    OpponentId = g.WinnerId,
                    MySets = g.LoserSets,
                    OpponentSets = g.WinnerSets,
                    EloBefore = g.LoserEloBefore,
                    EloAfter = g.LoserEloAfter,
                    EloChange = g.LoserEloAfter - g.LoserEloBefore
                }))
            .OrderByDescending(g => ((dynamic)g).PlayedAt)
            .ToList();

        return Ok(new
        {
            player.Id,
            player.Name,
            player.EloRating,
            player.GamesWon,
            player.GamesLost,
            player.CreatedAt,
            Games = games
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePlayerRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("Name is required.");

        if (await db.Players.AnyAsync(p => p.Name == req.Name.Trim()))
            return Conflict("A player with this name already exists.");

        var player = new Player { Name = req.Name.Trim() };
        db.Players.Add(player);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = player.Id }, new
        {
            player.Id,
            player.Name,
            player.EloRating,
            player.GamesWon,
            player.GamesLost,
            player.CreatedAt
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var player = await db.Players
            .Include(p => p.GamesAsWinner)
            .Include(p => p.GamesAsLoser)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (player is null) return NotFound();
        if (player.GamesAsWinner.Count != 0 || player.GamesAsLoser.Count != 0)
            return Conflict("Cannot delete a player who has played games.");

        db.Players.Remove(player);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public record CreatePlayerRequest(string Name);
