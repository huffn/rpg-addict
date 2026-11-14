import { existsSync } from 'fs';
import * as cheerio from 'cheerio';

const MEDIA_VIDEO = /\.mp4$/i;
const MEDIA_AUDIO = /\.(mp3|m4a|ogg|wav)$/i;

/** Lowercase, hyphenated id for a heading, e.g. "Tessel Rootbinder" → "tessel-rootbinder". */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Minutes to read at 200 words a minute, rounded up. */
export function readingTime(html = '') {
  const words = String(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Headings with ids in rendered content: [{ id, text, level }]. */
export function toc(html = '', selector = 'h2') {
  const $ = cheerio.load(String(html), null, false);
  return $(selector).filter('[id]').map((_, el) => ({
    id: $(el).attr('id'),
    text: $(el).text().trim(),
    level: Number(el.tagName.slice(1)),
  })).get();
}

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function videoHtml(src, alt) {
  // Use a "<name>-poster.jpg" still next to the video as its thumbnail, if one exists
  const posterPath = src.replace(MEDIA_VIDEO, '-poster.jpg');
  const poster = existsSync(posterPath) ? ` poster="${posterPath}"` : '';
  return `<video src="${src}" title="${alt}"${poster} controls preload="metadata"></video>`;
}

function audioHtml(src, alt) {
  return `<div class="player" data-player>
  <button class="player-btn" type="button" aria-label="Play ${alt}"><span aria-hidden="true">▶</span></button>
  <div class="player-main">
    <div class="player-top"><span class="player-title">${alt}</span><span class="player-time">${formatTime(0)}</span></div>
    <div class="player-bar" aria-hidden="true"><div class="player-fill"></div></div>
  </div>
  <audio src="${src}" preload="metadata" controls></audio>
</div>`;
}

/**
 * Restyles markdown output for the menu-screen design:
 * - images become framed <figure>s (a trailing link becomes the caption,
 *   several images in one paragraph become a grid)
 * - .mp4 / .mp3 "images" become <video> / a styled audio player
 * - "**Term** - definition" lists become a definition-list panel
 */
export function enhance(html = '') {
  const $ = cheerio.load(String(html), null, false);

  $('p').each((_, p) => {
    const $p = $(p);
    const imgs = $p.children('img');
    if (!imgs.length) return;
    const others = $p.contents().filter((_, n) =>
      !(n.type === 'text' && !n.data.trim()) && n.tagName !== 'img' && n.tagName !== 'br');
    const caption = others.length === 1 && others.first().is('a') ? others.first() : null;
    if (others.length && !caption) return; // an image inside running text: leave it alone

    const figures = imgs.map((_, img) => {
      const src = $(img).attr('src') || '';
      const alt = $(img).attr('alt') || '';
      if (MEDIA_AUDIO.test(src)) return audioHtml(src, alt);
      const media = MEDIA_VIDEO.test(src) ? videoHtml(src, alt) : $.html(img);
      const kind = MEDIA_VIDEO.test(src) ? ' figure-video' : '';
      return `<figure class="figure${kind}">${media}</figure>`;
    }).get();

    if (caption && figures.length === 1) {
      figures[0] = figures[0].replace('</figure>', `<figcaption>${$.html(caption)}</figcaption></figure>`);
    }
    const out = figures.length > 1 ? `<div class="figure-grid">${figures.join('')}</div>` : figures[0];
    $p.replaceWith(out);
  });

  $('ul').each((_, ul) => {
    const items = $(ul).children('li');
    const terms = items.map((_, li) => {
      const first = li.children.find((n) => !(n.type === 'text' && !n.data.trim()));
      if (!first || first.tagName !== 'strong') return null;
      const rest = $(li).clone();
      rest.children('strong').first().remove();
      const body = rest.html().replace(/^(?:\s|&nbsp;)*[-–—:](?:\s|&nbsp;)*/, '');
      if (body === rest.html()) return null; // no "Term - " separator
      return `<div class="term"><dt>${$(first).html()}</dt><dd>${body}</dd></div>`;
    }).get();
    if (items.length > 1 && terms.length === items.length) {
      $(ul).replaceWith(`<dl class="term-list panel">${terms.join('')}</dl>`);
    }
  });

  $('table').each((_, table) => {
    $(table).wrap('<div class="table-wrap"></div>');
  });

  return $.html();
}

/** A campaign's recaps (including a session-0 brief), oldest first. */
export function campaignRecaps(recaps = [], folder) {
  return recaps
    .filter((item) => item.data.tags?.includes(folder))
    .sort((a, b) => a.date - b.date);
}

/** Number of played sessions, leaving out a session-0 brief. */
export function sessionCount(recaps = []) {
  return recaps.filter((item) => item.data.session !== 0).length;
}

/** The next session date for an active campaign, or null once it has passed. */
export function nextSession(campaign, recaps = []) {
  if (!campaign || campaign.status !== 'active' || !recaps.length) return null;
  return upcoming(recaps[recaps.length - 1].data['next-session']);
}

/** The date if it is today or later (UTC), otherwise null. */
export function upcoming(date) {
  if (!date) return null;
  const when = new Date(date);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return when >= today ? when : null;
}

/** "Feb 2026" from "2026-02". */
export function monthYear(value) {
  if (!value) return '';
  const [year, month] = String(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** The item at url in a list, with the ones before and after it. */
export function neighbors(items = [], url) {
  const i = items.findIndex((item) => item.url === url);
  return {
    current: items[i] || null,
    prev: i > 0 ? items[i - 1] : null,
    next: i >= 0 && i < items.length - 1 ? items[i + 1] : null,
  };
}

/** The recap with the given session number, if any. */
export function sessionOf(recaps = [], session) {
  return recaps.find((item) => item.data.session === session) || null;
}

/** Campaigns with the given status ("active" or "complete"). */
export function withStatus(campaigns = [], status) {
  return campaigns.filter((c) => c.status === status);
}

/**
 * Campaigns ordered by most recent activity: active ones first, then by the
 * date of their latest recap (or their start date if no recap exists yet).
 */
export function byActivity(campaigns = [], recaps = []) {
  const lastActivity = (c) => {
    const dates = recaps.filter((r) => r.data.tags?.includes(c.folder)).map((r) => +r.date);
    return dates.length ? Math.max(...dates) : +new Date(c.started || 0);
  };
  return campaigns
    .map((c) => ({ c, at: lastActivity(c) }))
    .sort((a, b) =>
      (a.c.status === 'active' ? 0 : 1) - (b.c.status === 'active' ? 0 : 1) || b.at - a.at)
    .map(({ c }) => c);
}
