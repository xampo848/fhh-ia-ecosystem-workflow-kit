---
theme: default
title: AI Workflow Kit · FHH IA Ecosystem
titleTemplate: '%s'
info: |
  Un sistema operativo para el desarrollo asistido por IA.
  Gobernanza, calidad, portabilidad y eficiencia.
author: Francisco Herrera
presenter: true
download: false
exportFilename: ai-workflow-kit
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
    <div class="eyebrow">AI Workflow Kit · FHH IA Ecosystem</div>
    <div class="cover-title">Un sistema operativo<br>para el desarrollo<br>asistido por IA</div>
    <div class="cover-sub">Gobernanza, calidad, portabilidad y eficiencia</div>
    <p class="cover-copy">
      Un mismo sistema de trabajo para llevar un workflow personal a una organización
      sin perder control — repetible, auditable y portable entre runtimes.
    </p>
    <div class="cover-meta">
      <span class="v">Propuesta de adopción corporativa</span>
      <span class="k">Basada en la implementación real del workflow kit · v0.6.0</span>
    </div>
  </div>
  <div class="stack">
    <div class="stack-item s-core">
      <div class="st-tag">Fuente de verdad</div>
      <div class="st-title">.agents/</div>
      <div class="st-desc">Contrato neutral · routing · skills · políticas · memoria</div>
    </div>
    <div class="stack-item s-cyan">
      <div class="st-tag">Portable core</div>
      <div class="st-title">Router · create-prd · implement-prd</div>
    </div>
    <div class="stack-item s-blue">
      <div class="st-tag">Runtime adapters</div>
      <div class="st-title">Codex · Copilot · Claude · Antigravity</div>
    </div>
    <div class="stack-item s-mint">
      <div class="st-tag">Repo overlay</div>
      <div class="st-title">Reglas locales · estándares · dominio</div>
    </div>
  </div>
</div>

---

<div class="slide-head">
  <div class="eyebrow">Resumen ejecutivo</div>
  <h1>La oportunidad no es "usar más IA"</h1>
  <div class="sub">Es convertir la IA en un sistema de trabajo repetible, auditable y controlado.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="idx">01</div>
    <div class="card-title">Estandarizar</div>
    <div class="card-copy">Una fuente de verdad neutral evita que Codex, Copilot y Claude ejecuten reglas distintas.</div>
  </div>
  <div class="card accent-mint">
    <div class="idx">02</div>
    <div class="card-title">Proteger</div>
    <div class="card-copy">Dry-run, backups, validación y separación core/overlay reducen cambios destructivos y contaminación de contexto.</div>
  </div>
  <div class="card accent-blue">
    <div class="idx">03</div>
    <div class="card-title">Escalar</div>
    <div class="card-copy">Un kit instalable permite llevar el mismo modelo a varios repositorios sin copiar reglas manualmente.</div>
  </div>
</div>

<div class="callout mt-6">
  <strong>Recomendación.</strong> Mantener el repositorio personal privado y crear una distribución privada propiedad de la empresa. Los desarrolladores contribuyen mediante PRs; las mejoras reutilizables vuelven al upstream solo con reglas explícitas de propiedad intelectual.
</div>

<div class="source">Fuentes: README.md · package.json · templates/template-manifest.json</div>

---

<div class="slide-head">
  <div class="eyebrow amber">El problema</div>
  <h1>Sin un workflow común, cada agente "inventa" su forma de trabajar</h1>
  <div class="sub">El costo real aparece en retrabajo, inconsistencias, consumo de tokens y defectos que escapan al proceso.</div>
</div>

<div class="grid grid-4">
  <div class="card accent-amber">
    <div class="card-icon">⇋</div>
    <div class="card-title">Runtimes divergentes</div>
    <div class="card-copy">AGENTS.md, Copilot y Claude pueden contener reglas duplicadas o contradictorias.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-icon">↯</div>
    <div class="card-title">Contexto inflado</div>
    <div class="card-copy">Se cargan demasiadas skills, documentos y archivos aunque la tarea sea pequeña.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-icon">！</div>
    <div class="card-title">Calidad no verificable</div>
    <div class="card-copy">La IA implementa antes de fijar alcance, criterios de aceptación y validación.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-icon">◇</div>
    <div class="card-title">Conocimiento efímero</div>
    <div class="card-copy">Decisiones y patrones quedan en chats, no en artefactos reutilizables.</div>
  </div>
