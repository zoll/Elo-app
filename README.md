# Table Tennis Tracker

An internal tool for tracking table tennis matches, ELO ratings, and tournaments among office players.

## Features

- **Leaderboard** — live ELO rankings with win rate bars
- **Record a match** — set-score entry with instant ELO preview
- **Match history** — last 50 games with ELO deltas
- **Tournaments** — Single Elimination, Double Elimination, Swiss

### Tournament formats

| Format | Description |
|--------|-------------|
| Single Elimination | One loss and you're out. Bracket auto-seeded by registration order. |
| Double Elimination | Two losses to eliminate. Winners Bracket, Losers Bracket, and Grand Final. |
| Swiss | Round-robin style; no elimination. Each round pairs players with similar records. Auto-computed rounds: `max(3, ceil(log2(n)) + 1)`. |

### Tournament workflow

1. Create a tournament (name + format).
2. Players sign up from the Pending view.
3. Click **Start Tournament** — brackets are generated and the tournament goes InProgress.
4. Click any highlighted match card to enter the score.
5. The bracket auto-advances winners (and losers in Double Elim).
6. Once all matches are resolved the tournament is marked Completed with a champion.

> Tournament results do **not** affect ELO ratings.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, plain CSS |
| Backend | ASP.NET Core 8 Web API, C# |
| Database | MySQL 8 via EF Core (Pomelo driver) |
| ELO | Standard formula, K = 32 |

## Running with Docker (recommended)

```bash
docker compose up --build
```

The app is available at **http://localhost:5000**.  
MySQL data is persisted in the `mysql_data` Docker volume.

## Running manually

### Backend

Requires .NET 8 SDK and a MySQL instance. Set the connection string:

```bash
cd backend
dotnet run --ConnectionStrings__DefaultConnection="Server=localhost;Database=tabletennis;User=root;Password=yourpassword;"
```

API listens on `http://localhost:5000`.

### Frontend

Requires Node 18+.

```bash
cd frontend
npm install
npm run dev
```

Dev server at `http://localhost:5173` — proxies `/api` to the backend.

## Running tests

```bash
cd backend.Tests
dotnet test
```

29 xUnit tests covering Single Elim, Double Elim (including bye auto-resolution edge cases), and Swiss pairing logic. Uses EF Core InMemory; no database required.

## Project structure

```
tabletennis/
├── backend/            # ASP.NET Core 8 Web API
│   ├── Controllers/    # REST endpoints
│   ├── Models/         # EF Core entities
│   ├── Services/       # EloService, TournamentService
│   └── Data/           # AppDbContext
├── backend.Tests/      # xUnit test project
├── frontend/           # React + TypeScript (Vite)
│   └── src/
│       ├── components/ # Leaderboard, Games, Tournaments
│       ├── api/        # Typed API client
│       └── types.ts    # Shared TypeScript interfaces
├── Dockerfile
└── docker-compose.yml
```
