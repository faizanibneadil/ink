import * as migration_20261030_225034_initial from './20261030_225034_initial';

export const migrations = [
  {
    up: migration_20261030_225034_initial.up,
    down: migration_20261030_225034_initial.down,
    name: '20261030_225034_initial'
  },
];
