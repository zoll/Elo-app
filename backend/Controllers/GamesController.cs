using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TableTennis.Api.Data;
using TableTennis.Api.Models;
using TableTennis.Api.Services;

namespace TableTennis.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GamesController(AppDbContext db, EloService elo) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetRecent([FromQuery] int limit = 50)
    {
        var games = await db.Games
            .Include(g => g.Winner)
            .Include(g => g.Loser)
            .OrderByDescending(g => g.PlayedAt)
            .Take(Math.Min(limit, 200))
            .Select(g => new
            {
                g.Id,
                g.PlayedAt,
                Winner = g.Winner.Name,
                WinnerId = g.WinnerId,
                Loser = g.Loser.Name,
                LoserId = g.LoserId,
                g.WinnerEloBefore,
                g.LoserEloBefore,
                g.WinnerEloAfter,
                g.LoserEloAfter,
                WinnerEloChange = g.WinnerEloAfter - g.WinnerEloBefore,
                LoserEloChange = g.LoserEloAfter - g.LoserEloBefore,
                g.WinnerSets,
                g.LoserSets
            })
            .ToListAsync();

        return Ok(games);
    }

    [HttpPost]
    public async Task<IActionResult> Record([FromBody] RecordGameRequest req)
    {
        if (req.WinnerId == req.LoserId)
            return BadRequest("Winner and loser must be different players.");
        if (req.WinnerSets <= 0 || req.LoserSets < 0)
            return BadRequest("Set counts must be positive for the winner and non-negative for the loser.");
        if (req.WinnerSets <= req.LoserSets)
            return BadRequest("Winner must have more sets than the loser.");

        var winner = await db.Players.FindAsync(req.WinnerId);
        var loser = await db.Players.FindAsync(req.LoserId);

        if (winner is null || loser is null)
            return NotFound("One or both players not found.");

        var (newWinnerRating, newLoserRating) = elo.Calculate(winner.EloRating, loser.EloRating);

        var game = new Game
        {
            WinnerId = winner.Id,
            LoserId = loser.Id,
            WinnerEloBefore = winner.EloRating,
            LoserEloBefore = loser.EloRating,
            WinnerEloAfter = newWinnerRating,
            LoserEloAfter = newLoserRating,
            WinnerSets = req.WinnerSets,
            LoserSets = req.LoserSets
        };

        winner.EloRating = newWinnerRating;
        winner.GamesWon++;
        loser.EloRating = newLoserRating;
        loser.GamesLost++;

        db.Games.Add(game);
        await db.SaveChangesAsync();

        return Ok(new
        {
            game.Id,
            game.PlayedAt,
            Winner = winner.Name,
            WinnerId = winner.Id,
            Loser = loser.Name,
            LoserId = loser.Id,
            game.WinnerEloBefore,
            game.LoserEloBefore,
            WinnerEloAfter = newWinnerRating,
            LoserEloAfter = newLoserRating,
            WinnerEloChange = newWinnerRating - game.WinnerEloBefore,
            LoserEloChange = newLoserRating - game.LoserEloBefore,
            game.WinnerSets,
            game.LoserSets
        });
    }
}

public record RecordGameRequest(int WinnerId, int LoserId, int WinnerSets, int LoserSets);
