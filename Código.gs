/**
 * Script para importar datos CSV desde KoboToolbox a Google Sheets
 * Sistema de Intervención de Casos - Solo datos 2026
 */

// URL de exportación de KoboToolbox para Intervención de Casos
const KOBO_EXPORT_URL = "https://kf.kobotoolbox.org/api/v2/assets/avnPVj8iEwvfwUkySWcMAJ/export-settings/esiNV5nenKxfDh9wNmZD6kC/data.csv";

// ID del archivo de Google Sheets para Intervención de Casos
const SPREADSHEET_DESTINO_ID = "1T0YCTaiu6qxB6Hzq0nth3ZlJpCeKlGTrw2afncW11ME";

// Nombre de la hoja de destino para Intervención de Casos
const HOJA_DESTINO_NOMBRE = "Intervención de casos";

/**
 * Crea el menú personalizado al abrir la hoja
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('🎯 Intervención de Casos')
    .addItem('🔄 Sincronizar Datos 2026', 'sincronizarDatos')
    .addItem('📤 Sincronización Inicial 2026', 'sincronizacionInicial')
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Configurar')
      .addItem('Activar Sincronización Automática', 'activarSincronizacionAutomatica')
      .addItem('Desactivar Sincronización Automática', 'desactivarSincronizacionAutomatica')
      .addItem('Ver Estado de Sincronización', 'verEstadoSincronizacion'))
    .addToUi();
}

/**
 * Detecta el separador del CSV (coma o punto y coma)
 */
function detectarSeparador(texto) {
  const primerasLineas = texto.split('\n').slice(0, 5).join('\n');
  let dentroComillas = false;
  let comas = 0;
  let puntosComa = 0;

  for (let i = 0; i < primerasLineas.length; i++) {
    const char = primerasLineas[i];
    if (char === '"') {
      dentroComillas = !dentroComillas;
    } else if (!dentroComillas) {
      if (char === ',') comas++;
      if (char === ';') puntosComa++;
    }
  }

  Logger.log(`Detectados - Comas: ${comas}, Puntos y coma: ${puntosComa}`);
  return puntosComa > comas ? ';' : ',';
}

/**
 * Parsea CSV correctamente manejando campos con comillas y separadores
 */
function parsearCSV(texto, separador) {
  if (!separador) {
    separador = detectarSeparador(texto);
    Logger.log(`Usando separador: "${separador}"`);
  }

  const filas = [];
  let filaActual = [];
  let campoActual = '';
  let dentroDeComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];
    const siguiente = texto[i + 1];

    if (char === '"') {
      if (dentroDeComillas && siguiente === '"') {
        campoActual += '"';
        i++;
      } else {
        dentroDeComillas = !dentroDeComillas;
      }
    } else if (char === separador && !dentroDeComillas) {
      filaActual.push(campoActual.trim());
      campoActual = '';
    } else if ((char === '\n' || char === '\r') && !dentroDeComillas) {
      if (char === '\r' && siguiente === '\n') {
        i++;
      }
      if (campoActual || filaActual.length > 0) {
        filaActual.push(campoActual.trim());
        if (filaActual.some(campo => campo !== '')) {
          filas.push(filaActual);
        }
        filaActual = [];
        campoActual = '';
      }
    } else {
      campoActual += char;
    }
  }

  if (campoActual || filaActual.length > 0) {
    filaActual.push(campoActual.trim());
    if (filaActual.some(campo => campo !== '')) {
      filas.push(filaActual);
    }
  }

  return filas;
}

/**
 * Normaliza los datos para que todas las filas tengan el mismo número de columnas
 */
function normalizarDatos(datos) {
  if (datos.length === 0) return datos;

  const numColumnas = datos[0].length;

  for (let i = 0; i < datos.length; i++) {
    while (datos[i].length < numColumnas) {
      datos[i].push('');
    }
    if (datos[i].length > numColumnas) {
      datos[i] = datos[i].slice(0, numColumnas);
    }
  }

  return datos;
}

/**
 * Verifica si una fecha es del año 2026
 */
function esFecha2026(fechaTexto) {
  if (!fechaTexto) return false;

  const fecha = new Date(fechaTexto);
  if (isNaN(fecha.getTime())) return false;

  return fecha.getFullYear() === 2026;
}

/**
 * Sincroniza datos de Intervención de Casos (solo 2026)
 * Descarga directamente de KoboToolbox y envía a la hoja destino
 */