</div>

<div class="callout amber mt-6">
  <strong>Resultado típico:</strong> más autonomía aparente, pero menos previsibilidad operacional.
</div>

<div class="source">Referencia: docs/internal-documentation/workflows/ai-workflow.md · .agents/instructions.md</div>

---

<div class="slide-head">
  <div class="eyebrow">Alcance real</div>
  <h1>Qué entrega hoy el kit y qué pertenece al workflow maduro</h1>
  <div class="sub">La propuesta evita vender como "incluido" lo que todavía es una extensión de la implementación de referencia.</div>
</div>

<div class="compare">
  <div class="panel p-now">
    <div class="p-tag">Producto distribuible hoy</div>
    <div class="p-title">v0.6.0 · private install/export ready</div>
    <ul>
      <li>CLI: init, export, doctor y TUI guiada.</li>
      <li>Dry-run por defecto; apply exige <strong>--apply --yes</strong>.</li>
      <li>Core portable mínimo: router, create-prd e implement-prd.</li>
      <li>Adapters delgados para Codex, Copilot y Claude.</li>
      <li>Overlay starter para reglas locales y capabilities.</li>
      <li>Backups, manifest validation y release guardrails.</li>
    </ul>
  </div>
  <div class="panel p-ref">
    <div class="p-tag">Referencia madura</div>
    <div class="p-title">Workflow ampliado para producción</div>
    <ul>
      <li>product-studio, create-epic y document-development.</li>
      <li>Readiness, discovery y slicing antes de implementar.</li>
      <li>Implementadores backend/frontend y acceptance tests.</li>
      <li>Verificación de contratos, validación y QA fresco.</li>
      <li>Model routing lean/balanced/premium y delegación.</li>
      <li>Memoria, patrones de dominio y quality gates.</li>
    </ul>
  </div>
</div>

