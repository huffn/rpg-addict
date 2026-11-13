import eleventyNavigationPlugin from "@11ty/eleventy-navigation";
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { DateTime } from "luxon";
import eleventyGenerateOgImage from './eleventy-generate-og-image.js';


export default function (eleventyConfig) {
  eleventyConfig.setInputDirectory('./src');
  eleventyConfig.setOutputDirectory('./dist');
  // Set directories to pass through to the dist folder
  eleventyConfig.addPassthroughCopy({ 'src/css': 'css' });
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  eleventyConfig.amendLibrary('md', (mdLib) => {
    mdLib.set({ html: true, linkify: true, typographer: true });
  });

  eleventyConfig.addGlobalData('eleventyComputed', {
    title: (data) => {
      if (data.title) return data.title;
      const slug = data.page?.fileSlug || '';
      const cleanedSlug = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
      return cleanedSlug
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
    }
  });

  eleventyConfig.addTransform('show-video', (content) => {
    const regex = /<img\s+[^>]*src="(.+\.mp4)"\s+[^>]*alt="([^"]*)"[^>]*>/gi;

    const updatedContent = content.replace(regex, (match, src, alt) => {
      // Use a "<name>-poster.jpg" still next to the video as its thumbnail, if one exists
      const posterPath = src.replace(/\.mp4$/i, '-poster.jpg');
      const poster = existsSync(posterPath)
        ? ` poster="${posterPath.replace(/^src\/assets\//, '/assets/')}"`
        : '';
      return `<video src="${src}" title="${alt}"${poster} controls preload="metadata"></video>`;
    });
    return updatedContent;
  });

  eleventyConfig.addTransform('show-audio', (content) => {
    const regex = /<img\s+[^>]*src="(.+\.(?:mp3|m4a|ogg|wav))"\s+[^>]*alt="([^"]*)"[^>]*>/gi;

    return content.replace(regex, (match, src, alt) => {
      return `<audio src="${src}" title="${alt}" controls></audio>`;
    });
  });

  eleventyConfig.addTransform('assetPaths', function (content) {
    if (!this.page.outputPath?.endsWith('.html')) return content;
    return content.replace(/(src|href)="src\/assets\//g, '$1="/assets/');
  });

  eleventyConfig.addFilter('luxonDate', (dateObj, format = 'yyyy-MM-dd') => {
    if (!dateObj) return '';
    return DateTime.fromJSDate(new Date(dateObj), { zone: 'utc'}).toFormat(format);
  })

  eleventyConfig.addCollection("blogPosts", (collectionApi) => {
    return collectionApi.getFilteredByTag("blog-post");
  });

  eleventyConfig.addPlugin(eleventyGenerateOgImage)

  eleventyConfig.on('eleventy.after', async () => {
    execSync(`npx pagefind --site dist`, { encoding: 'utf-8' });
  })

}

export const config = {
  markdownTemplateEngine: 'njk',
  htmlTemplateEngine: 'njk',
  templateFormats: ['md', 'njk', 'html']
}
