-- Migration: Add tournament tables
-- Safe to run against an existing database — uses IF NOT EXISTS so it won't
-- touch Players or Games, and won't error if run a second time.
--
-- Run with:
--   mysql -u root -p tabletennis < database/migrate_add_tournaments.sql
-- Or paste into MySQL Workbench / DBeaver with `tabletennis` selected.

USE tabletennis;

-- ── Tournaments ──────────────────────────────────────────────────────────────
-- Format: 'SingleElim' | 'DoubleElim' | 'Swiss'
-- Status: 'Pending' | 'InProgress' | 'Completed'

CREATE TABLE IF NOT EXISTS Tournaments (
    Id          INT          AUTO_INCREMENT PRIMARY KEY,
    Name        VARCHAR(100) NOT NULL,
    Format      VARCHAR(20)  NOT NULL,
    Status      VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    SwissRounds INT          NULL,
    CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── TournamentParticipants ───────────────────────────────────────────────────
-- One row per player per tournament. Seed is 1-based (1 = top seed).
-- Points is used for Swiss standings (1.0 per win, 0 for loss).

CREATE TABLE IF NOT EXISTS TournamentParticipants (
    Id           INT          AUTO_INCREMENT PRIMARY KEY,
    TournamentId INT          NOT NULL,
    PlayerId     INT          NOT NULL,
    Seed         INT          NOT NULL DEFAULT 1,
    Wins         INT          NOT NULL DEFAULT 0,
    Losses       INT          NOT NULL DEFAULT 0,
    Points       DECIMAL(4,1) NOT NULL DEFAULT 0.0,
    CONSTRAINT FK_TPartic_Tournament FOREIGN KEY (TournamentId) REFERENCES Tournaments(Id) ON DELETE CASCADE,
    CONSTRAINT FK_TPartic_Player     FOREIGN KEY (PlayerId)     REFERENCES Players(Id)     ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── TournamentMatches ────────────────────────────────────────────────────────
-- Bracket: 'Winners' | 'Losers' | 'GrandFinal' | NULL (Swiss)
-- Player1Id / Player2Id are NULL when the slot is TBD (waiting for a prior match).
-- WinnerId is NULL until the match result is recorded.
-- IsBye = 1 means Player2 is absent; winner is auto-set to Player1.
-- NextWinnerMatchId / NextLoserMatchId link to the match the winner/loser advances to.

CREATE TABLE IF NOT EXISTS TournamentMatches (
    Id                INT         AUTO_INCREMENT PRIMARY KEY,
    TournamentId      INT         NOT NULL,
    Round             INT         NOT NULL,
    MatchNumber       INT         NOT NULL,
    Bracket           VARCHAR(20) NULL,
    Player1Id         INT         NULL,
    Player2Id         INT         NULL,
    WinnerId          INT         NULL,
    Player1Sets       INT         NULL,
    Player2Sets       INT         NULL,
    IsBye             TINYINT(1)  NOT NULL DEFAULT 0,
    NextWinnerMatchId INT         NULL,
    NextLoserMatchId  INT         NULL,
    CONSTRAINT FK_TMatch_Tournament  FOREIGN KEY (TournamentId)     REFERENCES Tournaments(Id)      ON DELETE CASCADE,
    CONSTRAINT FK_TMatch_Player1     FOREIGN KEY (Player1Id)        REFERENCES Players(Id)          ON DELETE RESTRICT,
    CONSTRAINT FK_TMatch_Player2     FOREIGN KEY (Player2Id)        REFERENCES Players(Id)          ON DELETE RESTRICT,
    CONSTRAINT FK_TMatch_Winner      FOREIGN KEY (WinnerId)         REFERENCES Players(Id)          ON DELETE RESTRICT,
    CONSTRAINT FK_TMatch_NextWinner  FOREIGN KEY (NextWinnerMatchId) REFERENCES TournamentMatches(Id) ON DELETE SET NULL,
    CONSTRAINT FK_TMatch_NextLoser   FOREIGN KEY (NextLoserMatchId)  REFERENCES TournamentMatches(Id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
