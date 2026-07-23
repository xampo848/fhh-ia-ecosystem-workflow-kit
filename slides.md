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
  primary: '#e0995e'
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
      <div class="st-title">41 SKILL.md en 7 áreas (40 en registry.json)</div>
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

<div class="callout mt-4">
  <strong>Regla de lectura:</strong> no cargar todo al inicio. Navega desde la capa y el trigger hacia la fuente exacta que necesitas para decidir o ejecutar.
</div>

---

<div class="slide-head">
  <div class="eyebrow blue">General</div>
  <h1>Mapa operativo por fases</h1>
  <div class="sub">Lectura recomendada: seguir el color para ubicar rápidamente en qué parte del ciclo estás trabajando.</div>
</div>

<div class="phase-band">
  <div class="band b-amber">00 Router</div>
  <div class="band b-cyan">01 Producto</div>
  <div class="band b-mint">02 Implementación</div>
  <div class="band b-blue">03 Calidad</div>
  <div class="band b-magenta">04 Crosscutting</div>
  <div class="band b-amber">06 Patrones</div>
</div>

<div class="manifest mt-2">
  <div class="manifest-row">
    <div class="manifest-num">00</div>
    <div class="manifest-title">Router</div>
    <div class="manifest-copy">Clasifica intención, riesgo y ruta mínima segura antes de ejecutar cualquier flujo.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">01</div>
    <div class="manifest-title">Producto</div>
    <div class="manifest-copy">Convierte incertidumbre en decisión: estrategia, épica y PRD ejecutable.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">02</div>
    <div class="manifest-title">Implementación</div>
    <div class="manifest-copy">Orquesta slices técnicos, delegación, validación focalizada y handoff de QA.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">03</div>
    <div class="manifest-title">Calidad</div>
    <div class="manifest-copy">Verifica evidencia técnica y documental, incluyendo pruebas E2E cuando aplica.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">04</div>
    <div class="manifest-title">Crosscutting</div>
    <div class="manifest-copy">Aceleradores transversales para diseño, mentoría y resolución de comentarios.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">06</div>
    <div class="manifest-title">Patrones</div>
    <div class="manifest-copy">Contrato reusable para mapear slices a skills requeridas y evidencia de salida.</div>
  </div>
</div>

<div class="callout amber mt-4">
  <strong>Nota:</strong> 05-caveman existe en el repo como modo/capability opcional de ahorro de tokens; no reemplaza las fases core del flujo.
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
    <tr><td>Ambigüedad de producto</td><td>product-studio</td><td>balanced</td><td>No</td></tr>
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
  <h1>Costo, tier y delegación</h1>
  <div class="sub">El router no selecciona un proveedor por nombre: decide el nivel de esfuerzo seguro para la tarea y lo adapta al runtime disponible.</div>
</div>

<div class="grid grid-3">
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
  <strong>Regla de seguridad:</strong> el sistema usa fallback explícito y no puede degradar silenciosamente una preferencia de usuario por un tier más fuerte.
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

<div class="callout amber mt-4">
  <strong>Propósito de la slide:</strong> mostrar cómo el router reduce cuatro fuentes de retrabajo: código prematuro, scope oculto, validación irrelevante y supuestos críticos.
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
    <tr><td>"No sabemos si priorizar alertas de gasto o reportes semanales para los administradores."</td><td>product-studio</td><td>Intake y ruta de discovery o priorización; no convertir la idea en una feature.</td></tr>
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
  <h1>Producto: product-studio</h1>
  <div class="sub">Hub de estrategia y discovery para convertir incertidumbre en decisiones accionables.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Diagnostica antes de elegir</div>
    <div class="card-copy">Parte de una pregunta de producto vaga, identifica la decisión pendiente y selecciona el método mínimo útil.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Facilita la conversación</div>
    <div class="card-copy">Guía una pregunta por turno, separa hechos, supuestos y recomendaciones, y no exige un brief perfecto.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Produce un siguiente paso</div>
    <div class="card-copy">Entrega artefactos concretos y recomienda el salto correcto a create-epic o create-prd cuando corresponde.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Posición en el flujo:</strong> es la capa de pensamiento previa a épicas y PRDs; no implementa código ni reemplaza una especificación ya clara.
</div>

---

<div class="slide-head">
  <div class="eyebrow">Producto</div>
  <h1>Product-studio: cómo funciona</h1>
  <div class="sub">Convierte una necesidad de producto poco definida en un único siguiente paso claro.</div>
