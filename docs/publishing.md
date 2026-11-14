# Publishing guide

Everything is a file edit under `src/`. Preview with `npm start`, then commit and push to `main`; the push deploys the site to GitHub Pages.

The quickest way to create these files is with the Obsidian templates in `templates/` (see [Obsidian templates](#obsidian-templates)). The sections below describe what the templates do, so you can also make the files by hand.

- [Obsidian templates](#obsidian-templates)
- [1. New campaign in a new system](#1-new-campaign-in-a-new-system)
- [2. New campaign in a system you've used before](#2-new-campaign-in-a-system-youve-used-before)
- [3. New recap](#3-new-recap)
- [4. New blog post](#4-new-blog-post)
- [5. Character page](#5-character-page)

## Obsidian templates

`templates/` holds four [Templater](https://github.com/SilentVoid13/Templater) templates. Each one asks a few questions, then creates the files with the right front matter in the right folder:

| Template | Asks for | Creates |
| --- | --- | --- |
| New campaign | name, system, folder, key, start month, accent color, emblem, banner, party | the campaign folder, data file, campaign page and recaps folder |
| New recap | campaign, date, session number, title, next session date | `recaps/YY-MM-DD.md` in that campaign |
| New blog post | title, game system | `src/blog/<title>.md` |
| New character | campaign, name, page name, portrait, whether you play them | the character page, linked from the campaign's data file |

### One-time setup

1. In Obsidian, open **Settings → Community plugins**, turn off Restricted mode if it's on, then **Browse**, find **Templater**, install it and enable it.
2. In **Settings → Templater**, set **Template folder location** to `templates`.
3. Optional: under **Template hotkeys**, add a hotkey for the templates you use most, such as `templates/New recap.md`.
4. Optional: turn on **Automatic jump to cursor**, so the cursor lands where you start writing.

Don't use Obsidian's built-in **Templates: Insert template** command on these files; it would paste the script instead of running it.

### Using a template

1. Open the command palette (⌘P) and run **Templater: Create new note from template**, or press its hotkey.
2. Pick the template and answer the prompts. Press Enter to accept a suggested answer; press Escape to cancel, which removes the empty note.
3. The note moves into place and opens, ready to write.

Add any images to `src/assets/` before you start, so they're in the image lists. The newest images are listed first.

## 1. New campaign in a new system

1. **Make the system emblem.** Save a square image of the system's logo to `src/assets/`, for example `src/assets/Daggerheart-square.jpg`. It's used on cards, in search results and in link previews.
2. **Optional banner.** A wide image for the top of the campaign page also goes in `src/assets/`.
3. **Create the campaign folder** under `src/campaigns/`. Use a short name such as `DagHrt`; it becomes the URL (`/campaigns/DagHrt/`) and the tag your recaps use.
4. **Add the campaign data file** at `src/campaigns/DagHrt/DagHrt.11tydata.json`. The file name must match the folder name:

   ```json
   {
     "campaign": {
       "key": "dh",
       "accent": { "dark": "#ff8a7a", "light": "#b03a2e" },
       "folder": "DagHrt",
       "name": "Campaign Name",
       "system": "Daggerheart",
       "started": "2026-12",
       "ended": null,
       "status": "active",
       "ogImage": "src/assets/Daggerheart-square.jpg",
       "heroImage": "src/assets/DaggerheartBanner.jpg",
       "heroAlt": "Description of the banner",
       "party": [
         { "name": "Character One" },
         { "name": "Character Two" }
       ]
     }
   }
   ```

   - `key` is a short unique ID that ties the campaign's pages to its accent color.
   - `accent` is the campaign's color: `dark` for dark mode (bright enough to read on navy) and `light` for light mode (dark enough to read on white). Without it, the campaign uses Fabula Ultima's gold.
   - `folder` must match the folder name.
   - Leave out `heroImage` and `heroAlt` if there's no banner.

5. **Add the campaign page** at `src/campaigns/DagHrt/index.md`. Its title comes from `name` in the data file:

   ```md
   ---
   layout: layouts/campaign.html
   ---
   A paragraph or two about the campaign.
   ```

6. **Set up the recaps folder.** Copy these two files from an existing campaign into `src/campaigns/DagHrt/recaps/`:
   - `index.md`
   - `recaps.11tydata.json`

## 2. New campaign in a system you've used before

Follow section 1, except:

- **Step 1:** skip it and point `ogImage` at the existing emblem, for example `src/assets/FabulaUltima-square.jpg`.
- Still give the campaign its own `key` and `accent`, so the two campaigns look different.

If the new campaign replaces one that's ending, edit the old campaign's data file and set:

- `"status": "complete"`
- `"ended": "2026-12"`

The header shows the two active campaigns with the most recent recaps. Any others are under All campaigns.

## 3. New recap

1. **Create the file** in the campaign's `recaps/` folder, named by date, for example `src/campaigns/FabUlt/recaps/26-11-19.md`:

   ```md
   ---
   tags: [recap, FabUlt]
   date: 2026-11-19
   session: 14
   title: Session Title
   next-session: 2026-12-03
   ---
   ## First Chapter
   Text…

   ## Second Chapter
   Text…
   ```

2. **Check the front matter:**
   - The tags must include `recap` and the campaign's folder name.
   - Each `##` heading becomes an entry in the Chapters list.
   - `session: 0` marks a session-zero brief; it isn't counted as a played session.
   - `next-session` is optional. It shows the next game date until that date passes.
   - Leave `title` out and the file name is used instead.

3. **Add any media.** Put files in `src/assets/` and link them as `![caption](src/assets/file.jpg)`. Images become captioned figures, `.mp3` files get an audio player, and `.mp4` files become video. A video uses `<name>-poster.jpg` as its thumbnail if that file exists.

The home page card, the campaign page and the header order all update on their own.

## 4. New blog post

1. **Create the file** in `src/blog/`, for example `src/blog/my-post.md`:

   ```md
   ---
   title: "Post Title"
   date: 2026-11-20
   tags: [blog-post, CoM]
   ---
   ## Section
   Text…
   ```

2. **Check the tags.** `blog-post` puts the post on the blog. The campaign folder tag (here `CoM`) supplies:
   - the system name in the "Blog · City of Mist" label
   - the accent color
   - the search thumbnail

   The site only knows a system through a campaign, so a post about a system you've never run gets a plain "Blog" label.

## 5. Character page

1. **Add the portrait** to `src/assets/`.
2. **Create the page** in the campaign folder, for example `src/campaigns/ToX/Telemachus.md`:

   ```md
   ---
   title: Telemachus
   tags: [ToX]
   layout: layouts/character.html
   portrait: src/assets/telemachus.png
   ogImage: src/assets/telemachus.png
   ---
   ## General Description
   …
   ```

   The page's address comes from the file name, for example `/campaigns/ToX/Telemachus/`. The portrait shows in the sidebar, so don't repeat it in the body.

3. **Link the page from the campaign** in the campaign's data file:
   - Add `"character": { "name": "Telemachus", "page": "/campaigns/ToX/Telemachus/" }`. This shows "Character" on the campaign page and the cards.
   - On that character's entry in `party`, add `"page"` and `"portrait"`, so the party list shows the picture and links to the page:

     ```json
     { "name": "Telemachus", "page": "/campaigns/ToX/Telemachus/", "portrait": "src/assets/telemachus.png" }
     ```

### More than one character

`character` can also be a list, for example in a solo campaign where you write up every character:

```json
"character": [
  { "name": "Aria", "page": "/campaigns/Solo/Aria/" },
  { "name": "Bren", "page": "/campaigns/Solo/Bren/" }
]
```

Each character listed:

- gets its own "Character" row in the campaign page menu
- links to the others from its sidebar menu, so readers can move between them

Campaign cards list up to two names; with three or more they show a count, such as "3 characters".

Party members who aren't in `character` can still get pages; give their `party` entry a `page` and `portrait`.