function sincronizarDatos() {
  const ui = SpreadsheetApp.getUi();

  try {
    ui.alert('⏳ Sincronizando', 'Descargando datos del 2026 de KoboToolbox...', ui.ButtonSet.OK);

    // Descargar CSV de KoboToolbox
    const response = UrlFetchApp.fetch(KOBO_EXPORT_URL, {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      ui.alert('❌ Error', 'No se pudo descargar los datos de KoboToolbox', ui.ButtonSet.OK);
      return;
    }

    const csv = response.getContentText();
    const separador = detectarSeparador(csv);
    let datos;

    try {
      if (separador === ',') {
        datos = Utilities.parseCsv(csv);
      } else {
        datos = parsearCSV(csv, separador);
      }
    } catch (e) {
      datos = parsearCSV(csv, separador);
    }

    if (!datos || datos.length === 0) {
      ui.alert('❌ Error', 'No se encontraron datos', ui.ButtonSet.OK);
      return;
    }

    datos = normalizarDatos(datos);

    // Acceder DIRECTAMENTE al archivo destino
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID);
    const hojaDestino = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE);

    if (!hojaDestino) {
      ui.alert('❌ Error', `No se encontró la hoja "${HOJA_DESTINO_NOMBRE}"`, ui.ButtonSet.OK);
      return;
    }

    const datosDestino = hojaDestino.getDataRange().getValues();

    if (datosDestino.length === 0) {
      ui.alert('❌ Error', 'La hoja de destino está vacía. Debe tener encabezados.', ui.ButtonSet.OK);
      return;
    }

    const encabezadosOrigen = datos[0];
    const encabezadosDestino = datosDestino[0];

    // Buscar columna de fecha
    const indiceFecha = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'fecha'
    );

    if (indiceFecha < 0) {
      ui.alert('❌ Error', 'No se encontró la columna "Fecha" en los datos', ui.ButtonSet.OK);
      return;
    }

    // Mapear columnas automáticamente
    const mapeoColumnas = [];
    for (let i = 0; i < encabezadosOrigen.length; i++) {
      const columnaOrigen = encabezadosOrigen[i].toString().trim().toLowerCase();
      const indiceDestino = encabezadosDestino.findIndex(col =>
        col.toString().trim().toLowerCase() === columnaOrigen
      );

      if (indiceDestino >= 0) {
        mapeoColumnas.push({ origen: i, destino: indiceDestino });
      }
    }

    Logger.log(`Mapeo: ${mapeoColumnas.length} columnas coinciden`);

    // Buscar columna de Participante para identificar duplicados
    const indiceParticipanteDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'participante'
    );

    const datosExistentes = new Set();
    if (indiceParticipanteDestino >= 0) {
      for (let i = 1; i < datosDestino.length; i++) {
        const participante = datosDestino[i][indiceParticipanteDestino];
        if (participante) {
          datosExistentes.add(participante.toString().trim());
        }
      }
    }

    // Filtrar solo datos de 2026 y nuevos
    const filasNuevas = [];
    let registrosFiltrados = 0;
    let duplicados = 0;

    for (let i = 1; i < datos.length; i++) {
      const filaOrigen = datos[i];
      const fecha = filaOrigen[indiceFecha];

      // Verificar que sea del 2026
      if (!esFecha2026(fecha)) {
        registrosFiltrados++;
        continue;
      }

      // Verificar que no sea duplicado
      if (indiceParticipanteDestino >= 0) {
        const indiceParticipanteOrigen = encabezadosOrigen.findIndex(col =>
          col.toString().trim().toLowerCase() === 'participante'
        );

        if (indiceParticipanteOrigen >= 0) {
          const participante = filaOrigen[indiceParticipanteOrigen];
          if (participante && datosExistentes.has(participante.toString().trim())) {
            duplicados++;
            continue;
          }
        }
      }

      // Crear fila mapeada
      const nuevaFila = new Array(encabezadosDestino.length).fill('');
      mapeoColumnas.forEach(mapeo => {
        nuevaFila[mapeo.destino] = filaOrigen[mapeo.origen] || '';
      });

      filasNuevas.push(nuevaFila);
    }

    if (filasNuevas.length === 0) {
      let mensaje = 'No hay datos nuevos del 2026 para sincronizar.\n\n';
      mensaje += `📊 Resumen:\n`;
      mensaje += `• Registros no son de 2026: ${registrosFiltrados}\n`;
      mensaje += `• Duplicados: ${duplicados}`;

      ui.alert('ℹ️ Sin datos nuevos', mensaje, ui.ButtonSet.OK);
      return;
    }

    // Agregar filas nuevas DIRECTAMENTE
    const ultimaFila = hojaDestino.getLastRow();
    hojaDestino.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosDestino.length).setValues(filasNuevas);

    // Registrar sincronización
    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', filasNuevas.length.toString());

    let mensaje = `✅ Se agregaron ${filasNuevas.length} registros del 2026\n\n`;
    mensaje += `📊 Resumen:\n`;
    mensaje += `• Registros nuevos del 2026: ${filasNuevas.length}\n`;
    mensaje += `• Registros no son de 2026: ${registrosFiltrados}\n`;
    mensaje += `• Duplicados omitidos: ${duplicados}\n`;
    mensaje += `• Columnas mapeadas: ${mapeoColumnas.length}`;

    ui.alert('✅ Sincronización exitosa', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', 'Error al sincronizar: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.stack);
  }
}

