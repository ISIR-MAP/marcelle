import '@tensorflow/tfjs-backend-webgl';
import './utils';
import './ui/css/styles.css';

export * from './core';
export * from './components';
export * from './layouts';
export * from './utils';

// Export all svelte components in './ui' in a new namespace UI.
// e.g. Button becomes UI.Button.
// This is done to prevent ambiguity with Marcelle components in './components'.
// see: https://stackoverflow.com/a/47501654

import * as UI from './ui';
export { UI }