export function toInquirerChoices(options) {
  return options.map((option) => {
    const choice = {
      name: option.label,
      value: option.value,
      description: option.description
    };
    if (option.checked !== undefined) choice.checked = option.checked;
    return choice;
  });
}

export function selectedRuntimeList(values, customRuntimeList = '') {
  const selected = new Set(values);
  const runtimes = selected.has('all')
    ? ['codex', 'copilot', 'claude', 'antigravity']
    : [...selected];

  if (selected.has('custom')) {
    runtimes.push(...String(customRuntimeList).split(',').map((item) => item.trim()).filter(Boolean));
  }

  const normalized = [...new Set(runtimes.filter((runtime) => runtime !== 'all' && runtime !== 'custom'))];
  const adapters = normalized.filter((runtime) => runtime !== 'neutral');
  return adapters.length > 0 ? adapters : ['neutral'];
}

export function selectedCapabilityList(values) {
  const selected = new Set(values);
  if (selected.has('all')) return ['context7', 'engram', 'codebase-memory-mcp'];
  return [...selected].filter((capability) => capability !== 'all');
}

export function installPackageDetails(overlay) {
  return {
    label: 'Full FHH IA Ecosystem (recommended)',
    summary: overlay === 'fhh-ia-ecosystem-full'
      ? 'Full FHH IA Ecosystem flow selected (recommended).'
      : `Unsupported overlay "${overlay}" requested.`,
    tone: overlay === 'fhh-ia-ecosystem-full' ? 'green' : 'red'
  };
}

export function runtimeSet(runtimeList = '') {
  return new Set(String(runtimeList).split(',').map((item) => item.trim()).filter(Boolean));
}

export function defaultIntentFor(capability) {
  if (capability === 'context7' || capability === 'engram') return 'attach-only';
  return 'install+attach';
}

export function createCapabilityGuide({ capability, scope, intent, runtimes }) {
  if (capability === 'context7') {
    const commands = [
      'VS Code MCP (workspace .vscode/mcp.json):',
      '{',
      '  "servers": {',
      '    "context7": {',
      '      "type": "stdio",',
      '      "command": "npx",',
      '      "args": ["-y", "@upstash/context7-mcp@latest", "--api-key", "YOUR_API_KEY"]',
      '    }',
      '  }',
      '}',
      '',
      'Codex (~/.codex/config.toml):',
      '[mcp_servers.context7]',
      'command = "npx"',
      'args = ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"]',
      'startup_timeout_ms = 20_000',
      '',
      'Copilot CLI (~/.copilot/mcp-config.json):',
      '{',
      '  "mcpServers": {',
      '    "context7": {',
      '      "type": "local",',
      '      "command": "npx",',
      '      "args": ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"]',
      '    }',
      '  }',
      '}'
    ];

    return {
      source: 'upstash/context7 (packages/mcp/README.md)',
      effect: 'Adds Context7 docs tools (resolve-library-id + get-library-docs).',
      commands,
      notes: [
        'Node.js >= 18 is required by Context7 MCP.',
        'Use official source by default unless user requests another source.'
      ],
      scope,
      intent,
      runtimeHint: `Detected runtimes: ${[...runtimes].join(', ') || 'neutral'}`
    };
  }

  if (capability === 'engram') {
    const commands = [
      'Install Engram binary (macOS/Linux):',
      'brew install gentleman-programming/tap/engram',
      '',
      'Then setup by runtime:',
      'engram setup codex',
      'engram setup vscode-copilot',
      '',
      'Workspace MCP alternative (.vscode/mcp.json):',
      '{',
      '  "servers": {',
      '    "engram": {',
      '      "command": "engram",',
      '      "args": ["mcp"]',
      '    }',
      '  }',
      '}',
      '',
      'CLI one-liner:',
      'code --add-mcp "{\"name\":\"engram\",\"command\":\"engram\",\"args\":[\"mcp\"]}"'
    ];

    return {
      source: 'gentleman-programming/engram (docs/INSTALLATION.md + docs/AGENT-SETUP.md)',
      effect: 'Enables durable memory tools (mem_save, mem_search, mem_context, mem_session_summary).',
      commands,
      notes: [
        'For Codex/Copilot/VS Code, Engram MCP runs as stdio via engram mcp.',
        'No install command should run without explicit approval.'
      ],
      scope,
      intent,
      runtimeHint: `Detected runtimes: ${[...runtimes].join(', ') || 'neutral'}`
    };
  }

  const commands = [
    'Install package:',
    'bun add -g codebase-memory-mcp',
    '',
    'Configure detected coding agents:',
    'codebase-memory-mcp install',
    '',
    'Optional quick config:',
    'codebase-memory-mcp config set auto_index true',
    '',
    'Manual MCP entry example:',
    '{',
    '  "mcpServers": {',
    '    "codebase-memory-mcp": {',
    '      "command": "codebase-memory-mcp",',
    '      "args": []',
    '    }',
    '  }',
    '}'
  ];

  return {
    source: 'DeusData/codebase-memory-mcp (README.md)',
    effect: 'Adds structural code graph MCP tools for indexing/search/trace.',
    commands,
    notes: [
      'Installer mutates local agent configs; confirm scope before running.',
      'Restart the coding agent after install/setup.'
    ],
    scope,
    intent,
    runtimeHint: `Detected runtimes: ${[...runtimes].join(', ') || 'neutral'}`
  };
}