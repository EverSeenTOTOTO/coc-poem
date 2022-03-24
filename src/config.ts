import puppeteer from 'puppeteer-core';
import { workspace } from 'coc.nvim';
import { PROVIDER_DIR } from '@/utils/constants';

type LaunchOptions = Parameters<typeof puppeteer.launch>[0];

export type PoemConfig = {
  updateTime: number;
  screenFPS: number;
  providersDir: string;
  launchBrowser: LaunchOptions;
};

export default async (): Promise<PoemConfig> => {
  const updateTime = workspace.getConfiguration('poem').get<number>('updateTime');
  const screenFPS = workspace.getConfiguration('poem').get<number>('screenFPS');
  const providersDir = workspace.getConfiguration('poem').get<string>('providersDir');
  const launchBrowser = workspace.getConfiguration('poem').get<LaunchOptions>('launchBrowser');

  return {
    updateTime: updateTime ?? 60000,
    screenFPS: screenFPS ?? 2,
    providersDir: providersDir ?? PROVIDER_DIR,
    launchBrowser: {
      executablePath: 'google-chrome',
      ignoreHTTPSErrors: true,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
      ],
      ...(typeof launchBrowser === 'object' ? launchBrowser : {}),
    },
  };
};