/**
 * Sincronización inicial de Intervención de Casos (solo 2026)
 */
function sincronizacionInicial() {
  const ui = SpreadsheetApp.getUi();

  const confirmacion = ui.alert(
    '⚠️ Sincronización Inicial - Solo 2026',
    'Esto enviará TODOS los datos del 2026 a "Intervención de casos".\n\n¿Deseas continuar?',
    ui.ButtonSet.YES_NO
  );

  if (confirmacion !== ui.Button.YES) {
    return;
  }

  sincronizarDatos();
}

/**
 * Sincronización automática (silenciosa, solo 2026)
 */
function sincronizarAutomatico() {
  try {
    // Descargar CSV
    const response = UrlFetchApp.fetch(KOBO_EXPORT_URL, {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('Error al descargar datos de Intervención de Casos');
      return;
    }

    const csv = response.getContentText();
    const separador = detectarSeparador(csv);
    let datos;

    try {
      if (separador === ',') {
        datos = Utilities.parseCsv(csv);
      } else {
        datos = parsearCSV(csv, separador);
      }
    } catch (e) {
      datos = parsearCSV(csv, separador);
    }

    if (!datos || datos.length === 0) {
      Logger.log('No hay datos para sincronizar');
      return;
    }

    datos = normalizarDatos(datos);

    // Acceder al archivo destino
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID);
    const hojaDestino = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE);

    if (!hojaDestino) {
      Logger.log('No se encontró la hoja de destino');
      return;
    }

    const datosDestino = hojaDestino.getDataRange().getValues();

    if (datosDestino.length === 0) {
      Logger.log('La hoja de destino está vacía');
      return;
    }

    const encabezadosOrigen = datos[0];
    const encabezadosDestino = datosDestino[0];

    // Buscar columna de fecha
    const indiceFecha = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'fecha'
    );

    if (indiceFecha < 0) {
      Logger.log('No se encontró la columna Fecha');
      return;
    }

    // Mapear columnas
    const mapeoColumnas = [];
    for (let i = 0; i < encabezadosOrigen.length; i++) {
      const columnaOrigen = encabezadosOrigen[i].toString().trim().toLowerCase();
      const indiceDestino = encabezadosDestino.findIndex(col =>
        col.toString().trim().toLowerCase() === columnaOrigen
      );

      if (indiceDestino >= 0) {
        mapeoColumnas.push({ origen: i, destino: indiceDestino });
      }
    }

    // Buscar duplicados
    const indiceParticipanteDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'participante'
    );

    const datosExistentes = new Set();
    if (indiceParticipanteDestino >= 0) {
      for (let i = 1; i < datosDestino.length; i++) {
        const participante = datosDestino[i][indiceParticipanteDestino];
        if (participante) {
          datosExistentes.add(participante.toString().trim());
        }
      }
    }

    // Filtrar solo datos de 2026 y nuevos
    const filasNuevas = [];

    for (let i = 1; i < datos.length; i++) {
      const filaOrigen = datos[i];
      const fecha = filaOrigen[indiceFecha];

      if (!esFecha2026(fecha)) continue;

      // Verificar duplicado
      if (indiceParticipanteDestino >= 0) {
        const indiceParticipanteOrigen = encabezadosOrigen.findIndex(col =>
          col.toString().trim().toLowerCase() === 'participante'
        );

        if (indiceParticipanteOrigen >= 0) {
          const participante = filaOrigen[indiceParticipanteOrigen];
          if (participante && datosExistentes.has(participante.toString().trim())) {
            continue;
          }
        }
      }

      // Crear fila mapeada
      const nuevaFila = new Array(encabezadosDestino.length).fill('');
      mapeoColumnas.forEach(mapeo => {
        nuevaFila[mapeo.destino] = filaOrigen[mapeo.origen] || '';
      });

      filasNuevas.push(nuevaFila);
    }

    if (filasNuevas.length > 0) {
      const ultimaFila = hojaDestino.getLastRow();
      hojaDestino.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosDestino.length).setValues(filasNuevas);

      const propiedades = PropertiesService.getScriptProperties();
      propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
      propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', filasNuevas.length.toString());

      Logger.log(`Intervención de Casos: ${filasNuevas.length} registros nuevos del 2026`);
    } else {
      Logger.log('Intervención de Casos: sin datos nuevos del 2026');
    }

  } catch (error) {
    Logger.log('Error en sincronización automática: ' + error.message);
  }
}

