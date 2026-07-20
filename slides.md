---
theme: default
title: FHH IA Ecosystem Workflow
titleTemplate: '%s'
info: |
  FHH IA Ecosystem Workflow: el flujo completo de desarrollo asistido por IA.
  Finetuning avanzado para delivery de software con gobernanza y calidad.
author: Francisco Herrera
presenter: true
download: false
exportFilename: fhh-ia-ecosystem-workflow
lineNumbers: false
monaco: false
colorSchema: dark
aspectRatio: 16/9
canvasWidth: 1440
transition: fade
themeConfig:
  primary: '#33d6ff'
fonts:
  sans: Inter
  serif: Inter
  mono: JetBrains Mono
defaults:
  layout: default
---

<div class="cover">
  <div>
    <div class="cover-title">El flujo completo<br>para desarrollar software<br>con agentes IA</div>
    <div class="cover-sub">Finetuning avanzado de desarrollo de software</div>
    <p class="cover-copy">
      Un sistema operativo end-to-end: contrato neutral, skills ejecutables, capacidades acoplables, routing por riesgo, memoria gobernada y paridad entre runtimes.
    </p>
    <div class="cover-meta">
      <span class="v">Flujo completo del ecosistema IA</span>
      <span class="k">Basado en templates/repo-overlay-fhh-ia-ecosystem-full/.agents/**</span>
    </div>
  </div>
  <div class="stack">
    <div class="stack-item s-core">
      <div class="st-tag">Contrato neutral</div>
      <div class="st-title">.agents/instructions.md</div>
      <div class="st-desc">Fuente de verdad para todos los runtimes</div>
    </div>
    <div class="stack-item s-cyan">
      <div class="st-tag">Motor del workflow</div>
      <div class="st-title">47 SKILL.md en 7 áreas</div>
      <div class="st-desc">Router + Product + Implement + Quality + Crosscutting + Caveman + Patterns</div>
    </div>
    <div class="stack-item s-blue">
      <div class="st-tag">Capacidades</div>
      <div class="st-title">6 manifests + integración neutral</div>
      <div class="st-desc">context7 · engram · impeccable · cavecrew · caveman · skills-sh</div>
    </div>
    <div class="stack-item s-mint">
      <div class="st-tag">Paridad runtime</div>
      <div class="st-title">Codex · Copilot · Claude</div>
      <div class="st-desc">Misma semántica, distintos wrappers</div>
    </div>
  </div>
</div>

---

<div class="slide-head">
  <h1>Un workflow completo, no una colección de prompts</h1>
  <div class="sub">Contrato neutral, taxonomía de skills, capacidades acoplables y gobernanza de calidad trabajando como un solo sistema.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="idx">01</div>
    <div class="card-title">Control semántico</div>
    <div class="card-copy">Un contrato neutral gobierna skills, integración, memoria y routing en todos los runtimes.</div>
  </div>
  <div class="card accent-mint">
    <div class="idx">02</div>
    <div class="card-title">Cobertura operativa</div>
    <div class="card-copy">Desde discovery y PRD hasta implementación por slices, QA fresco y documentación durable.</div>
  </div>
  <div class="card accent-blue">
    <div class="idx">03</div>
    <div class="card-title">Escalamiento real</div>
    <div class="card-copy">Paridad multi-runtime, capacidades acoplables y blueprint de adopción para nuevos repositorios.</div>
  </div>
</div>

<div class="callout mt-6">
  <strong>Un solo estándar de trabajo:</strong> todas las piezas del ecosistema — skills, capabilities, routing y memoria — operan bajo la misma gobernanza.
</div>

---

<div class="slide-head">
  <h1>Mapa completo de capas y responsabilidades</h1>
  <div class="sub">El workflow separa contrato, ejecución, capacidades y adapters para mantener calidad sin acoplarse a un solo vendor.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">.agents/instructions.md</div>
    <div class="card-copy">Startup contract neutral: jerarquía de fuentes, loading rules, token posture, políticas de integración y routing.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">.agents/skills/**</div>
    <div class="card-copy">Taxonomía y ejecución AI-native. Registro neutral con cargas just-in-time y delegates con ownership explícito.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">.agents/capabilities/**</div>
    <div class="card-copy">Blueprint de packaging + lifecycle (known/installed/attached/active) + attach points estables.</div>
  </div>
  <div class="card accent-magenta">
    <div class="card-title">.agents/integrations/**</div>
    <div class="card-copy">Contrato install/attach: intents, source policy, confirmación obligatoria y definición de éxito.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">.agents/model-routing/**</div>
    <div class="card-copy">Cost posture lean/balanced/premium + tiers Grande/Mediano/Liviano + delegación y overrides.</div>
  </div>
  <div class="card accent-cyan">
    <div class="card-title">.agents/memory/** + parity</div>
    <div class="card-copy">Gobierno de memoria compartida, sensibilidad y checklist de paridad runtime para evitar drift.</div>
  </div>
</div>

---

<div class="slide-head">
  <h1>47 skills activables en 7 áreas operativas</h1>
  <div class="sub">No son prompts sueltos: son procedimientos ejecutables con triggers, loading posture y límites de ownership.</div>
</div>

<div class="grid grid-4">
  <div class="card accent-cyan"><div class="idx">00-router</div><div class="card-title">1 skill</div><div class="card-copy">workflow-router: intake y selección de flujo seguro mínimo.</div></div>
  <div class="card accent-blue"><div class="idx">01-product</div><div class="card-title">11 skills</div><div class="card-copy">product-studio, create-epic, create-prd, PM ticket y sub-workflows de estrategia.</div></div>
  <div class="card accent-mint"><div class="idx">02-implement</div><div class="card-title">11 skills</div><div class="card-copy">implement-prd + readiness, discovery, slicing, implementers, contracts, validation y QA.</div></div>
  <div class="card accent-magenta"><div class="idx">03-quality</div><div class="card-title">3 skills</div><div class="card-copy">document-development, playwright-testing, react-doctor.</div></div>
  <div class="card accent-amber"><div class="idx">04-crosscutting</div><div class="card-title">4 skills</div><div class="card-copy">engineering-mentor, frontend-design, impeccable, PR comments resolution.</div></div>
  <div class="card accent-cyan"><div class="idx">05-caveman</div><div class="card-title">10 skills</div><div class="card-copy">modo de compresión y helper delegates para velocidad con precisión.</div></div>
  <div class="card accent-blue"><div class="idx">06-patterns</div><div class="card-title">7 skills</div><div class="card-copy">backend/domain/frontend patterns reutilizables para implementation slicing.</div></div>
  <div class="card accent-mint"><div class="idx">Registry</div><div class="card-title">Contrato neutral</div><div class="card-copy">registry.md + registry.json/cache/schema como inventario canónico y artefactos derivados.</div></div>
</div>

---

<div class="slide-head">
  <h1>Del routing a la entrega verificable en una sola cadena</h1>
  <div class="sub">El workflow operacionaliza entrega de software con fases, ownership y gates explícitos.</div>
</div>

<div class="phase-band">
  <div class="band b-amber">Intake y definición</div>
  <div class="band b-cyan">Implementación orquestada</div>
  <div class="band b-mint">Calidad y cierre durable</div>
</div>

<div class="flow">
  <div class="flow-row">
    <div class="step"><span class="s-num">R</span><div class="s-title">Router</div><div class="s-desc">Clasifica intención/riesgo y decide flujo.</div></div>
    <div class="step"><span class="s-num">P</span><div class="s-title">Product</div><div class="s-desc">product-studio, epic o PRD con aceptación.</div></div>
    <div class="step"><span class="s-num">I</span><div class="s-title">Implement PRD</div><div class="s-desc">Readiness → Discovery → Slicing → Build.</div></div>
    <div class="step"><span class="s-num">Q</span><div class="s-title">Quality Gates</div><div class="s-desc">Contracts → Validation → Fresh QA.</div></div>
    <div class="step"><span class="s-num">D</span><div class="s-title">Document</div><div class="s-desc">Cierre durable de conocimiento.</div></div>
  </div>
</div>

<div class="callout mint mt-4">
  <strong>Principio del workflow:</strong> no hay "avance" sin evidencia de aceptación, validación focalizada y ownership de archivos por fase/delegate.
</div>

---

<div class="slide-head">
  <h1>El workflow también es un sistema de capabilities acoplables</h1>
  <div class="sub">Skills ejecutan el flujo; capabilities extienden el sistema con una política neutral de install/attach.</div>
</div>

<div class="grid grid-2">
  <div class="card accent-magenta">
    <div class="card-title">Inventario de capabilities (6)</div>
    <div class="chips mt-2">
      <span class="chip">context7</span>
      <span class="chip">engram</span>
      <span class="chip">impeccable</span>
      <span class="chip">caveman</span>
      <span class="chip">cavecrew</span>
      <span class="chip">skills-sh</span>
    </div>
    <div class="card-copy mt-4">Cada capability declara manifest, attach points, scope, install_mode y estado de lifecycle.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Contrato de integración</div>
    <div class="card-copy">
      Intents soportados: install+attach, attach-only, list/discover, recommend.<br>
      Políticas: source oficial por defecto, confirmación previa obligatoria, éxito = available + attached + documented.
    </div>
  </div>
</div>

<table class="wk-table mt-4">
  <thead><tr><th>Attach point</th><th>Uso en el workflow</th></tr></thead>
  <tbody>
    <tr><td>startup-discovery</td><td>Visibilidad inicial y disponibilidad</td></tr>
    <tr><td>workflow-routing</td><td>Influye selección de flujo/capability lookup</td></tr>
    <tr><td>skill-execution</td><td>Uso just-in-time durante skills</td></tr>
    <tr><td>memory / validation</td><td>Evidencia durable y verificaciones</td></tr>
  </tbody>
</table>

---

<div class="slide-head">
  <h1>Calidad consistente entre Codex, Copilot y Claude</h1>
  <div class="sub">La paridad del workflow no exige mismo archivo ni mismo modelo exacto; exige misma semántica de riesgo, gates y gobernanza.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Model routing neutral</div>
    <div class="card-copy">Cost posture lean/balanced/premium + tiers Grande/Mediano/Liviano + override explícito con warning de riesgo.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Memory governance</div>
    <div class="card-copy">Scopes local-session/local-user/project-shared/runtime-derived + sensibilidad public/restricted/do-not-share.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Parity checklist</div>
    <div class="card-copy">Startup, skill discovery, integrations, routing, memory y closure/reporting con estado aligned/drift.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Regla de oro:</strong> si un wrapper redefine semántica neutral, hay drift y debe corregirse.
</div>

---

<div class="slide-head">
  <h1>Cómo se reutiliza el workflow en otros repositorios</h1>
  <div class="sub">El workflow-kit empaqueta el flujo completo para reuso, preservando la misma operación en cualquier repositorio nuevo.</div>
</div>

<div class="compare">
  <div class="panel p-now">
    <div class="p-tag">Operación diaria</div>
    <div class="p-title">Repo Overlay del workflow</div>
    <ul>
      <li>Superficie completa de skills, capabilities y gobernanza.</li>
      <li>Finetuning avanzado para delivery real de software.</li>
      <li>Paridad runtime y quality gates en producción.</li>
      <li>Base recomendada para equipos y repos activos.</li>
    </ul>
  </div>
  <div class="panel p-ref">
    <div class="p-tag">Packaging boundary</div>
    <div class="p-title">workflow-kit blueprint</div>
    <ul>
      <li>Define cómo portar el sistema a otros repositorios.</li>
      <li>Valida separación de capas y artefactos derivados.</li>
      <li>Preserva el mismo flujo completo al adoptarlo.</li>
      <li>Existe para adopción, no para reducir alcance.</li>
    </ul>
  </div>
</div>

---
layout: section
class: section-slide
---

<div class="section-num">Cierre</div>
<div class="section-title">FHH IA Ecosystem Workflow<br>es el estándar completo<br>de ingeniería con IA</div>
<div class="section-copy mt-4">
  Sistema completo: contrato neutral, skills AI-native, capabilities acoplables, routing por riesgo, memoria gobernada y paridad multi-runtime.
</div>
<div class="chips mt-6">
  <span class="chip">47 skills</span>
  <span class="chip">6 capabilities</span>
  <span class="chip">7 áreas operativas</span>
  <span class="chip">quality gates</span>
  <span class="chip">runtime parity</span>
  <span class="chip">finetuning avanzado</span>
</div>
