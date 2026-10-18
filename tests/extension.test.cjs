const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../extension');
const script = fs.readFileSync(path.join(root, 'background.js'), 'utf8');

function worker(item, response = {ok: true}) {
  const messages = [], badges = [], titles = [];
  let listener, badge = "";
  const context = vm.createContext({
    console: {error() {}},
    chrome: {
      downloads: {
        onChanged: {addListener(fn) { listener = fn; }},
        search: async () => item ? [item] : []
      },
      runtime: {sendNativeMessage: async (host, message) => {
        messages.push({host, ...message}); return response;
      }},
      action: {
        getBadgeText: async () => badge,
        setBadgeText: async value => { badge = value.text; badges.push(value.text); },
        setBadgeBackgroundColor: async () => {},
        setTitle: async value => titles.push(value.title)
      }
    }
  });
  vm.runInContext(script, context);
  return {context, messages, badges, titles, emit: delta => listener(delta),
    respond: value => { response = value; }};
}

test('manifest keeps the same ID and declares only required permissions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  assert.equal(manifest.version, '1.1.1');
  assert.deepEqual(manifest.permissions, ['downloads', 'nativeMessaging']);
  const crypto = require('node:crypto');
  const id = crypto.createHash('sha256').update(Buffer.from(manifest.key, 'base64'))
    .digest('hex').slice(0, 32).replace(/[0-9a-f]/g, x => String.fromCharCode(97 + parseInt(x, 16)));
  assert.equal(id, 'cmkpcmhhoahnchoipflobbccaifnpldm');
});

test('passes a completed file path to the native host once for simultaneous events', async () => {
  const w = worker({state: 'complete', exists: true, filename: 'C:\\Downloads\\archive.zip'});
  await Promise.all([vm.runInContext('lockDownload(1)', w.context), vm.runInContext('lockDownload(1)', w.context)]);
  assert.equal(w.messages.length, 1);
  assert.equal(w.messages[0].host, 'local.brave_lock');
  assert.equal(w.messages[0].action, 'lock');
  assert.equal(w.messages[0].path, 'C:\\Downloads\\archive.zip');
});

test('ignores progress events, missing files, and existing lock suffixes', async () => {
  for (const item of [null, {state: 'in_progress'}, {state: 'complete', exists: false},
    {state: 'complete', exists: true, filename: 'C:\\Downloads\\archive.LOCK'}]) {
    const w = worker(item);
    w.emit({id: 1, state: {current: 'in_progress'}});
    await vm.runInContext('lockDownload(1)', w.context);
    assert.equal(w.messages.length, 0);
  }
});

test('shows an error badge when the helper rejects a rename', async () => {
  const w = worker({state: 'complete', exists: true, filename: 'C:\\Downloads\\archive.zip'},
    {ok: false, error: 'File is in use.'});
  await vm.runInContext('lockDownload(1)', w.context);
  assert.deepEqual(w.badges, ['!']);
  assert.match(w.titles[0], /rename failed.*File is in use/);
});

test('keeps the error badge and title after a later successful rename', async () => {
  const w = worker({state: 'complete', exists: true, filename: 'C:\Downloads\archive.zip'},
    {ok: false, error: 'File is in use.'});
  await vm.runInContext('lockDownload(1)', w.context);
  w.respond({ok: true});
  await vm.runInContext('lockDownload(2)', w.context);
  assert.deepEqual(w.badges, ['!']);
  assert.equal(w.titles.length, 1);
});

test('reports success in the title when no error is pending', async () => {
  const w = worker({state: 'complete', exists: true, filename: 'C:\Downloads\archive.zip'});
  await vm.runInContext('lockDownload(1)', w.context);
  assert.deepEqual(w.badges, []);
  assert.deepEqual(w.titles, ['Brave Lock: last download renamed']);
});
