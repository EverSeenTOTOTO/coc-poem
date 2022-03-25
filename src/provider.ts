/* eslint-disable @typescript-eslint/no-explicit-any */
import { callMaybeAsync, MaybeAsync, PoemDataTypes } from '@/utils/constants';
import createLogger, { logger, Logger, onerror } from '@/utils/logger';
import cp from 'child_process';
import * as coc from 'coc.nvim';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { PoemConfig } from './config';
import { clearData, loadData, SavedData } from './data';
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

async function loadScript(name: string, context: coc.ExtensionContext, config: PoemConfig): Promise<(ProviderApi & { required: any })|undefined> {
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

async function loadAllScripts(context: coc.ExtensionContext, config: PoemConfig): Promise<(ProviderApi & { required: any })[]> {
  const dirs = await fs.promises.readdir(config.providersDir);

  return Promise.all(dirs.map((dir) => loadScript(dir, context, config)))
    .then((xs) => xs.filter((p) => p)) as Promise<(ProviderApi & { required: any })[]>;
}

async function buildProvider(p: ProviderApi & { required: any }): Promise<Provider> {
  const shouldUseBrowser = await callMaybeAsync(p.required.shouldUseBrowser, p);
  const fetchData = p.required.fetchData
    ? (browser?: puppeteer.Browser) => callMaybeAsync(p.required.fetchData, { ...p, browser })
    : undefined;
  const prepareScreen = (screen: Screen) => callMaybeAsync(p.required.prepareScreen, { ...p, screen });

  return {
    ...p,
    shouldUseBrowser,
    fetchData,
    prepareScreen,
  };
}

export async function loadAvailableProviders(context: coc.ExtensionContext, config: PoemConfig): Promise<Provider[]> {
  const requireds = await loadAllScripts(context, config);
  const data = await loadData(context, config);
  const enabled = await Promise.all(requireds.map(async (p) => {
    // eslint-disable-next-line no-param-reassign
    if (data && data.provider === p.name) p.data = data; // attach previous data

    const [available, priority] = await Promise.all([
      callMaybeAsync(p.required.shouldUpdate, p),
      callMaybeAsync(p.required.getPriority, p),
    ]);

    return { available, priority, ...p };
  }));

  if (enabled.length === 0) {
    return [];
  }

  const sorted = enabled.sort((a, b) => b.priority - a.priority);
  const prevProvider = sorted.filter((x) => x.name === data?.provider)[0];

  logger.info(`Provider priority, prev: ${data?.provider}(${prevProvider.priority ?? 'Deleted'}), now: ${sorted[0].name}(${sorted[0].priority})`);
  // priority not change
  if (sorted[0].name === prevProvider.name) {
    return sorted[0].available ? [await buildProvider(sorted[0])] : [];
  }

  logger.info(`Provider changed to ${sorted[0].name}, will clear cached data`);
  await clearData(context, config);

  const filtered = sorted.filter((p) => p.available);

  logger.info(`Loaded ${filtered.length} providers: ${filtered.map((p) => p.name).join(', ')}`);
  return Promise.all(filtered.map(buildProvider));
}

export async function loadSingleProvider(data: SavedData, context: coc.ExtensionContext, config: PoemConfig): Promise<Provider|undefined> {
  const name = data.provider;
  const p = await loadScript(name, context, config);

  if (!p) return undefined;
  if (data && data.provider === p.name) p.data = data; // attach data
  if (await callMaybeAsync(p.required.shouldUpdate, p)) return buildProvider(p);

  return undefined;
}

export async function runProviderFetch(provider: Provider, context: coc.ExtensionContext, config: PoemConfig): Promise<Omit<SavedData, 'lastUpdated'>|undefined> {
  if (!provider.fetchData) {
    return {
      provider: provider.name,
      type: PoemDataTypes.ProviderName,
    };
  }

  let browser: puppeteer.Browser|undefined;
  let pid: number|undefined;

  context.subscriptions.push({
    dispose() {
      // FIXME: process.kill is not allowed in extension context
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
    provider: provider.name,
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
