# Guía paso a paso — Formularios ampliados Wayuu (4ª revisión experta MEAL, 2026)

Esta guía documenta cómo se aplicó la 4ª devolución de un experto MEAL sobre el
proyecto **Guardianes del Mar Wayuu**: campos nuevos en las dos encuestas
existentes y 5 formularios nuevos que alimentan indicadores automáticamente.
Sirve como referencia de qué cambió, por qué, y cómo aplicarlo o verificarlo.

## Qué se construyó y qué se descartó (y por qué)

| # | Propuesto por el experto | Resultado |
|---|---|---|
| 101 | + género, edad, experiencia_turismo, checklist de equipos de seguridad | ✅ Aplicado tal cual (motor legado, `Surveys.jsx`) |
| 102 | Reemplazar respeto cultural (1-5) por checklist de observables + intención de compra | ✅ Aplicado tal cual |
| 103 | Evaluación de Pitch Vivencial (5 puntajes: 30/20/20/15/15%) | ✅ Construido como **formulario nuevo** (`db.forms`), no encuesta legada |
| 104 | Registro de Asistencia a Formación | ✅ Alimenta **IND-1.1** automáticamente (suma de asistentes) |
| 105 | Acta de Entrega de Activos Productivos | ✅ Alimenta **IND-2.1** automáticamente (conteo de actas validadas) |
| 106 | Adopción de Mecanismos de Gobernanza | ✅ Alimenta **IND-4.2** automáticamente (conteo) |
| 107 | Alianzas Comerciales B2B | ✅ Alimenta **IND-4.1** automáticamente (conteo) |
| 108 | Formulario de PQRS y Alertas Comunitarias | ❌ **Descartado.** Ya existe un módulo PQRS completo y offline (`Feedback.jsx`): niveles verde/amarillo/naranja/rojo, SLA, reserva de identidad, flujo de estados. Un formulario 108 genérico crearía un canal paralelo desconectado de ese flujo. Usa **Menú → PQRS** para eso. |

Dos correcciones técnicas silenciosas que hizo el sistema (no requieren nada de ti):
- El experto proponía 103-107 como "encuestas" (`srv-*`, motor legado), pero
  usan fecha/foto/firma/documento — el motor legado no soporta esos tipos.
  Por eso son **formularios** (`frm-*`, motor nuevo).
- `indicator_id` en una encuesta legada es solo decorativo (no calcula nada);
  lo que sí calcula es la **fórmula** del indicador, configurada en el Paso 3.

## Camino recomendado — Aplicar por SQL (5 minutos)

1. Entra a tu proyecto en **Supabase → SQL Editor**.
2. Abre [`supabase/update_wayuu_formularios_ampliados.sql`](../supabase/update_wayuu_formularios_ampliados.sql),
   copia todo el contenido, pégalo y **Run**. Esto:
   - Actualiza el `schema` de las encuestas 101 y 102 con los campos nuevos.
   - Fija la `formula` de IND-1.1, IND-2.1, IND-4.1 e IND-4.2 para que se
     calculen solos a partir de los formularios nuevos.
3. Abre [`supabase/seed.sql`](../supabase/seed.sql) (ya regenerado), cópialo
   completo y **Run**. Es idempotente (`on conflict do nothing`): todo lo que
   ya existe se salta, y solo se crean las 5 filas nuevas en `forms`
   (`frm-wayuu-103` a `107`).
4. En la app, refresca (o espera la sincronización automática) y verifica el
   Paso 4 más abajo.

> Si prefieres no tocar SQL directamente, sigue el camino manual de abajo —
> es más lento pero útil para aprender dónde vive cada pieza en la interfaz.

## Camino manual — Verificar/recrear desde la interfaz

### Paso 1 — Revisar las encuestas 101 y 102 ampliadas

1. Menú lateral → **Encuestas** → pestaña "Diligenciar Ficha".
2. Sobre "Ficha de Caracterización..." (101), clic en **Editar** → pestaña
   "Diseñador": confirma que aparecen los campos `genero`, `edad`,
   `experiencia_turismo` y el checklist `equipos_seguridad_actuales`.
3. Repite sobre "Evaluación del FAM TRIP..." (102): confirma el checklist
   `cultural_respect_checklist` (reemplaza el antiguo campo numérico) y el
   campo `intencion_compra`.
4. Si aplicaste el SQL del camino recomendado, esto ya está — este paso es
   solo de verificación. Si NO lo aplicaste, puedes agregar cada campo a mano
   con "+ Agregar Campo" usando el mismo nombre/tipo/opciones del cuadro de
   arriba, y **Guardar cambios**.

### Paso 2 — Revisar los 5 formularios nuevos

1. Menú lateral → **Formularios** (FormBuilder).
2. Deben existir: `FRM-103` Evaluación de Pitch Vivencial, `FRM-104` Registro
   de Asistencia, `FRM-105` Acta de Entrega, `FRM-106` Gobernanza y
   Sostenibilidad, `FRM-107` Alianzas Comerciales B2B — todos en la línea
   "Línea General de Ejecución".
3. Si no aparecen, corriste solo el UPDATE y falta correr `seed.sql` (Paso 3
   del camino recomendado) — ahí es donde se insertan.

### Paso 3 — Confirmar el cálculo automático de indicadores

1. Menú lateral → **Indicadores MEAL**.
2. En cada tarjeta de **IND-1.1**, **IND-2.1**, **IND-4.1** e **IND-4.2** debe
   verse la etiqueta **"⚙ Cálculo automático"** (no "✎ Manual").
3. Clic en **"Editar definición"** sobre IND-1.1: confirma que **Fuente** =
   `FRM-104` (Registro de Asistencia), **Operación** = `Suma`, **Campo** =
   `numero_asistentes`. Sobre IND-2.1: Fuente = `FRM-105`, Operación =
   `Conteo`. IND-4.1 → `FRM-107` / Conteo. IND-4.2 → `FRM-106` / Conteo.

### Paso 4 — Prueba de extremo a extremo (opcional, recomendada)

1. Menú lateral → **Captura de Campo**, elige el formulario `FRM-104`.
2. Llena una respuesta de prueba (ej. `numero_asistentes = 5`) y guarda.
3. Menú lateral → **Validación**, busca ese registro y **valídalo** (solo
   los registros `validado` cuentan para el indicador).
4. Vuelve a **Indicadores MEAL** → IND-1.1: el valor **actual** debe subir en
   5, sin que nadie haya tocado "Registrar Avance" a mano.
5. Borra el registro de prueba si no quieres que quede en el histórico real
   (o dilo explícitamente si prefieres dejarlo).

## Sobre el Pitch Vivencial (FRM-103) y el puntaje ponderado

El sistema **no** suma automáticamente los 5 puntajes (30/20/20/15/15%) — se
decidió así explícitamente para esta etapa: el formulario solo captura los 5
campos por separado (`puntaje_asistencia`, `puntaje_viabilidad`,
`puntaje_pitch`, `puntaje_innovacion_cultural`,
`puntaje_inclusion_diferencial`), y el Comité totaliza manualmente. Si más
adelante se necesita el total automático, es un ajuste futuro al motor de
indicadores (`indicatorEngine.js`), hoy no soporta sumas ponderadas
multi-campo.
