# PRD template section: Datos y Persistencia

Conditional section of [PRD_TEMPLATE.md](../PRD_TEMPLATE.md). Insert it as section 3.1 only when the PRD creates or changes persisted data (tables, columns, documents, files, or any stored schema).

### 3.1 Datos y Persistencia

**Persistencia**: aplica

#### Ubicación en el dominio

[Contexto o módulo dueño de la entidad, namespace, estrategia de nombres de tabla o colección y dependencias entre contextos: quién depende de quién y en qué dirección]

#### Enumeraciones

[Valores restringidos y la enumeración con nombre que los define, según la convención del proyecto; `Ninguna` si no hay]

#### Estado actual de los datos

[Tablas, colecciones o archivos existentes que el cambio toca, con sus campos relevantes]

#### Campos nuevos o modificados

| Campo origen | Campo almacenado | Tipo | Nullable | Descripción |
| ------------ | ---------------- | ---- | -------- | ----------- |
| ...          | ...              | ...  | ...      | ...         |

**Almacenamiento**: [Qué se persiste: crudo, calculado o ambos]

#### Migración requerida

[Pseudocódigo de la migración en la herramienta de migraciones del proyecto: qué se agrega, valores por defecto, índices y cómo se revierte]

#### Ciclo de vida

[Solo-agregar o mutable; estados y transiciones válidas; quién puede cambiar cada estado]

#### Aislamiento entre tenants _(solo si el proyecto es multi-tenant)_

[Regla de aislamiento, cómo se prueba en la entrada y qué pasa con los datos existentes. En un proyecto de un solo tenant, borrar este bloque.]

#### Definition of Done de datos

- [ ] Los datos existentes siguen siendo válidos tras la migración, o hay un backfill definido
- [ ] Nombres de campos según el `identifier_language` del Pattern Lock
- [ ] Sin consultas N+1 en los caminos tocados
- [ ] La migración se puede revertir, o el PRD dice por qué no
