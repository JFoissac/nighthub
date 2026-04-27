import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

(global as any).jest = {
  fn: () => {
    const fn = (...args: any[]) => {};
    fn.mock = { calls: [] };
    fn.mockReturnValue = (val: any) => {
      fn.__returnValue = val;
      return fn;
    };
    fn.__returnValue = undefined;
    return fn;
  },
  mock: () => {},
};