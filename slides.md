---
theme: default
title: FHH IA Ecosystem Workflow
titleTemplate: '%s'
info: |
  Documentación oficial del flujo completo de desarrollo asistido por IA.
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
  primary: '#ff5a4f'
fonts:
  sans: Archivo
  serif: Archivo
  mono: JetBrains Mono
defaults:
  layout: default
---

<div class="cover">
  <div>
    <div class="cover-title">FHH IA Ecosystem Workflow<br><span class="accent">Documentación Oficial</span></div>
    <div class="cover-sub">Flujo completo para diseñar, implementar, validar y documentar software con IA</div>
    <p class="cover-copy">
      Esta presentación funciona como guía operativa integral: qué hace cada módulo, cuándo se usa, qué entrada espera, qué salida produce y qué evidencia exige para cerrar con calidad.
    </p>
    <div class="cover-meta">
      <span class="v">Cobertura end-to-end del ecosistema</span>
      <span class="k">Basado en .agents/, skills registry, capabilities, memory y CLI workflow-kit</span>
    </div>
  </div>
  <div class="stack">
    <div class="stack-item s-core">
      <div class="st-tag">Contrato neutral</div>
      <div class="st-title">.agents/instructions.md</div>
      <div class="st-desc">Fuente de verdad cross-runtime</div>
    </div>
    <div class="stack-item s-cyan">
      <div class="st-tag">Skills del workflow</div>
      <div class="st-title">40 SKILL.md en 7 áreas (39 skills + 1 pattern skill en registry.json)</div>
      <div class="st-desc">Desde routing hasta patterns</div>
    </div>
    <div class="stack-item s-blue">
      <div class="st-tag">Extensiones</div>
      <div class="st-title">Capabilities e integrations</div>
      <div class="st-desc">Install/attach con gobernanza</div>
    </div>
    <div class="stack-item s-mint">
      <div class="st-tag">Confiabilidad</div>
      <div class="st-title">Quality + memory + parity</div>
      <div class="st-desc">Cierre verificable y sin drift</div>
    </div>
  </div>
</div>

---

<div class="slide-head">
  <div class="eyebrow amber">Introducción</div>
  <h1>La oportunidad: pasar de prompts sueltos a un sistema de trabajo</h1>
  <div class="sub">No se trata de usar más IA, sino de operar con un workflow repetible, auditable y bajo control humano.</div>
</div>

<div class="callout mt-4">
  <strong>La oportunidad no es “usar más IA”.</strong> Es convertir la IA en un sistema de trabajo repetible, auditable y controlado.
</div>

<div class="callout mt-4">
  <strong>Sin un workflow común, cada agente inventa su forma de trabajar.</strong>
</div>

<div class="callout mt-4">
  <strong>Top 6 problemas operativos que resuelve este workflow</strong>
</div>

<div class="manifest mt-4">
  <div class="manifest-row">
    <div class="manifest-num">01</div>
    <div class="manifest-title">Contexto fragmentado</div>
    <div class="manifest-copy">Sin memoria operativa se pierde continuidad entre turnos y repositorios, aumentando retrabajo y decisiones inconsistentes.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">02</div>
    <div class="manifest-title">Exceso de tokens y costo</div>
    <div class="manifest-copy">Cuando no hay routing ni carga just-in-time, se reitera discovery y se consume contexto innecesario.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">03</div>
    <div class="manifest-title">Procesos no estandarizados</div>
    <div class="manifest-copy">Cada agente ejecuta distinto; la variación de flujo rompe consistencia, trazabilidad y repetibilidad.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">04</div>
    <div class="manifest-title">Bajo control humano</div>
    <div class="manifest-copy">Sin gates ni evidencia, la automatización avanza sin supervisión suficiente ni ownership claro.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">05</div>
    <div class="manifest-title">Scope creep silencioso</div>
    <div class="manifest-copy">Tareas pequeñas escalan sin control cuando no se fuerza decisión de ruta y límites de entrega.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">06</div>
    <div class="manifest-title">Calidad inconsistente</div>
    <div class="manifest-copy">Sin validación por superficie, aumentan regresiones y cada entrega termina con criterios distintos.</div>
  </div>
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">General</div>
  <h1>Cómo leer esta documentación</h1>
  <div class="sub">Primero identifica qué capa estás leyendo y su fuente de verdad; después aplica la lectura adecuada para orientar o ejecutar trabajo.</div>
</div>

<div class="flow-row phase-quality">
  <div class="step"><span class="s-num">1</span><div class="s-title">Ubica la capa</div><div class="s-desc">Contrato neutral, registry, skill, integración, adapter o documentación humana.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Confirma el ownership</div><div class="s-desc">La fuente neutral gobierna; adapters solo exponen su comportamiento al runtime.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Elige la lectura</div><div class="s-desc">Sistema para orientarte; workflow o skill para ejecutar una tarea concreta.</div></div>
</div>