</div>

<div class="product-journey">
  <div class="journey-stage journey-input">
    <div class="journey-kicker">1. Entra una necesidad</div>
    <div class="journey-title">Idea, problema o desacuerdo</div>
    <div class="journey-copy">Ejemplo: “No sabemos qué construir primero”.</div>
  </div>
  <div class="journey-stage journey-diagnose">
    <div class="journey-kicker">2. Hace intake guiado</div>
    <div class="journey-title">Resultado, evidencia, personas y horizonte</div>
    <div class="journey-copy">Una pregunta por turno para identificar la decisión pendiente.</div>
  </div>
  <div class="journey-stage journey-route">
    <div class="journey-kicker">3. Elige una ruta</div>
    <div class="journey-title">Explorar, decidir o especificar</div>
    <div class="journey-copy">Selecciona strategy, discovery, jtbd, prioritize, roadmap o story.</div>
  </div>
  <div class="journey-stage journey-output">
    <div class="journey-kicker">4. Entrega y deriva</div>
    <div class="journey-title">Artefacto y siguiente workflow</div>
    <div class="journey-copy">Deja un brief, plan o historia; luego recomienda epic, PRD o ticket solo si aplica.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Resultado:</strong> la persona no necesita conocer el framework; product-studio hace el diagnóstico y propone una sola ruta principal.
</div>

---

<div class="slide-head">
  <div class="eyebrow">Producto</div>
  <h1>Product-studio: ejemplo de una decisión</h1>
  <div class="sub">La misma conversación pasa de incertidumbre a una acción concreta, sin convertir la primera idea en una feature prematura.</div>
</div>

<div class="flow-row phase-product">
  <div class="step"><span class="s-num">1</span><div class="s-title">Entrada</div><div class="s-desc">“No sabemos qué construir primero”.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Diagnóstico</div><div class="s-desc">¿Qué resultado importa, qué evidencia existe y qué decisión está bloqueada?</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Ruta</div><div class="s-desc">prioritize si hay apuestas comparables; discovery si aún faltan señales.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">Salida</div><div class="s-desc">Criterio de priorización y una apuesta seleccionada, con supuestos visibles.</div></div>
</div>

<div class="callout mt-4">
  <strong>Handoff correcto:</strong> solo cuando la apuesta queda suficientemente definida se abre create-epic, create-prd o generate-pm-ticket.
</div>

---

<div class="slide-head">
  <div class="eyebrow">Producto</div>
  <h1>Product-studio: seis rutas de trabajo</h1>
  <div class="sub">Las rutas se agrupan por la decisión que el equipo necesita tomar ahora, no por el nombre de una metodología.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Explorar</div>
    <div class="card-copy"><strong>strategy</strong>: alinear dirección.<br><strong>discovery</strong>: validar problema y supuestos.<br><strong>jtbd</strong>: entender jobs, pains y gains.</div>
  </div>
  <div class="card accent-cyan">
    <div class="card-title">Decidir</div>
    <div class="card-copy"><strong>prioritize</strong>: elegir cómo ordenar apuestas.<br><strong>roadmap</strong>: secuenciar temas, releases o iniciativas.</div>
  </div>
  <div class="card accent-cyan">
    <div class="card-title">Especificar</div>
    <div class="card-copy"><strong>story</strong>: convertir una necesidad en user story lista para desarrollo y criterios de aceptación.</div>
  </div>
</div>

<div class="compare mt-4">
  <div class="panel p-now">
    <div class="p-tag">Cuando terminar aquí</div>
    <div class="p-title">Decisión de producto tomada</div>
    <ul>
      <li>Se logró alineación o aprendizaje suficiente.</li>
      <li>Hay una secuencia priorizada o una historia clara.</li>
    </ul>
  </div>
  <div class="panel p-ref">
    <div class="p-tag">Cuando continuar</div>
    <div class="p-title">Handoff proporcional</div>
    <ul>
      <li>create-epic para una iniciativa amplia ya definida.</li>
      <li>create-prd para una feature lista para especificar.</li>
      <li>generate-pm-ticket para un backlog item acotado.</li>
    </ul>
  </div>
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
    <div class="card-copy">Una necesidad ya priorizada: desde product-studio, una épica o una solicitud de feature suficientemente concreta.</div>
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
  <h1>Implementación: implement-prd</h1>
  <div class="sub">Orquestador de ejecución técnica con modos, delegación y control de contexto.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Modo de operación</div>
    <div class="card-copy">Trabaja sobre PRD aprobado, con quick flow y reglas de parada.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Delegación</div>
    <div class="card-copy">Activa especialistas de readiness, discovery, slicing, implementers, validation y QA handoff.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Context budget</div>
    <div class="card-copy">Carga mínima necesaria, evitando inflación de contexto y costo innecesario.</div>
  </div>
