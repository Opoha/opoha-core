/**
 * In-process scheduled job handler contract.
 */
export type ScheduledJobHandlerContext = {
  readonly jobCode: string;
  readonly attempt: number;
  readonly queuedAt: Date;
};

export type ScheduledJobHandler = (ctx: ScheduledJobHandlerContext) => void | Promise<void>;

export type RegisterScheduledJobInput = {
  /** Local code; host prefixes with plugin id when registered via PluginContext. */
  code: string;
  displayName?: string;
  cron: string;
  timezone?: string;
  handler: ScheduledJobHandler;
};

export type RegisteredScheduledJob = {
  pluginId: string | null;
  code: string;
  displayName: string;
  cron: string;
  timezone: string;
  handlerKey: string;
  handler: ScheduledJobHandler;
  active: boolean;
};
