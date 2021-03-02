import './style.scss';

export * from '.';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
declare const __VERSION__: string;
// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
declare const __BUILD_ID__: string;

export const version = __VERSION__;
export const buildId = __BUILD_ID__;
