import { NAME, PoemCommands, PoemDataTypes } from '@/utils/constants';
import { channel, logger, onerror } from '@/utils/logger';
import {
  commands, ExtensionContext, window, workspace,
} from 'coc.nvim';
import createSpinner from '@/utils/spinner';
import loadConfig, { PoemConfig } from './config';
import { displayData, loadData, saveData } from './data';
import { loadAvailableProviders, loadSingleProvider, runProviderFetch, runProviderPrepare } from './provider';

async function checkLimitations() {
  const { nvim } = workspace;
  const cannotInvoke = await nvim.commandOutput('echo argc() || line2byte(\'$\') != -1 || v:progname !~? \'^[-gmnq]\\=vim\\=x\\=\\%[\\.exe]$\' || &insertmode');
  if (cannotInvoke.trim() === '1') {
    logger.warn(`Cannot invoke ${NAME}, you might be in insert mode, running vim with extra args or using gvim`);
    return false;
  }

  const shouldSave = await nvim.commandOutput('echo !&hidden && &modified');
  if (shouldSave.trim() === '1') {
    window.showErrorMessage('You have unsaved changes, please save them first');
    return false;
  }
  return true;
}

async function fetch(context: ExtensionContext, config: PoemConfig) {
  const providers = await loadAvailableProviders(context, config);

  if (providers.length === 0) {
    logger.warn('No providers found');
    return undefined;
  }

  const cancel = createSpinner(providers[0].name);
  try {
    const data = await runProviderFetch(providers[0], context, config);

    return data && await saveData(context, config, data);
  } catch (e) {
    return onerror()(e);
  } finally {
    cancel();
  }
}

function scheduleFetch(context: ExtensionContext, config: PoemConfig) {
  logger.info('Schedule fetch');

  const timeout = setTimeout(() => {
    logger.info('Fetch started');
    fetch(context, config).catch(onerror());
  }, config.updateTime);

  context.subscriptions.push({
    dispose() {
      clearTimeout(timeout);
    },
  });
}

async function show(context: ExtensionContext, config: PoemConfig) {
  const { nvim } = workspace;
  const data = await loadData(context, config);

  if (!data) {
    logger.warn('No data found, schedule fetching...');
    return scheduleFetch(context, config);
  }

  switch (data.type) {
    case PoemDataTypes.Content: {
      await displayData(context, config, data);
      if (data.commands) {
        await Promise.all(
          data.commands.map((cmd) => nvim.command(cmd)),
        );
      }
      break;
    }
    case PoemDataTypes.ProviderName:
    default: {
      const provider = await loadSingleProvider(data, context, config);

      if (provider) {
        await runProviderPrepare(provider, context, config);
      } else {
        logger.error(`Failed to quick load provider, ${data.content} not found`);
      }
    }
  }

  return scheduleFetch(context, config);
}

async function boot(context: ExtensionContext, config: PoemConfig) {
  if (await checkLimitations()) {
    return show(context, config);
  }

  return scheduleFetch(context, config);
}

export async function activate(context: ExtensionContext): Promise<void> {
  const config = await loadConfig();

  const registerCommand = (cmd: string, callback: (...args: any[]) => any) => {
    context.subscriptions.push(commands.registerCommand(cmd, callback));
  };

  registerCommand(PoemCommands.SHOW_OUTPUT_CHANNEL, () => {
    channel.show();
  });
  registerCommand(PoemCommands.CLEAR_OUTPUT_CHANNEL, () => {
    channel.clear();
  });
  registerCommand(PoemCommands.SHOW, () => {
    return show(context, config).catch(onerror());
  });
  registerCommand(PoemCommands.FETCH, () => {
    return fetch(context, config).catch(onerror());
  });
  registerCommand(PoemCommands.BOOT, async () => {
    return boot(context, config).catch(onerror());
  });
}
