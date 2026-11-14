<%*
// New character page. Run with "Templater: Create new note from template".
// Asks for the campaign, name and portrait, saves the note in the campaign folder,
// and links it from the campaign's party list (and its "character" list if you play them).
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
  return list.sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) ||
    String(b.started).localeCompare(String(a.started)));
};
const images = () => app.vault.getFiles()
  .filter((f) => f.path.startsWith('src/assets/') && /\.(png|jpe?g|webp|gif)$/i.test(f.name))
  .sort((a, b) => b.stat.mtime - a.stat.mtime); // newest first, so a just-added portrait is on top

const campaigns = await loadCampaigns();
if (!campaigns.length) await stop('No campaigns found in src/campaigns.');
const c = await pick(
  campaigns.map((x) => `${x.name} · ${x.system}${x.status === 'active' ? '' : ' (complete)'}`),
  campaigns, 'Which campaign is this character in?');

let name = '';
while (!name) name = await ask('Character name');

// The file name becomes the page address, so keep it to letters and numbers
let fileName = '';
for (;;) {
  fileName = await ask('Page name (used in the address)', name.replace(/[^A-Za-z0-9]+/g, '') || 'Character');
  if (!/^[A-Za-z0-9_-]+$/.test(fileName)) { new Notice('Use only letters, numbers, - and _.'); continue; }
  if (await adapter.exists(`${c.dir}/${fileName}.md`)) { new Notice(`${c.dir}/${fileName}.md already exists.`); continue; }
  break;
}
const pageUrl = `/campaigns/${c.folder}/${fileName}/`;

const files = images();
const portrait = await pick(
  ['No portrait yet', ...files.map((f) => f.name)],
  ['', ...files.map((f) => f.path)], 'Portrait (add the image to src/assets first)');
const mine = await pick(
  ['Yes: one of my characters (shown on the campaign page and cards)', 'No: another party member'],
  [true, false], 'Is this a character you play?');

tR += [
  '---',
  `title: ${JSON.stringify(name)}`,
  `tags: [${c.folder}]`,
  'layout: layouts/character.html',
  portrait ? `portrait: ${portrait}` : null,
  portrait ? `ogImage: ${portrait}` : null,
  '---',
  '',
].filter((line) => line !== null).join('\n');
await tp.file.move(`${c.dir}/${fileName}`);

// Link the page from the campaign data file
const data = JSON.parse(await adapter.read(c.file));
const campaign = data.campaign;
const party = campaign.party || (campaign.party = []);
let member = party.find((m) => m.name.toLowerCase() === name.toLowerCase());
if (!member) party.push(member = { name });
member.page = pageUrl;
if (portrait) member.portrait = portrait;
if (mine) {
  const list = [].concat(campaign.character || []).filter((ch) => ch.page !== pageUrl);
  list.push({ name, page: pageUrl });
  campaign.character = list.length === 1 ? list[0] : list;
}
await adapter.write(c.file, JSON.stringify(data, null, 2) + '\n');
new Notice(`Linked ${name} in ${c.file}`);
-%>
## General Description
<% tp.file.cursor() %>

## Appearance

## Personality

## Background
