# Ticket Template

## Título

Una línea, específica y accionable.

## Contexto

- Qué existe hoy.
- Qué problema, fricción o limitación motiva el cambio.
- Qué evidencia o input lo respalda.

## Objetivo

- Qué resultado de producto o negocio se espera.

## Historia de usuario

- Como [actor], quiero [acción], para [resultado].

## Alcance

- Qué sí debe incluir este ticket.

## Fuera de alcance

- Qué explícitamente no forma parte de este trabajo.

## Reglas funcionales

- Defaults.
- Interacciones entre filtros/controles/componentes.
- Límites máximos o mínimos.
- Reglas de visibilidad y comportamiento.
- Casos condicionales.

## Casos borde y estados

- Estado inicial.
- Sin información.
- Error.
- Carga.
- Reset de filtros.
- Permisos.
- Variantes pública/compartida si aplica.

## Contrato visual

Completar si el ticket cambia una pantalla. Si no hay UI visible: `not-applicable` + razón de una línea.

- Superficie: nueva o evolución de [ruta/componente].
- Densidad / composición.
- Acción primaria.
- Estados requeridos: loading, vacío, error, permisos, 1 ítem, N ítems.
- Reutilizar: primitiva del Design System o pantalla hermana.
- Evidencia opcional: screen actual, Figma, foto o mockup. No sustituye los campos de arriba.

## Criterios de aceptación

1. Deben ser verificables.
2. Deben evitar ambigüedad.
3. Deben cubrir happy path y regresiones importantes.

## Notas para desarrollo

- Si hay código real, aterrizar sobre superficies existentes.
- Si no hay código, marcar como sugerencias, no como hechos.

## Riesgos o dependencias

- Performance.
- Calidad/completitud de datos.
- Dependencias externas.
- Permisos o sharing.

## Preguntas abiertas

- Solo las que realmente queden pendientes.

## Definición de terminado

- Condiciones globales para dar el trabajo por completo.