import { execSync } from 'child_process';
import { DateTime } from "luxon";
import eleventyGenerateOgImage from './eleventy-generate-og-image.js';
import * as helpers from './lib/helpers.js';


export default function (eleventyConfig) {
  eleventyConfig.setInputDirectory('./src');
  eleventyConfig.setOutputDirectory('./dist');
  // Set directories to pass through to the dist folder
  eleventyConfig.addPassthroughCopy({ 'src/css': 'css' });
  eleventyConfig.addPassthroughCopy({ 'src/js': 'js' });
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });

  eleventyConfig.amendLibrary('md', (mdLib) => {
    mdLib.set({ html: true, linkify: true, typographer: true });

    // Give h2/h3 headings ids, so chapter lists and search results can link to them
    mdLib.core.ruler.push('heading_ids', (state) => {
      const used = new Set();
      state.tokens.forEach((token, i) => {
        if (token.type !== 'heading_open' || !['h2', 'h3'].includes(token.tag) || token.attrGet('id')) return;
        const base = helpers.slugify(state.tokens[i + 1].content) || 'section';
        let id = base;
        for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
        used.add(id);
        token.attrSet('id', id);
      });
    });
  });

  eleventyConfig.addGlobalData('eleventyComputed', {
    title: (data) => {
      // A campaign page is titled with the campaign's own name, not its system
      if (data.layout?.endsWith('/campaign.html') && data.campaign) {
        return data.campaign.name || data.campaign.system;
      }
      if (data.title) return data.title;
      const slug = data.page?.fileSlug || '';
      const cleanedSlug = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
      return cleanedSlug
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
    },
    // The campaign a page belongs to: its folder's campaign, or (for blog posts) a campaign tag
    currentCampaign: (data) => {
      const all = data.campaigns || [];
      const folder = data.campaign?.folder ||
        (data.tags || []).find((tag) => all.some((c) => c.folder === tag));
      return all.find((c) => c.folder === folder);
    },
    // The small uppercase line above a page title (also used on link preview images)
    kicker: (data) => {
      const c = data.currentCampaign;
      const layout = data.layout || '';
      if (layout.endsWith('/recap.html')) {
        return [c?.name, data.session != null ? `Session ${data.session}` : null].filter(Boolean).join(' · ');
      }
      if (layout.endsWith('/character.html')) return c ? `${c.name} · Character` : 'Character';
      // Blog posts are about a game system in general, not one campaign
      if (layout.endsWith('/post.html')) return c ? `Blog · ${c.system}` : 'Blog';
      if (layout.endsWith('/campaign.html')) return `Campaign · ${c?.status === 'active' ? 'Active' : 'Complete'}`;
      if (layout.endsWith('/recap-list.html')) return c?.name || '';
      return '';
    },
  });

  eleventyConfig.addTransform('assetPaths', function (content) {
    if (!this.page.outputPath?.endsWith('.html')) return content;
    return content.replace(/(src|href|poster)="src\/assets\//g, '$1="/assets/');
  });

  eleventyConfig.addFilter('luxonDate', (dateObj, format = 'yyyy-MM-dd') => {
    if (!dateObj) return '';
    return DateTime.fromJSDate(new Date(dateObj), { zone: 'utc'}).toFormat(format);
  });
  eleventyConfig.addFilter('readingTime', helpers.readingTime);
  eleventyConfig.addFilter('toc', helpers.toc);
  eleventyConfig.addFilter('enhance', helpers.enhance);
  eleventyConfig.addFilter('campaignRecaps', helpers.campaignRecaps);
  eleventyConfig.addFilter('sessionCount', helpers.sessionCount);
  eleventyConfig.addFilter('nextSession', helpers.nextSession);
  eleventyConfig.addFilter('upcoming', helpers.upcoming);
  eleventyConfig.addFilter('monthYear', helpers.monthYear);
  eleventyConfig.addFilter('neighbors', helpers.neighbors);
  eleventyConfig.addFilter('sessionOf', helpers.sessionOf);
  eleventyConfig.addFilter('withStatus', helpers.withStatus);
  eleventyConfig.addFilter('byActivity', helpers.byActivity);
  eleventyConfig.addFilter('characterNames', helpers.characterNames);

  eleventyConfig.addCollection("blogPosts", (collectionApi) => {
    return collectionApi.getFilteredByTag("blog-post").sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addPlugin(eleventyGenerateOgImage)

  eleventyConfig.on('eleventy.after', async () => {
    execSync(`npx pagefind --site dist --glob "**/index.html"`, { encoding: 'utf-8' });
  })

}

export const config = {
  markdownTemplateEngine: 'njk',
  htmlTemplateEngine: 'njk',
  templateFormats: ['md', 'njk', 'html']
}
