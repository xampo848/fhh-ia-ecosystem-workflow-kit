# Estructura Canónica del Documento

Part of [SKILL.md](../SKILL.md). Read it en el Paso 3, al construir el documento.

## Estructura Canónica del Documento

Guardar en: `docs/internal-documentation/<feature-or-project>/<nombre-del-desarrollo>.md`

```markdown
# <Nombre del Desarrollo>

**Tipo de documento**: Guía funcional y técnica
**Fecha**: <fecha>
**Estado**: Implementado / En desarrollo / Deprecado

---

## 1. Contexto y Problema que Resuelve

Explicar en 2–3 párrafos:

- Qué no era posible hacer antes de este desarrollo
- Qué preguntas de negocio concretas no tenían respuesta
- Por qué es relevante resolverlo

NO mencionar la solución técnica aquí. Solo el problema.

## 2. Alcance

Dos listas cortas:

**Incluido en esta implementación:**

- item 1
- item 2

**No incluido:**

- item fuera de alcance 1
- item fuera de alcance 2

## 3. Flujo de Usuario

Pasos numerados del flujo principal en lenguaje llano.
Luego, subpárrafo con comportamientos importantes (edge cases de UX: qué pasa al cancelar, al desactivar, con errores).

## 4. Reglas de Negocio

Lista de reglas con título en negrita y explicación. Cada regla tiene nombre, descripción del comportamiento y el "por qué" si no es obvio.
Incluir explícitamente reglas de autorización: roles habilitados, roles excluidos, condiciones por estado del recurso, ownership y feature flags.

## 5. Casos de Uso

3–5 casos de uso reales del negocio. Formato: ### título del caso + descripción en prosa. Deben ser casos que un comercial o PM reconozca como propios.

## 6. Arquitectura Técnica

### Cómo funciona end-to-end

Prosa que explica el flujo completo del sistema.

### Diagrama de flujo

\`\`\`mermaid
flowchart LR
...
\`\`\`

### Integraciones y decisiones de diseño

Subsecciones por área: integración externa, estrategia de búsqueda/cálculo, caché, etc.
Debe incluir una subsección específica de **autorización y acceso** (el mecanismo de autorización del proyecto), indicando acciones permitidas por rol y restricciones relevantes.

### Límites operativos

Explicación causal de los límites como una cadena, con ejemplo concreto.

### Robustez ante fallas

Qué pasa cuando falla cada integración externa. Debe mencionar: qué se captura, cómo afecta al usuario, qué registra.

## 7. Guía de Uso

Recomendaciones numeradas para usuarios no técnicos. Foco en cómo sacar el máximo provecho, no en cómo funciona por dentro.

## 8. Impacto y Evolución

Dos párrafos:

- Qué mejora desde el día 1 (valor inmediato)
- Qué habilita a futuro (valor derivado, sin comprometerse a fechas)

## 9. Preguntas Frecuentes

5–8 preguntas en formato **negrita pregunta** + respuesta en línea siguiente.
Solo preguntas que NO estén ya respondidas en el cuerpo del documento.

## 10. Glosario

Tabla o lista de términos técnicos usados en el documento. Cada entrada: término en negrita + definición en una línea.

---

## Anexo: Archivos técnicos de referencia

| Propósito   | Archivo                                  |
| ----------- | ---------------------------------------- |
| Descripción | [ruta/al/archivo.rb](ruta/al/archivo.rb) |
```
