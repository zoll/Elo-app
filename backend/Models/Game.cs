namespace TableTennis.Api.Models;

public class Game
{
    public int Id { get; set; }
    public int WinnerId { get; set; }
    public int LoserId { get; set; }
    public int WinnerEloBefore { get; set; }
    public int LoserEloBefore { get; set; }
    public int WinnerEloAfter { get; set; }
    public int LoserEloAfter { get; set; }
    public int WinnerSets { get; set; }
    public int LoserSets { get; set; }
    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;

    public Player Winner { get; set; } = null!;
    public Player Loser { get; set; } = null!;
}
