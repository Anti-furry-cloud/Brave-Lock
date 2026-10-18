const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');

const host = path.resolve(__dirname, '../native/BraveLockHost.exe');

function frame(message) {
  const body = Buffer.from(JSON.stringify(message));
  const length = Buffer.alloc(4);
  length.writeUInt32LE(body.length);
  return Buffer.concat([length, body]);
}

function send(message) {
  const result = spawnSync(host, [], {input: frame(message), windowsHide: true, timeout: 10000});
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.readUInt32LE(0), result.stdout.length - 4);
  return JSON.parse(result.stdout.subarray(4).toString('utf8'));
}

test('helper reports its release version', () => {
  assert.deepEqual(send({action: 'ping'}), {ok: true, version: '1.1.1'});
});

test('rename keeps contents and avoids duplicate suffixes or overwrites', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brave-lock-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const name of ['archive.zip', 'photo.png', 'no-extension', 'existing.LOCK', '\u65e5\u672c.zip']) {
    const file = path.join(dir, name);
    const contents = Buffer.from([0, 255, 13, 10, 80, 75, 3, 4]);
    fs.writeFileSync(file, contents);
    const result = send({action: 'lock', path: file});
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(fs.readFileSync(result.path), contents);
    assert.equal(send({action: 'lock', path: result.path}).path, result.path);
  }
  const file = path.join(dir, 'collision.zip');
  fs.writeFileSync(file, 'new');
  fs.writeFileSync(file + '.lock', 'existing');
  assert.equal(send({action: 'lock', path: file}).path, file + ' (1).lock');
  assert.equal(fs.readFileSync(file + '.lock', 'utf8'), 'existing');
});

test('rejects unsupported actions, paths, and missing files', () => {
  for (const message of [
    {action: 'execute'},
    {action: 'lock', path: 'relative.zip'},
    {action: 'lock', path: '\\\\server\\share\\file.zip'},
    {action: 'lock', path: 'C:\\file.zip:stream'},
    {action: 'lock', path: path.join(os.tmpdir(), 'missing-brave-lock-' + Date.now())}
  ]) assert.equal(send(message).ok, false);
});

test('reports a missing file clearly', () => {
  const result = send({action: 'lock', path: path.join(os.tmpdir(), 'missing-brave-lock-' + Date.now())});
  assert.deepEqual(result, {ok: false, error: 'File not found.'});
});

test('waits for another process to release the file', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brave-lock-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const file = path.join(dir, 'scanned.zip');
  fs.writeFileSync(file, 'data');

  // Hold the file without sharing for about one second, like an antivirus scan.
  const holder = spawn('powershell.exe', ['-NoProfile', '-Command',
    "$f = [IO.File]::Open($env:LOCK_FILE, 'Open', 'Read', 'None'); 'held'; Start-Sleep -Milliseconds 1000; $f.Close()"],
    {env: {...process.env, LOCK_FILE: file}, windowsHide: true});
  const released = new Promise(resolve => holder.on('exit', resolve));
  await new Promise((resolve, reject) => {
    holder.stdout.on('data', data => { if (String(data).includes('held')) resolve(); });
    holder.on('exit', () => reject(new Error('Lock holder exited early.')));
  });

  const child = spawn(host, [], {windowsHide: true});
  const chunks = [];
  child.stdout.on('data', data => chunks.push(data));
  child.stdin.end(frame({action: 'lock', path: file}));
  await new Promise(resolve => child.on('exit', resolve));
  await released;

  const output = Buffer.concat(chunks);
  const result = JSON.parse(output.subarray(4).toString('utf8'));
  assert.deepEqual(result, {ok: true, path: file + '.lock'});
  assert.equal(fs.readFileSync(file + '.lock', 'utf8'), 'data');
});
