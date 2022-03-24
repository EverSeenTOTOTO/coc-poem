import os from 'os';
import path from 'path';
import pkg from '../../package.json';

export const NAME = pkg.name.replace(/@[^/]*\//, '');
export const VERSION = pkg.version;

export const PROVIDER_DIR = os.platform() === 'win32'
  ? path.resolve(os.homedir(), 'AppData/Local/', NAME)
  : path.resolve(os.homedir(), '.config/', NAME);

export const SPINNER_CHARS = ['◐', '◓', '◑', '◒'];

export type MaybeAsync<T, Param> = T extends (param: Param) => infer P
  ? T extends (param: Param) => Promise<infer Q>
    ? (param: Param) => Promise<Q>
    : (param: Param) => P
  : T;

export const callMaybeAsync = async <T, Param>(fn: MaybeAsync<T, any>, param: Param): Promise<T> => {
  return typeof fn === 'function'
    ? fn.constructor.name === 'AsyncFunction'
      ? fn(param)
      : Promise.resolve(fn(param))
    : Promise.resolve(fn);
};

export enum PoemCommands {
  SHOW = 'poem.show',
  FETCH = 'poem.fetch',
  BOOT = 'poem.boot',
  SHOW_OUTPUT_CHANNEL = 'poem.showOutputChannel',
  CLEAR_OUTPUT_CHANNEL = 'poem.clearOutputChannel',
}

export enum PoemDataTypes {
  Content = 'content',
  ProviderName = 'providerName',
}
