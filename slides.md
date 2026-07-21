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
    <div class="cover-title">FHH IA Ecosystem Workflow<br>Documentación Oficial</div>
    <div class="cover-sub">Flujo completo para diseñar, implementar, validar y documentar software con IA</div>
    <p class="cover-copy">
      Esta presentación funciona como guía operativa integral: qué hace cada módulo, cuándo se usa, qué entrada espera, qué salida produce y qué evidencia exige para cerrar con calidad.
    </p>
    <div class="cover-meta">
      <span class="v">Cobertura end-to-end del ecosistema</span>
      <span class="k">Basado en .agents/, skills registry, capabilities, memory y workflow-kit</span>
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
      <div class="st-title">41 SKILL.md en 7 áreas (estado actual)</div>
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
  <h1>Cómo leer esta documentación</h1>
  <div class="sub">Cada bloque responde 5 preguntas: propósito, uso, entradas, salidas y evidencia de cierre.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="idx">1</div>
    <div class="card-title">Propósito</div>
    <div class="card-copy">Qué problema resuelve el módulo y qué decisión toma dentro del flujo.</div>
  </div>
  <div class="card accent-blue">
    <div class="idx">2</div>
    <div class="card-title">Cuándo usarlo</div>
    <div class="card-copy">Señales de activación, triggers y clase de solicitud.</div>
  </div>
  <div class="card accent-mint">
    <div class="idx">3</div>
    <div class="card-title">Input / Output</div>
    <div class="card-copy">Entradas mínimas requeridas y artefactos esperados al finalizar.</div>
  </div>
</div>

<div class="grid grid-2 mt-4">
  <div class="card accent-magenta">
    <div class="idx">4</div>
    <div class="card-title">Evidencia</div>
    <div class="card-copy">Tests, checks, trazas o documentos que demuestran calidad real.</div>
  </div>
  <div class="card accent-amber">
    <div class="idx">5</div>
    <div class="card-title">Stop conditions</div>
    <div class="card-copy">Cuándo no se debe continuar sin clarificar o corregir.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Nota de consistencia:</strong> esta versión refleja el estado real del repo (skills, adapters y contratos) para evitar drift entre narrativa y código.
</div>

---

<div class="slide-head">
  <h1>Mapa operativo por fases (con color fijo)</h1>
  <div class="sub">Lectura recomendada: seguir el color para ubicar rápidamente en qué parte del ciclo estás trabajando.</div>
</div>

<div class="phase-band">
  <div class="band b-amber">00 Router</div>
  <div class="band b-cyan">01 Product</div>
  <div class="band b-mint">02 Implement</div>
  <div class="band b-blue">03 Quality</div>
  <div class="band b-magenta">04 Crosscutting</div>
  <div class="band b-amber">06 Patterns</div>
</div>

<div class="grid grid-3 mt-2">
  <div class="card accent-amber">
    <div class="card-title">Router (00)</div>
    <div class="card-copy">Clasifica intención, riesgo y ruta mínima segura antes de ejecutar cualquier flujo.</div>
  </div>
  <div class="card accent-cyan">
    <div class="card-title">Product (01)</div>
    <div class="card-copy">Convierte incertidumbre en decisión: estrategia, épica y PRD ejecutable.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Implement (02)</div>
    <div class="card-copy">Orquesta slices técnicos, delegación, validación focalizada y handoff de QA.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Quality (03)</div>
    <div class="card-copy">Verifica evidencia técnica y documental, incluyendo pruebas E2E cuando aplica.</div>
  </div>
  <div class="card accent-magenta">
    <div class="card-title">Crosscutting (04)</div>
    <div class="card-copy">Aceleradores transversales para diseño, mentoría y resolución de comentarios.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">Patterns (06)</div>
    <div class="card-copy">Contrato reusable para mapear slices a skills requeridas y evidencia de salida.</div>
  </div>
</div>

