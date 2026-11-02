import * as migration_20261030_225034_initial from './20261030_225034_initial';
import * as migration_20261102_183541_add_note_slug from './20261102_183541_add_note_slug';

export const migrations = [
  {
    up: migration_20261030_225034_initial.up,
    down: migration_20261030_225034_initial.down,
    name: '20261030_225034_initial',
  },
  {
    up: migration_20261102_183541_add_note_slug.up,
    down: migration_20261102_183541_add_note_slug.down,
    name: '20261102_183541_add_note_slug'
  },
];
