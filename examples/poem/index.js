module.exports.shouldUseBrowser = true;
module.exports.getPriority = 3;

module.exports.shouldUpdate = (options) => {
  const { data, logger } = options;

  if (!data) return true;

  const lastUpdate = new Date(data.lastUpdated);

  logger.info(`Last update: ${lastUpdate.toLocaleString()}`);

  return lastUpdate.getTime() < new Date().getTime() - 1000 * 60 * 60 * 12;
};

module.exports.fetchData = async (options) => {
  const { logger, browser } = options;

  logger.info('Fetching poem');
  const page = await browser.newPage();

  await page.goto('https://www.gushiwen.cn/');

  const title = await page.evaluate(() => {
    return document.querySelector('body > div.main3 > div.left > div:nth-child(4) > div.cont > p:nth-child(2) > a > b').innerHTML.trim();
  });
  const author = await page.evaluate(() => {
    return document.querySelector('body > div.main3 > div.left > div:nth-child(4) > div.cont > p.source > a:nth-child(1)').innerHTML.trim();
  });
  const time = await page.evaluate(() => {
    return document.querySelector('body > div.main3 > div.left > div:nth-child(4) > div.cont > p.source > a:nth-child(2)').innerHTML.trim();
  });
  const content = await page.evaluate(() => {
    return document.querySelector('body > div.main3 > div.left > div:nth-child(4) > div.cont > div.contson').innerHTML.replaceAll(/<[^>]*?\\?>/g, '\n').replaceAll(/\n\s+/g, '\n').trim();
  });

  logger.info('Fetched poem');
  await page.close();

  return {
    content: `\n\n${title}\n\n${time}${author}\n\n${content}`,
    commands: [
      'nnoremap <buffer><silent> i :enew <bar> startinsert<CR>',
      'nnoremap <buffer><silent> o :enew <bar> startinsert<CR><CR>',
    ],
  };
};
