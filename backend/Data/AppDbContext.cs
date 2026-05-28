using Microsoft.EntityFrameworkCore;
using TableTennis.Api.Models;

namespace TableTennis.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Player> Players => Set<Player>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<Tournament> Tournaments => Set<Tournament>();
    public DbSet<TournamentParticipant> TournamentParticipants => Set<TournamentParticipant>();
    public DbSet<TournamentMatch> TournamentMatches => Set<TournamentMatch>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Game>()
            .HasOne(g => g.Winner)
            .WithMany(p => p.GamesAsWinner)
            .HasForeignKey(g => g.WinnerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Game>()
            .HasOne(g => g.Loser)
            .WithMany(p => p.GamesAsLoser)
            .HasForeignKey(g => g.LoserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Player>()
            .HasIndex(p => p.Name)
            .IsUnique();

        modelBuilder.Entity<TournamentParticipant>()
            .HasOne(tp => tp.Player)
            .WithMany()
            .HasForeignKey(tp => tp.PlayerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TournamentMatch>()
            .HasOne(m => m.Player1)
            .WithMany()
            .HasForeignKey(m => m.Player1Id)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TournamentMatch>()
            .HasOne(m => m.Player2)
            .WithMany()
            .HasForeignKey(m => m.Player2Id)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TournamentMatch>()
            .HasOne(m => m.Winner)
            .WithMany()
            .HasForeignKey(m => m.WinnerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TournamentMatch>()
            .HasOne<TournamentMatch>()
            .WithMany()
            .HasForeignKey(m => m.NextWinnerMatchId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TournamentMatch>()
            .HasOne<TournamentMatch>()
            .WithMany()
            .HasForeignKey(m => m.NextLoserMatchId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Tournament>()
            .Property(t => t.Format)
            .HasConversion<string>();

        modelBuilder.Entity<Tournament>()
            .Property(t => t.Status)
            .HasConversion<string>();

        modelBuilder.Entity<TournamentMatch>()
            .Property(m => m.Bracket)
            .HasConversion<string>();
    }
}
