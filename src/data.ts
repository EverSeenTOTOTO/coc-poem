import { ExtensionContext } from 'coc.nvim';
import fs from 'fs';
import path from 'path';
import { logger } from '@/utils/logger';
import { PoemConfig } from './config';
import Screen from './screen';

export type SavedData = {
  lastUpdated: number,
  type: string,
  provider: string,
  content?: string,
  commands?: string[]
};

export async function clearData(_context: ExtensionContext, config: PoemConfig) {
  const dataPath = path.join(config.providersDir, 'data.json');

  return fs.promises.unlink(dataPath).then(() => {
    logger.info('Cleared data');
  });
}

export async function loadData(_context: ExtensionContext, config: PoemConfig) {
  try {
    const dataPath = path.join(config.providersDir, 'data.json');
    const data = await fs.promises.readFile(dataPath, 'utf8');
    const res = JSON.parse(data) as SavedData;

    logger.info('Loaded data');

    return res;
  } catch (e) {
    logger.error(`Failed to load data: ${e.stack ?? e.message}`);

    return undefined;
  }
}

export async function saveData(_context: ExtensionContext, config: PoemConfig, data: Omit<SavedData, 'lastUpdated'>) {
  const dataPath = path.join(config.providersDir, 'data.json');

  return fs.promises.writeFile(dataPath, JSON.stringify({ ...data, lastUpdated: Date.now() }, null, 2)).then(() => {
    logger.info('Saved data');
  });
}

export async function displayData(context: ExtensionContext, config: PoemConfig, data: SavedData) {
  const screen = new Screen({
    FPS: config.screenFPS,
  });

  context.subscriptions.push({
    dispose() {
      screen.hide();
    },
  });

  await screen.render(data.content ?? '');
  await screen.show();
}
