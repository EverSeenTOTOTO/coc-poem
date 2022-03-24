/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import fs from 'fs';
import cp from 'child_process';
import puppeteer from 'puppeteer-core';
import { callMaybeAsync, MaybeAsync, PoemDataTypes } from '@/utils/constants';
import createLogger, { logger, Logger, onerror } from '@/utils/logger';
import * as coc from 'coc.nvim';
import { PoemConfig } from './config';
import { SavedData, loadData, clearData } from './data';
import Screen from './screen';

export type ProviderApi = {
  name: string;
  root: string;
  logger: Logger;
  config: PoemConfig;
  coc: typeof coc;
  context: coc.ExtensionContext;
  data?: SavedData;
};

// User Defined Provider
export interface ProviderUD {
  shouldUpdate?: MaybeAsync<boolean, ProviderApi>;
  shouldUseBrowser?: MaybeAsync<boolean, ProviderApi>;
  getPriority?: MaybeAsync<number, ProviderApi>;
  fetchData?: MaybeAsync<{ content: any, commands?: string[] }, ProviderApi & { browser?: puppeteer.Browser }>
  prepareScreen?: MaybeAsync<void, ProviderApi & { screen: Screen }>
}

// Real Provider
export interface Provider {
  name: string;
  root: string;
  logger: Logger;
  config: PoemConfig;
  coc: typeof coc;
  context: coc.ExtensionContext;
  data?: SavedData;
  shouldUseBrowser: boolean;
  fetchData?: (browser?: puppeteer.Browser) => Promise<{ content: any, commands?: string[] }>;
  prepareScreen?: (screen: Screen) => Promise<void>;
}

const resolveProviderEntry = async (root: string, name: string) => {
  const entry = path.resolve(root, name, 'index.js');

  return fs.existsSync(entry) && fs.statSync(entry).isFile() ? entry : undefined;
};

async function loadProvider(name: string, context: coc.ExtensionContext, config: PoemConfig): Promise<(ProviderApi & { required: any })|undefined> {
  const entry = await resolveProviderEntry(config.providersDir, name);

  if (!entry) {
    return undefined;
  }

  try {
    // eslint-disable-next-line import/no-dynamic-require, @typescript-eslint/no-var-requires, global-require
    const required = require(entry);
    const root = path.dirname(entry);
    const plogger = createLogger(name);

    return {
      required: {
        shouldUpdate: true,
        shouldUseBrowser: false,
        getPriority: 0,
        ...required,
      },
      name,
      root,
      logger: plogger,
      config,
      coc,
      context,
    };
  } catch (e) {
    return onerror()(e);
  }
}

async function loadAllProviders(context: coc.ExtensionContext, config: PoemConfig): Promise<(ProviderApi & { required: any })[]> {
  const dirs = await fs.promises.readdir(config.providersDir);

  return Promise.all(dirs.map((dir) => loadProvider(dir, context, config)))
    .then((xs) => xs.filter((x) => x)) as Promise<(ProviderApi & { required: any })[]>;
}

async function isAvailable(item: ProviderApi & { required: any }) {
  const { required } = item;

  logger.info(`Checking availability of ${item.name}`);

  return callMaybeAsync(required.shouldUpdate, item);
}

export async function loadAvailableProviders(context: coc.ExtensionContext, config: PoemConfig): Promise<Provider[]> {
  const requireds = await loadAllProviders(context, config);
  const data = await loadData(context, config);
  const enabled = await Promise.all(requireds.map(async (x) => {
    // eslint-disable-next-line no-param-reassign
    x.data = data; // attach data

    const [available, priority] = await Promise.all([
      isAvailable(x),
      callMaybeAsync(x.required.getPriority, x),
    ]);

    return { available, priority, ...x };
  }));

  if (enabled.length === 0) { clearData(context, config); }

  const filtered = enabled
    .filter((x) => x.available)
    .sort((a, b) => b.priority - a.priority);

  logger.info(`Loaded ${filtered.length} providers: ${filtered.map((x) => x.name).join(', ')}`);

  return Promise.all(filtered.map(async (x) => {
    const shouldUseBrowser = await callMaybeAsync(x.required.shouldUseBrowser, x);
    const fetchData = x.required.fetchData
      ? (browser?: puppeteer.Browser) => callMaybeAsync(x.required.fetchData, { ...x, browser })
      : undefined;
    const prepareScreen = (screen: Screen) => callMaybeAsync(x.required.prepareScreen, { ...x, screen });

    return {
      ...x,
      data,
      shouldUseBrowser,
      fetchData,
      prepareScreen,
    };
  }));
}

export async function loadSingleProvider(data: SavedData, context: coc.ExtensionContext, config: PoemConfig): Promise<Provider|undefined> {
  const name = data.content;
  const x = await loadProvider(name, context, config);

  if (x) x.data = data; // attach data
  if (x && await isAvailable(x)) {
    const shouldUseBrowser = await callMaybeAsync(x.required.shouldUseBrowser, x);
    const fetchData = x.required.fetchData
      ? (browser?: puppeteer.Browser) => callMaybeAsync(x.required.fetchData, { ...x, browser })
      : undefined;
    const prepareScreen = (screen: Screen) => callMaybeAsync(x.required.prepareScreen, { ...x, screen });

    return {
      ...x,
      data,
      shouldUseBrowser,
      fetchData,
      prepareScreen,
    };
  }

  return undefined;
}

export async function runProviderFetch(provider: Provider, context: coc.ExtensionContext, config: PoemConfig): Promise<Omit<SavedData, 'lastUpdated'>|undefined> {
  if (!provider.fetchData) {
    return {
      type: PoemDataTypes.ProviderName,
      content: provider.name,
    };
  }

  let browser: puppeteer.Browser|undefined;
  let pid: number|undefined;

  context.subscriptions.push({
    dispose() {
      // process.kill is not allowed in extension context
      if (pid) { cp.exec(`kill -9 ${pid}`); }
      browser?.close();
    },
  });

  if (provider.shouldUseBrowser) {
    browser = await puppeteer.launch(config.launchBrowser);
    pid = browser?.process()?.pid;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    logger.info(`Launch browser: ${config.launchBrowser!.executablePath}, pid: ${pid}`);
  }

  const { content, commands } = await provider.fetchData(browser);

  if (pid) { cp.exec(`kill -9 ${pid}`); }
  browser = undefined;

  return {
    content,
    commands,
    type: PoemDataTypes.Content,
  };
}

export async function runProviderPrepare(provider: Provider, context: coc.ExtensionContext, config: PoemConfig) {
  if (!provider.prepareScreen) { return; }

  const screen = new Screen({
    FPS: config.screenFPS,
  });

  context.subscriptions.push({
    dispose() {
      screen.hide();
    },
  });

  await screen.show();
  await provider.prepareScreen(screen);
}
