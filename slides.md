---
theme: default
title: FHH IA Ecosystem - AI Workflow
titleTemplate: '%s'
info: |
  Primera version del deck centrado en el workflow con IA.
author: Francisco Herrera
presenter: true
download: false
exportFilename: workflow-ai-deck
lineNumbers: false
monaco: false
colorSchema: dark
aspectRatio: 16/9
canvasWidth: 1440
transition: fade
themeConfig:
  primary: '#59e1c3'
fonts:
  sans: Space Grotesk
  serif: IBM Plex Serif
  mono: JetBrains Mono
defaults:
  layout: default
---

# FHH IA Ecosystem

<div class="hero-grid mt-8">
  <div>
    <div class="eyebrow">AI Workflow System</div>
    <h2 class="hero-title">No instala solo archivos.<br>Instala una forma correcta de desarrollar software con agentes IA.</h2>
    <p class="hero-copy">
      Skills, routing, memoria, validaciones, ownership y guardrails para convertir peticiones libres en ejecucion de ingenieria con estructura.
    </p>
  </div>
  <div class="hero-panel">
    <div class="stack-orbit">
      <div class="orbit-center">workflow</div>
      <div class="orbit-node orbit-a">router</div>
      <div class="orbit-node orbit-b">skills</div>
      <div class="orbit-node orbit-c">memory</div>
      <div class="orbit-node orbit-d">validation</div>
    </div>
  </div>
</div>

---
layout: section
---

# La tesis

## El valor fuerte no es la instalacion. Es el sistema de trabajo con IA.

---

# El problema que corrige

<div class="three-up mt-10">
  <div class="surface-card danger">
    <div class="card-kicker">Sin workflow</div>
    <h3>Prompting caotico</h3>
    <p>Cada pedido arranca distinto. No hay intake, no hay decision de flujo, no hay criterio de escala.</p>
  </div>
  <div class="surface-card warning">
    <div class="card-kicker">Sin ownership</div>
    <h3>Coding directo</h3>
    <p>El agente salta a editar sin PRD, sin slicing, sin contratos y sin protecciones de validacion.</p>
  </div>
  <div class="surface-card accent">
    <div class="card-kicker">Sin memoria</div>
    <h3>Calidad inconsistente</h3>
    <p>Se pierde contexto entre sesiones, se repiten errores y cada repo vuelve a inventar su forma de trabajar.</p>
  </div>
</div>

<div class="statement mt-8">
  El workflow convierte lenguaje natural en proceso operativo repetible.
</div>

---

# Que se instala realmente

<div class="two-col-balanced mt-8">
  <div class="surface-card tall">
    <div class="card-kicker">No es el centro</div>
    <h3>Toolkit de adopcion</h3>
    <p>CLI, TUI, update, doctor y export existen para distribuir el sistema de forma segura entre repos y runtimes.</p>
  </div>
  <div class="surface-card tall accent">
    <div class="card-kicker">Lo importante</div>
    <h3>Workflow operativo con IA</h3>
    <ul class="clean-list">
      <li>Contrato neutral de instrucciones</li>
      <li>Registro de skills con carga just-in-time</li>
      <li>Workflows de producto, implementacion y calidad</li>
      <li>Pattern skills reutilizables por dominio</li>
      <li>Capacidades opcionales como memoria y docs lookup</li>
    </ul>
  </div>
</div>

---

# Arquitectura del sistema

```mermaid
flowchart TD
    A[User request] --> B[Neutral contract\n.agents/instructions.md]
    B --> C[Skill registry\nload only what is needed]
    C --> D[Workflow router]
    D --> E[Product workflows]
    D --> F[Implementation workflows]
    D --> G[Quality overlays]
    F --> H[Pattern skills]
    F --> I[Validation and QA]
    B --> J[Capabilities\nContext7 / Engram / Cavecrew]
    B --> K[Runtime adapters\nCopilot / Codex / Claude / Antigravity]
```

<div class="footnote mt-5">El repo instala wrappers finos; la logica vive en la capa neutral.</div>

---

# Contrato neutral y source of truth

