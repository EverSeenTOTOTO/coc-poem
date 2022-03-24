/* eslint-disable import/no-extraneous-dependencies */
import { workspace } from 'coc.nvim';

export interface ROBuffer {
  id: number,
  append(content: string, place?: string|number): Promise<void>;
  redraw(content: string, place?: string|number): Promise<void>;
}

export default async () => {
  const { nvim } = workspace;

  const shouldCreate = await nvim.commandOutput("echo line2byte('$') != -1");
  if (shouldCreate.trim() === '1') {
    await nvim.command('noautocmd enew');
  }

  // FIXME: got wrong buffer id as async
  const id = await nvim.call('bufnr', ['%']);

  // see vim-startify
  await nvim.command('silent! setlocal bufhidden=wipe colorcolumn= foldcolumn=0 matchpairs= modifiable nobuflisted nocursorcolumn nocursorline nolist nonumber noreadonly norelativenumber nospell noswapfile signcolumn=no synmaxcol&', true);

  const isInvalidBuffer = async () => {
    const [exists, currentId] = await Promise.all([
      nvim.commandOutput(`echo bufexists(${id})`),
      nvim.call('bufnr', ['%']),
    ]);
    return exists.trim() === '0' || currentId !== id;
  };

  return {
    id,
    append: async (content: string, place = '$') => {
      if (await isInvalidBuffer()) { return; }
      await nvim.command('setl modifiable', true);
      await nvim.command(`call appendbufline("${id}", "${place}", split("${content}", "\n"))`, true);
      await nvim.command('setl nomodifiable nomodified', true);
    },
    redraw: async (content: string, place = 1) => {
      if (await isInvalidBuffer()) { return; }
      await nvim.command('setl modifiable', true);
      await nvim.command('silent %delete _', true);
      await nvim.command(`call setbufline(${id}, ${place}, split("${content}", "\n"))`, true);
      await nvim.command('setl nomodifiable nomodified', true);
    },
  };
};
