const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const folder = "C:/Users/Paul/Downloads/collection-us-midwest/us/oh";"; 

async function importFile(filePath) {
  const raw = fs.readFileSync(filePath);
  const geo = JSON.parse(raw);

  for (const f of geo.features) {
    const coords = f.geometry?.coordinates;
    if (!coords) continue;

    const props = f.properties || {};

    const address =
      (props.number || "") + " " + (props.street || "");

    const lat = coords[1];
    const lng = coords[0];

    if (!lat || !lng) continue;

    await pool.query(
      "INSERT INTO properties (address, lat, lng) VALUES ($1,$2,$3)",
      [address.trim(), lat, lng]
    );
  }

  console.log("Imported:", filePath);
}

async function run() {
  const files = fs.readdirSync(folder);

  for (const file of files) {
    if (!file.includes("addresses")) continue;

    await importFile(path.join(folder, file));
  }

  console.log("DONE");
  process.exit();
}

run();
