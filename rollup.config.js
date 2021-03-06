import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import json from '@rollup/plugin-json';
// import { terser } from 'rollup-plugin-terser';
import path from 'path';

const extensions = ['.mjs', '.js', '.ts', '.json', '.node'];
const opts = {
  plugins: [
    json(),
    alias({
      entries: [
        { find: /^node:(.*)$/, replacement: '$1' },
        { find: '@', replacement: path.resolve(__dirname, 'src') },
        { find: '@test', replacement: path.resolve(__dirname, 'src/__tests__') },
      ],
    }),
    resolve({
      extensions,
      preferBuiltins: true,
    }),
    commonjs(),
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
    // terser({
    //   mangle: true,
    //   compress: true,
    // }),
  ],
};

export default [{
  external: ['coc.nvim', 'puppeteer-core'],
  input: path.resolve(__dirname, 'src/index.ts'),
  output: [
    {
      file: path.resolve(__dirname, 'dist/index.js'),
      format: 'cjs',
      sourcemap: true,
    },
  ],
  ...opts,
}];
