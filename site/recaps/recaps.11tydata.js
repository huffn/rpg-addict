const {DateTime} = require('luxon')

module.exports = {
  layout: 'recap.njk',

  eleventyComputed: {
    permalink: "recaps/{{ title | slugify }}/index.html",
    dateString: ({page}) => DateTime.fromJSDate(page.date, {zone: 'utc'}).toLocaleString(DateTime.DATE_FULL),
  }
};
