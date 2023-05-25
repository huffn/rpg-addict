const {DateTime} = require('luxon')

module.exports = {
  layout: 'post.njk',

  eleventyComputed: {
    permalink: data => 'posts/' + data.page.filePathStem.match(/.*\/(?:\d{1,}-){0,3}(.*)/)[1] + '/',
    dateString: ({page}) => DateTime.fromJSDate(page.date, {zone: 'utc'}).toLocaleString(DateTime.DATE_FULL),
  }
};
