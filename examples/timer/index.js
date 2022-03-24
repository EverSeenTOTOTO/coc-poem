module.exports.getPriority = 2;

const Numbers = [
  { 0: ' ____ ', 1: '      ', 2: ' ____ ', 3: ' ____ ', 4: '      ', 5: ' ____ ', 6: ' ____ ', 7: ' ____ ', 8: ' ____ ', 9: ' ____ ', dot: '     ' },
  { 0: '|    |', 1: '     |', 2: '     |', 3: '     |', 4: '|    |', 5: '|     ', 6: '|     ', 7: '     |', 8: '|    |', 9: '|    |', dot: '     ' },
  { 0: '|    |', 1: '     |', 2: ' ____|', 3: ' ____|', 4: '|____|', 5: '|____ ', 6: '|____ ', 7: '     |', 8: '|____|', 9: '|____|', dot: '  *  ' },
  { 0: '|    |', 1: '     |', 2: '|     ', 3: '     |', 4: '     |', 5: '     |', 6: '|    |', 7: '     |', 8: '|    |', 9: '     |', dot: '  *  ' },
  { 0: '|____|', 1: '     |', 2: '|____ ', 3: ' ____|', 4: '     |', 5: ' ____|', 6: '|____|', 7: '     |', 8: '|____|', 9: ' ____|', dot: '     ' },
];

const format = (num, i) => String(num < 10 ? `0${num}` : num).split('').map((ch) => Numbers[i][ch]).join('');
const getClockText = (hour, min, sec) => {
  const result = [];
  for (let i = 0; i < 5; ++i) {
    result.push(`${format(hour, i)}${Numbers[i].dot}${format(min, i)}${Numbers[i].dot}${format(sec, i)}`);
  }
  return result.join('\n');
};

module.exports.prepareScreen = async (options) => {
  const { logger, coc, screen, context } = options;
  const { workspace } = coc;
  const { nvim } = workspace;

  await Promise.all([
    nvim.command('nnoremap <buffer><silent> i :enew <bar> startinsert<CR>'),
    nvim.command('nnoremap <buffer><silent> o :enew <bar> startinsert<CR><CR>'),
  ]);

  const render = () => {
    const date = new Date();

    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();

    try {
      screen.render(getClockText(hour, minute, second));
    } catch (e) {
      logger.error(e.stack || e.message);
    }
  };

  render();
  const interval = setInterval(render, 1000);

  context.subscriptions.push({
    dispose() {
      clearInterval(interval);
    },
  });
};