<div class="timeline-grid mt-8">
  <div class="timeline-item">
    <div class="timeline-index">01</div>
    <div>
      <h3>.agents/instructions.md</h3>
      <p>Define jerarquia, reglas de carga, boundaries y el contrato base para cualquier runtime.</p>
    </div>
  </div>
  <div class="timeline-item">
    <div class="timeline-index">02</div>
    <div>
      <h3>.agents/skills/registry.md</h3>
      <p>Explica que skill existe, cuando cargarla, cuanto pesa y si es workflow, pattern, overlay o helper.</p>
    </div>
  </div>
  <div class="timeline-item">
    <div class="timeline-index">03</div>
    <div>
      <h3>SKILL.md</h3>
      <p>Es la instruccion ejecutable para el agente. No documentacion humana, sino procedimiento operativo.</p>
    </div>
  </div>
</div>

---

# El router: donde empieza la disciplina

<div class="two-col-balanced mt-8">
  <div class="surface-card tall">
    <div class="card-kicker">workflow-router</div>
    <h3>Promesa del router</h3>
    <ul class="clean-list compact">
      <li>Clasifica la peticion</li>
      <li>Elige el flujo mas pequeno que da resultado serio</li>
      <li>Recomienda postura de costo: lean, balanced o premium</li>
      <li>Explica la ruta en una frase clara</li>
      <li>Deja traza visible de decision</li>
    </ul>
  </div>
  <div class="surface-card tall accent">
    <div class="card-kicker">Guardrail critico</div>
    <h3>No se codea directamente</h3>
    <p>Si la solicitud es de desarrollo, el router no deja que el agente salte a editar sin pasar por el flujo correcto.</p>
    <div class="mini-quote mt-6">Development request -> safe predecessor or implement-prd.</div>
  </div>
</div>

---

# Rutas principales del workflow

<div class="route-grid mt-10">
  <div class="route-card">
    <div class="route-tag">Producto</div>
    <h3>Decidir que construir</h3>
    <p>product-studio, create-epic, create-prd, generate-pm-ticket.</p>
  </div>
  <div class="route-card">
    <div class="route-tag">Implementacion</div>
    <h3>Construir con control</h3>
    <p>implement-prd y su orquestacion por fases, slices y ownership.</p>
  </div>
  <div class="route-card">
    <div class="route-tag">Calidad</div>
    <h3>Validar y cerrar</h3>
    <p>contract-verifier, validation-runner, QA handoff, document-development.</p>
  </div>
</div>

<div class="statement mt-8">
  El sistema no trata todo pedido igual. Decide el workflow correcto antes de producir trabajo.
</div>

---

# Flujo de producto con IA

```mermaid
flowchart LR
    A[Idea o problema] --> B[product-studio]
    B --> C[discovery-process]
    B --> D[jobs-to-be-done]
    B --> E[prioritization-advisor]
    B --> F[roadmap-planning]
    C --> G[create-epic]
    D --> H[create-prd]
    E --> H
    F --> H
    H --> I[Implementable artifact]
```

<div class="footnote mt-5">La IA no solo responde: facilita discovery, estrategia, priorizacion y definicion ejecutable.</div>

---

# Flujo de implementacion con IA

<div class="phase-stack mt-7">
  <div class="phase-band"><span>Phase 0</span> Readiness review</div>
  <div class="phase-band"><span>Phase 1</span> Codebase discovery</div>
  <div class="phase-band"><span>Phase 2</span> Implementation slicing</div>
  <div class="phase-band"><span>Phase 3</span> Owned implementation slices</div>
  <div class="phase-band"><span>Phase 4</span> Contract verification</div>
  <div class="phase-band"><span>Phase 5</span> Focused validation</div>
  <div class="phase-band"><span>Phase 6</span> Fresh-context QA</div>
  <div class="phase-band"><span>Phase 7</span> Closure with evidence</div>
</div>

<div class="footnote mt-6">`implement-prd` actua como orquestador; no concentra todo el trabajo en una sola conversacion ciega.</div>

---

# Delegacion con ownership real

<div class="two-col-balanced mt-8">
  <div class="surface-card tall">
    <div class="card-kicker">Modelo operativo</div>
    <h3>Un writer por slice</h3>
    <ul class="clean-list compact">
      <li>Cada slice define owner skill y archivos permitidos</li>
      <li>Se esperan handoffs terminales con evidencia</li>
      <li>No se pisa trabajo de otro writer</li>
      <li>La paralelizacion solo existe con ownership disjunto</li>
    </ul>
  </div>
  <div class="surface-card tall accent">
    <div class="card-kicker">Delegates</div>
    <h3>Subagentes especializados</h3>
    <p>Capitana Alcance, Sherlock Estructura, Arquitecta Fases, Turbo Backend, Pixel Ninja, Guardia Contrato, QA Relampago.</p>
    <p class="muted">Cada uno entra por skill, no por improvisacion.</p>
  </div>
