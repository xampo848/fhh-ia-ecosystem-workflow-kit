# PRD template section: Contrato Visual (UI lock)

Conditional section of [PRD_TEMPLATE.md](../PRD_TEMPLATE.md). Insert it as section 2.7 only when the PRD changes visible UI (`visible_ui: yes`).

### 2.7 Contrato Visual (UI lock)

Completar cuando hay UI visible. Si no hay pantalla de usuario, dejar `UI lock: not-applicable` y una razón de una línea.

**UI lock**: locked | not-applicable
**Superficie**: Nueva | Evolucion de [ruta o componente existente]
**Densidad / composición**: Tabla | Formulario | Wizard | Detalle | Dashboard | Otro: [nombre]
**Acción primaria**: [La única acción que debe ganar jerarquía]
**Estados requeridos**: loading | vacío | error | permisos | 1 item | N items
**Tesis visual**: [Una frase: jerarquía, ritmo y el movimiento que evita un look genérico]
**Reutilizar**: [Primitiva del Design System o pantalla hermana]
**Evidencia opcional**: [path de screen actual / Figma / foto / mockup | ninguna]
**No lockear aquí**: hex, tipografías nuevas, animación, salvo decisión de producto ya existente o `Lock visual: pixel` pedido explícitamente

```text
[Wireframe ASCII de la pantalla principal]
+--------------------------------------+
| Título                    [Acción]   |
|--------------------------------------|
| [contenido primario]                 |
| [estado vacío / error / lista]       |
+--------------------------------------+
```

`implement-change` no puede inventar esta pantalla. Un mockup o foto ancla; no sustituye los campos de arriba.

#### Lock visual (prototipo)

Reglas en `reference/visual-lock.md`: el prototipo manda en estructura y contenido; los patterns del proyecto, en lo visual. Sin prototipo: `Lock visual: N/A`.

**Lock visual**: N/A | estructura | pixel
**Fuente**: [ruta del HTML o la imagen]

| Elemento | Fuente | Componente | Decisión |
| --- | --- | --- | --- |
| [sección, campo, texto, estado o interacción] | prototipo/pattern | [Componente existente / componente nuevo] | [default / pattern gana: valor / prototipo (explícito): palabras del usuario / prototipo (pixel) / pattern update pendiente] |
