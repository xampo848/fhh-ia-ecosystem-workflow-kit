# PRD template section: Contrato Visual (UI lock)

Conditional section of [PRD_TEMPLATE.md](../PRD_TEMPLATE.md). Insert it as section 2.7 only when the PRD changes visible UI (`visible_ui: yes`).

### 2.7 Contrato Visual (UI lock)

Completar cuando hay UI visible. Si no hay pantalla de usuario, dejar `UI lock: not-applicable` y una razon de una linea.

**UI lock**: locked | not-applicable
**Superficie**: Nueva | Evolucion de [ruta o componente existente]
**Densidad / composicion**: Tabla | Formulario | Wizard | Detalle | Dashboard | Otro: [nombre]
**Accion primaria**: [La unica accion que debe ganar jerarquia]
**Estados requeridos**: loading | vacio | error | permisos | 1 item | N items
**Tesis visual**: [Una frase: jerarquia, ritmo y el movimiento que evita un look generico]
**Reutilizar**: [Primitiva del Design System o pantalla hermana]
**Evidencia opcional**: [path de screen actual / Figma / foto / mockup | ninguna]
**No lockear aqui**: hex, tipografias nuevas, animacion, salvo decision de producto ya existente o `Lock visual: pixel` pedido explicitamente

```text
[Wireframe ASCII de la pantalla principal]
+--------------------------------------+
| Titulo                    [Accion]   |
|--------------------------------------|
| [contenido primario]                 |
| [estado vacio / error / lista]       |
+--------------------------------------+
```

`implement-change` no puede inventar esta pantalla. Un mockup o foto ancla; no sustituye los campos de arriba.

#### Lock visual (prototipo)

Reglas en `reference/visual-lock.md`: el prototipo manda en estructura y contenido; los patterns del proyecto, en lo visual. Sin prototipo: `Lock visual: N/A`.

**Lock visual**: N/A | estructura | pixel
**Fuente**: [ruta del HTML o la imagen]

| Elemento | Fuente | Componente | Decision |
| --- | --- | --- | --- |
| [seccion, campo, texto, estado o interaccion] | prototipo/pattern | [Componente existente / componente nuevo] | [default / pattern gana: valor / prototipo (explicito): palabras del usuario / prototipo (pixel) / pattern update pendiente] |