</div>

<div class="callout mint mt-4">
  <strong>Resultado esperado:</strong> cambios implementados por slices con evidencia verificable y trazabilidad al PRD.
</div>

---

<div class="slide-head">
  <div class="eyebrow mint">Implementación</div>
  <h1>Implement-prd: elegir el modo correcto</h1>
  <div class="sub">El modo ajusta coordinación y evidencia al riesgo real; no todos los cambios requieren el flujo completo.</div>
</div>

<table class="wk-table">
  <thead><tr><th>Modo</th><th>Cuándo aplica</th><th>Postura de ejecución</th></tr></thead>
  <tbody>
    <tr><td>small/local</td><td>1–2 archivos, alcance y validación evidentes.</td><td>Trabajo local con validación focalizada.</td></tr>
    <tr><td>controlled-lite</td><td>Una superficie y PRD claro, sin riesgo transversal.</td><td>Preflight compacto y ownership explícito.</td></tr>
    <tr><td>controlled-implementation</td><td>Riesgo, dependencia o ownership parcialmente independiente.</td><td>Delegación selectiva y checkpoints.</td></tr>
    <tr><td>standard</td><td>Cross-layer, contrato, migración o UI relevante.</td><td>Flujo completo, slices y gates de evidencia.</td></tr>
    <tr><td>autonomous-safe</td><td>Trabajo suficientemente delimitado para delegar con seguridad.</td><td>Tracker, handoffs y barreras entre dependencias.</td></tr>
    <tr><td>resume</td><td>Ejecución previamente interrumpida.</td><td>Reconstruir estado desde evidencia antes de continuar.</td></tr>
  </tbody>
</table>

<div class="callout mint mt-4">
  <strong>Principio:</strong> aumentar el modo cuando aumentan riesgo, alcance, dependencia o necesidad de revisión independiente; no por preferencia de complejidad.
</div>

---

<div class="slide-head">
  <div class="eyebrow mint">Implementación</div>
  <h1>Un slice no termina al escribir código</h1>
  <div class="sub">Cada slice recorre estados observables. El progreso se acredita con evidencia, no con una declaración de avance.</div>
</div>

<div class="flow-row phase-implement">
  <div class="step"><span class="s-num">1</span><div class="s-title">NOT_STARTED</div><div class="s-desc">Scope, dependencia y owner definidos.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">IMPLEMENTED</div><div class="s-desc">Cambio realizado dentro del write set acordado.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">TESTED</div><div class="s-desc">Prueba focalizada ejecutada sobre el comportamiento.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">VALIDATED</div><div class="s-desc">Comando, contrato o smoke check deja resultado verificable.</div></div>
  <div class="step"><span class="s-num">5</span><div class="s-title">VERIFIED</div><div class="s-desc">Criterio de aceptación y handoff quedan listos para cierre.</div></div>
</div>

<div class="callout mint mt-4">
  <strong>Regla de avance:</strong> un slice dependiente no empieza por intuición; espera la evidencia terminal del slice que necesita.
</div>

---

<div class="slide-head">
  <div class="eyebrow mint">Implementación</div>
  <h1>Delegación segura: paralelismo con límites</h1>
  <div class="sub">La delegación acelera solo cuando conserva ownership, orden de dependencia y capacidad de revalidación.</div>
</div>

<div class="grid grid-2">
  <div class="card accent-mint">
    <div class="card-title">Un writer por archivo</div>
    <div class="card-copy">Cada write set tiene un owner. Dos implementers no editan la misma superficie en paralelo.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Paralelo solo si es independiente</div>
    <div class="card-copy">Se delegan slices cuando sus archivos, contratos y decisiones no se bloquean entre sí.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Handoff antes de depender</div>
    <div class="card-copy">El siguiente slice espera resultado, evidencia y estado terminal del trabajo precedente.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Tracker como fuente de estado</div>
    <div class="card-copy">Registra owner, dependencia, validación y progreso para que un resume no reconstruya el trabajo a ciegas.</div>
  </div>
