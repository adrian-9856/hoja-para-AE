/**
 * SISTEMA: Lista de Espera → Terapias
 *
 * Copia registros de "Lista de Espera" a "Terapias" cuando se cumple una condición.
 * NO ELIMINA nada de ninguna hoja.
 * Un registro pasa a Terapias cuando tiene:
 *   - Una "Descripción" escrita, O
 *   - El campo "Proceso" marcado como culminado, O
 *   - Una columna de estado/asignación con valor
 *
 * Ambas hojas están en el archivo destino (Google Sheets principal).
 */

// ID del archivo Google Sheets donde están Lista de Espera y Terapias
const SPREADSHEET_TERAPIAS_ID = "1T0YCTaiu6qxB6Hzq0nth3ZlJpCeKlGTrw2afncW11ME";

// Nombres de las hojas
const HOJA_LISTA_ESPERA_NOMBRE = "Lista de Espera";
const HOJA_TERAPIAS_NOMBRE = "Terapias";

// Columnas que SE BUSCAN en Lista de Espera como trigger para pasar a Terapias.
// Si alguna de estas columnas tiene contenido, el registro se copia a Terapias.
// (Se evalúan en orden de prioridad)
const COLUMNAS_TRIGGER_TERAPIAS = [
  'descripción',
  'descripcion',
  'proceso culminado',
  'proceso',
  'estado',
  'terapeuta asignado',
  'terapeuta',
  'asignado',
  'asignado a',
  'fecha de asignación',
  'fecha asignación',
  'notas',
  'observaciones'
];

// Columna que se usará para marcar registros ya copiados a Terapias
// (Se agrega en Lista de Espera pero NO se borra el registro)
const COLUMNA_MARCA_COPIADO = "Copiado a Terapias";

/**
 * Encuentra la última fila con datos en una hoja
 */
function encontrarUltimaFilaTerapias(hoja) {
  const ultimaFila = hoja.getMaxRows();
  const datos = hoja.getRange(1, 1, ultimaFila, hoja.getMaxColumns()).getValues();
  for (let i = datos.length - 1; i >= 0; i--) {
    if (datos[i].some(c => c !== null && c !== undefined && c.toString().trim() !== '')) {
      return i + 1;
    }
  }
  return 0;
}

/**
 * FUNCIÓN PRINCIPAL: Copia registros de Lista de Espera a Terapias
 *
 * Condición para copiar un registro:
 *   - Que la columna trigger tenga algún valor escrito
 *   - Y que el registro NO esté ya en Terapias (evita duplicados)
 *
 * NO se borra nada. Solo copia.
 */
