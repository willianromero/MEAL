# Guía paso a paso — Cargar indicadores nuevos (ejemplo real)

Esta guía usa como ejemplo un ajuste real recomendado por un experto MEAL para el
proyecto **Guardianes del Mar Wayuu**: tres indicadores faltantes de los
Resultados R-3 y R-4. Sirve como plantilla para cualquier carga futura de
indicadores y para hacer pruebas de funcionalidad del sistema.

> **Nota (2026):** desde la mejora de generación automática de códigos, el
> campo "Código" ya **no se escribe a mano** — el sistema lo calcula solo a
> partir del proyecto y el componente del marco lógico que elijas. Los pasos
> de abajo reflejan ese comportamiento.

## Paso 0 — Preparar (una sola vez)

1. Entra a la app con tu usuario.
2. Arriba, en el selector de proyecto, elige **el proyecto correcto**
   (en este ejemplo: "Guardianes del Mar Wayuu"). ⚠️ Es el error más común:
   crear el indicador en el proyecto equivocado.
3. Menú lateral → **Indicadores MEAL**.

## Paso 1 — Crear cada indicador

Repite por cada indicador de tu lista:

1. Clic en **"Nuevo Indicador"**.
2. Elige el **Proyecto** y el **Componente del Marco Lógico** (el resultado
   `R-N` al que cuelga el indicador). El **código se genera solo** al elegir
   el componente — revisa que sea el esperado antes de guardar.
3. Completa **Unidad de Medida**, **Nombre**, **Línea Base** y **Meta**.
4. Clic en **"Guardar Indicador"**.

### Ejemplo transcrito (3 indicadores del experto MEAL)

| Campo | Indicador 1 | Indicador 2 | Indicador 3 |
|---|---|---|---|
| **Componente (Marco Lógico)** | `[R-3]` … portafolio comunitario | `[R-4]` … acuerdos comerciales | `[R-4]` … acuerdos comerciales |
| **Código (autogenerado)** | `IND-3.2` | `IND-4.1` | `IND-4.2` |
| **Unidad de Medida** | `Experiencias` | `Acuerdos comerciales` | `Mecanismos adoptados` |
| **Línea Base** | `0` | `0` | `0` |
| **Meta Objetivo** | `2` | `4` | `2` |

**Nombres** (cópialos tal cual):
- **IND-3.2:** `Experiencias turísticas comunitarias fortalecidas e incorporadas a la oferta turística local.`
- **IND-4.1:** `Alianzas o acuerdos de articulación comercial establecidos con actores de la cadena de valor turística.`
- **IND-4.2:** `Mecanismos de sostenibilidad y reinversión definidos, socializados y adoptados por las organizaciones beneficiarias.`

## Paso 2 — Completar frecuencia y medio de verificación

Para cada indicador creado, en su tarjeta clic en **"Editar definición"**:

- **Frecuencia:** `Semestral` (IND-3.2 y IND-4.2) · `Trimestral` (IND-4.1).
- **Medio de verificación:**
  - **IND-3.2:** `Portafolios turísticos, material promocional, registros de implementación e informes técnicos.`
  - **IND-4.1:** `Cartas de intención, acuerdos de colaboración, actas de reunión y registros de articulación comercial.`
  - **IND-4.2:** `Reglamentos internos, actas de adopción, acuerdos organizacionales y planes de sostenibilidad.`

Clic en **"Guardar cambios"**.

## Paso 3 — Verificar

1. Los 3 indicadores nuevos aparecen en la lista con su meta (0/2, 0/4, 0/2).
2. El indicador de sincronización arriba debe llegar a **ONLINE, 0 pendientes,
   sin errores** en menos de un minuto (la sincronización ahora es automática
   tras guardar; no hace falta pulsar "Sincronizar" a mano).
3. En **Dashboard → "Por línea"** los verás sumados al avance del proyecto.

## Sobre la desagregación sugerida por el experto

- **Ubicación (Mayapo / El Pájaro):** se captura al **registrar avance**
  (botón "Registrar Avance" en la tarjeta del indicador), no al crearlo. Ya
  incluye esa desagregación por defecto.
- **Tipo de actor (Agencia / Operador / Gremio)** para IND-4.1: el sistema no
  tiene ese campo nativo hoy. Regístralo en el **medio de verificación** o en
  observaciones al capturar el avance. Es un ajuste posible a futuro si se
  necesita como campo propio.
