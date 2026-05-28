namespace TableTennis.Api.Models;

public class Player
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int EloRating { get; set; } = 1000;
    public int GamesWon { get; set; }
    public int GamesLost { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Game> GamesAsWinner { get; set; } = new List<Game>();
    public ICollection<Game> GamesAsLoser { get; set; } = new List<Game>();
}
