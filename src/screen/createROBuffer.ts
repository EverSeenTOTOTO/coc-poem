/* eslint-disable import/no-extraneous-dependencies */
import { workspace } from 'coc.nvim';

export type BufferWriteOptions = {
  start: number,
  end: number,
  strictIndexing: boolean
};

export interface ROBuffer {
  id: number,
  close(): Promise<void>,
  append(content: string): Promise<void>;
  redraw(content: string, options?: BufferWriteOptions): Promise<void>;
}

export default async () => {
  const { nvim } = workspace;

  const shouldCreate = await nvim.commandOutput("echo line2byte('$') != -1");
  if (shouldCreate.trim() === '1') {
    await nvim.command('noautocmd enew', true);
  }

  // from coc.nvim and vim-startify
  nvim.pauseNotification();
  nvim.call('bufnr', ['%'], true);
  nvim.command('setl nobuflisted nocursorcolumn nocursorline nolist nonumber norelativenumber nospell noswapfile nofoldenable nowrap', true);
  nvim.command('setl buftype=nofile bufhidden=hide colorcolumn= foldcolumn=0 matchpairs= signcolumn=no synmaxcol&', true);
  nvim.command('setf log', true);
  const res = await nvim.resumeNotification();

  console.log(res[0], res[1]);

  if (res[1]) {
    throw new Error('Failed to create buffer');
  }
  const id = res[0][0];

  const isInvalidBuffer = async () => {
    const buffer = await nvim.buffer;
    return !buffer.loaded || buffer.id !== id;
  };

  return {
    id,
    append: async (content: string) => {
      if (await isInvalidBuffer()) { return; }
      await nvim.buffer.then((buffer) => buffer.append(content.split('\n')));
    },
    redraw: async (content: string, options?: BufferWriteOptions) => {
      if (await isInvalidBuffer()) { return; }
      await nvim.buffer.then((buffer) => buffer.setLines(content.split('\n'), { start: 0, end: -1, strictIndexing: false, ...options }));
    },
    async close() {
      if (await isInvalidBuffer()) { return; }
      await nvim.command('silent bwipeout!', true);
    },
  };
};