<div class="source">Fuentes: README.md · templates/portable-core/** · docs/internal-documentation/workflows/ai-workflow.md</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Arquitectura</div>
  <h1>Una fuente de verdad; múltiples runtimes; reglas locales separadas</h1>
  <div class="sub">La portabilidad se consigue evitando que los adapters y el core absorban reglas específicas de cada producto.</div>
</div>

<div class="arch">
  <div class="arch-core">
    <div class="ac-tag">Fuente de verdad</div>
    <div class="ac-path">.agents/</div>
    <div class="ac-desc">instrucciones · registry · skills · model routing · integrations · memory — neutral y reusable</div>
  </div>
  <div class="arch-runtimes">
    <div class="rt">
      <div class="rt-badge">C</div>
      <div class="rt-name">Codex</div>
      <div class="rt-desc">AGENTS.md apunta al core.</div>
    </div>
    <div class="rt r-blue">
      <div class="rt-badge">G</div>
      <div class="rt-name">GitHub Copilot</div>
      <div class="rt-desc">.github/ adapta la superficie.</div>
    </div>
    <div class="rt r-mint">
      <div class="rt-badge">A</div>
      <div class="rt-name">Claude</div>
      <div class="rt-desc">CLAUDE.md hereda reglas.</div>
    </div>
    <div class="rt r-amber">
      <div class="rt-badge">N</div>
      <div class="rt-name">Neutral</div>
      <div class="rt-desc">Solo portable core.</div>
    </div>
  </div>
  <div class="callout">
    <strong>Repo overlay:</strong> arquitectura local · estándares · patrones · comandos de prueba · dominio — separado del core.
  </div>
</div>

<div class="source">Fuente: templates/template-manifest.json · runtime-adapters/** · portable-core/.agents/instructions.md</div>

---

<div class="slide-head">
  <div class="eyebrow">Entrada y routing</div>
  <h1>El usuario describe el problema; el sistema elige el flujo mínimo seguro</h1>
  <div class="sub">No se exige memorizar skills. La decisión queda trazada con razón, costo y validación esperada.</div>
</div>

<div class="flow">
  <div class="flow-row">
    <div class="step">
      <span class="s-num">?</span>
      <div class="s-title">Solicitud libre</div>
      <div class="s-desc">El usuario describe qué necesita, sin memorizar skills ni comandos.</div>
    </div>
    <div class="step" style="border-color: rgba(51,214,255,0.5); background: rgba(51,214,255,0.08);">
      <span class="s-num">→</span>
      <div class="s-title">Workflow router</div>
      <div class="s-desc">Clasifica intención, riesgo y tamaño. Elige el menor workflow que conserve calidad production-ready.</div>
    </div>
  </div>
  <div class="flow-row">
    <div class="step">
      <span class="s-num">A</span>
      <div class="s-title">Respuesta directa</div>
      <div class="s-desc">Análisis o comando puntual.</div>
    </div>
    <div class="step">
      <span class="s-num">B</span>
      <div class="s-title">create-prd</div>
      <div class="s-desc">Requisitos aún no explícitos.</div>
    </div>
    <div class="step">
      <span class="s-num">C</span>
      <div class="s-title">implement-prd</div>
      <div class="s-desc">PRD aprobado o cambio productivo.</div>
    </div>
    <div class="step">
      <span class="s-num">D</span>
      <div class="s-title">Flujo extendido</div>
      <div class="s-desc">Producto, épica o documentación.</div>
    </div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Traza:</strong> workflow · confidence · reason · alternative · cost posture · validation.
</div>

<div class="source">Fuentes: workflow-router/SKILL.md · .github/copilot-instructions.md · ai-workflow.md</div>

---

<div class="slide-head">
  <div class="eyebrow mint">Ciclo de trabajo</div>
  <h1>De una necesidad difusa a una capacidad terminada y documentada</h1>
  <div class="sub">Los pasos se activan según el tamaño de la iniciativa; no todos son obligatorios en cada tarea.</div>
</div>

<div class="phase-band">
  <div class="band b-amber">Opcional cuando falta claridad</div>
  <div class="band b-cyan">Núcleo de entrega</div>
  <div class="band b-mint">Cierre durable</div>
</div>

<div class="flow-row">
  <div class="step">
    <span class="s-num">−1</span>
    <div class="s-title">Product studio</div>
    <div class="s-desc">Aclara problema, usuario, prioridad y validación.</div>
  </div>
  <div class="step">
    <span class="s-num">0</span>
    <div class="s-title">Create epic</div>
    <div class="s-desc">Investiga iniciativas amplias y las divide en PRDs.</div>
  </div>
  <div class="step">
    <span class="s-num">1</span>
    <div class="s-title">Create PRD</div>
    <div class="s-desc">Fija alcance, reglas, aceptación, riesgos y fases.</div>
  </div>
  <div class="step">
    <span class="s-num">2</span>
    <div class="s-title">Implement PRD</div>
    <div class="s-desc">Construye por slices con evidencia y quality gates.</div>
  </div>
  <div class="step">
    <span class="s-num">3</span>
    <div class="s-title">Document</div>
    <div class="s-desc">Preserva conocimiento para dev, QA, soporte y producto.</div>
  </div>
</div>

<div class="source">Fuente: docs/internal-documentation/workflows/ai-workflow.md</div>

---

<div class="slide-head">
  <div class="eyebrow">Orquestación de implementación</div>
  <h1>"Implementar" no significa empezar a escribir código</h1>
  <div class="sub">Primero se valida que el trabajo sea ejecutable; después se descubre, divide, construye y verifica.</div>
</div>

<div class="flow">
  <div class="flow-row">
    <div class="step"><span class="s-num">1</span><div class="s-title">Readiness</div><div class="s-desc">GO / STOP</div></div>
    <div class="step"><span class="s-num">2</span><div class="s-title">Discovery</div><div class="s-desc">Patrones, archivos y riesgos</div></div>
    <div class="step"><span class="s-num">3</span><div class="s-title">Slicing</div><div class="s-desc">Ownership y orden</div></div>
    <div class="step"><span class="s-num">4</span><div class="s-title">Build</div><div class="s-desc">Backend / Frontend / Tests</div></div>
  </div>
  <div class="flow-row">
    <div class="step"><span class="s-num">5</span><div class="s-title">Contracts</div><div class="s-desc">API ↔ UI</div></div>
    <div class="step"><span class="s-num">6</span><div class="s-title">Validation</div><div class="s-desc">Tests + lint</div></div>
    <div class="step"><span class="s-num">7</span><div class="s-title">Fresh QA</div><div class="s-desc">Revisión independiente</div></div>
    <div class="step"><span class="s-num">8</span><div class="s-title">Docs</div><div class="s-desc">Conocimiento durable</div></div>
  </div>
</div>

<div class="callout mint mt-4">
  La <strong>evidencia de aceptación</strong> —no la cantidad de código— determina el cierre.
</div>

<div class="source">Fuente: ai-workflow.md §7 · implement-prd/SKILL.md</div>

---

<div class="slide-head">
  <div class="eyebrow magenta">Eficiencia</div>
  <h1>Controlar costo sin degradar calidad</h1>
  <div class="sub">El sistema optimiza contexto, modelo, delegación y validación; no "abarata" omitiendo controles.</div>
</div>

<div class="tiers">
  <div class="tier lean">
    <div class="t-name">LEAN</div>
    <div class="t-desc">Routing, documentación, repetición, cambios de bajo riesgo.</div>
  </div>
  <div class="tier balanced">
    <div class="t-name">BALANCED</div>
    <div class="t-desc">PRDs, implementación normal, debugging y code review.</div>
  </div>
  <div class="tier premium">
    <div class="t-name">PREMIUM</div>
    <div class="t-desc">Arquitectura, seguridad, multi-tenancy y QA crítico.</div>
  </div>
</div>

<div class="grid grid-4">
  <div class="card accent-cyan">
    <div class="card-title">Carga just-in-time</div>
    <div class="card-copy">Solo abrir skills, patrones y archivos cuando el trigger aplica.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Delegación selectiva</div>
    <div class="card-copy">Subagentes solo si reducen riesgo, carga de contexto o sesgo de revisión.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Validación focalizada</div>
    <div class="card-copy">Comenzar con el comando mínimo que puede falsar el cambio.</div>
  </div>
  <div class="card accent-magenta">
    <div class="card-title">Salida proporcional</div>
    <div class="card-copy">Reportar decisiones, deltas, riesgos y próximos pasos; evitar repetir contexto.</div>
  </div>
</div>

<div class="source">Fuentes: model-routing/README.md · .agents/instructions.md · copilot-instructions.md</div>

---

<div class="slide-head">
  <div class="eyebrow">Instalación segura</div>
  <h1>Dry-run primero; escritura explícita después</h1>
  <div class="sub">El kit trata la adopción como una operación de infraestructura: planificable, reversible y validable.</div>
</div>

<div class="flow-row">
  <div class="step"><span class="s-num">1</span><div class="s-title">Seleccionar</div><div class="s-desc">Target · runtimes · overlay</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Planificar</div><div class="s-desc">create · unchanged · overwrite</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Revisar</div><div class="s-desc">Conflictos y archivos afectados</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">Aplicar</div><div class="s-desc">Requiere --apply --yes</div></div>
  <div class="step"><span class="s-num">5</span><div class="s-title">Respaldar</div><div class="s-desc">Backup timestamped antes de overwrite</div></div>
  <div class="step"><span class="s-num">6</span><div class="s-title">Validar</div><div class="s-desc">workflow-kit doctor</div></div>
</div>

<div class="callout mt-4">
  <strong>Por defecto no escribe nada.</strong>
  <span style="font-family:'JetBrains Mono',monospace; color:var(--wk-text-soft); display:block; margin-top:0.4rem; font-size:0.8rem;">workflow-kit init --target /repo --runtime codex,copilot --overlay starter</span>
</div>

<div class="source">Fuentes: src/cli.mjs · planner.mjs · apply.mjs · doctor.mjs · tui.mjs</div>

---

<div class="slide-head">
  <div class="eyebrow">Guardrails</div>
  <h1>La seguridad está integrada en el diseño del producto</h1>
  <div class="sub">No depende de que cada desarrollador recuerde "tener cuidado" al instalar o actualizar el workflow.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-mint">
    <div class="card-icon">✓</div>
    <div class="card-title">Sin escritura silenciosa</div>
    <div class="card-copy">Dry-run default; apply explícito.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-icon">↶</div>
    <div class="card-title">Sin overwrite irreversible</div>
    <div class="card-copy">Backup automático antes de reemplazar.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-icon">▦</div>
    <div class="card-title">Sin fuga de reglas locales</div>
    <div class="card-copy">Core portable y overlay tienen límites validados.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-icon">≣</div>
    <div class="card-title">Sin lógica duplicada</div>
    <div class="card-copy">Adapters delgados heredan del contrato neutral.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-icon">⊘</div>
    <div class="card-title">Sin publicación accidental</div>
    <div class="card-copy">package.json private:true y release approval-gated.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-icon">≡</div>
    <div class="card-title">Sin capabilities implícitas</div>
    <div class="card-copy">Instalar ≠ adjuntar ≠ activar.</div>
  </div>
</div>

<div class="source">Fuentes: README.md · template-manifest.json · RELEASE.md · capabilities/README.md</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Modelo operativo recomendado</div>
  <h1>Separar el activo personal del producto corporativo</h1>
  <div class="sub">La empresa necesita control operacional; el creador necesita preservar propiedad, independencia y trazabilidad.</div>
</div>

<div class="compare">
  <div class="panel p-now">
    <div class="p-tag">Upstream personal · privado</div>
    <div class="p-title">workflow-kit (personal)</div>
    <ul>
      <li>Visión, diseño genérico y roadmap personal.</li>
      <li>Sin reglas internas ni secretos de la empresa.</li>
      <li>Publicación futura bajo decisión del autor.</li>
      <li>Acepta solo contribuciones con origen y derechos claros.</li>
    </ul>
  </div>
  <div class="panel p-ref">
    <div class="p-tag">Distribución corporativa · privada</div>
    <div class="p-title">company/ai-workflow-kit</div>
    <ul>
      <li>Overlay, políticas, seguridad y runtimes corporativos.</li>
      <li>Contribuciones de desarrolladores vía pull request.</li>
      <li>CODEOWNERS, rulesets, CI y releases internas.</li>
      <li>Propiedad y soporte formal de la organización.</li>
    </ul>
  </div>
</div>

<div class="callout mt-4">
  <strong>Flujo:</strong> el corporativo importa versiones aprobadas del upstream; el upstream recibe mejoras genéricas propuestas — basado en la separación portable-core / repo-overlay del propio kit.
</div>

---

<div class="slide-head">
  <div class="eyebrow">Colaboración</div>
  <h1>Mejoran el sistema sin escribir directamente en el repositorio personal</h1>
  <div class="sub">La colaboración preserva revisión, ownership y separación entre mejoras corporativas y mejoras genéricas.</div>
</div>

<div class="flow-row">
  <div class="step"><span class="s-num">1</span><div class="s-title">Issue / RFC</div><div class="s-desc">Problema observado, evidencia y propuesta.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Branch</div><div class="s-desc">Cambio aislado en repo corporativo.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Pull request</div><div class="s-desc">Tests, docs e impacto en templates.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">CODEOWNERS</div><div class="s-desc">Revisión obligatoria del workflow owner.</div></div>
  <div class="step"><span class="s-num">5</span><div class="s-title">Release interno</div><div class="s-desc">Versión, changelog y piloto.</div></div>
</div>

<div class="grid grid-2 mt-4">
  <div class="card accent-blue">
    <div class="card-title">Mejora corporativa</div>
    <div class="card-copy">Políticas internas, seguridad, vendors, modelos aprobados, comandos y overlays.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Mejora genérica</div>
    <div class="card-copy">CLI, planner, doctor, adapters neutrales o guardrails reutilizables; candidata a upstream.</div>
  </div>
</div>

<div class="source">Base: CONTRIBUTING.md · RELEASE.md · arquitectura de templates del kit.</div>

---

<div class="slide-head">
  <div class="eyebrow amber">Decisión de visibilidad</div>
  <h1>Mantener privado ahora; considerar público después de estabilizar la frontera</h1>
  <div class="sub">Hacerlo público hoy aumenta distribución, pero cede control, expone diferenciadores y complica la propiedad de contribuciones corporativas.</div>
</div>

<table class="wk-table">
  <thead>
    <tr><th>Criterio</th><th>Privado</th><th>Público</th></tr>
  </thead>
  <tbody>
    <tr><td>Control de roadmap</td><td class="col-priv">Alto</td><td class="col-pub">Medio</td></tr>
    <tr><td>Adopción en la empresa</td><td class="col-priv">Simple con acceso GitHub</td><td class="col-pub">Simple, pero sin aislamiento</td></tr>
    <tr><td>Protección del diferenciador</td><td class="col-priv">Alta</td><td class="col-pub">Baja</td></tr>
    <tr><td>Contribuciones externas</td><td class="col-priv">Limitadas y controladas</td><td class="col-pub">Amplias; mayor mantenimiento</td></tr>
    <tr><td>Riesgo IP empresa/personal</td><td class="col-priv">Gestionable con repos separados</td><td class="col-pub">Más complejo</td></tr>
    <tr><td>Credibilidad / comunidad</td><td class="col-priv">Menor</td><td class="col-pub">Mayor</td></tr>
  </tbody>
</table>

<div class="callout amber mt-4">
  <strong>Decisión recomendada:</strong> privado durante el piloto corporativo y hasta contar con versión 1.0, política de contribución y revisión de propiedad intelectual.
</div>

---

<div class="slide-head">
  <div class="eyebrow mint">Adopción</div>
  <h1>Plan 30–60–90 días para introducirlo sin imponerlo</h1>
  <div class="sub">El objetivo del piloto es demostrar calidad y eficiencia, no convertir el workflow en burocracia obligatoria desde el primer día.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-mint">
    <div class="idx">0–30 días</div>
    <div class="card-title">Diseñar y pilotear</div>
    <div class="card-copy">
      Crear repo corporativo privado.<br>
      Definir owners, licencia interna y reglas de contribución.<br>
      Seleccionar 2 repos piloto y 4–6 desarrolladores.<br>
      Instalar core + adapters + overlay mínimo.
    </div>
  </div>
  <div class="card accent-cyan">
    <div class="idx">31–60 días</div>
    <div class="card-title">Medir y ajustar</div>
    <div class="card-copy">
      Medir tiempo a PR, retrabajo, defectos y consumo.<br>
      Refinar router, skills y quality gates.<br>
      Separar reglas universales de reglas locales.<br>
      Publicar primera release interna estable.
    </div>
  </div>
  <div class="card accent-blue">
    <div class="idx">61–90 días</div>
    <div class="card-title">Escalar con gobierno</div>
    <div class="card-copy">
      Ampliar a nuevos equipos/repositorios.<br>
      Crear onboarding y office hours.<br>
      Automatizar doctor y drift checks en CI.<br>
      Decidir roadmap, soporte y eventual apertura pública.
    </div>
  </div>
</div>

<div class="source">Propuesta de rollout: pilotar, medir y escalar por evidencia.</div>

---

<div class="slide-head">
  <div class="eyebrow">Decisiones requeridas</div>
  <h1>Qué debe aprobar la empresa para comenzar</h1>
  <div class="sub">La tecnología ya tiene una base funcional; el siguiente bloqueo es de ownership, gobierno y adopción.</div>
</div>

<div class="grid grid-4">
  <div class="card accent-cyan">
    <div class="idx">01</div>
    <div class="card-title">Repositorio</div>
    <div class="card-copy">Crear un repositorio privado propiedad de la empresa.</div>
  </div>
  <div class="card accent-blue">
    <div class="idx">02</div>
    <div class="card-title">Ownership</div>
    <div class="card-copy">Nombrar workflow owner, CODEOWNERS y mantenedores.</div>
  </div>
  <div class="card accent-mint">
    <div class="idx">03</div>
    <div class="card-title">Piloto</div>
    <div class="card-copy">Seleccionar equipos y repositorios con métricas de éxito.</div>
  </div>
  <div class="card accent-amber">
    <div class="idx">04</div>
    <div class="card-title">IP y licencia</div>
    <div class="card-copy">Validar el uso del proyecto personal y las contribuciones.</div>
  </div>
</div>

<div class="callout mint mt-6">
  <strong>Resultado esperado:</strong> un estándar interno de IA que aumenta velocidad sin sacrificar arquitectura, seguridad ni control.
</div>

<div class="source">Recomendación final basada en el estado actual v0.6.0-private-install-export.</div>

---
layout: section
class: section-slide
---

<div class="section-num">Gracias</div>
<div class="section-title">Un estándar interno de IA<br>que aumenta velocidad<br>sin sacrificar control</div>
<div class="section-copy mt-4">
  AI Workflow Kit · FHH IA Ecosystem — un sistema operativo para el desarrollo asistido por IA.
</div>
<div class="chips mt-6">
  <span class="chip">.agents/</span>
  <span class="chip">workflow-router</span>
  <span class="chip">implement-prd</span>
  <span class="chip">dry-run first</span>
  <span class="chip">lean · balanced · premium</span>
  <span class="chip">portable-core / repo-overlay</span>
</div>
