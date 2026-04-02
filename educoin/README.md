# EduCoin 🎓🪙

> Turn discipline into currency — a gamified study tracker where focus earns real rewards.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS v3 + TanStack Query |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT in httpOnly cookies (access + refresh) |

---

## Project Structure

```
educoin/
├── client/          # React + Vite frontend (port 5173)
├── server/          # Express backend (port 3001)
└── prisma/          # Prisma schema + seed script
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL running locally

### 1. Configure the database

```bash
# Create a database named "educoin" in PostgreSQL
psql -U postgres -c "CREATE DATABASE educoin;"
```

Edit `server/.env` and set your DB credentials:
```
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/educoin"
```

### 2. Install all dependencies

```bash
# Install server deps
cd server && npm install && cd ..

# Install client deps
cd client && npm install && cd ..
```

### 3. Run Prisma migrations

```bash
cd server
npx prisma generate --schema=../prisma/schema.prisma
npx prisma migrate dev --name init --schema=../prisma/schema.prisma
```

### 4. Seed the database (10 fake users for leaderboard)

```bash
cd server
node ../prisma/seed.js
```

### 5. Start both servers

**Terminal 1 — Backend:**
```bash
cd server && npm run dev
# Runs on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client && npm run dev
# Opens http://localhost:5173
```

---

## 🔐 Auth

- JWTs stored in **httpOnly cookies** (not localStorage)
- Access token: 15 minutes
- Refresh token: 7 days, auto-refresh on 401
- Passwords: bcrypt with 12 rounds

## 🪙 Coin Formula

```
base        = durationMinutes × 1
focusBonus  = base × (focusScore / 100)
coinsEarned = Math.round(base + focusBonus)
```

## 📊 Level Thresholds

| Level | Coins |
|---|---|
| 1 | 0 |
| 2 | 100 |
| 3 | 300 |
| 4 | 600 |
| 5 | 1,000 |
| 6 | 1,800 |
| 7 | 3,240 |

---

## 🧪 Demo Credentials (after seeding)

| Email | Password |
|---|---|
| alex@educoin.dev | password123 |
| maya@educoin.dev | password123 |

---

## API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | ❌ | Create user, return JWT |
| POST | /api/auth/login | ❌ | Login, return JWT |
| GET | /api/auth/me | ✅ | Current user |
| POST | /api/auth/logout | ✅ | Clear cookies |
| POST | /api/sessions/start | ✅ | Start study session |
| POST | /api/sessions/end | ✅ | End session, calculate coins |
| GET | /api/sessions/history | ✅ | Last 10 sessions |
| GET | /api/sessions/active | ✅ | Active session |
| GET | /api/leaderboard | ✅ | Top 20 by coins |
| GET | /api/user/stats | ✅ | Coins, level, rank, hours |
| GET | /api/user/wallet | ✅ | Transaction history |
| GET | /api/user/weekly-stats | ✅ | Last 7 days data |