<div class="compare mt-4">
  <div class="panel p-now">
    <div class="p-tag">Lectura del sistema</div>
    <div class="p-title">Para entender cómo se organiza</div>
    <ul>
      <li>Qué responsabilidad tiene cada capa.</li>
      <li>Cuál es la fuente de verdad y qué puede extenderse.</li>
      <li>Cómo se cargan registry, integrations y runtime adapters.</li>
    </ul>
  </div>
  <div class="panel p-ref">
    <div class="p-tag">Lectura de ejecución</div>
    <div class="p-title">Para aplicar un workflow o skill</div>
    <ul>
      <li>Propósito, trigger y entradas mínimas.</li>
      <li>Pasos, salida esperada y handoff.</li>
      <li>Evidencia de cierre y condiciones de parada.</li>
    </ul>
  </div>
</div>

<div class="grid grid-3 mt-4">
  <div class="card accent-cyan">
    <div class="idx">FUENTE</div>
    <div class="card-title">Contrato neutral primero</div>
    <div class="card-copy">Ante una contradicción, .agents/instructions.md prevalece sobre cualquier adapter de runtime.</div>
  </div>
  <div class="card accent-blue">
    <div class="idx">CARGA</div>
    <div class="card-title">Registry antes que inventario</div>
    <div class="card-copy">Descubre skills mediante el registry y carga solo la que exige el trigger y la fase activa.</div>
  </div>
  <div class="card accent-mint">
    <div class="idx">LÍMITE</div>
    <div class="card-title">Docs no sustituyen skills</div>
    <div class="card-copy">La documentación explica y orienta; los SKILL.md establecen el procedimiento ejecutable.</div>
  </div>
</div>

<div class="phase-band mt-4">
  <div class="band b-amber">00 Router</div>
  <div class="band b-cyan">01 Producto</div>
  <div class="band b-mint">02 Implementación</div>
  <div class="band b-blue">03 Calidad</div>
  <div class="band b-magenta">04 Crosscutting</div>
  <div class="band b-amber">06 Patrones</div>
</div>

<div class="callout mt-4">
  <strong>Regla de lectura:</strong> no cargar todo al inicio. Navega desde la capa y el trigger hacia la fuente exacta que necesitas para decidir o ejecutar.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Arquitectura</div>
  <h1>Arquitectura del ecosistema completo</h1>
  <div class="sub">Separación explícita entre contrato neutral, ejecución de skills, extensiones, memoria y adapters.</div>
</div>

