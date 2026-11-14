<%*
// New session recap. Run with "Templater: Create new note from template".
// Asks for the campaign, date and title, fills in the tags and session number,
// and saves the note as src/campaigns/<Folder>/recaps/YY-MM-DD.md.
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
const askDate = async (text, value, optional = false) => {
  for (;;) {
    const answer = await ask(text, value);
    if (optional && !answer) return '';
    if (moment(answer, 'YYYY-MM-DD', true).isValid()) return answer;
    new Notice('Use the form YYYY-MM-DD, for example 2026-11-19.');
    value = answer;
  }
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
  // Active campaigns first, then the most recently started
  return list.sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) ||
    String(b.started).localeCompare(String(a.started)));
};

const campaigns = await loadCampaigns();
if (!campaigns.length) await stop('No campaigns found in src/campaigns.');
const c = await pick(
  campaigns.map((x) => `${x.name} · ${x.system}${x.status === 'active' ? '' : ' (complete)'}`),
  campaigns, 'Which campaign is this recap for?');

const recapDir = `${c.dir}/recaps`;
const recaps = app.vault.getMarkdownFiles()
  .filter((f) => f.parent?.path === recapDir && f.name !== 'index.md')
  .map((f) => app.metadataCache.getFileCache(f)?.frontmatter || {});
const latest = recaps.reduce((a, b) => (String(b.date) > String(a?.date ?? '') ? b : a), null);

// Default to the date the last recap said the next session would be, unless that's in the future
const today = tp.date.now('YYYY-MM-DD');
const planned = latest?.['next-session'] ? moment(String(latest['next-session'])).format('YYYY-MM-DD') : '';
const date = await askDate('Session date (YYYY-MM-DD)', planned && planned <= today ? planned : today);

// Campaigns that number their sessions get the next number. A campaign's first recap asks
// (blank = don't number them); campaigns that never did (like City of Mist episodes) skip it.
const numbers = recaps.map((fm) => fm.session).filter((n) => typeof n === 'number');
let session = null;
if (numbers.length || !recaps.length) {
  for (;;) {
    const answer = numbers.length
      ? await ask('Session number', String(Math.max(...numbers) + 1))
      : await ask('Session number (leave blank to not number sessions)', '1');
    if (!numbers.length && !answer) break;
    if (/^\d+$/.test(answer)) { session = Number(answer); break; }
    new Notice('The session number should be a whole number.');
  }
}

let title = '';
while (!title) title = await ask('Recap title');
const next = await askDate('Next session date (YYYY-MM-DD), or leave blank',
  moment(date).add(7, 'days').format('YYYY-MM-DD'), true);

let name = moment(date).format('YY-MM-DD');
for (let n = 2; await adapter.exists(`${recapDir}/${name}.md`); n++) name = `${moment(date).format('YY-MM-DD')}-${n}`;

tR += [
  '---',
  `tags: [recap, ${c.folder}]`,
  `date: ${date}`,
  session !== null ? `session: ${session}` : null,
  `title: ${JSON.stringify(title)}`,
  next ? `next-session: ${next}` : null,
  '---',
  '',
].filter((line) => line !== null).join('\n');
await tp.file.move(`${recapDir}/${name}`);
-%>
## <% tp.file.cursor() %>