</div>

---

<div class="slide-head">
  <div class="eyebrow mint">Implementación</div>
  <h1>Implementación: cadena detallada por fases</h1>
  <div class="sub">Secuencia completa para modos con coordinación elevada; los modos ligeros conservan solo los gates que el riesgo justifica.</div>
</div>

<div class="flow phase-implement">
  <div class="flow-row">
    <div class="step"><span class="s-num">1</span><div class="s-title">Revisión de preparación</div><div class="s-desc">Go/stop sobre ejecutabilidad real.</div></div>
    <div class="step"><span class="s-num">2</span><div class="s-title">Descubrimiento del código</div><div class="s-desc">Archivos, patrones, riesgos y restricciones.</div></div>
    <div class="step"><span class="s-num">3</span><div class="s-title">Slicing de implementación</div><div class="s-desc">Orden, dependencias y ownership por slice.</div></div>
    <div class="step"><span class="s-num">4</span><div class="s-title">Asignación de skills</div><div class="s-desc">Patterns y capabilities relevantes por slice.</div></div>
  </div>
  <div class="flow-row">
    <div class="step"><span class="s-num">5</span><div class="s-title">Construcción</div><div class="s-desc">Implementers de backend y frontend.</div></div>
    <div class="step"><span class="s-num">6</span><div class="s-title">Verificación de contrato</div><div class="s-desc">Consistencia API/UI y acoplamientos.</div></div>
    <div class="step"><span class="s-num">7</span><div class="s-title">Ejecución de validación</div><div class="s-desc">Comandos focalizados que puedan falsar.</div></div>
    <div class="step"><span class="s-num">8</span><div class="s-title">Revisión de handoff QA</div><div class="s-desc">Fresh-context independiente.</div></div>
  </div>
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
  <h1>Calidad: qué se mide en este workflow</h1>
  <div class="sub">Calidad no es opinión: se demuestra con evidencia técnica y documental.</div>
</div>

<div class="manifest">
  <div class="manifest-row">
    <div class="manifest-num">01</div>
    <div class="manifest-title">Cumplimiento de aceptación</div>
    <div class="manifest-copy">Cada criterio Given/When/Then debe tener evidencia esperada.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">02</div>
    <div class="manifest-title">Validación ejecutable</div>
    <div class="manifest-copy">Comandos concretos por slice, no validaciones genéricas o ambiguas.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">03</div>
    <div class="manifest-title">Calidad estructural</div>
    <div class="manifest-copy">Tenancy, contratos, reglas de negocio, i18n y consistencia de arquitectura.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">04</div>
    <div class="manifest-title">Cobertura documental</div>
    <div class="manifest-copy">Document-development deja conocimiento durable para dev, QA, soporte y producto.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">05</div>
    <div class="manifest-title">Cobertura E2E</div>
    <div class="manifest-copy">Playwright-testing verifica flujos críticos de usuario en entorno controlado.</div>
  </div>
  <div class="manifest-row">
    <div class="manifest-num">06</div>
    <div class="manifest-title">Salud React</div>
    <div class="manifest-copy">react-doctor acelera diagnóstico de problemas frecuentes en frontend React.</div>
  </div>
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
  <div class="sub">Segunda pasada de consistencia: inventario físico y registry derivado no están completamente sincronizados.</div>
</div>

<table class="wk-table">
  <thead><tr><th>Chequeo</th><th>Valor</th><th>Impacto</th></tr></thead>
  <tbody>
    <tr><td>Archivos SKILL.md detectados</td><td>41</td><td>Superficie real del repo.</td></tr>
    <tr><td>Entradas registry.json</td><td>40</td><td>Descubrimiento automático incompleto.</td></tr>
    <tr><td>Faltante</td><td>.agents/skills/06-patterns/authoring/add-project-pattern/SKILL.md</td><td>Riesgo de drift entre narrativa y ejecución.</td></tr>
  </tbody>
</table>

<div class="callout amber mt-4">
  <strong>Mejora recomendada:</strong> agregar check CI de paridad entre SKILL.md físicos y registry.json.
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
  <div class="step"><span class="s-num">2</span><div class="s-title">Dar forma</div><div class="s-desc">Product-studio entrega una decisión, historia, roadmap o brief.</div></div>
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
