export function yesGuardMessage(options, actionLabel) {
  if (options.apply && !options.yes) {
    return `Refusing to ${actionLabel} without --yes. Run dry-run first, then use --apply --yes.\n`;
  }

  return null;
}
