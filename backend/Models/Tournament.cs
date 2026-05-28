namespace TableTennis.Api.Models;

public enum TournamentFormat { SingleElim, DoubleElim, Swiss }
public enum TournamentStatus { Pending, InProgress, Completed }
public enum MatchBracket { Winners, Losers, GrandFinal }

public class Tournament
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public TournamentFormat Format { get; set; }
    public TournamentStatus Status { get; set; } = TournamentStatus.Pending;
    public int? SwissRounds { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TournamentParticipant> Participants { get; set; } = new List<TournamentParticipant>();
    public ICollection<TournamentMatch> Matches { get; set; } = new List<TournamentMatch>();
}

public class TournamentParticipant
{
    public int Id { get; set; }
    public int TournamentId { get; set; }
    public int PlayerId { get; set; }
    public int Seed { get; set; }
    public int Wins { get; set; }
    public int Losses { get; set; }
    public decimal Points { get; set; }

    public Tournament Tournament { get; set; } = null!;
    public Player Player { get; set; } = null!;
}

public class TournamentMatch
{
    public int Id { get; set; }
    public int TournamentId { get; set; }
    public int Round { get; set; }
    public int MatchNumber { get; set; }
    public MatchBracket? Bracket { get; set; }
    public int? Player1Id { get; set; }
    public int? Player2Id { get; set; }
    public int? WinnerId { get; set; }
    public int? Player1Sets { get; set; }
    public int? Player2Sets { get; set; }
    public bool IsBye { get; set; }
    public int? NextWinnerMatchId { get; set; }
    public int? NextLoserMatchId { get; set; }

    public Tournament Tournament { get; set; } = null!;
    public Player? Player1 { get; set; }
    public Player? Player2 { get; set; }
    public Player? Winner { get; set; }
}
