# Support Ticket System (with RAG-Assisted Support)

A full-stack support ticket system built as a learning project: ASP.NET Core backend
with role-based ticketing, a Python FastAPI service providing AI ticket triage and
retrieval-augmented reply generation, and a React frontend for Users, Agents, and
Admins.

## Project Overview

Users file support tickets. An AI service automatically categorizes and prioritizes
them. Agents work a queue, get an AI-generated *suggested reply* grounded in a
company knowledge base (with citations), and can accept high-confidence suggestions
with one click or edit them before sending. Admins manage users/roles, ingest
knowledge-base documents, view AI-generated weekly analytics, and review an audit
trail of every sensitive action in the system. Both the ticket creator and the
assigned agent get in-app notifications when something relevant happens to a ticket.

Every AI-assisted action in this system is designed to keep a human in the loop -
see [Key Design Decisions](#key-design-decisions) below.

## Architecture

```mermaid
flowchart LR
    subgraph Frontend["React Frontend (Vite)"]
        UI[User / Agent / Admin UI]
    end

    subgraph Backend[".NET Backend (ASP.NET Core)"]
        API[REST API + JWT Auth]
        DB[(SQL Server<br/>EF Core)]
    end

    subgraph AI["Python AI Service (FastAPI)"]
        Triage["/triage/classify"]
        KB["/kb/ingest, /kb/retrieve"]
        RAG["/rag/generate"]
        Insights["/insights/summarize"]
        Vec[(FAISS Vector Store)]
    end

    subgraph External["External LLM APIs"]
        Groq[Groq - chat completions]
        Gemini[Gemini - embeddings]
    end

    UI -- "JWT-authenticated REST calls" --> API
    API -- EF Core --> DB
    API -- "classify ticket" --> Triage
    API -- "upload KB docs" --> KB
    API -- "generate suggested reply" --> RAG
    API -- "weekly stats summary" --> Insights

    Triage --> Groq
    RAG --> Groq
    RAG --> Vec
    Insights --> Groq
    KB --> Vec
    KB --> Gemini
    RAG -. "embed ticket query" .-> Gemini
```

### Request flow: an Agent viewing a ticket with an AI-suggested reply

```mermaid
sequenceDiagram
    participant Agent
    participant API as .NET API
    participant DB as SQL Server
    participant AI as Python AI Service
    participant Vec as FAISS
    participant LLM as Groq

    Agent->>API: GET suggested-reply for ticket
    API->>DB: Is there a fresh cached reply?
    alt Cached and not "regenerate"
        DB-->>API: cached reply + confidence + sources
    else No cache / regenerate requested
        API->>AI: POST /rag/generate {title, description}
        AI->>Vec: embed query, search top-K chunks
        Vec-->>AI: chunks + similarity scores
        AI->>LLM: grounded prompt (context + instructions)
        LLM-->>AI: generated reply text
        AI-->>API: {reply, confidence, sources, auto_resolvable}
        API->>DB: cache reply on ticket
    end
    API-->>Agent: reply + confidence + sources + auto_resolvable
    opt confidence over threshold
        Agent->>API: PUT /auto-resolve (Accept & Resolve)
        API->>DB: post comment + set Resolved + write audit log + notify creator
    end
```

## Tech Stack

**Backend**
- ASP.NET Core Web API (.NET)
- Entity Framework Core + SQL Server (LocalDB for dev)
- ASP.NET Core Identity + JWT Bearer authentication
- Role-based authorization (User / Agent / Admin)

**AI Service**
- Python, FastAPI, Pydantic v2
- Groq (OpenAI-compatible API) for chat completions
- Google Gemini for text embeddings
- FAISS for vector similarity search

**Frontend**
- React (Vite)
- Redux Toolkit + RTK Query

## Features by Area

- **Auth & Roles**: JWT login, seeded Admin, User/Agent/Admin roles, account deactivation.
- **Tickets**: creation, comments, status lifecycle, agent assignment/queue.
- **AI Triage**: automatic category + priority classification on ticket creation, with manual override.
- **Knowledge Base**: Admin PDF/TXT upload, chunking, embeddings, FAISS storage.
- **RAG Suggested Replies**: grounded, cited draft replies for agents, cached per ticket, regenerate on demand.
- **Auto-Resolve**: high-confidence suggestions get a one-click "Accept & Resolve" (still human-triggered).
- **Weekly Insights**: AI-summarized 7-day ticket analytics for Admins, cached for an hour.
- **Notifications**: in-app bell/dropdown - ticket creators notified on resolution, agents notified on assignment.
- **Audit Log**: one consistent, filterable trail of auto-resolves, manual status changes, role changes, and deactivations.

## Setup Instructions

### Prerequisites
- .NET SDK (10.0+)
- SQL Server LocalDB (or another SQL Server instance)
- Python 3.11+
- Node.js 18+

### 1. Backend (`SupportTicketSystem/`)

```bash
cd SupportTicketSystem
dotnet restore
```

Configure `appsettings.json` (or user secrets) with:
- `ConnectionStrings:DefaultConnection` - your SQL Server connection string
- `Jwt:Key` / `Jwt:Issuer` / `Jwt:Audience` - JWT signing config
- `SeedAdmin:Email` / `SeedAdmin:Password` - seeded Admin account, created on first run
- `RagService:BaseUrl` - URL of the Python AI service (default `http://localhost:8001`)

Apply migrations and run:

```bash
dotnet ef database update
dotnet run
```

The API listens on `http://localhost:5228` by default.

### 2. AI Service (`SupportTicketAI/`)

```bash
cd SupportTicketAI
python -m venv venv
venv\Scripts\activate        # venv/bin/activate on macOS/Linux
pip install -r requirements.txt
```

Create a `.env` file:

```dotenv
GROQ_API_KEY=your-groq-api-key
GEMINI_API_KEY=your-gemini-api-key
AUTO_RESOLVE_THRESHOLD=0.9
```

Run:

```bash
uvicorn main:app --host 127.0.0.1 --port 8001
```

### 3. Frontend (`support-ticket-frontend/`)

```bash
cd support-ticket-frontend
npm install
```

Create a `.env` file:

```dotenv
VITE_API_BASE_URL=http://localhost:5228/api
```

Run:

```bash
npm run dev      # dev server at http://localhost:5173
npm run build    # production build
```

## Key Design Decisions

### Why human-in-the-loop auto-resolve, instead of full automation

A high retrieval-similarity score only proves the ticket's wording *matched* the
knowledge base well - it doesn't prove the generated reply is actually correct, or
that it accounts for the specific customer's nuance. Letting the system resolve a
ticket (and send a reply) entirely on its own means a wrong or subtly-off answer can
go out unreviewed, close a ticket that isn't really solved, and erode customer trust
with nobody accountable for the mistake. Every AI-assisted action in this system -
suggested replies and auto-resolve alike - is therefore a *recommendation* an Agent
sees and explicitly acts on ("Accept & Resolve" is one click, but it's still a
click), and that action is logged in the audit trail with the confidence score at
the time it was taken.

### Why graceful degradation on AI failures, not hard failures

Every integration with the AI service is built so an outage or error there degrades
the experience rather than breaking it entirely:
- Ticket classification falls back to `Uncategorized` / `Medium` if the classifier is
  unavailable - a ticket can still be created and triaged manually.
- The Weekly Insights dashboard shows a "summary temporarily unavailable" message but
  still renders the real, server-computed stats/charts if the LLM summarization call
  fails - the numbers don't depend on the LLM succeeding.
- RAG generation and KB ingestion are the exceptions: they *do* surface a clear error
  instead of a silent fallback, because there's no safe placeholder for "a suggested
  reply" or "an ingested document" - inventing one would be actively misleading. The
  general principle is the same either way: never let an AI failure silently produce
  wrong-looking-right output; either degrade to a clearly-labeled fallback, or fail
  loudly.

### Why confidence is derived from retrieval similarity, not LLM self-reporting

The confidence score attached to every suggested reply is the top similarity score
from the knowledge-base vector search, not a number the LLM is asked to report about
its own answer. Three reasons:
1. **It's already computed.** Retrieval happens before generation regardless - reusing
   its top score costs no extra LLM call, no extra latency, no extra cost.
2. **It's deterministic and meaningful.** It directly answers the question that
   matters: "how well does the knowledge base actually cover this ticket?" A low score
   honestly means "the KB probably doesn't have the answer," which is exactly when an
   Agent should distrust the draft.
3. **LLM self-reported confidence is unreliable.** Language models are known to be
   poorly calibrated at self-assessing correctness - a hallucinated answer is often
   reported with just as much apparent confidence as a well-grounded one, since the
   "confidence" is itself just more generated text, not a measured probability.

## Deployment (Render + a self-hosted SQL Server)

This repo includes `render.yaml` (a Render Blueprint) plus a `Dockerfile` in both
`SupportTicketSystem/` and `SupportTicketAI/`, so the backend and AI service deploy as
Docker web services and the frontend deploys as a static site. Render's free tier
doesn't offer managed SQL Server, so the database is assumed to be a SQL Server
instance you host and expose yourself (a VPS, a home server with port forwarding, etc.)
- everything else runs on Render.

### 0. Push this repo to GitHub
Render deploys from a connected Git provider. Create a repo on GitHub and push this
one to it (`git remote add origin ...`, `git push -u origin main`).

### 1. Make sure your SQL Server is reachable from the internet
- SQL Server must be listening on TCP (enable **TCP/IP** in SQL Server Configuration
  Manager if it's currently LocalDB/named-pipes only), with a firewall rule allowing
  inbound `1433` (or whatever port you expose).
- Render's free web services don't have a static outbound IP, so you generally can't
  restrict the firewall to Render's IP range - plan your SQL login's password strength
  accordingly, and consider `TrustServerCertificate=True` if you don't have a signed
  cert on the SQL Server endpoint.
- Your connection string will look like:
  `Server=tcp:your-host,1433;Database=SupportTicketDb;User Id=...;Password=...;TrustServerCertificate=True;`

### 2. Create the three services on Render
Easiest: **New > Blueprint**, point it at your GitHub repo, and Render reads
`render.yaml` and proposes all three services. Otherwise, create each manually:
- `support-ticket-ai`: Docker web service, Dockerfile at `SupportTicketAI/Dockerfile`, root `SupportTicketAI/`.
- `support-ticket-backend`: Docker web service, Dockerfile at `SupportTicketSystem/Dockerfile`, root `SupportTicketSystem/`.
- `support-ticket-frontend`: Static site, build command `cd support-ticket-frontend && npm install && npm run build`, publish path `support-ticket-frontend/dist`.

### 3. Set environment variables
On `support-ticket-ai`:
- `GROQ_API_KEY`, `GEMINI_API_KEY` - your real keys (never commit these).
- `AUTO_RESOLVE_THRESHOLD` - `0.9` (or your tuned value).

On `support-ticket-backend`:
- `ConnectionStrings__DefaultConnection` - from step 1.
- `Jwt__Key` - a real random secret (e.g. `openssl rand -base64 48`), **not** the
  placeholder in `appsettings.json`.
- `Jwt__Issuer` / `Jwt__Audience` - can keep the defaults.
- `SeedAdmin__Email` / `SeedAdmin__Password` - **do not** deploy publicly with the
  default `admin@example.com` / `Admin@123` from local dev; the seed logic creates
  this account automatically on first boot if it doesn't already exist.
- `RagService__BaseUrl` - the public URL Render gives `support-ticket-ai`
  (e.g. `https://support-ticket-ai.onrender.com`).
- `Cors__FrontendOrigin` - the public URL Render gives `support-ticket-frontend`.

On `support-ticket-frontend`:
- `VITE_API_BASE_URL` - the public URL Render gives `support-ticket-backend`, plus
  `/api` (e.g. `https://support-ticket-backend.onrender.com/api`). Vite bakes this in
  at **build** time, so set it before the first build, or trigger a redeploy after
  changing it.

### 4. Deploy order
Backend and frontend each need the other's URL, which only exists after that service
is first created - so expect to: create all three, fill in what you can, deploy, then
go back and fill in `RagService__BaseUrl` / `Cors__FrontendOrigin` / `VITE_API_BASE_URL`
once you have the real URLs, then redeploy the backend and frontend.

### Known limitations of this setup
- **Free web services spin down after inactivity** and cold-start on the next request
  (can take 30-60s) - acceptable for a demo, not for production SLAs.
- **The AI service's FAISS knowledge-base data is not persisted** on Render's free
  tier (no free persistent disk) - ingested documents are lost on redeploy/restart.
  A paid persistent disk, or moving `kb_data/` to external storage, would fix this.
- **No static outbound IP** on free Render services, so you can't IP-allowlist Render
  in your SQL Server's firewall.

## Notable Limitations / Future Work

- Notifications are polled (every 30s), not pushed via websockets/SignalR.
- No real email delivery - notifications are in-app only.
- No charting library - Weekly Insights uses simple CSS bar breakdowns.
- Single-instance in-memory caching (Weekly Insights) - would need a distributed cache
  (e.g. Redis) to run behind multiple backend instances.
