import * as migration_20261003_012330_initial from './20261003_012330_initial';

export const migrations = [
  {
    up: migration_20261003_012330_initial.up,
    down: migration_20261003_012330_initial.down,
    name: '20261003_012330_initial'
  },
];