function copiarListaEsperaATerapias() {
  const ui = SpreadsheetApp.getUi();

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_TERAPIAS_ID);

    // Obtener hoja Lista de Espera
    const hojaListaEspera = ss.getSheetByName(HOJA_LISTA_ESPERA_NOMBRE);
    if (!hojaListaEspera) {
      ui.alert('❌ Error', `No se encontró la hoja "${HOJA_LISTA_ESPERA_NOMBRE}".`, ui.ButtonSet.OK);
      return;
    }

    const datosListaEspera = hojaListaEspera.getDataRange().getValues();
    if (datosListaEspera.length <= 1) {
      ui.alert('ℹ️ Sin datos', 'La hoja "Lista de Espera" está vacía.', ui.ButtonSet.OK);
      return;
    }

    const encabezados = datosListaEspera[0];

    // Buscar columna trigger (en orden de prioridad)
    let indiceTrigger = -1;
    let nombreColumnaTrigger = '';

    for (const nombreBuscado of COLUMNAS_TRIGGER_TERAPIAS) {
      indiceTrigger = encabezados.findIndex(col =>
        col.toString().trim().toLowerCase() === nombreBuscado
      );
      if (indiceTrigger >= 0) {
        nombreColumnaTrigger = encabezados[indiceTrigger];
        break;
      }
    }

    if (indiceTrigger < 0) {
      // No se encontró columna trigger automática → preguntar al usuario
      const respuesta = ui.prompt(
        '⚙️ Columna de condición no encontrada',
        'No se encontró automáticamente una columna de condición.\n\n' +
        'Por favor escribe el nombre EXACTO de la columna que indica\n' +
        'que un registro debe pasar a Terapias\n' +
        '(ej: "Descripción", "Estado", "Proceso"):\n\n' +
        'Columnas disponibles:\n' + encabezados.join(', '),
        ui.ButtonSet.OK_CANCEL
      );

      if (respuesta.getSelectedButton() !== ui.Button.OK) return;
      const nombreIngresado = respuesta.getResponseText().trim();
      if (!nombreIngresado) return;

      indiceTrigger = encabezados.findIndex(col =>
        col.toString().trim().toLowerCase() === nombreIngresado.toLowerCase()
      );

      if (indiceTrigger < 0) {
        ui.alert('❌ Error', `No se encontró la columna "${nombreIngresado}".`, ui.ButtonSet.OK);
        return;
      }
      nombreColumnaTrigger = encabezados[indiceTrigger];
    }

    Logger.log(`[Terapias] Usando columna trigger: "${nombreColumnaTrigger}" (índice ${indiceTrigger})`);

    // Obtener o crear hoja Terapias
    let hojaTerapias = ss.getSheetByName(HOJA_TERAPIAS_NOMBRE);
    if (!hojaTerapias) {
      Logger.log(`[Terapias] Creando hoja "${HOJA_TERAPIAS_NOMBRE}"...`);
      hojaTerapias = ss.insertSheet(HOJA_TERAPIAS_NOMBRE);
      // Copiar encabezados de Lista de Espera
      hojaTerapias.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
      Logger.log('[Terapias] ✅ Hoja Terapias creada con encabezados');
    }

    const datosTerapias = hojaTerapias.getDataRange().getValues();
    const encabezadosTerapias = datosTerapias.length > 0 ? datosTerapias[0] : [];

    // Buscar columna "Nombre Completo" o "Nombres" en Terapias para verificar duplicados
    const indiceNombreTerapias = encabezadosTerapias.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombre completo' ||
      col.toString().trim().toLowerCase() === 'nombres'
    );
    const indiceTelefonoTerapias = encabezadosTerapias.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono' ||
      col.toString().trim().toLowerCase() === 'telefono'
    );

    // Construir Set de registros ya en Terapias (para evitar duplicados)
    const yaEnTerapias = new Set();
    for (let i = 1; i < datosTerapias.length; i++) {
      let idRegistro = '';
      if (indiceNombreTerapias >= 0) {
        idRegistro += (datosTerapias[i][indiceNombreTerapias] || '').toString().trim().toLowerCase();
      }
      if (indiceTelefonoTerapias >= 0) {
        idRegistro += '|' + (datosTerapias[i][indiceTelefonoTerapias] || '').toString().trim().toLowerCase();
      }
      if (idRegistro.trim()) {
        yaEnTerapias.add(idRegistro.trim());
      }
    }

    // Buscar columna "Nombre Completo" o "Nombres" en Lista de Espera
    const indiceNombreListaEspera = encabezados.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombre completo' ||
      col.toString().trim().toLowerCase() === 'nombres'
    );
    const indiceTelefonoListaEspera = encabezados.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono' ||
      col.toString().trim().toLowerCase() === 'telefono'
    );

    // Identificar qué columnas de Lista de Espera existen en Terapias (mapeo)
    const mapeoColumnas = [];
    for (let i = 0; i < encabezados.length; i++) {
      const nombreCol = encabezados[i].toString().trim().toLowerCase();
      const indiceDestino = encabezadosTerapias.findIndex(col =>
        col.toString().trim().toLowerCase() === nombreCol
      );
      if (indiceDestino >= 0) {
        mapeoColumnas.push({ origen: i, destino: indiceDestino });
      }
    }

    // Recorrer Lista de Espera y copiar registros con trigger activo
    const filasTerapias = [];
    let copiados = 0;
    let yaExistian = 0;
    let sinCondicion = 0;

    for (let i = 1; i < datosListaEspera.length; i++) {
      const fila = datosListaEspera[i];

      // Verificar si la fila tiene datos
      const tieneContenido = fila.some(c => c !== null && c !== undefined && c.toString().trim() !== '');
      if (!tieneContenido) continue;

      // Verificar condición trigger (la columna tiene valor)
      const valorTrigger = fila[indiceTrigger];
      const tieneCondicion = valorTrigger !== null &&
                             valorTrigger !== undefined &&
                             valorTrigger.toString().trim() !== '';

      if (!tieneCondicion) {
        sinCondicion++;
        continue;
      }

      // Verificar si ya está en Terapias
      let idRegistro = '';
      if (indiceNombreListaEspera >= 0) {
        idRegistro += (fila[indiceNombreListaEspera] || '').toString().trim().toLowerCase();
      }
      if (indiceTelefonoListaEspera >= 0) {
        idRegistro += '|' + (fila[indiceTelefonoListaEspera] || '').toString().trim().toLowerCase();
      }

      if (idRegistro.trim() && yaEnTerapias.has(idRegistro.trim())) {
        yaExistian++;
        Logger.log(`[Terapias] Ya existe en Terapias: ${idRegistro}`);
        continue;
      }

      // Construir fila para Terapias (mapear columnas)
      const filaDestino = new Array(encabezadosTerapias.length).fill('');
      for (const mapeo of mapeoColumnas) {
        filaDestino[mapeo.destino] = fila[mapeo.origen];
      }

      filasTerapias.push(filaDestino);
      if (idRegistro.trim()) {
        yaEnTerapias.add(idRegistro.trim()); // Agregar al set para evitar duplicar en esta misma pasada
      }
      copiados++;

      Logger.log(`[Terapias] ✅ Copiando fila ${i + 1}: ${idRegistro} (${nombreColumnaTrigger}: ${valorTrigger})`);
    }

    // Escribir en Terapias
    if (filasTerapias.length > 0) {
      const ultimaFila = encontrarUltimaFilaTerapias(hojaTerapias);
      hojaTerapias.getRange(ultimaFila + 1, 1, filasTerapias.length, encabezadosTerapias.length)
        .setValues(filasTerapias);
      Logger.log(`[Terapias] ✅ ${filasTerapias.length} registros copiados a Terapias`);
    }

    // Mostrar resumen
    let mensaje = `✅ Proceso completado\n\n`;
    mensaje += `📋 Columna usada como condición: "${nombreColumnaTrigger}"\n\n`;
    mensaje += `📊 Resultados:\n`;
    mensaje += `  ✅ Copiados a Terapias: ${copiados}\n`;
    mensaje += `  ⚠️ Ya existían en Terapias: ${yaExistian}\n`;
    mensaje += `  ℹ️ Sin condición (no se copiaron): ${sinCondicion}\n\n`;
    mensaje += `🚫 NO se eliminó ningún registro de Lista de Espera ni de Terapias.`;

    ui.alert('✅ Completado', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    Logger.log(`[Terapias] ❌ Error: ${error.message}\n${error.stack}`);
    ui.alert('❌ Error', `Ocurrió un error:\n${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Muestra un diagnóstico de la hoja Lista de Espera y Terapias
 * para ayudar a configurar correctamente las columnas trigger
 */
function diagnosticarListaEsperaYTerapias() {
  const ui = SpreadsheetApp.getUi();

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_TERAPIAS_ID);

    let mensaje = '🔍 DIAGNÓSTICO: Lista de Espera → Terapias\n';
    mensaje += '════════════════════════════════\n\n';

    // Lista de Espera
    const hojaListaEspera = ss.getSheetByName(HOJA_LISTA_ESPERA_NOMBRE);
    if (!hojaListaEspera) {
      mensaje += `❌ No se encontró la hoja "${HOJA_LISTA_ESPERA_NOMBRE}"\n`;
    } else {
      const datos = hojaListaEspera.getDataRange().getValues();
      const encabezados = datos.length > 0 ? datos[0] : [];
      mensaje += `📋 LISTA DE ESPERA:\n`;
      mensaje += `  Filas de datos: ${datos.length - 1}\n`;
      mensaje += `  Columnas (${encabezados.length}):\n`;
      encabezados.forEach((col, i) => {
        const esTrigger = COLUMNAS_TRIGGER_TERAPIAS.includes(col.toString().trim().toLowerCase());
        mensaje += `    [${i}] "${col}"${esTrigger ? ' ← TRIGGER DETECTADO' : ''}\n`;
      });
    }

    mensaje += '\n';

    // Terapias
    const hojaTerapias = ss.getSheetByName(HOJA_TERAPIAS_NOMBRE);
    if (!hojaTerapias) {
      mensaje += `⚠️ La hoja "${HOJA_TERAPIAS_NOMBRE}" NO existe todavía.\n`;
      mensaje += `  → Se creará automáticamente la primera vez que ejecutes\n`;
      mensaje += `    "Copiar Lista de Espera → Terapias"\n`;
    } else {
      const datos = hojaTerapias.getDataRange().getValues();
      const encabezados = datos.length > 0 ? datos[0] : [];
      mensaje += `🏥 TERAPIAS:\n`;
      mensaje += `  Filas de datos: ${datos.length - 1}\n`;
      mensaje += `  Columnas (${encabezados.length}):\n`;
      encabezados.forEach((col, i) => {
        mensaje += `    [${i}] "${col}"\n`;
      });
    }

    // Mostrar en log también
    Logger.log(mensaje);
    ui.alert('🔍 Diagnóstico', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    Logger.log(`[Diagnóstico] ❌ Error: ${error.message}`);
    ui.alert('❌ Error', `Error al diagnosticar:\n${error.message}`, ui.ButtonSet.OK);
  }
}
