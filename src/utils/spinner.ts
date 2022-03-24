// forked from coc-rls
import {
  StatusBarItem, window,
// eslint-disable-next-line import/no-extraneous-dependencies
} from 'coc.nvim';
import { NAME, SPINNER_CHARS } from '@/utils/constants';

const statusItem: StatusBarItem = window.createStatusBarItem(100);

export default (message: string): (doneMessage?: string) => void => {
  let spinnerTimer: NodeJS.Timer|null = null;

  if (spinnerTimer !== null) {
    clearInterval(spinnerTimer);
  }

  let state = 0;
  statusItem.text = '';
  statusItem.show();
  spinnerTimer = setInterval(() => {
    statusItem.text = `${NAME} ${SPINNER_CHARS[state]} ${message}`;
    state = (state + 1) % SPINNER_CHARS.length;
  }, 100);

  return (doneMessage?: string) => {
    if (spinnerTimer !== null) {
      clearInterval(spinnerTimer);
    }
    spinnerTimer = null;
    statusItem.isProgress = false;
    statusItem.text = `${NAME} ${doneMessage ?? '✓'}`;
    setTimeout(() => {
      statusItem.hide();
    }, 2000);
  };
};
