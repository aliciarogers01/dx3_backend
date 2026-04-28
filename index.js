import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const app = express();
const { Pool } = pg;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is NOT set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function generatePlayerId() {
  const length = Math.random() < 0.5 ? 9 : 10;
  let digits = "";

  for (let i = 0; i < length; i++) {
    digits += Math.floor(Math.random() * 10);
  }

  return `DX-${digits}`;
}

function formatMemberSince(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).toUpperCase();
}

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      player_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      member_since TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id SERIAL PRIMARY KEY,
      player_id TEXT UNIQUE NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS emails (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

app.get("/", (req, res) => {
  res.json({ message: "DX3 backend is running" });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/players/create", async (req, res) => {
  try {
    const { username, city, state } = req.body;

    if (!username || !city || !state) {
      return res.status(400).json({ error: "username, city, and state are required" });
    }

    let playerId = generatePlayerId();

    const created = await pool.query(
      `
      INSERT INTO players (player_id, username, city, state)
      VALUES ($1, $2, $3, $4)
      RETURNING player_id, username, city, state, member_since;
      `,
      [playerId, username.trim(), city.trim(), state.trim()]
    );

    const player = created.rows[0];

    await pool.query(
      `
      INSERT INTO bank_accounts (player_id, balance)
      VALUES ($1, 0)
      ON CONFLICT (player_id) DO NOTHING;
      `,
      [player.player_id]
    );

    await pool.query(
      `
      INSERT INTO emails (player_id, subject, body)
      VALUES
      ($1, $2, $3),
      ($1, $4, $5);
      `,
      [
        player.player_id,
        "Welcome to Deed Exchange",
        "Welcome. Use the Web tab to find housing, the Work tab to earn WD, the Bank to manage money, and the Map to explore properties.",
        "Housing Assistance Approved",
        "You have received a 500 WD starter housing voucher. Use this toward your first place to live."
      ]
    );

    res.json({
      playerId: player.player_id,
      username: player.username,
      city: player.city,
      state: player.state,
      memberSince: formatMemberSince(player.member_since)
    });
  } catch (error) {
    console.error("Create player error:", error);
    res.status(500).json({ error: "Failed to create player" });
  }
});

const port = process.env.PORT || 3000;

setupDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`DX3 backend running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Database setup failed:", error);
    process.exit(1);
  });
