/**
 * Plugin lifecycle state machine (AC-MVP-024 / AC-MVP-026).
 * `boot` is an action, not a durable state — it runs for installed plugins at app start.
 */

export const PLUGIN_LIFECYCLE_STATES = [
  'discovered',
  'installed',
  'enabled',
  'disabled',
  'uninstalled',
] as const;

export type PluginLifecycleState = (typeof PLUGIN_LIFECYCLE_STATES)[number];

export type PluginLifecycleAction = 'install' | 'enable' | 'disable' | 'uninstall';

const ALLOWED: Record<PluginLifecycleAction, readonly PluginLifecycleState[]> = {
  install: ['discovered', 'uninstalled'],
  enable: ['installed', 'disabled'],
  disable: ['enabled'],
  uninstall: ['installed', 'enabled', 'disabled'],
};

const NEXT: Record<PluginLifecycleAction, PluginLifecycleState> = {
  install: 'installed',
  enable: 'enabled',
  disable: 'disabled',
  uninstall: 'uninstalled',
};

/**
 * Returns the next state for a lifecycle action, or throws if the transition is illegal.
 */
export function transitionPluginState(
  current: PluginLifecycleState,
  action: PluginLifecycleAction,
): PluginLifecycleState {
  const allowed = ALLOWED[action];
  if (!allowed.includes(current)) {
    throw new Error(
      `Invalid plugin lifecycle transition: cannot ${action} from state "${current}" (allowed: ${allowed.join(', ')})`,
    );
  }
  return NEXT[action];
}

/** Whether boot() may run for this durable state. */
export function canBootPlugin(state: PluginLifecycleState): boolean {
  return state === 'installed' || state === 'enabled' || state === 'disabled';
}
