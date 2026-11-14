import fs from 'fs';
import path from 'path';

const ROOT = 'src/campaigns';

/**
 * Every campaign, read from the per-folder data files
 * (src/campaigns/<Folder>/<Folder>.11tydata.json), so pages outside a
 * campaign's folder (home, All campaigns, the header menu) can list them.
 * Templates order them with the byActivity filter (latest recap first).
 */
export default function () {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(ROOT, entry.name, `${entry.name}.11tydata.json`);
      if (!fs.existsSync(file)) return null;
      const { campaign } = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return {
        ...campaign,
        folder: entry.name,
        name: campaign.name || campaign.system,
        url: `/campaigns/${entry.name}/`,
        party: campaign.party || [],
        accent: validAccent(campaign.accent, file),
        // "character" may be one { name, page } or a list of them (e.g. a solo campaign)
        characters: [].concat(campaign.character || []),
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) ||
      String(b.started).localeCompare(String(a.started))
    );
}

/** { dark, light } hex colors, or null (the site's gold is used) if missing or malformed. */
function validAccent(accent, file) {
  const hex = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);
  if (accent && hex(accent.dark) && hex(accent.light)) return accent;
  if (accent) console.warn(`[campaigns] ${file}: "accent" needs "dark" and "light" hex colors; using the default.`);
  return null;
}
