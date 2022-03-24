/* eslint-disable no-underscore-dangle */
import { events } from 'coc.nvim';
import { onerror, logger } from '@/utils/logger';
import createROBuffer, { ROBuffer } from './createROBuffer';

export type ScreenOptions = {
  FPS: number;
};

// need double buffer??
export default class Screen {
  buffer?: ROBuffer;

  data: string;

  FPS: number;

  interval?: NodeJS.Timeout;

  _createBufferPromise: Promise<ROBuffer> | undefined;

  constructor(options: ScreenOptions) {
    this.data = '';
    this.FPS = options.FPS;
    this._createBufferPromise = createROBuffer(); // speed up first render
  }

  async render(data: string, clear = true) {
    this.data = clear ? data : this.data + data;
  }

  async show() {
    await this.hide();
    this.buffer = await (this._createBufferPromise ? this._createBufferPromise : createROBuffer());
    this._createBufferPromise = undefined;

    return new Promise<void>((resolve) => {
      this.interval = setInterval(() => {
        this.buffer?.redraw(this.data).catch(onerror()).finally(resolve);
      }, 1000 / this.FPS);
      logger.info(`Started render, FPS: ${this.FPS}`);

      events.on('BufHidden', (id) => {
        if (id === this.buffer?.id) {
          this.hide();
        }
      });
    });
  }

  async hide() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
      logger.info('Stopped render');
    }
    this.buffer = undefined;
  }
}
