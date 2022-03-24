/* eslint-disable import/no-extraneous-dependencies */
import { workspace } from 'coc.nvim';

export type BufferWriteOptions = {
  start: number,
  end: number,
  strictIndexing: boolean
};

export interface ROBuffer {
  id: number,
  append(content: string): Promise<void>;
  redraw(content: string, options?: BufferWriteOptions): Promise<void>;
}

export default async () => {
  const { nvim } = workspace;

  const shouldCreate = await nvim.commandOutput("echo line2byte('$') != -1");
  if (shouldCreate.trim() === '1') {
    await nvim.command('noautocmd enew');
  }

  // FIXME: got wrong buffer id because of async
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
    append: async (content: string) => {
      if (await isInvalidBuffer()) { return; }
      await nvim.command('setl modifiable', true);
      await nvim.buffer.then((buffer) => buffer.append(content.split('\n')));
      await nvim.command('setl nomodifiable nomodified', true);
    },
    redraw: async (content: string, options?: BufferWriteOptions) => {
      if (await isInvalidBuffer()) { return; }
      await nvim.command('setl modifiable', true);
      await nvim.buffer.then((buffer) => buffer.setLines(content.split('\n'), { start: 0, end: -1, strictIndexing: false, ...options }));
      await nvim.command('setl nomodifiable nomodified', true);
    },
  };
};
