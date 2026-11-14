<%*
// New blog post. Run with "Templater: Create new note from template".
// Asks for the title and game system and saves the note as src/blog/<title-slug>.md.
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

let title = '';
while (!title) title = await ask('Post title');

// One choice per system; the post takes the label, color and emblem of that system's most recent campaign
const bySystem = new Map();
for (const c of await loadCampaigns()) if (!bySystem.has(c.system)) bySystem.set(c.system, c);
const systems = [...bySystem.values()];
const c = await pick(
  [...systems.map((x) => x.system), 'No particular system'],
  [...systems, 'none'], 'Which game system is this post about?');

const slug = title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'post';
let name = slug;
for (let n = 2; await adapter.exists(`src/blog/${name}.md`); n++) name = `${slug}-${n}`;

tR += [
  '---',
  `title: ${JSON.stringify(title)}`,
  `date: ${tp.date.now('YYYY-MM-DD')}`,
  `tags: [blog-post${c === 'none' ? '' : `, ${c.folder}`}]`,
  '---',
  '',
].join('\n');
await tp.file.move(`src/blog/${name}`);
-%>
## <% tp.file.cursor() %>
