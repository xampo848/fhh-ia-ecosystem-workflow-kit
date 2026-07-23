export function diagnostic({ code, path = '', message, severity = 'error' }) {
  return { code, path, message, severity };
}

export function finalizeDiagnostics(diagnostics) {
  const severityOrder = { error: 0, warning: 1 };
  const sorted = [...diagnostics].sort((a, b) => {
    return (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
      || a.code.localeCompare(b.code)
      || a.path.localeCompare(b.path);
  });
  return {
    ok: !sorted.some((item) => item.severity === 'error'),
    diagnostics: sorted
  };
}
