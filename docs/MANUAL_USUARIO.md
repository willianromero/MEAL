# Manual de Usuario — Plataforma MEAL

Guía operativa por rol (los nombres de rol pueden variar por proyecto: cada
tenant los configura; aquí se usan los del convenio Hocol como referencia).

## Conceptos básicos

- **Proyecto (tenant):** cada convenio es un espacio aislado con sus comunidades,
  líneas, indicadores, formularios y usuarios. El selector superior cambia el
  proyecto activo; **nunca** verás datos de un proyecto al que no perteneces.
- **Offline-first:** todo se guarda primero en tu dispositivo. El indicador de
  sincronización muestra ONLINE/OFFLINE, los registros pendientes y la última
  sincronización. Al recuperar señal, la cola sube sola (con reintentos).
- **Firmas:** cada registro lleva una firma SHA-256; el sello "Cripto: Íntegro"
  confirma que el dato no fue alterado.

## Gestor Comunitario (captura en campo)

1. **Captura Offline** → elige el formulario (línea base, caracterización,
   asistencia, acta de entrega, solicitud, apoyos, salud, mentoría…).
2. Selecciona la **comunidad/unidad**, diligencia los campos, **captura el GPS**
   y adjunta **fotos** (se comprimen y suben después, sin bloquear los datos).
3. Guarda: el registro queda **pendiente de validación** y en cola de sync.
   Sin señal no se pierde nada; puedes seguir capturando toda la jornada.
4. **Beneficiarios**: regístralos solo con **consentimiento informado** del
   titular (la plataforma lo exige). Sus datos personales se guardan cifrados.
5. **PQRS**: registra quejas/alertas con su nivel (verde/amarillo/naranja/rojo);
   el nivel fija el tiempo máximo de respuesta (SLA). Puedes marcar el reporte
   como anónimo: la identidad queda reservada.
6. No puedes validar registros (ni siquiera los tuyos): separación de funciones.

### Sincronización entre dispositivos sin internet (P2P)

En el indicador de sincronización → **Sincro P2P Offline**: un dispositivo genera
el código (iniciador), el otro lo pega (receptor) y se intercambian las colas
pendientes por la red local, validando firmas.

## Coordinador Territorial (validación y configuración)

1. **Cola de Validación**: revisa cada registro pendiente (datos, GPS, posibles
   duplicados marcados automáticamente) y **valida** o **rechaza con motivo**.
   Solo los registros validados alimentan indicadores. No puedes validar lo que
   tú mismo capturaste.
2. **Catálogo Maestro**: administra comunidades/unidades y líneas programáticas.
3. **Formularios**: crea o ajusta formularios sin tocar código; los gestores los
   reciben en la próxima sincronización.
4. **Indicadores**: define indicadores (código, meta, frecuencia, medio de
   verificación) y **congela la línea base** en el corte acordado (queda en
   bitácora y ya no se altera).
5. **Reportes y Export**: genera el informe técnico mensual (PDF) y paquetes de
   auditoría por comunidad/período.

## Director del Proyecto (aprobación y supervisión)

- **Tablero de Control**: resumen ejecutivo, avance por línea y por comunidad,
  solicitudes/apoyos, riesgos y PQRS, físico vs financiero. Filtros por línea y
  exportación CSV de cualquier vista.
- **PQRS**: atiende los niveles naranja/rojo (SLA 24h/inmediato), escala y cierra
  con retroalimentación al reportante.
- **Bitácora de Auditoría**: consulta inmutable de quién hizo qué y cuándo.

## Administrador de Tenant / Plataforma

- **Usuarios del Proyecto**: asigna roles del equipo **solo dentro de tu
  proyecto** (membresías); cada cambio queda auditado.
- **Consola de Proyectos** (solo plataforma): crea un convenio nuevo por
  configuración — opcionalmente **clonando** líneas, formularios e indicadores
  de un proyecto existente como plantilla — y suspéndelo/reactívalo.

## Financiador / Auditor (consulta)

- Acceso de **solo lectura** a tableros, repositorio documental y exportaciones
  de su proyecto. El **Repositorio Documental** enlaza cada evidencia con su
  registro, formulario, comunidad y responsable, con hash de integridad.

## Buenas prácticas de campo

- Inicia el día con una sincronización para bajar catálogos/formularios nuevos.
- Captura el GPS en el sitio de la actividad (no después).
- Ante duda con un dato, captúralo igual: el coordinador lo depura en validación
  ("nunca se pierde un dato de campo", DRT 8.4).
