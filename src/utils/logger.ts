// eslint-disable-next-line import/no-extraneous-dependencies
import { window } from 'coc.nvim';
import { NAME } from '@/utils/constants';

export const channel = window.createOutputChannel(NAME);

const createLogger = (domain = 'coc-poem') => {
  const log = (type: string) => (msg: string) => channel.appendLine(`[${type} ${domain} - ${new Date().toLocaleTimeString()}] ${msg}`);
  return {
    log: (msg: string) => channel.append(msg),
    info: log('Info'),
    warn: log('Warn'),
    error: log('Error'),
    clear: () => channel.clear(),
    append: (value: string) => channel.append(value),
  };
};

export type Logger = ReturnType<typeof createLogger>;

export default createLogger;
export const logger = createLogger();
export const onerror = (res?: any) => (e: Error|null) => {
  logger.error(e?.stack ?? e?.message ?? 'Unknown error');
  return res;
};
