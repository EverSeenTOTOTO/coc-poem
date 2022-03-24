module.exports.shouldUseBrowser = true;
module.exports.getPriority = 3;

module.exports.fetchData = async (api) => {
  const { name, logger, browser } = api;

  logger.info(`Fetching data for ${name}`);

  const page = await browser.newPage();
  await page.goto('https://www.example.com/');
  const content = await page.content();

  await page.close();

  return {
    content,
    commands: [
      'nnoremap <buffer><silent> i :enew <bar> startinsert<CR>',
      'nnoremap <buffer><silent> o :enew <bar> startinsert<CR><CR>',
    ],
  };
};

module.exports.shouldUpdate = (options) => {
  const { data, logger } = options;

  if (!data || data.content !== 'headless-browser') return true;

  const lastUpdate = new Date(data.lastUpdated);

  logger.info(`Last update: ${lastUpdate.toLocaleString()}`);

  return lastUpdate.getTime() < new Date().getTime() - 1000 * 60 * 10;
};
