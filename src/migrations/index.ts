import * as migration_20261030_225034_initial from './20261030_225034_initial';
import * as migration_20261102_183541_add_note_slug from './20261102_183541_add_note_slug';
import * as migration_20261102_215906_remove_legacy_code_block from './20261102_215906_remove_legacy_code_block';
import * as migration_20261105_154605_payload_beta_7 from './20261105_154605_payload_beta_7';
import * as migration_20261105_160042_relabel_clamped_password_hashes from './20261105_160042_relabel_clamped_password_hashes';
import * as migration_20261105_190440_add_user_role from './20261105_190440_add_user_role';
import * as migration_20261106_212540_add_note_cover_icon from './20261106_212540_add_note_cover_icon';
import * as migration_20261111_094442_add_user_api_key from './20261111_094442_add_user_api_key';
import * as migration_20261111_181656_payload_beta_8 from './20261111_181656_payload_beta_8';

export const migrations = [
  {
    up: migration_20261030_225034_initial.up,
    down: migration_20261030_225034_initial.down,
    name: '20261030_225034_initial',
  },
  {
    up: migration_20261102_183541_add_note_slug.up,
    down: migration_20261102_183541_add_note_slug.down,
    name: '20261102_183541_add_note_slug',
  },
  {
    up: migration_20261102_215906_remove_legacy_code_block.up,
    down: migration_20261102_215906_remove_legacy_code_block.down,
    name: '20261102_215906_remove_legacy_code_block',
  },
  {
    up: migration_20261105_154605_payload_beta_7.up,
    down: migration_20261105_154605_payload_beta_7.down,
    name: '20261105_154605_payload_beta_7',
  },
  {
    up: migration_20261105_160042_relabel_clamped_password_hashes.up,
    down: migration_20261105_160042_relabel_clamped_password_hashes.down,
    name: '20261105_160042_relabel_clamped_password_hashes',
  },
  {
    up: migration_20261105_190440_add_user_role.up,
    down: migration_20261105_190440_add_user_role.down,
    name: '20261105_190440_add_user_role',
  },
  {
    up: migration_20261106_212540_add_note_cover_icon.up,
    down: migration_20261106_212540_add_note_cover_icon.down,
    name: '20261106_212540_add_note_cover_icon',
  },
  {
    up: migration_20261111_094442_add_user_api_key.up,
    down: migration_20261111_094442_add_user_api_key.down,
    name: '20261111_094442_add_user_api_key',
  },
  {
    up: migration_20261111_181656_payload_beta_8.up,
    down: migration_20261111_181656_payload_beta_8.down,
    name: '20261111_181656_payload_beta_8'
  },
];
