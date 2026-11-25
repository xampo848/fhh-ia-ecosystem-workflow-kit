import { pluginName } from '../plugin-mode.mjs';
import { pluginRuntimes } from '../runtime-matrix.mjs';

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
    tone: overlay === 'fhh-ia-ecosystem-full' ? 'copper' : 'copperInk'
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
    'Run official installer (with UI):',
    'curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --ui',
    '',
    'Configure detected coding agents:',
    'codebase-memory-mcp install',
    '',
    'Index the current project:',
    'codebase-memory-mcp cli index_repository --repo-path /absolute/path/to/repo',
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
    source: 'DeusData/codebase-memory-mcp (install.sh + README.md)',
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
// Plain words for the tiers: a small model (Haiku), a mid-size one (Sonnet,
// or Codex with medium reasoning) and the most capable one (Opus, or Codex
// with the highest reasoning).
const MODEL_PROFILE_OPTIONS = [
  {
    value: 'calidad',
    label: 'Suscripción (perfil calidad)',
    description: 'Claude Pro/Max o ChatGPT: modelo mediano (Sonnet, o Codex con razonamiento medio) por defecto y el más capaz (Opus, o Codex con el razonamiento más alto) para implementar, QA y planificar; nunca modelos chicos.'
  },
  {
    value: 'equilibrado',
    label: 'Suscripción con límites ajustados (perfil equilibrado)',
    description: 'Si alcanzas los límites semanales a menudo: el modelo más capaz solo para planificar y para el QA final; implementación, tests y revisión de contratos con el modelo mediano. Nunca modelos chicos.'
  },
  {
    value: 'costo',
    label: 'API por token (perfil costo)',
    description: 'Pago por uso: modelos chicos (Haiku o similar) para leer, validar y documentar; el más capaz solo ante riesgos críticos (seguridad, migraciones, contratos públicos).'
  }
];

// Stack packs carry framework rules that the neutral skills no longer hold.
// `detected` (from detectStackPack) preselects the pack the repository looks like.
export function stackPackQuestion({ detected = 'none' } = {}) {
  const options = [
    { value: 'none', label: 'Ninguno', description: 'El proyecto escribe sus propias reglas en .agents/project/.' },
    { value: 'rails-react', label: 'Rails API + React', description: 'Minitest, Bullet, MSW, TanStack Query y comandos make / bun run, en .agents/project/stack.md.' }
  ];
  return {
    title: '¿Instalar un stack pack con las reglas de tu stack?',
    options,
    defaultIndex: Math.max(0, options.findIndex((option) => option.value === detected))
  };
}

// PRD plugin-mode-pilot 2.6: asked only in an interactive install, and only
// when every chosen runtime has a plugin (null otherwise). Repo is the default.
export function installModeQuestion(runtimeList = '') {
  const runtimes = [...runtimeSet(runtimeList)];
  if (runtimes.length === 0 || runtimes.some((runtime) => !pluginRuntimes.includes(runtime))) return null;
  return {
    title: '¿Cómo instalar el kit en este repositorio?',
    options: [
      { value: 'repo', label: 'Archivos en el repo', description: 'El modo de hoy: los archivos del kit quedan en el repositorio. Funciona con todos los runtimes.' },
      { value: 'plugin', label: `Plugin ${pluginName}`, description: 'El kit corre como plugin de Claude Code o Copilot; el repositorio guarda solo el adaptador, la declaración del plugin y su overlay. Cada persona instala el plugin una vez por clon.' }
    ],
    defaultIndex: 0
  };
}

const RUNTIME_BILLING = {
  claude: { label: 'Claude Code', apiKey: 'ANTHROPIC_API_KEY' },
  codex: { label: 'Codex', apiKey: 'OPENAI_API_KEY' }
};

// One question per selected runtime that can run on a subscription (D-07).
// An API key in the environment only preselects "costo"; the user confirms.
export function modelProfileQuestions(runtimeList = '', env = {}) {
  const runtimes = runtimeSet(runtimeList);
  return Object.entries(RUNTIME_BILLING)
    .filter(([runtime]) => runtimes.has(runtime))
    .map(([runtime, info]) => {
      const hasApiKey = Boolean(env?.[info.apiKey]);
      return {
        runtime,
        title: `¿Cómo se cobra ${info.label} en este proyecto?`,
        hint: hasApiKey ? `${info.apiKey} está definida: se preselecciona API por token. Confírmalo o cámbialo.` : null,
        options: MODEL_PROFILE_OPTIONS,
        defaultIndex: MODEL_PROFILE_OPTIONS.findIndex((option) => option.value === (hasApiKey ? 'costo' : 'calidad'))
      };
    });
}
