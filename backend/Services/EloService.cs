namespace TableTennis.Api.Services;

public class EloService
{
    private const int K = 32;

    public (int newWinnerRating, int newLoserRating) Calculate(int winnerRating, int loserRating)
    {
        double expected = 1.0 / (1.0 + Math.Pow(10, (loserRating - winnerRating) / 400.0));
        int newWinner = (int)Math.Round(winnerRating + K * (1 - expected));
        int newLoser = (int)Math.Round(loserRating + K * (0 - (1 - expected)));
        return (newWinner, newLoser);
    }
}
