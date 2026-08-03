export const CORE_PACKAGE_NAME = '@opoha/core' as const;

export function getCorePackageName(): typeof CORE_PACKAGE_NAME {
  return CORE_PACKAGE_NAME;
}