/**
 * Activa la sincronización automática
 */
function activarSincronizacionAutomatica() {
  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.prompt(
    'Activar Sincronización Automática - Intervención de Casos',
    '¿Cada cuántos MINUTOS deseas sincronizar datos del 2026?\n\n' +
    '⚡ SINCRONIZACIÓN RÁPIDA:\n' +
    '5 = Cada 5 minutos\n' +
    '10 = Cada 10 minutos\n' +
    '15 = Cada 15 minutos (recomendado)\n' +
    '30 = Cada 30 minutos\n\n' +
    'Ingresa el número de minutos:',
    ui.ButtonSet.OK_CANCEL
  );

  if (respuesta.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const minutos = parseInt(respuesta.getResponseText().trim());

  if (![5, 10, 15, 30].includes(minutos)) {
    ui.alert('❌ Error', 'Por favor ingresa: 5, 10, 15 o 30 minutos', ui.ButtonSet.OK);
    return;
  }

  try {
    // Eliminar triggers existentes
    const triggers = ScriptApp.getProjectTriggers();
    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sincronizarAutomatico') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Crear nuevo trigger
    ScriptApp.newTrigger('sincronizarAutomatico')
      .timeBased()
      .everyMinutes(minutos)
      .create();

    ui.alert(
      '✅ Sincronización Activada',
      `⚡ Los datos del 2026 se sincronizarán automáticamente cada ${minutos} minutos con "${HOJA_DESTINO_NOMBRE}".\n\n` +
      `✓ Solo se agregarán datos del 2026\n` +
      `✓ Solo datos NUEVOS\n` +
      `✓ Sincronización casi instantánea`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Desactiva la sincronización automática
 */
function desactivarSincronizacionAutomatica() {
  const ui = SpreadsheetApp.getUi();

  try {
    const triggers = ScriptApp.getProjectTriggers();
    let eliminados = 0;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sincronizarAutomatico') {
        ScriptApp.deleteTrigger(trigger);
        eliminados++;
      }
    }

    if (eliminados > 0) {
      ui.alert('✅ Desactivado', 'La sincronización automática ha sido desactivada', ui.ButtonSet.OK);
    } else {
      ui.alert('ℹ️ Información', 'No había sincronización automática activa', ui.ButtonSet.OK);
    }

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Muestra el estado de la sincronización
 */
function verEstadoSincronizacion() {
  const ui = SpreadsheetApp.getUi();

  try {
    const propiedades = PropertiesService.getScriptProperties();
    const ultimaSincronizacion = propiedades.getProperty('ULTIMA_SINCRONIZACION') || 'Nunca';
    const ultimasFilas = propiedades.getProperty('ULTIMA_SINCRONIZACION_FILAS') || '0';

    const triggers = ScriptApp.getProjectTriggers();
    let triggerActivo = null;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sincronizarAutomatico') {
        triggerActivo = trigger;
        break;
      }
    }

    let mensaje = `📍 Hoja de destino: "${HOJA_DESTINO_NOMBRE}"\n`;
    mensaje += `📁 Archivo destino: ${SPREADSHEET_DESTINO_ID.substring(0, 20)}...\n`;
    mensaje += `📅 Filtro: Solo datos del 2026\n\n`;
    mensaje += `🕒 Última sincronización: ${ultimaSincronizacion}\n`;
    mensaje += `📊 Registros agregados: ${ultimasFilas}\n\n`;

    if (triggerActivo) {
      mensaje += '✅ Estado: ACTIVA (Sincronización rápida)\n\n';
      mensaje += '⚡ Los datos del 2026 se sincronizan automáticamente cada pocos minutos.\n';
      mensaje += 'Los nuevos registros de KoboToolbox se enviarán casi de inmediato.';
    } else {
      mensaje += '⚠️ Estado: INACTIVA\n\n';
      mensaje += 'Para activar sincronización rápida:\n';
      mensaje += '🎯 Intervención de Casos > ⚙️ Configurar > Activar Sincronización Automática\n\n';
      mensaje += 'Recomendado: 15 minutos';
    }

    ui.alert('Estado de Sincronización - Intervención de Casos', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}