</div>

---

# Pattern skills: conocimiento reusable

<div class="skill-matrix mt-8">
  <div class="skill-chip">api-contract-producer</div>
  <div class="skill-chip">tenant-safe-data-access</div>
  <div class="skill-chip">feature-flag-implementation</div>
  <div class="skill-chip">external-data-source-integration</div>
  <div class="skill-chip">importer-implementation</div>
  <div class="skill-chip">form-validation</div>
  <div class="skill-chip">frontend-test-pattern</div>
</div>

<div class="surface-card mt-8 wide">
  <div class="card-kicker">Por que importa</div>
  <h3>El agente no resuelve cada problema desde cero</h3>
  <p>Cuando una slice necesita conocimiento repetible, el workflow carga la skill exacta justo a tiempo. Eso reduce variabilidad y sube la consistencia tecnica entre features, repos y sesiones.</p>
</div>

---

# Calidad integrada, no postiza

<div class="three-up mt-10">
  <div class="surface-card">
    <div class="card-kicker">Contracts</div>
    <h3>contract-verifier</h3>
    <p>Protege payloads, serializers, controllers y consumidores frontend.</p>
  </div>
  <div class="surface-card">
    <div class="card-kicker">Validation</div>
    <h3>validation-runner</h3>
    <p>Fuerza el comando mas chico capaz de falsar el cambio antes de seguir.</p>
  </div>
  <div class="surface-card">
    <div class="card-kicker">QA</div>
    <h3>qa-handoff-review</h3>
    <p>Aporta sesgo fresco y findings defendibles antes del cierre.</p>
  </div>
</div>

---

# Memoria y capacidades opcionales

<div class="two-col-balanced mt-8">
  <div class="surface-card tall accent">
    <div class="card-kicker">Durabilidad</div>
    <h3>Engram</h3>
    <p>Guarda decisiones, descubrimientos y resuenes de sesion para que el aprendizaje no se pierda.</p>
  </div>
  <div class="surface-card tall">
    <div class="card-kicker">Contexto vivo</div>
    <h3>Context7 y helpers</h3>
    <p>Docs actualizadas, cavecrew para tareas comprimidas, overlays de frontend craft como impeccable y frontend-design.</p>
  </div>
</div>

<div class="footnote mt-6">Estas capacidades no reemplazan el workflow. Lo potencian sin cambiar su contrato central.</div>

---

# Lo que habilita en la practica

<div class="metric-grid mt-10">
  <div class="metric-card">
    <div class="metric-value">Menos</div>
    <div class="metric-label">coding impulsivo</div>
  </div>
  <div class="metric-card">
    <div class="metric-value">Mas</div>
    <div class="metric-label">rutas correctas por tipo de trabajo</div>
  </div>
  <div class="metric-card">
    <div class="metric-value">Mejor</div>
    <div class="metric-label">calidad reproducible entre agentes</div>
  </div>
  <div class="metric-card">
    <div class="metric-value">Menor</div>
    <div class="metric-label">costo por rework y ambiguedad</div>
  </div>
  <div class="metric-card">
    <div class="metric-value">Mayor</div>
    <div class="metric-label">trazabilidad de decisiones</div>
  </div>
  <div class="metric-card">
    <div class="metric-value">Mas</div>
    <div class="metric-label">portabilidad entre runtimes y repos</div>
  </div>
</div>

---

# Donde entra el kit

<div class="two-col-balanced mt-12">
  <div>
    <h3 class="subtle-title">Rol secundario pero necesario</h3>
    <p class="hero-copy small">El kit existe para instalar, actualizar, exportar y validar este sistema sin romper repos ni duplicar logica entre adapters.</p>
  </div>
  <div class="surface-card">
    <ul class="clean-list compact">
      <li>dry-run first</li>
      <li>apply explicito</li>
      <li>backups antes de overwrite</li>
      <li>doctor para validar superficie instalada</li>
      <li>adapters finos por runtime</li>
    </ul>
  </div>
</div>

---
layout: end
---

# Idea central

## No es un paquete para usar IA.<br>No es un prompt bonito.<br>Es un workflow para hacer ingenieria correcta con agentes IA.

<div class="footnote mt-10">Primera version del deck. Siguiente paso: profundizar demos, casos de uso y slides ejecutivas.</div>