<div class="callout amber mt-4">
  <strong>Nota:</strong> 05-caveman existe en el repo como modo/capability opcional de ahorro de tokens; no reemplaza las fases core del flujo.
</div>

---

<div class="slide-head">
  <h1>Arquitectura del ecosistema completo</h1>
  <div class="sub">Separación explícita entre contrato neutral, ejecución de skills, extensiones, memoria y adapters.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Contrato neutral</div>
    <div class="card-copy">.agents/instructions.md define jerarquía, loading rules, routing policy y límites de wrappers.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Ejecución del flujo</div>
    <div class="card-copy">.agents/skills/** organiza workflows, delegados, quality y patterns con descubrimiento just-in-time.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Extensiones gobernadas</div>
    <div class="card-copy">.agents/integrations/** y .agents/capabilities/** separan install, attach y activación.</div>
  </div>
  <div class="card accent-magenta">
    <div class="card-title">Routing y costo</div>
    <div class="card-copy">.agents/model-routing/README.md establece lean, balanced, premium y delegación por riesgo.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">Memoria y paridad</div>
    <div class="card-copy">.agents/memory/** define shareability, sensibilidad y revisión cross-runtime.</div>
  </div>
  <div class="card accent-cyan">
    <div class="card-title">Adopción reusable</div>
    <div class="card-copy">.agents/workflow-kit/** define frontera portable-core y overlay para replicar el sistema.</div>
  </div>
</div>

---

<div class="slide-head">
  <h1>Runtimes soportados (incluye Antigravity)</h1>
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
  <h1>Router: puerta de entrada obligatoria</h1>
  <div class="sub">workflow-router clasifica la solicitud y enruta al flujo mínimo seguro con traza explícita.</div>
</div>

<table class="wk-table">
  <thead>
    <tr><th>Clase</th><th>Ruta primaria</th><th>Postura costo</th><th>Confirmación</th></tr>
  </thead>
  <tbody>
    <tr><td>Respuesta directa</td><td>Answer directly</td><td>lean</td><td>No</td></tr>
    <tr><td>Ambigüedad de producto</td><td>product-studio</td><td>balanced</td><td>No</td></tr>
    <tr><td>Iniciativa amplia</td><td>create-epic</td><td>balanced / premium por riesgo</td><td>Sí</td></tr>
    <tr><td>Feature specification</td><td>create-prd</td><td>balanced</td><td>No</td></tr>
    <tr><td>Cambio productivo</td><td>implement-prd</td><td>balanced / premium por riesgo</td><td>Depende de PRD</td></tr>
    <tr><td>Documentación</td><td>document-development</td><td>lean</td><td>No</td></tr>
  </tbody>
</table>

<div class="callout mt-4">
  <strong>Salida esperada del router:</strong> workflow, confidence, reason, alternative, cost posture y expectativa de validación.
</div>

---

<div class="slide-head">
  <h1>Router: reglas críticas y seguridad operativa</h1>
  <div class="sub">Evita implementación prematura y obliga trazabilidad antes de cambios relevantes.</div>
</div>

<div class="grid grid-2">
  <div class="card accent-blue">
    <div class="card-title">Production-ready gate</div>
    <div class="card-copy">Si no existe PRD o ticket robusto, no se salta a implementación no trivial.</div>
  </div>
  <div class="card accent-cyan">
    <div class="card-title">Surgical edit exception</div>
    <div class="card-copy">Solo para cambios muy pequeños, claros y de bajo riesgo; si no, vuelve a create-prd.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Review/QA applicability gate</div>
    <div class="card-copy">Selecciona skill de revisión según superficie: visual, técnica, contractual o E2E.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">Stop rule</div>
    <div class="card-copy">Ante ambigüedad crítica, inconsistencia o riesgo alto, se detiene y se pregunta.</div>
  </div>
</div>

---

<div class="slide-head">
  <h1>Producto: product-studio</h1>
  <div class="sub">Hub de estrategia y discovery para convertir incertidumbre en decisiones accionables.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Qué hace</div>
    <div class="card-copy">Orquesta sesiones de estrategia, discovery, JTBD, priorización, roadmap y user story.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Cómo se invoca</div>
    <div class="card-copy">Comandos: strategy, discovery, jtbd, prioritize, roadmap, story, help.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Qué entrega</div>
    <div class="card-copy">Dirección de producto, hipótesis claras, criterios y base para epic o PRD.</div>
  </div>
</div>

<div class="callout mt-4">
  <strong>Cuándo usarlo:</strong> cuando el problema no está bien definido o se requiere alinear visión, oportunidad y prioridad.
</div>

---

<div class="slide-head">
  <h1>Producto: create-epic</h1>
  <div class="sub">Forma una épica profesional desde investigación hasta pipeline de entrega.</div>
</div>

<div class="flow-row">
  <div class="step"><span class="s-num">1</span><div class="s-title">Frame request</div><div class="s-desc">Contexto, objetivo y alcance inicial.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Local context</div><div class="s-desc">Carga arquitectura y restricciones del repo.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">External research</div><div class="s-desc">Estado del arte, riesgos y benchmarks.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">Synthesis</div><div class="s-desc">Documento de investigación accionable.</div></div>
  <div class="step"><span class="s-num">5</span><div class="s-title">Delivery design</div><div class="s-desc">Fases, dependencias y preguntas bloqueantes.</div></div>
</div>

<div class="callout mt-4">
  <strong>Salida:</strong> épica estructurada y handoff explícito a create-prd para cada frente implementable.
</div>

---

<div class="slide-head">
  <h1>Producto: create-prd</h1>
  <div class="sub">Convierte una intención de feature en especificación ejecutable con criterios falsables.</div>
</div>

<div class="grid grid-2">
  <div class="card accent-blue">
    <div class="card-title">Fases del protocolo</div>
    <div class="card-copy">1) Codebase exploration, 2) Gap analysis con preguntas dirigidas, 3) Draft del PRD completo.</div>
  </div>
  <div class="card accent-cyan">
    <div class="card-title">Preguntas obligatorias</div>
    <div class="card-copy">Scope boundary, business rules, data decisions, tenancy, DDD placement, verification y rollout/recovery.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Estructura de salida</div>
    <div class="card-copy">Contexto, requerimientos, modelo de datos, plan por fases/slices, aceptación, validación y decisiones tomadas.</div>
  </div>
  <div class="card accent-magenta">
    <div class="card-title">Calidad del PRD</div>
    <div class="card-copy">Cada slice debe tener outcome, dependencies, tests, command de validación, evidencia y stop conditions.</div>
  </div>
</div>

---

<div class="slide-head">
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
  <h1>Implementación: cadena detallada por fases</h1>
  <div class="sub">Secuencia recomendada para reducir retrabajo y aumentar confiabilidad.</div>
</div>

<div class="flow">
  <div class="flow-row">
    <div class="step"><span class="s-num">1</span><div class="s-title">Readiness review</div><div class="s-desc">GO/STOP sobre ejecutabilidad real.</div></div>
    <div class="step"><span class="s-num">2</span><div class="s-title">Codebase discovery</div><div class="s-desc">Archivos, patrones, riesgos y constraints.</div></div>
    <div class="step"><span class="s-num">3</span><div class="s-title">Implementation slicing</div><div class="s-desc">Orden, dependencias y ownership por slice.</div></div>
    <div class="step"><span class="s-num">4</span><div class="s-title">Skill matching</div><div class="s-desc">Asignación a patterns y capabilities relevantes.</div></div>
  </div>
  <div class="flow-row">
    <div class="step"><span class="s-num">5</span><div class="s-title">Build</div><div class="s-desc">Backend/frontend implementers.</div></div>
    <div class="step"><span class="s-num">6</span><div class="s-title">Contract verify</div><div class="s-desc">Consistencia API/UI y acoplamientos.</div></div>
    <div class="step"><span class="s-num">7</span><div class="s-title">Validation runner</div><div class="s-desc">Comandos focalizados que puedan falsar.</div></div>
    <div class="step"><span class="s-num">8</span><div class="s-title">QA handoff review</div><div class="s-desc">Fresh-context independiente.</div></div>
  </div>
</div>

---

<div class="slide-head">
  <h1>Calidad: qué se mide en este workflow</h1>
  <div class="sub">Calidad no es opinión: se demuestra con evidencia técnica y documental.</div>
</div>

<div class="grid grid-3">
  <div class="card accent-cyan">
    <div class="card-title">Cumplimiento de aceptación</div>
    <div class="card-copy">Cada criterio Given/When/Then debe tener evidencia esperada.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Validación ejecutable</div>
    <div class="card-copy">Comandos concretos por slice, no validaciones genéricas o ambiguas.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Calidad estructural</div>
    <div class="card-copy">Tenancy, contratos, reglas de negocio, i18n y consistencia de arquitectura.</div>
  </div>
</div>

<div class="grid grid-3 mt-4">
  <div class="card accent-magenta">
    <div class="card-title">Cobertura documental</div>
    <div class="card-copy">Document-development deja conocimiento durable para dev, QA, soporte y producto.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">Cobertura E2E</div>
    <div class="card-copy">Playwright-testing verifica flujos críticos de usuario en entorno controlado.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Salud React</div>
    <div class="card-copy">react-doctor acelera diagnóstico de problemas frecuentes en frontend React.</div>
  </div>
</div>

---

<div class="slide-head">
  <h1>Quality Skill: document-development</h1>
  <div class="sub">Genera documentación técnica y no técnica con estructura canónica y diagrama de flujo.</div>
</div>

<div class="flow-row">
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
  <h1>Quality Skill: playwright-testing</h1>
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
    <div class="card-title">Stop conditions</div>
    <div class="card-copy">Entorno no listo, señales frágiles, selectors inestables o flujos no deterministicos.</div>
  </div>
</div>

---

<div class="slide-head">
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
  <h1>Crosscutting (04): capacidades transversales</h1>
  <div class="sub">Skills que no reemplazan fases, pero elevan calidad y velocidad cuando la situación lo requiere.</div>
</div>

<div class="grid grid-2">
  <div class="card accent-magenta">
    <div class="card-title">engineering-mentor</div>
    <div class="card-copy">Guía decisiones técnicas y trade-offs sin alterar el contrato principal del flujo.</div>
  </div>
  <div class="card accent-magenta">
    <div class="card-title">frontend-design</div>
    <div class="card-copy">Define dirección visual y criterios UX para reducir retrabajo de frontend.</div>
  </div>
  <div class="card accent-magenta">
    <div class="card-title">impeccable</div>
    <div class="card-copy">Overlay premium para calidad visual y hardening de experiencia cuando aplica.</div>
  </div>
  <div class="card accent-magenta">
    <div class="card-title">pr-comments-resolution</div>
    <div class="card-copy">Resuelve feedback de revisión sin perder trazabilidad a la intención original.</div>
  </div>
</div>

<div class="callout magenta mt-4">
  <strong>Boundary:</strong> crosscutting complementa router/product/implement/quality; no sustituye sus gates.
</div>

---

<div class="slide-head">
  <h1>Patterns: contrato para implementación reusable</h1>
  <div class="sub">Los pattern skills definen cómo ejecutar clases repetibles de trabajo técnico.</div>
</div>

<div class="grid grid-2">
  <div class="card accent-cyan">
    <div class="card-title">Slice contract</div>
    <div class="card-copy">required_pattern_skills, optional_capabilities, fallback_docs, validation_hooks y handoff fields.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">Boundary rules</div>
    <div class="card-copy">Skills obligatorias con path exacto; capabilities son opcionales y se gobiernan fuera del registry de skills.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">Handoff evidence</div>
    <div class="card-copy">El implementer debe dejar evidencia suficiente para que QA y maintainers revaliden sin contexto oculto.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">Authoring flow</div>
    <div class="card-copy">Bootstrap recomendado para crear y registrar nuevos patterns con coherencia de contrato.</div>
  </div>
</div>

---

<div class="slide-head">
  <h1>Capabilities vs Integrations (definición clara)</h1>
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
  <h1>Workflow-kit: adopción en otros repositorios</h1>
  <div class="sub">Define frontera de packaging para replicar el sistema sin mezclar reglas locales con core portable.</div>
</div>

<div class="compare">
  <div class="panel p-now">
    <div class="p-tag">Portable core</div>
    <div class="p-title">Semántica reusable</div>
    <ul>
      <li>Contrato neutral y skills base del workflow.</li>
      <li>Mecánica de registry, schema y cache.</li>
      <li>Vocabulario de lifecycle y attach points.</li>
      <li>Expectativas de paridad runtime.</li>
    </ul>
  </div>
  <div class="panel p-ref">
    <div class="p-tag">Repo overlay</div>
    <div class="p-title">Especialización local</div>
    <ul>
      <li>Reglas de dominio, patterns y capacidades locales.</li>
      <li>Comandos de validación y documentación específica.</li>
      <li>Políticas de adopción por equipo.</li>
      <li>Sin contaminar la semántica portable del core.</li>
    </ul>
  </div>
</div>

---

<div class="slide-head">
  <h1>Runbook operativo: idea a entrega</h1>
  <div class="sub">Playbook mínimo para operar el ecosistema sin dudas.</div>
</div>

<div class="flow-row">
  <div class="step"><span class="s-num">1</span><div class="s-title">Intake</div><div class="s-desc">Solicitud entra al router.</div></div>
  <div class="step"><span class="s-num">2</span><div class="s-title">Ruta</div><div class="s-desc">Direct / Product / PRD / Implement.</div></div>
  <div class="step"><span class="s-num">3</span><div class="s-title">Especificar</div><div class="s-desc">PRD con slices y validaciones.</div></div>
  <div class="step"><span class="s-num">4</span><div class="s-title">Construir</div><div class="s-desc">Implement-prd con delegación controlada.</div></div>
  <div class="step"><span class="s-num">5</span><div class="s-title">Validar</div><div class="s-desc">Contracts, tests, QA handoff.</div></div>
  <div class="step"><span class="s-num">6</span><div class="s-title">Documentar</div><div class="s-desc">Cierre durable y transferible.</div></div>
</div>

<div class="callout mint mt-4">
  <strong>Definición de terminado:</strong> aceptación cumplida, evidencia verificable, documentación actualizada y sin drift de contrato neutral.
</div>

---

<div class="slide-head">
  <h1>FAQ operacional</h1>
  <div class="sub">Preguntas que un equipo se hace al adoptar el workflow por primera vez.</div>
</div>

<div class="grid grid-2">
  <div class="card accent-cyan">
    <div class="card-title">¿Puedo implementar sin PRD?</div>
    <div class="card-copy">Solo en casos quirúrgicos de bajo riesgo. Para trabajo no trivial, primero create-prd.</div>
  </div>
  <div class="card accent-blue">
    <div class="card-title">¿Install ya significa activo?</div>
    <div class="card-copy">No. Debe estar attached al flujo y documentado como capability activa.</div>
  </div>
  <div class="card accent-mint">
    <div class="card-title">¿Paridad implica mismo modelo exacto?</div>
    <div class="card-copy">No. Implica misma semántica de riesgo/tier/postura, no identidad de proveedor.</div>
  </div>
  <div class="card accent-amber">
    <div class="card-title">¿Qué evita más retrabajo?</div>
    <div class="card-copy">Router bien aplicado + PRD granular + validación focalizada + documentación de cierre.</div>
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
