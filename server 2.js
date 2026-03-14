const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Install better-sqlite3 if not present
try { require('better-sqlite3'); } catch(e) {
  console.log('Installing better-sqlite3...');
  execSync('npm install better-sqlite3', { cwd: __dirname });
}

const Database = require('better-sqlite3');
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH 
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'workout.db')
  : path.join(__dirname, 'workout.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week INTEGER, day TEXT, ex_idx INTEGER, set_idx INTEGER,
    field TEXT, value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(week, day, ex_idx, set_idx, field)
  );
  CREATE TABLE IF NOT EXISTS session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week INTEGER, day TEXT, field TEXT, value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(week, day, field)
  );
`);

const setEntry = db.prepare(`INSERT INTO entries (week,day,ex_idx,set_idx,field,value) VALUES (?,?,?,?,?,?)
  ON CONFLICT(week,day,ex_idx,set_idx,field) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`);
const getEntries = db.prepare(`SELECT * FROM entries WHERE week=? AND day=?`);
const setSession = db.prepare(`INSERT INTO session (week,day,field,value) VALUES (?,?,?,?)
  ON CONFLICT(week,day,field) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`);
const getSessions = db.prepare(`SELECT * FROM session WHERE week=? AND day=?`);

function parseBody(req) {
  return new Promise((res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { res(JSON.parse(body)); } catch(e) { res({}); } });
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

http.createServer(async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // Serve app
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    return;
  }

  // GET /data?week=1&day=a
  if (req.method === 'GET' && url === '/data') {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const week = parseInt(params.get('week')), day = params.get('day');
    const entries = getEntries.all(week, day);
    const sessions = getSessions.all(week, day);
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ entries, sessions }));
    return;
  }

  // POST /data
  if (req.method === 'POST' && url === '/data') {
    const body = await parseBody(req);
    if (body.type === 'entry') {
      setEntry.run(body.week, body.day, body.ex_idx, body.set_idx, body.field, body.value);
    } else if (body.type === 'session') {
      setSession.run(body.week, body.day, body.field, body.value);
    }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404); res.end('Not found');

}).listen(PORT, () => console.log('Running on port ' + PORT));
