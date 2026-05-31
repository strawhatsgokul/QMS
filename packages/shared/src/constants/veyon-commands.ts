export const VEYON_COMMANDS = {
  FEATURE_START: 'feature start',
  FEATURE_STOP: 'feature stop',
  POWER_ON: 'power on',
  LIST_NETWORK_OBJECTS: 'networkobjects list',
  IMPORT_NETWORK_OBJECTS: 'networkobjects import',
  NETWORK_OBJECTS_ADD: 'networkobjects add',
} as const;

export const VEYON_FEATURE_NAMES = {
  SCREEN_LOCK: 'ScreenLock',
  SCREENSHOT: 'Screenshot',
  REBOOT: 'Reboot',
  POWER_DOWN: 'PowerDown',
  POWER_DOWN_NOW: 'PowerDownNow',
  TEXT_MESSAGE: 'TextMessage',
  SHARE_OWN_SCREEN: 'ShareOwnScreenFullScreen',
  DEMO_STOP: 'Demo',
  DISTRIBUTE_FILES: 'DistributeFiles',
  FILE_COLLECT: 'FileCollect',
} as const;

export type VeyonCommand = (typeof VEYON_COMMANDS)[keyof typeof VEYON_COMMANDS];
export type VeyonFeatureName = (typeof VEYON_FEATURE_NAMES)[keyof typeof VEYON_FEATURE_NAMES];

export const VEYON_COMMAND_TIMEOUTS: Record<string, number> = {
  [VEYON_COMMANDS.FEATURE_START]: 15000,
  [VEYON_COMMANDS.FEATURE_STOP]: 10000,
  [VEYON_COMMANDS.POWER_ON]: 10000,
  [VEYON_COMMANDS.LIST_NETWORK_OBJECTS]: 10000,
};
