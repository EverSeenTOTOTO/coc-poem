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
    if (!this.buffer) {
      this.buffer = await (this._createBufferPromise ? this._createBufferPromise : createROBuffer());
      this._createBufferPromise = undefined;
    }

    logger.info(`Start render: ${this.buffer?.id}, FPS: ${this.FPS}`);

    return new Promise<void>((resolve) => {
      this.interval = setInterval(() => {
        this.buffer?.redraw(this.data)
          .catch(onerror())
          .finally(resolve);
      }, 1000 / this.FPS);

      events.on('BufUnload', async (id) => {
        if (this.buffer?.id === id) {
          logger.info(`Buffer unloaded: ${id}`);
          await this.hide();
          await this.buffer?.close().then(() => {
            logger.info(`Buffer closed: ${this.buffer?.id}`);
          });
          this.buffer = undefined;
        }
      });

      events.on('BufHidden', async (id) => {
        if (id === this.buffer?.id) {
          logger.info(`Buffer hidden: ${id}`);
          await this.hide();
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
  }
}
