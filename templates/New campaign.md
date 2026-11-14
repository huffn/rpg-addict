<%*
// New campaign. Run with "Templater: Create new note from template".
// Asks for the campaign details, then creates src/campaigns/<Folder>/ with the data file,
// the recaps folder, and this note as the campaign page (index.md).
const adapter = app.vault.adapter;
const target = tp.config.target_file;
const stop = async (message) => {
  if (!(await app.vault.read(target)).trim()) await app.vault.trash(target, true);
  throw new Error(message);
};
const ask = async (text, value = '') => {
  const answer = await tp.system.prompt(text, value);
  if (answer === null || answer === undefined) await stop('Cancelled');
  return answer.trim();
};
const pick = async (labels, items, placeholder) => {
  const choice = await tp.system.suggester(labels, items, false, placeholder);
  if (choice === null || choice === undefined) await stop('Cancelled');
  return choice;
};
const loadCampaigns = async () => {
  const list = [];
  for (const dir of (await adapter.list('src/campaigns')).folders) {
    const folder = dir.split('/').pop();
    const file = `${dir}/${folder}.11tydata.json`;
    if (!(await adapter.exists(file))) continue;
    const { campaign } = JSON.parse(await adapter.read(file));
    list.push({ ...campaign, folder, dir, file, name: campaign.name || campaign.system });
  }
  return list.sort((a, b) => String(b.started).localeCompare(String(a.started)));
};
const images = () => app.vault.getFiles()
  .filter((f) => f.path.startsWith('src/assets/') && /\.(png|jpe?g|webp|gif)$/i.test(f.name))
  .sort((a, b) => b.stat.mtime - a.stat.mtime); // newest first, so a just-added image is on top
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

const campaigns = await loadCampaigns();

let name = '';
while (!name) name = await ask('Campaign name (the story, e.g. "Astral Covenant")');

const systems = [...new Set(campaigns.map((c) => c.system))];
let system = await pick([...systems, 'A new system…'], [...systems, ''], 'Which game system?');
while (!system) system = await ask('Game system name');
const previous = campaigns.find((c) => c.system === system); // most recent campaign in this system

// The folder name becomes the address (/campaigns/<Folder>/) and the tag on every recap
let folder = '';
for (;;) {
  folder = await ask('Folder name (short, letters and numbers, e.g. "FabUlt")', name.replace(/[^A-Za-z0-9]+/g, ''));
  if (!/^[A-Za-z0-9_-]+$/.test(folder)) { new Notice('Use only letters, numbers, - and _.'); continue; }
  if (await adapter.exists(`src/campaigns/${folder}`)) { new Notice(`src/campaigns/${folder} already exists.`); continue; }
  break;
}
const dir = `src/campaigns/${folder}`;

// Short unique key that ties pages to the campaign's accent color
const keys = new Set(campaigns.map((c) => c.key));
let key = name.split(/\s+/).map((w) => w[0] || '').join('').toLowerCase().replace(/[^a-z0-9]/g, '') || 'c';
for (let n = 2; keys.has(key); n++) key = key.replace(/\d+$/, '') + n;
for (;;) {
  key = await ask('Short key for the accent color (lowercase, unique)', key);
  if (!/^[a-z][a-z0-9-]*$/.test(key)) { new Notice('Start with a letter; use lowercase letters, numbers and -.'); continue; }
  if (keys.has(key)) { new Notice(`"${key}" is already used by another campaign.`); continue; }
  break;
}

let started = '';
for (;;) {
  started = await ask('Start month (YYYY-MM)', tp.date.now('YYYY-MM'));
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(started)) break;
  new Notice('Use the form YYYY-MM, for example 2026-12.');
}

// Accent color: dark-mode value, then a darker one that reads on white in light mode
const used = new Set(campaigns.map((c) => c.accent?.dark?.toLowerCase()));
const presets = [
  ['Gold', '#e6bf6a', '#946410'], ['Teal', '#5fd0c4', '#0d7268'], ['Violet', '#b9a3ff', '#6a4fc4'],
  ['Coral', '#ff8a7a', '#b03a2e'], ['Green', '#8fd694', '#2f7a3a'], ['Blue', '#7fb2ff', '#2a5db0'],
  ['Rose', '#f59ac0', '#a8366a'], ['Orange', '#ffb366', '#a45a10'],
];
const free = presets.filter(([, dark]) => !used.has(dark));
const taken = presets.filter(([, dark]) => used.has(dark));
const options = [...free, ...taken];
let accent = await pick(
  [...options.map(([label, dark]) => `${label} ${dark}${used.has(dark) ? ' (already used)' : ''}`), 'Custom colors…'],
  [...options.map(([, dark, light]) => ({ dark, light })), null], 'Accent color');
if (!accent) {
  let dark = '', light = '';
  while (!isHex(dark)) dark = await ask('Dark-mode color (#rrggbb, bright enough for a navy background)', '#');
  while (!isHex(light)) light = await ask('Light-mode color (#rrggbb, dark enough for a white background)', '#');
  accent = { dark, light };
}

const files = images();
const emblemFiles = previous?.ogImage ? [previous.ogImage, ...files.map((f) => f.path).filter((p) => p !== previous.ogImage)] : files.map((f) => f.path);
const ogImage = await pick(
  ['No emblem yet', ...emblemFiles.map((p) => p === previous?.ogImage ? `${p.split('/').pop()} (current ${system} emblem)` : p.split('/').pop())],
  ['', ...emblemFiles], 'Square system emblem (add the image to src/assets first)');
const heroImage = await pick(
  ['No banner', ...files.map((f) => f.name)],
  ['', ...files.map((f) => f.path)], 'Wide banner for the top of the campaign page (optional)');
const heroAlt = heroImage ? await ask('Describe the banner image (for screen readers)', `${name} – ${system}`) : '';

const partyNames = (await ask('Party members, separated by commas (you can add more later)'))
  .split(',').map((s) => s.trim()).filter(Boolean);

const campaign = {
  key, accent, folder, name, system, started, ended: null, status: 'active',
  ...(ogImage ? { ogImage } : {}),
  ...(heroImage ? { heroImage, heroAlt } : {}),
  party: partyNames.map((n) => ({ name: n })),
};

await app.vault.createFolder(dir);
await app.vault.createFolder(`${dir}/recaps`);
await adapter.write(`${dir}/${folder}.11tydata.json`, JSON.stringify({ campaign }, null, 2) + '\n');
await adapter.write(`${dir}/recaps/recaps.11tydata.json`, JSON.stringify({ layout: 'layouts/recap.html' }) + '\n');
await app.vault.create(`${dir}/recaps/index.md`, '---\ntitle: Session Recaps\nlayout: layouts/recap-list.html\n---\n');

tR += '---\nlayout: layouts/campaign.html\n---\n';
await tp.file.move(`${dir}/index`);

const stillActive = campaigns.filter((c) => c.status === 'active').map((c) => c.name);
new Notice(`Created ${dir}.` + (stillActive.length
  ? ` Still marked active: ${stillActive.join(', ')}. Set "status": "complete" in a campaign's data file when it ends.`
  : ''), 15000);
-%>
<% tp.file.cursor() %>A paragraph or two about the campaign.