<div class="manifest">
  <div class="manifest-row">
    <div class="manifest-num">01</div>
    <div class="manifest-title">Contrato neutral</div>
    <div class="manifest-copy">.agents/instructions.md define jerarquía, loading rules, routing policy y límites de wrappers.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">02</div>
    <div class="manifest-title">Ejecución del flujo</div>
    <div class="manifest-copy">.agents/skills/** organiza workflows, delegados, quality y patterns con descubrimiento just-in-time.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">03</div>
    <div class="manifest-title">Extensiones gobernadas</div>
    <div class="manifest-copy">.agents/integrations/** y .agents/capabilities/** separan install, attach y activación.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">04</div>
    <div class="manifest-title">Routing y costo</div>
    <div class="manifest-copy">.agents/model-routing/README.md establece lean, balanced, premium y delegación por riesgo.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">05</div>
    <div class="manifest-title">Memoria y paridad</div>
    <div class="manifest-copy">.agents/memory/** define shareability, sensibilidad y revisión cross-runtime.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">06</div>
    <div class="manifest-title">Adopción reusable</div>
    <div class="manifest-copy">workflow-kit instala el overlay completo, valida los packs y agrega adapters de runtime cuando se solicitan.</div>
  </div>
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Arquitectura</div>
  <h1>Runtimes soportados</h1>
  <div class="sub">El toolkit soporta neutral, Codex, Copilot, Claude y Antigravity con adapters delgados que remiten al contrato neutral.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">neutral</div>
    <div class="card-copy">Instala el workflow completo en .agents sin adapter adicional específico de runtime.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">codex / copilot / claude</div>
    <div class="card-copy">Agrega archivos puente de cada runtime, siempre apuntando a .agents como fuente de verdad.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">antigravity</div>
    <div class="card-copy">Adapter oficial incluido: ANTIGRAVITY.md + .antigravity/README.md.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Regla clave:</strong> el adapter no redefine flujo. Solo expone acceso runtime a políticas ya definidas en .agents.
</div>

---

<div class="slide-head">
  <div class="eyebrow amber">Router</div>
  <h1>Router: puerta de entrada obligatoria</h1>
  <div class="sub">workflow-router clasifica la solicitud y enruta al flujo mínimo seguro con traza explícita.</div>
</div>

<table class="wk-table">
  <thead>
    <tr><th>Clase</th><th>Ruta primaria</th><th>Postura costo</th><th>Confirmación</th></tr>
  </thead>
  <tbody>
    <tr><td>Respuesta directa</td><td>Responder directamente</td><td>lean</td><td>No</td></tr>
    <tr><td>Ambigüedad de producto</td><td>project-formation</td><td>balanced</td><td>No</td></tr>
    <tr><td>Iniciativa amplia</td><td>create-epic</td><td>balanced / premium por riesgo</td><td>Sí</td></tr>
    <tr><td>Especificación de feature</td><td>create-prd</td><td>balanced</td><td>No</td></tr>
    <tr><td>Backlog item acotado</td><td>generate-pm-ticket</td><td>lean</td><td>No</td></tr>
    <tr><td>Cambio productivo</td><td>implement-prd</td><td>balanced / premium por riesgo</td><td>Depende de PRD</td></tr>
    <tr><td>Review o QA</td><td>Skill aplicable por superficie</td><td>lean / balanced</td><td>No</td></tr>
    <tr><td>Documentación</td><td>document-development</td><td>lean</td><td>No</td></tr>
  </tbody>
</table>

<div class="callout mt-4">
  <strong>Salida esperada del router:</strong> workflow, confidence, reason, alternative, cost posture y expectativa de validación.
</div>

---

<div class="slide-head">
  <div class="eyebrow amber">Router</div>
  <h1>Router: cuatro decisiones que evitan retrabajo</h1>
  <div class="sub">Ante cada señal, el router decide si puede avanzar, qué ruta aplicar o cuándo detenerse para pedir la mínima aclaración necesaria.</div>
</div>

<div class="manifest">
  <div class="manifest-row">
    <div class="manifest-num">01</div>
    <div class="manifest-title">¿La especificación es suficiente?</div>
    <div class="manifest-copy"><strong>No:</strong> enrutar a create-prd o generate-pm-ticket. <strong>Sí:</strong> permitir implement-prd con una base verificable.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">02</div>
    <div class="manifest-title">¿El cambio es realmente quirúrgico?</div>
    <div class="manifest-copy"><strong>Sí:</strong> editar con validación focalizada. <strong>No:</strong> volver a la especificación antes de abrir una implementación no trivial.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">03</div>
    <div class="manifest-title">¿Qué superficie cambió?</div>
    <div class="manifest-copy">Elegir solo la validación aplicable: contrato para API/UI, react-doctor para React, Playwright para E2E o revisión inline cuando basta.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">04</div>
    <div class="manifest-title">¿Falta una decisión crítica?</div>
    <div class="manifest-copy"><strong>Sí:</strong> detenerse y preguntar. La salida no es adivinar: es una pregunta concreta que cambie la ruta o el resultado.</div>
  </div>
</div>

<div class="grid grid-3 mt-4">
  <div class="card accent-amber">
    <div class="card-title">Postura de costo</div>
    <div class="card-copy"><strong>lean</strong> para trabajo acotado; <strong>balanced</strong> para planificación e implementación; <strong>premium</strong> solo ante riesgo explícito.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">Tier de razonamiento</div>
    <div class="card-copy">Liviano, Mediano o Grande. Es el contrato semántico; el modelo exacto puede diferir por runtime.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">Decisión de delegación</div>
    <div class="card-copy">Avoided, recommended o required según riesgo, ownership, contexto y necesidad de revisión independiente.</div>
  </div>
</div>

<div class="callout amber mt-4">
  <strong>Propósito de la slide:</strong> mostrar cómo el router reduce retrabajo y aplica costo/delegación proporcional sin degradar seguridad.
</div>

---

<div class="slide-head">
  <div class="eyebrow amber">Ejemplos en vivo</div>
  <h1>Probar el router con solicitudes reales</h1>
  <div class="sub">Usa estos prompts sin invocar una skill: la demostración consiste en observar cómo el router elige el flujo mínimo seguro y explica su decisión.</div>
</div>

<table class="wk-table">
  <thead><tr><th>Prompt para probar</th><th>Ruta esperada</th><th>Qué debe demostrar</th></tr></thead>
  <tbody>
    <tr><td>"No sabemos si priorizar alertas de gasto o reportes semanales para los administradores."</td><td>project-formation</td><td>Intake y ruta de discovery/shaping para no convertir una intuición en una feature prematura.</td></tr>
    <tr><td>"Queremos habilitar SSO SAML para clientes enterprise durante los próximos dos ciclos."</td><td>create-epic</td><td>Confirmación por iniciativa amplia, investigación y una cola de PRDs por fases.</td></tr>
    <tr><td>"Los administradores deben invitar miembros por correo, ver invitaciones pendientes y poder revocarlas."</td><td>create-prd</td><td>Exploración del código, preguntas bloqueantes, límites de scope y slices verificables.</td></tr>
    <tr><td>"Agrega texto de ayuda al filtro de fecha en la pantalla de reportes."</td><td>generate-pm-ticket</td><td>Artefacto pequeño con criterios de aceptación, sin abrir un PRD innecesario.</td></tr>
  </tbody>
</table>

<div class="callout amber mt-4">
  <strong>Resultado que se espera ver:</strong> ruta, confidence, reason, alternativa descartada, postura de costo y decisión de delegación. Si una de esas piezas falta, el enrutamiento no quedó explicado.
</div>

---

<div class="slide-head">
  <div class="eyebrow cyan">Ejemplos en vivo</div>
  <h1>De iniciativa a PRD implementable</h1>
  <div class="sub">Dos prompts consecutivos muestran el handoff: primero se delimita una iniciativa; luego se convierte una fase elegida en un contrato de ejecución.</div>
</div>

<div class="compare">
  <div class="panel p-now">
    <div class="p-tag">1. Crear la épica</div>
    <div class="p-title">Prompt de investigación y entrega</div>
    <p><code>$create-epic Investiga y crea una épica para habilitar SSO SAML para clientes enterprise. El objetivo es reducir fricción de acceso; tenemos una apuesta de dos ciclos. Incluye riesgos de seguridad, tenancy, rollout y una secuencia de PRDs. Guarda el artefacto en docs/epics/.</code></p>
    <ul>
      <li>La salida es una épica, no código ni un PRD gigante.</li>
      <li>Debe separar evidencia, supuestos, riesgos y preguntas abiertas.</li>
      <li>Debe proponer fases que puedan pasar por create-prd.</li>
    </ul>
  </div>
  <div class="panel p-ref">
    <div class="p-tag">2. Formalizar una fase</div>
    <div class="p-title">Prompt de PRD focalizado</div>
    <p><code>$create-prd A partir de la fase "configuración SAML por organización" de la épica de SSO, crea un PRD. Explora primero el código y pregunta solo lo que bloquee decisiones de datos, autorización, tenancy, activación y rollback. Define slices, criterios Given/When/Then y evidencia de validación.</code></p>
    <ul>
      <li>La salida se guarda en <code>docs/prd/</code> y queda lista para implement-prd.</li>
      <li>Debe declarar qué queda explícitamente fuera de alcance.</li>
      <li>No debe implementar código durante la planificación.</li>
    </ul>
  </div>
</div>

<div class="callout mt-4">
  <strong>Secuencia de demo:</strong> ejecuta primero el prompt libre de router y después estos dos prompts explícitos. Así se muestran tanto la decisión automática como el uso dirigido de cada workflow.
</div>

---

<div class="slide-head">
  <div class="eyebrow">Producto</div>
  <h1>Producto: project-formation</h1>
  <div class="sub">Workflow conversacional de formación PM para convertir incertidumbre en una apuesta ejecutable end-to-end, con desambiguación explícita en cada etapa.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Diagnostica antes de elegir</div>
    <div class="card-copy">Parte de una pregunta vaga, identifica la decisión pendiente y enruta a la etapa correcta con evidencia mínima útil.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Facilita la conversación</div>
    <div class="card-copy">Guía una pregunta por turno, separa hechos/supuestos/riesgos y resuelve una ambigüedad crítica antes de avanzar.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Produce un siguiente paso</div>
    <div class="card-copy">Entrega artefactos por etapa y cierra con dossier formal, con handoff opcional a create-epic cuando corresponde.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Posición en el flujo:</strong> vive en la capa de Producto; prepara decisiones sólidas antes de create-prd e implementación.
</div>

---

<div class="slide-head">
  <div class="eyebrow">Producto</div>
  <h1>Project-formation: operación en una vista</h1>
  <div class="sub">Flujo completo con pregunta anti-ambigüedad, Interview Prep opcional y salida ejecutable para handoff.</div>
</div>

<div class="flow-row phase-product">
  <div class="step"><span class="s-num">1</span><div class="s-title">Entrada</div><div class="s-desc">Problema o desacuerdo de producto.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Desambiguar</div><div class="s-desc">Una pregunta crítica por turno para limpiar término, scope o métrica.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Descubrir y dar forma</div><div class="s-desc">Discovery -> Shaping -> Roadmap según evidencia y riesgo.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">Lanzar y cerrar</div><div class="s-desc">GTM + Dossier con handoff a create-epic/create-prd.</div></div>
</div>

<div class="compare mt-4">
  <div class="panel p-now">
    <div class="p-tag">Reglas de avance</div>
    <div class="p-title">Ambigüedad y confianza</div>
    <ul>
      <li>High: no avanza, pregunta de precisión obligatoria.</li>
      <li>Partial: avanza solo con riesgos y controles explícitos.</li>
      <li>Clear: puede transicionar si el skip-guard está en pass.</li>
    </ul>
  </div>
  <div class="panel p-ref">
    <div class="p-tag">Discovery reforzado</div>
    <div class="p-title">Interview Prep opcional</div>
    <ul>
      <li>Se activa con evidencia débil o contradictoria.</li>
      <li>Prepara objetivo, perfil, preguntas y supuestos a validar.</li>
      <li>Cierra cuando vuelve evidencia útil al discovery.</li>
    </ul>
  </div>
</div>

<div class="grid grid-3">
  <div class="card accent-mint">
    <div class="card-title">SaaS B2B: churn SMB</div>
    <div class="card-copy">Señal: cancelaciones por sobreconsumo inesperado. Ruta: discovery -> shaping de alertas tempranas. Resultado: bet con KPI de retención y falsos positivos.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">E-commerce: checkout móvil</div>
    <div class="card-copy">Señal: abandono alto en pago. Ruta: discovery con entrevistas rápidas y roadmap por fricción crítica. Resultado: fases con hipótesis de conversión medibles.</div>
  </div>
  <div class="card accent-cyan">
    <div class="card-title">Fintech: baja activación</div>
    <div class="card-copy">Señal: usuarios no activan alertas. Ruta: shaping de onboarding + GTM segmentado. Resultado: experimento de lanzamiento con umbrales de activación.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Resultado esperado:</strong> del síntoma ambiguo a una apuesta defendible con evidencia, tradeoffs y handoff proporcional.
</div>

---

<div class="slide-head">
  <div class="eyebrow">Producto</div>
  <h1>Producto: create-epic</h1>
  <div class="sub">Forma una épica profesional desde investigación hasta pipeline de entrega.</div>
</div>

<div class="flow-row phase-product">
  <div class="step"><span class="s-num">1</span><div class="s-title">Encuadrar la solicitud</div><div class="s-desc">Contexto, objetivo y alcance inicial.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Contexto local</div><div class="s-desc">Carga arquitectura y restricciones del repo.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Investigación externa</div><div class="s-desc">Estado del arte, riesgos y benchmarks.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">Síntesis</div><div class="s-desc">Documento de investigación accionable.</div></div>
  <div class="step"><span class="s-num">5</span><div class="s-title">Diseño de entrega</div><div class="s-desc">Fases, dependencias y preguntas bloqueantes.</div></div>
</div>

<div class="callout mt-4">
  <strong>Salida:</strong> épica estructurada y handoff explícito a create-prd para cada frente implementable.
</div>

---

<div class="slide-head">
  <div class="eyebrow">Producto</div>
  <h1>Producto: create-prd</h1>
  <div class="sub">Convierte una intención de feature en un contrato de ejecución: decisiones resueltas, slices verificables y evidencia esperada.</div>
</div>

<div class="flow-row phase-product">
  <div class="step"><span class="s-num">1</span><div class="s-title">Entender la superficie real</div><div class="s-desc">Explora código, patrones, límites y dependencias antes de prometer una solución.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Resolver lo que bloquea</div><div class="s-desc">Hace preguntas dirigidas sobre alcance, reglas, datos, tenancy, rollout y recuperación.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Planificar trabajo verificable</div><div class="s-desc">Especifica slices con outcome, dependencias, validación, evidencia y condición de parada.</div></div>
</div>

<div class="grid grid-2 mt-4">
  <div class="card accent-cyan">
    <div class="card-title">Lo que recibe</div>
    <div class="card-copy">Una necesidad ya priorizada: desde project-formation, una épica o una solicitud de feature suficientemente concreta.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Lo que entrega</div>
    <div class="card-copy">Un PRD que permite a implement-prd elegir modo, asignar ownership, construir por slices y demostrar aceptación.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Distinción clave:</strong> no es un documento descriptivo; es la base verificable que evita que Implementación tenga que redescubrir decisiones de producto.
</div>

---

<div class="slide-head">
  <div class="eyebrow mint">Implementación</div>
  <h1>Implementación: implement-prd en una vista</h1>
  <div class="sub">Orquesta ejecución técnica desde un PRD aprobado, ajustando coordinación y evidencia al riesgo real.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Modo de operación</div>
    <div class="card-copy">Selecciona postura por riesgo: local, controlada o estándar; no todo cambio requiere el flujo completo.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Delegación</div>
    <div class="card-copy">Activa readiness, discovery, slicing, implementers, validation y QA handoff según dependencia y ownership.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Context budget</div>
    <div class="card-copy">Carga mínima necesaria, evitando inflación de contexto y costo innecesario.</div>
  </div>
</div>

<table class="wk-table mt-4">
  <thead><tr><th>Modo</th><th>Cuándo aplica</th><th>Postura de ejecución</th></tr></thead>
  <tbody>
    <tr><td>small/local</td><td>1–2 archivos, alcance evidente.</td><td>Validación focalizada y cierre rápido.</td></tr>
    <tr><td>controlled-lite / controlled-implementation</td><td>Dependencias parciales o riesgo moderado.</td><td>Ownership explícito, delegación selectiva y checkpoints.</td></tr>
    <tr><td>standard / autonomous-safe</td><td>Cross-layer, contrato, migración o UI relevante.</td><td>Slicing completo, gates de evidencia y handoffs formales.</td></tr>
    <tr><td>resume</td><td>Ejecución interrumpida.</td><td>Reconstruir estado desde tracker y evidencia antes de continuar.</td></tr>
  </tbody>
</table>

<div class="callout mint mt-4">
  <strong>Principio:</strong> escalar el modo por riesgo, alcance, dependencia y necesidad de revisión independiente; no por preferencia de complejidad.
</div>

---

<div class="slide-head">
  <div class="eyebrow mint">Implementación</div>
  <h1>Implementación: ejecución por slices y evidencia</h1>
  <div class="sub">Un slice progresa por estados observables y usa delegación segura: dependencia explícita, un writer por superficie y handoff verificable.</div>
</div>

<div class="flow-row phase-implement">
  <div class="step"><span class="s-num">1</span><div class="s-title">NOT_STARTED</div><div class="s-desc">Scope, owner y dependencia definidos.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">IMPLEMENTED</div><div class="s-desc">Cambio dentro del write set acordado.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">TESTED</div><div class="s-desc">Prueba focalizada ejecutada sobre comportamiento.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">VALIDATED</div><div class="s-desc">Comando o contrato deja resultado verificable.</div></div>
  <div class="step"><span class="s-num">5</span><div class="s-title">VERIFIED</div><div class="s-desc">Aceptación y handoff listos para cierre.</div></div>
</div>

<div class="grid grid-2 mt-4">
  <div class="card accent-mint">
    <div class="card-title">Cadena de ejecución</div>
    <div class="card-copy">Readiness -> Discovery -> Slicing -> Skill matching -> Build -> Contract check -> Validation -> QA handoff.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Reglas de delegación segura</div>
    <div class="card-copy">Un writer por superficie, paralelismo solo entre slices independientes y tracker como fuente de estado para resume.</div>
  </div>
</div>

<div class="callout mint mt-4">
  <strong>Regla de avance:</strong> un slice dependiente no empieza por intuición; espera evidencia terminal verificable del slice previo.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Calidad</div>
  <h1>Calidad: seleccionar la evidencia aplicable</h1>
  <div class="sub">La validación se elige por superficie y riesgo. Ejecutar un gate irrelevante aumenta costo sin aumentar confianza.</div>
</div>

<table class="wk-table">
  <thead><tr><th>Superficie</th><th>Evidencia principal</th><th>Cuándo no aplica</th></tr></thead>
  <tbody>
    <tr><td>Contrato, API o integración</td><td>Contract verifier, pruebas de integración y comandos del slice.</td><td>Cuando no cambian contratos ni comportamiento integrado.</td></tr>
    <tr><td>Frontend React relevante</td><td>react-doctor más tests o revisión focalizada.</td><td>Backend-only o cambio sin superficie React.</td></tr>
    <tr><td>Flujo navegable de usuario</td><td>Playwright E2E con ruta crítica reproducible.</td><td>Sin UI, sin intención E2E o entorno no disponible.</td></tr>
    <tr><td>Cambio local de bajo riesgo</td><td>Validación inline y comandos focalizados.</td><td>Cuando el alcance obliga contrato, UI o revisión independiente.</td></tr>
  </tbody>
</table>

<div class="callout mt-4">
  <strong>Gate de aplicabilidad:</strong> antes de crear E2E se confirma UI navegable, intención o riesgo formal y tooling disponible; si no, se declara not-applicable y se usa evidencia proporcional.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Calidad</div>
  <h1>Workflow de calidad: document-development</h1>
  <div class="sub">Genera documentación técnica y no técnica con estructura canónica y diagrama de flujo.</div>
</div>

<div class="flow-row phase-quality">
  <div class="step"><span class="s-num">1</span><div class="s-title">Explorar código</div><div class="s-desc">Entender implementación real y límites.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Identificar audiencias</div><div class="s-desc">No técnica y técnica con necesidades distintas.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Construir documento</div><div class="s-desc">Contexto, alcance, reglas, casos de uso, arquitectura, guía y FAQ.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">Mermaid + robustez</div><div class="s-desc">Flujo visual, límites y comportamiento ante fallas.</div></div>
</div>

<div class="callout mt-4">
  <strong>Resultado:</strong> artefacto durable y reutilizable para operación y evolución del sistema.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Calidad</div>
  <h1>Validación de calidad: playwright-testing</h1>
  <div class="sub">Protocolo de generación y ejecución de pruebas E2E con gate de aplicabilidad.</div>
</div>

<div class="grid grid-2">
  <div class="card accent-cyan">
    <div class="card-title">Cuándo usarlo</div>
    <div class="card-copy">Cuando el cambio afecta comportamiento de usuario o requiere evidencia de flujo extremo a extremo.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Protocolo</div>
    <div class="card-copy">Exploración guiada, estructura de test, gestión de archivos y ejecución iterativa hasta estabilidad.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Éxito</div>
    <div class="card-copy">Tests reproducibles, sin anti-patterns, con cobertura de rutas críticas y resultados verificables.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">Condiciones de parada</div>
    <div class="card-copy">Entorno no listo, señales frágiles, selectors inestables o flujos no deterministicos.</div>
  </div>
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Gobernanza</div>
  <h1>Registry y taxonomía de skills</h1>
  <div class="sub">El registry evita cargar todo al inicio y define descubrimiento preciso de capacidades.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-blue">
    <div class="card-title">Qué contiene</div>
    <div class="card-copy">Skill name, class, path, trigger, loading posture, cost hint y key estructurada.</div>
  </div>
  <div class="card accent-cyan">
    <div class="card-title">Loading postures</div>
    <div class="card-copy">Startup-minimal, explicit-only, just-in-time, delegated-only, overlay, helper/mode.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Regla operativa</div>
    <div class="card-copy">No abrir todos los SKILL.md en startup; cargar solo cuando trigger y fase lo exijan.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Beneficio:</strong> menor costo de contexto, menor ruido y mejor precisión de ejecución.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Gobernanza</div>
  <h1>Control de drift del registry</h1>
  <div class="sub">Paridad actual entre inventario físico y registry derivado, con separación explícita entre skills y pattern_skills.</div>
</div>

<table class="wk-table">
  <thead><tr><th>Chequeo</th><th>Valor</th><th>Impacto</th></tr></thead>
  <tbody>
    <tr><td>Archivos SKILL.md detectados</td><td>40</td><td>Superficie real del repo.</td></tr>
    <tr><td>Entradas skills en registry.json</td><td>39</td><td>Skills de descubrimiento principal.</td></tr>
    <tr><td>Entradas pattern_skills en registry.json</td><td>1</td><td>Contrato reusable separado del inventario principal.</td></tr>
  </tbody>
</table>

<div class="callout amber mt-4">
  <strong>Mejora recomendada:</strong> mantener check CI de paridad para detectar drift automáticamente cuando se agregan o mueven skills.
</div>

---

<div class="slide-head">
  <div class="eyebrow magenta">Crosscutting</div>
  <h1>Crosscutting: overlays transversales</h1>
  <div class="sub">Skills que se insertan por una necesidad concreta. Complementan una fase activa; no sustituyen router, Producto, Implementación ni Quality.</div>
</div>

<div class="manifest">
  <div class="manifest-row">
    <div class="manifest-num">01</div>
    <div class="manifest-title">Decisión técnica difícil</div>
    <div class="manifest-copy"><strong>engineering-mentor</strong> entra cuando hay trade-offs; deja una recomendación razonada sin alterar el contrato principal.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">02</div>
    <div class="manifest-title">Diseño de una superficie UI</div>
    <div class="manifest-copy"><strong>frontend-design</strong> entra antes de construir; deja dirección visual y criterios UX para reducir retrabajo.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">03</div>
    <div class="manifest-title">Hardening visual de alto impacto</div>
    <div class="manifest-copy"><strong>impeccable</strong> entra cuando la experiencia requiere un estándar visual superior; deja hallazgos y mejoras priorizadas.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">04</div>
    <div class="manifest-title">Feedback de revisión</div>
    <div class="manifest-copy"><strong>pr-comments-resolution</strong> entra tras review; resuelve comentarios con trazabilidad a la intención y evidencia original.</div>
  </div>
</div>

<div class="callout magenta mt-4">
  <strong>Boundary:</strong> crosscutting complementa router/product/implement/quality; no sustituye sus gates.
</div>

---

<div class="slide-head">
  <div class="eyebrow amber">Patterns</div>
  <h1>Patterns: contrato para implementación reusable</h1>
  <div class="sub">Los pattern skills convierten trabajo técnico repetible en un procedimiento con requisitos, fallback y evidencia de cierre.</div>
</div>

<div class="grid grid-2">
  <div class="card accent-cyan">
    <div class="card-title">Qué declara cada slice</div>
    <div class="card-copy">required_pattern_skills, optional_capabilities, fallback_docs, validation_hooks y handoff fields.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Requerido, opcional y fallback</div>
    <div class="card-copy">Skills requeridas usan path exacto; capabilities son opcionales; fallback docs sostienen el trabajo cuando no hay patrón aplicable.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Qué deja al cerrar</div>
    <div class="card-copy">El implementer entrega evidencia suficiente para que QA y maintainers revaliden sin contexto oculto.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">Cómo se extiende</div>
    <div class="card-copy">Bootstrap recomendado para crear y registrar nuevos patterns con coherencia de contrato y descubrimiento.</div>
  </div>
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Capacidades</div>
  <h1>Capabilities vs Integrations</h1>
  <div class="sub">Se complementan, pero no son lo mismo: una define estructura; la otra gobierna instalación y attachment.</div>
</div>

<table class="wk-table">
  <thead><tr><th>Concepto</th><th>Qué es</th><th>Dónde vive</th><th>Pregunta que responde</th></tr></thead>
  <tbody>
    <tr><td>Capability</td><td>Unidad de capacidad adjuntable (Context7, Engram, Caveman, etc.)</td><td>.agents/capabilities/**</td><td>¿Cómo encaja estructuralmente en el sistema?</td></tr>
    <tr><td>Integration</td><td>Contrato de operación para instalar/adjuntar/listar/recomendar capacidades</td><td>.agents/integrations/README.md</td><td>¿Cómo se solicita, confirma y completa su adopción?</td></tr>
  </tbody>
</table>

<div class="tiers">
  <div class="tier lean">
    <div class="t-name">Install + Attach</div>
    <div class="t-desc">Para capability no disponible aún; requiere confirmación previa.</div>
  </div>
  <div class="tier balanced">
    <div class="t-name">Attach-only</div>
    <div class="t-desc">Capability ya instalada; falta incorporarla al flujo neutral.</div>
  </div>
  <div class="tier premium">
    <div class="t-name">List / Recommend</div>
    <div class="t-desc">Descubrimiento y recomendación explícita cuando el usuario la pide.</div>
  </div>
</div>

<table class="wk-table">
  <thead><tr><th>Ley de integración</th><th>Regla</th></tr></thead>
  <tbody>
    <tr><td>Sin instalación silenciosa</td><td>Siempre resumen y confirmación antes de instalar</td></tr>
    <tr><td>Fuente por defecto</td><td>Official/curated salvo override explícito del usuario</td></tr>
    <tr><td>Definición de éxito</td><td>available + attached + documented</td></tr>
    <tr><td>Install ≠ attach</td><td>Instalar no implica activo; hay que adjuntar al flujo</td></tr>
  </tbody>
</table>

<div class="callout mt-4">
  <strong>Modelo mental corto:</strong> capability = qué capacidad existe; integration = cómo se incorpora con gobernanza.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Memoria</div>
  <h1>Memory governance y runtime parity</h1>
  <div class="sub">Mantiene continuidad sin filtrar información sensible ni romper semántica entre runtimes.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Scopes de memoria</div>
    <div class="card-copy">local-session, local-user, project-shared, runtime-derived con políticas distintas de exportación.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Sensibilidad</div>
    <div class="card-copy">public-in-repo, restricted, do-not-share; secretos y datos sensibles nunca se promueven.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Paridad</div>
    <div class="card-copy">Codex/Copilot/Claude pueden diferir en sintaxis, pero no en semántica del contrato neutral.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Checklist obligatorio:</strong> startup contract, skill discovery, integrations, routing, memory y cierre/reporting.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Adopción</div>
  <h1>Workflow-kit: adopción en otros repositorios</h1>
  <div class="sub">La CLI instala el workflow completo con preview obligatorio, adapters seleccionables y actualizaciones que preservan cambios locales.</div>
</div>

<div class="compare">
  <div class="panel p-now">
    <div class="p-tag">Instalación segura</div>
    <div class="p-title">Preview antes de escribir</div>
    <ul>
      <li><code>init</code> muestra el plan en dry-run por defecto.</li>
      <li><code>--apply --yes</code> confirma la escritura deliberadamente.</li>
      <li>El overlay completo instala el árbol <code>.agents</code> listo para operar.</li>
      <li><code>doctor</code> verifica los archivos esperados tras la instalación.</li>
    </ul>
  </div>
  <div class="panel p-ref">
    <div class="p-tag">Runtimes y evolución</div>
    <div class="p-title">Adapters separados y updates protegidos</div>
    <ul>
      <li>Selecciona <code>neutral</code>, Codex, Copilot, Claude o Antigravity.</li>
      <li>Los adapters son packs delgados que remiten a <code>.agents</code>.</li>
      <li><code>update</code> actualiza solo archivos gestionados por el toolkit.</li>
      <li>Las ediciones locales se conservan como <code>skip_modified</code> o <code>skip_unmanaged</code>.</li>
    </ul>
  </div>
</div>

<div class="callout mt-4">
  <strong>Contrato de distribución:</strong> el manifiesto externo de template packs valida el payload; <code>.agents/workflow-kit/install-state.json</code> es estado generado por la CLI, no documentación instalada.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Operación</div>
  <h1>Runbook operativo: idea a entrega</h1>
  <div class="sub">Playbook mínimo para operar el ecosistema sin dudas.</div>
</div>

<div class="flow-row">
  <div class="step"><span class="s-num">1</span><div class="s-title">Intake</div><div class="s-desc">Solicitud entra al router.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Dar forma</div><div class="s-desc">Project-formation entrega decisiones, roadmap, GTM y dossier según madurez.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Especificar</div><div class="s-desc">create-prd convierte una feature en slices y evidencia.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">Construir</div><div class="s-desc">implement-prd elige modo y gobierna ownership.</div></div>
  <div class="step"><span class="s-num">5</span><div class="s-title">Validar</div><div class="s-desc">Evidence proporcional: contrato, tests, E2E o QA.</div></div>
  <div class="step"><span class="s-num">6</span><div class="s-title">Documentar</div><div class="s-desc">Cierre durable y transferible para la siguiente decisión.</div></div>
</div>

<div class="callout mint mt-4">
  <strong>Cadena de handoff:</strong> decisión de producto → PRD ejecutable → slices verificados → evidencia de Quality → documentación durable.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">Operación</div>
  <h1>FAQ operacional</h1>
  <div class="sub">Preguntas que un equipo se hace al adoptar el workflow por primera vez.</div>
</div>

<div class="manifest">
  <div class="manifest-row">
    <div class="manifest-num">Q1</div>
    <div class="manifest-title">¿Puedo implementar sin PRD?</div>
    <div class="manifest-copy">Solo en casos quirúrgicos de bajo riesgo. Para trabajo no trivial, primero create-prd.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">Q2</div>
    <div class="manifest-title">¿Install ya significa activo?</div>
    <div class="manifest-copy">No. Debe estar attached al flujo y documentado como capability activa.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">Q3</div>
    <div class="manifest-title">¿Paridad implica mismo modelo exacto?</div>
    <div class="manifest-copy">No. Implica misma semántica de riesgo/tier/postura, no identidad de proveedor.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">Q4</div>
    <div class="manifest-title">¿Qué evita más retrabajo?</div>
    <div class="manifest-copy">Router bien aplicado + PRD granular + validación focalizada + documentación de cierre.</div>
  </div>
</div>

---
layout: section
class: section-slide
---

<div class="section-num">Cierre</div>
<div class="section-title">FHH IA Ecosystem Workflow<br>en operación completa</div>
<div class="section-copy mt-4">
  Esta presentación está diseñada para operar como documentación oficial: explica qué se puede hacer, cómo hacerlo bien y cómo demostrar calidad en cada etapa del flujo.
</div>
<div class="chips mt-6">
  <span class="chip">router first</span>
  <span class="chip">product to prd</span>
  <span class="chip">implement by slices</span>
  <span class="chip">quality evidence</span>
  <span class="chip">capabilities governance</span>
  <span class="chip">memory + parity</span>
</div>
