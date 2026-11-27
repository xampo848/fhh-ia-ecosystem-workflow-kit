# PRD template section: Datos y Persistencia

Conditional section of [PRD_TEMPLATE.md](../PRD_TEMPLATE.md). Insert it as section 3.1 only when the PRD creates or changes persisted data (tables, columns, documents, files, or any stored schema).

### 3.1 Datos y Persistencia

**Persistencia**: aplica

#### Estado actual de los datos

[Tablas, colecciones o archivos existentes que el cambio toca, con sus campos relevantes]

#### Campos nuevos o modificados

| Campo origen | Campo almacenado | Tipo | Nullable | Descripcion |
| ------------ | ---------------- | ---- | -------- | ----------- |
| ...          | ...              | ...  | ...      | ...         |

**Almacenamiento**: [Que se persiste: crudo, calculado o ambos]

#### Migracion requerida

[Pseudocodigo de la migracion en la herramienta de migraciones del proyecto: que se agrega, valores por defecto, indices y como se revierte]

#### Ciclo de vida

[Solo-agregar o mutable; estados y transiciones validas; quien puede cambiar cada estado]

#### Aislamiento entre tenants _(solo si el proyecto es multi-tenant)_

[Regla de aislamiento, como se prueba en la entrada y que pasa con los datos existentes. En un proyecto de un solo tenant, borrar este bloque.]

#### Definition of Done de datos

- [ ] Los datos existentes siguen siendo validos tras la migracion, o hay un backfill definido
- [ ] Nombres de campos segun el `identifier_language` del Pattern Lock
- [ ] Sin consultas N+1 en los caminos tocados
- [ ] La migracion se puede revertir, o el PRD dice por que no
