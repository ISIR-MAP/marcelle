import css from 'rollup-plugin-css-only';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
// import { plugin as analyze } from 'rollup-plugin-analyzer';
import { terser } from 'rollup-plugin-terser';
import filesize from 'rollup-plugin-filesize';
import svelte from 'rollup-plugin-svelte';
import preprocess from 'svelte-preprocess';
import pkg from './package.json';

const production = !process.env.ROLLUP_WATCH;

const plugins = [
  css({ output: 'dist/extra.css' }),
  svelte({
    dev: !production,
    css: (c) => {
      c.write('dist/bundle.css');
    },
    preprocess: preprocess({
      postcss: true,
    }),
  }),
  resolve({
    browser: true,
    dedupe: ['svelte'],
  }),
  commonjs(),
  typescript(),
  production && terser(),
  production && filesize(),
  // production && analyze(),
];

const esOutput = {
  file: pkg.module,
  format: 'es',
  sourcemap: true,
};

const umdOutput = {
  file: pkg.main,
  format: 'umd',
  name: 'marcelle',
  sourcemap: true,
  globals: {
    '@tensorflow/tfjs-core': 'tf',
    '@tensorflow/tfjs-converter': 'tf',
    '@tensorflow/tfjs-layers': 'tf',
    '@most/prelude': 'mostPrelude',
    '@most/core': 'mostCore',
  },
};

export default {
  input: 'src/index.ts',
  plugins,
  external: [
    '@tensorflow/tfjs-core',
    '@tensorflow/tfjs-converter',
    '@tensorflow/tfjs-layers',
    '@most/core',
    '@most/prelude',
  ],
  output: [esOutput, umdOutput],
};
