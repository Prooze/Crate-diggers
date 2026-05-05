const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const DB_PATH = process.env.DB_PATH || './crate-diggers.db';
const OWNER_PIN = process.env.OWNER_PIN || '1234';

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY,
    artist TEXT NOT NULL,
    album TEXT NOT NULL,
    suggestedBy TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    timestamp INTEGER NOT NULL,
    bought INTEGER NOT NULL DEFAULT 0,
    artUrl TEXT
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/suggestions', (req, res) => {
  const rows = db.prepare('SELECT * FROM suggestions ORDER BY timestamp DESC').all();
  res.json(rows.map(r => ({ ...r, bought: r.bought === 1 })));
});

app.post('/api/suggestions', (req, res) => {
  const { artist, album, suggestedBy, note, artUrl } = req.body;
  if (!artist || !album || !suggestedBy) {
    return res.status(400).json({ error: 'artist, album, and suggestedBy are required' });
  }
  const id = Date.now();
  db.prepare(
    'INSERT INTO suggestions (id, artist, album, suggestedBy, note, timestamp, bought, artUrl) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  ).run(id, artist, album, suggestedBy, note || '', id, artUrl || null);
  res.status(201).json({ id, artist, album, suggestedBy, note: note || '', timestamp: id, bought: false, artUrl: artUrl || null });
});

app.patch('/api/suggestions/:id/bought', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const newBought = row.bought ? 0 : 1;
  db.prepare('UPDATE suggestions SET bought = ? WHERE id = ?').run(newBought, id);
  res.json({ ...row, bought: newBought === 1 });
});

app.post('/api/suggestions/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (String(pin) === String(OWNER_PIN)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid PIN' });
  }
});

app.delete('/api/suggestions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM suggestions WHERE id = ?').run(id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Crate Diggers running on http://localhost:${PORT}`));
