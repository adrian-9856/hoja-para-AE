/**
 * Script para importar datos CSV desde KoboToolbox a Google Sheets
 * Sistema: Intervención de Casos
 */

// URL directa de exportación de KoboToolbox - INTERVENCIÓN DE CASOS
const KOBO_EXPORT_URL = "https://kf.kobotoolbox.org/api/v2/assets/avnPVj8iEwvfwUkySWcMAJ/export-settings/esiNV5nenKxfDh9wNmZD6kC/data.csv";

// ID del archivo de Google Sheets donde está la hoja de destino
const SPREADSHEET_DESTINO_ID = "1T0YCTaiu6qxB6Hzq0nth3ZlJpCeKlGTrw2afncW11ME";

// Nombre de la hoja de destino en el otro archivo
const HOJA_DESTINO_NOMBRE = "Intervención de casos";

/**
 * Encuentra la última fila con datos REALES (no vacía)
 * Busca desde abajo hacia arriba la primera fila que tenga contenido
 */
function encontrarUltimaFilaConDatos(hoja) {
  const ultimaFila = hoja.getMaxRows();
  const datos = hoja.getRange(1, 1, ultimaFila, hoja.getMaxColumns()).getValues();

  // Buscar desde abajo hacia arriba
  for (let i = datos.length - 1; i >= 0; i--) {
    const fila = datos[i];
    // Si encuentra al menos una celda con contenido, esa es la última fila
    if (fila.some(celda => celda !== null && celda !== undefined && celda.toString().trim() !== '')) {
      return i + 1; // +1 porque los índices empiezan en 0 pero las filas en 1
    }
  }

  return 0; // La hoja está completamente vacía
}

/**
 * Crea el menú personalizado al abrir la hoja
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎯 Intervención de Casos')
    .addItem('📥 Importar Datos', 'importarCSVdesdeKobo')
    .addItem('🔄 Actualizar Datos', 'actualizarDatosAutomatico')
    .addSeparator()
    .addItem('🔄 Sincronizar Solo Nuevos', 'sincronizarConHojaPrincipal')
    .addItem('📤 Sincronización Inicial (Enviar Todo)', 'sincronizacionInicial')
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
 * Importa datos CSV desde KoboToolbox a la hoja "DatosKobo"
 */
function importarCSVdesdeKobo() {
  try {
    const ui = SpreadsheetApp.getUi();

    ui.alert('Importando datos', 'Por favor espera mientras se descargan los datos...', ui.ButtonSet.OK);

    const response = UrlFetchApp.fetch(KOBO_EXPORT_URL, {
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      throw new Error(`Error al conectar con KoboToolbox (código ${statusCode})`);
    }

    const csv = response.getContentText();

    if (!csv || csv.trim().length === 0) {
      throw new Error('No se recibieron datos. El formulario podría estar vacío.');
    }

    Logger.log('CSV descargado correctamente. Tamaño: ' + csv.length + ' caracteres');

    const separador = detectarSeparador(csv);
    Logger.log(`Separador detectado: "${separador}"`);

    let datos;
    try {
      if (separador === ',') {
        datos = Utilities.parseCsv(csv);
        Logger.log('Usando Utilities.parseCsv (coma)');
      } else {
        datos = parsearCSV(csv, separador);
        Logger.log('Usando parser personalizado (punto y coma)');
      }
    } catch (e) {
      Logger.log('Parser estándar falló, usando parser personalizado');
      datos = parsearCSV(csv, separador);
    }

    if (!datos || datos.length === 0) {
      throw new Error('No se encontraron datos para importar');
    }

    datos = normalizarDatos(datos);

    Logger.log(`Datos parseados: ${datos.length} filas, ${datos[0].length} columnas`);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = spreadsheet.getSheetByName("DatosKobo");

    if (!hoja) {
      hoja = spreadsheet.insertSheet("DatosKobo");
    }

    hoja.clear();

    const numFilas = datos.length;
    const numColumnas = datos[0].length;

    hoja.getRange(1, 1, numFilas, numColumnas).setValues(datos);

    const rangoEncabezado = hoja.getRange(1, 1, 1, numColumnas);
    rangoEncabezado.setFontWeight('bold');
    rangoEncabezado.setBackground('#4285f4');
    rangoEncabezado.setFontColor('#ffffff');
    rangoEncabezado.setWrap(true);
    rangoEncabezado.setVerticalAlignment('middle');

    hoja.setRowHeight(1, 60);

    for (let i = 1; i <= numColumnas; i++) {
      hoja.autoResizeColumn(i);
      const anchoActual = hoja.getColumnWidth(i);

      if (anchoActual < 100) {
        hoja.setColumnWidth(i, 100);
      } else if (anchoActual > 300) {
        hoja.setColumnWidth(i, 300);
      }
    }

    hoja.setFrozenRows(1);
    spreadsheet.setActiveSheet(hoja);

    ui.alert(
      '✅ Importación exitosa',
      `Se importaron ${numFilas - 1} registros con ${numColumnas} columnas`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      'Error al importar: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    Logger.log('Error detallado: ' + error.stack);
  }
}

/**
 * Actualiza los datos automáticamente (sin mostrar alertas)
 */
function actualizarDatosAutomatico() {
  try {
    const response = UrlFetchApp.fetch(KOBO_EXPORT_URL, {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('Error al actualizar: código ' + response.getResponseCode());
      return;
    }

    const csv = response.getContentText();

    if (!csv || csv.trim().length === 0) {
      Logger.log('No hay datos para actualizar');
      return;
    }

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
      Logger.log('No se encontraron datos para actualizar');
      return;
    }

    datos = normalizarDatos(datos);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = spreadsheet.getSheetByName("DatosKobo");

    if (!hoja) {
      hoja = spreadsheet.insertSheet("DatosKobo");
    }

    hoja.clear();
    const numFilas = datos.length;
    const numColumnas = datos[0].length;

    hoja.getRange(1, 1, numFilas, numColumnas).setValues(datos);

    const rangoEncabezado = hoja.getRange(1, 1, 1, numColumnas);
    rangoEncabezado.setFontWeight('bold');
    rangoEncabezado.setBackground('#4285f4');
    rangoEncabezado.setFontColor('#ffffff');
    rangoEncabezado.setWrap(true);
    rangoEncabezado.setVerticalAlignment('middle');

    hoja.setRowHeight(1, 60);

    for (let i = 1; i <= numColumnas; i++) {
      hoja.autoResizeColumn(i);
      const anchoActual = hoja.getColumnWidth(i);

      if (anchoActual < 100) {
        hoja.setColumnWidth(i, 100);
      } else if (anchoActual > 300) {
        hoja.setColumnWidth(i, 300);
      }
    }

    hoja.setFrozenRows(1);

    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_ACTUALIZACION', new Date().toLocaleString('es-ES'));

    Logger.log(`Datos actualizados: ${numFilas - 1} registros`);

  } catch (error) {
    Logger.log('Error en actualización automática: ' + error.message);
  }
}

/**
 * Mapeo de columnas específico para Intervención de Casos
 * Mapea las columnas de KoboToolbox a las columnas de la hoja destino
 */
function mapearColumnasIntervencionCasos(encabezadosOrigen, encabezadosDestino) {
  const mapeoColumnas = [];
  const columnasEspeciales = [];
  const columnasIgnoradas = [];

  Logger.log('=== ENCABEZADOS ORIGEN ===');
  encabezadosOrigen.forEach((col, idx) => {
    Logger.log(`  [${idx}] ${col}`);
  });

  Logger.log('=== ENCABEZADOS DESTINO ===');
  encabezadosDestino.forEach((col, idx) => {
    Logger.log(`  [${idx}] ${col}`);
  });

  // Buscar índices en origen
  const indiceStart = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'start'
  );
  const indiceNombres = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'nombre (s)'
  );
  const indiceApellidos = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'apellidos (s)'
  );
  const indiceCreamosID = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'creamos id'
  );
  const indiceTipo = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'tipo intervención de caso'
  );

  // Buscar TODAS las columnas de motivo (hay 3 preguntas diferentes)
  const indicesMotivos = [];
  encabezadosOrigen.forEach((col, idx) => {
    const colNombre = col.toString().trim().toLowerCase();
    if (colNombre === 'motivo intervención de caso' || colNombre.startsWith('motivo intervención de caso')) {
      indicesMotivos.push(idx);
    }
  });

  // Buscar índices en destino
  const indiceFechaDestino = encabezadosDestino.findIndex(col =>
    col.toString().trim().toLowerCase() === 'fecha'
  );
  const indiceParticipanteDestino = encabezadosDestino.findIndex(col =>
    col.toString().trim().toLowerCase() === 'participante'
  );
  const indiceTerapeutaDestino = encabezadosDestino.findIndex(col =>
    col.toString().trim().toLowerCase() === 'terapeuta'
  );
  const indiceCreemosIDDestino = encabezadosDestino.findIndex(col =>
    col.toString().trim().toLowerCase() === 'creemos id'
  );
  const indiceTipoDestino = encabezadosDestino.findIndex(col =>
    col.toString().trim().toLowerCase() === 'tipo'
  );
  const indiceMotivoDestino = encabezadosDestino.findIndex(col =>
    col.toString().trim().toLowerCase() === 'motivo'
  );

  Logger.log('=== ÍNDICES ENCONTRADOS ORIGEN ===');
  Logger.log(`  start: ${indiceStart}`);
  Logger.log(`  nombre (s): ${indiceNombres}`);
  Logger.log(`  apellidos (s): ${indiceApellidos}`);
  Logger.log(`  Creamos ID: ${indiceCreamosID}`);
  Logger.log(`  Tipo intervención de caso: ${indiceTipo}`);
  Logger.log(`  Motivos intervención de caso (${indicesMotivos.length} columnas): [${indicesMotivos.join(', ')}]`);

  Logger.log('=== ÍNDICES ENCONTRADOS DESTINO ===');
  Logger.log(`  Fecha: ${indiceFechaDestino}`);
  Logger.log(`  Participante: ${indiceParticipanteDestino}`);
  Logger.log(`  Terapeuta: ${indiceTerapeutaDestino}`);
  Logger.log(`  Creemos ID: ${indiceCreemosIDDestino}`);
  Logger.log(`  Tipo: ${indiceTipoDestino}`);
  Logger.log(`  Motivo: ${indiceMotivoDestino}`);

  // Mapear start → Fecha
  if (indiceStart >= 0 && indiceFechaDestino >= 0) {
    mapeoColumnas.push({
      origen: indiceStart,
      destino: indiceFechaDestino,
      nombre: 'start → Fecha'
    });
  }

  // Combinar nombre (s) + apellidos (s) → Participante
  if (indiceNombres >= 0 && indiceApellidos >= 0 && indiceParticipanteDestino >= 0) {
    columnasEspeciales.push({
      tipo: 'combinar',
      origenes: [indiceNombres, indiceApellidos],
      destino: indiceParticipanteDestino,
      nombre: 'nombre (s) + apellidos (s) → Participante'
    });
  }

  // Mapear Creamos ID → Creemos ID
  if (indiceCreamosID >= 0 && indiceCreemosIDDestino >= 0) {
    mapeoColumnas.push({
      origen: indiceCreamosID,
      destino: indiceCreemosIDDestino,
      nombre: 'Creamos ID → Creemos ID'
    });
  }

  // Mapear Tipo intervención de caso → Tipo
  if (indiceTipo >= 0 && indiceTipoDestino >= 0) {
    mapeoColumnas.push({
      origen: indiceTipo,
      destino: indiceTipoDestino,
      nombre: 'Tipo intervención de caso → Tipo'
    });
  }

  // Mapear TODAS las columnas de Motivo (3 preguntas) → una sola columna Motivo
  if (indicesMotivos.length > 0 && indiceMotivoDestino >= 0) {
    columnasEspeciales.push({
      tipo: 'combinar',
      origenes: indicesMotivos,
      destino: indiceMotivoDestino,
      nombre: `Motivos intervención de caso (×${indicesMotivos.length}) → Motivo (combinados con ;)`
    });
  }

  // Terapeuta queda vacío por ahora (no hay campo en origen)
  Logger.log('Nota: Campo "Terapeuta" quedará vacío (no hay campo equivalente en origen)');

  return { mapeoColumnas, columnasEspeciales, columnasIgnoradas };
}

/**
 * Sincroniza datos de DatosKobo con la hoja principal
 */
function sincronizarConHojaPrincipal() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheetLocal = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID);
    const hojaPrincipal = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE);

    if (!hojaPrincipal) {
      ui.alert('❌ Error', `No se encontró la hoja "${HOJA_DESTINO_NOMBRE}" en el archivo destino.`, ui.ButtonSet.OK);
      return;
    }

    const hojaOrigen = spreadsheetLocal.getSheetByName("DatosKobo");

    if (!hojaOrigen) {
      ui.alert('❌ Error', 'No se encontró la hoja "DatosKobo". Primero importa los datos.', ui.ButtonSet.OK);
      return;
    }

    const datosOrigen = hojaOrigen.getDataRange().getValues();
    const datosDestino = hojaPrincipal.getDataRange().getValues();

    if (datosOrigen.length === 0) {
      ui.alert('❌ Error', 'La hoja "DatosKobo" está vacía.', ui.ButtonSet.OK);
      return;
    }

    if (datosDestino.length === 0) {
      ui.alert('❌ Error', `La hoja "${HOJA_DESTINO_NOMBRE}" está vacía. Debe tener al menos los encabezados.`, ui.ButtonSet.OK);
      return;
    }

    const encabezadosOrigen = datosOrigen[0];
    const encabezadosDestino = datosDestino[0];

    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasIntervencionCasos(encabezadosOrigen, encabezadosDestino);

    Logger.log(`\n=== RESUMEN DE MAPEO ===`);
    Logger.log(`Columnas mapeadas: ${mapeoColumnas.length}`);
    Logger.log(`Columnas especiales: ${columnasEspeciales.length}`);
    Logger.log(`Columnas ignoradas: ${columnasIgnoradas.length}`);

    Logger.log('\n=== MAPEO DETALLADO ===');
    mapeoColumnas.forEach(m => {
      Logger.log(`  ✓ ${m.nombre}`);
    });
    columnasEspeciales.forEach(e => {
      Logger.log(`  ✓ [ESPECIAL] ${e.nombre}`);
    });

    // Detectar filas nuevas usando Participante como identificador único
    const datosExistentes = new Set();
    const indiceParticipanteDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'participante'
    );

    for (let i = 1; i < datosDestino.length; i++) {
      if (indiceParticipanteDestino >= 0) {
        const participante = datosDestino[i][indiceParticipanteDestino];
        if (participante) {
          datosExistentes.add(participante.toString().trim().toLowerCase());
        }
      }
    }

    Logger.log(`\nDatos existentes: ${datosExistentes.size} participantes`);

    const filasNuevas = [];

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      // Crear fila vacía con todas las columnas del destino
      const nuevaFila = new Array(encabezadosDestino.length).fill('');

      // Mapear columnas normales
      mapeoColumnas.forEach(mapeo => {
        nuevaFila[mapeo.destino] = filaOrigen[mapeo.origen] || '';
      });

      // Aplicar mapeos especiales (combinar nombre + apellidos, y motivos)
      columnasEspeciales.forEach(especial => {
        if (especial.tipo === 'combinar') {
          const valores = especial.origenes.map(idx => filaOrigen[idx] || '').filter(v => v && v.toString().trim() !== '');

          // Si es el mapeo de Participante (nombre + apellidos), usar espacio
          if (especial.nombre.includes('Participante')) {
            nuevaFila[especial.destino] = valores.join(' ').trim();
          } else {
            // Para motivos, usar punto y coma
            nuevaFila[especial.destino] = valores.join('; ').trim();
          }
        }
      });

      // Verificar si es duplicado
      const participante = nuevaFila[indiceParticipanteDestino];
      const esDuplicado = participante && datosExistentes.has(participante.toString().trim().toLowerCase());

      if (!esDuplicado) {
        filasNuevas.push(nuevaFila);
        // Agregar al set para evitar duplicados en la misma sincronización
        if (participante) {
          datosExistentes.add(participante.toString().trim().toLowerCase());
        }
      }
    }

    Logger.log(`\nFilas nuevas detectadas: ${filasNuevas.length}`);

    if (filasNuevas.length === 0) {
      ui.alert(
        'ℹ️ Sin cambios',
        'No hay datos nuevos para sincronizar.\n\nTodos los registros ya existen en la hoja principal.',
        ui.ButtonSet.OK
      );
      return;
    }

    // Encontrar última fila con datos reales
    const ultimaFila = encontrarUltimaFilaConDatos(hojaPrincipal);
    Logger.log(`Última fila con datos: ${ultimaFila}`);
    Logger.log(`Insertando en fila: ${ultimaFila + 1}`);

    // Insertar justo después de la última fila con datos
    hojaPrincipal.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosDestino.length).setValues(filasNuevas);

    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', filasNuevas.length.toString());

    let mensaje = `✅ Se agregaron ${filasNuevas.length} filas nuevas a "${HOJA_DESTINO_NOMBRE}"\n\n`;
    mensaje += `✓ Inserción en fila: ${ultimaFila + 1}\n`;
    mensaje += `✓ Columnas mapeadas: ${mapeoColumnas.length}\n`;
    mensaje += `✓ Columnas especiales: ${columnasEspeciales.length}\n\n`;

    mensaje += `📋 Mapeo aplicado:\n`;
    mapeoColumnas.forEach(m => {
      mensaje += `  • ${m.nombre}\n`;
    });
    columnasEspeciales.forEach(e => {
      mensaje += `  • ${e.nombre}\n`;
    });

    ui.alert('✅ Sincronización exitosa', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', 'Error al sincronizar: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.stack);
  }
}

/**
 * Sincronización inicial - Envía TODOS los datos
 */
function sincronizacionInicial() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheetLocal = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const confirmacion = ui.alert(
      '⚠️ Sincronización Inicial',
      'Esto enviará TODOS los datos de DatosKobo a "Intervención de casos" sin verificar duplicados.\n\n' +
      '⚠️ ADVERTENCIA: Si los datos ya existen, se duplicarán.\n\n' +
      '¿Deseas continuar?',
      ui.ButtonSet.YES_NO
    );

    if (confirmacion !== ui.Button.YES) {
      return;
    }

    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID);
    const hojaPrincipal = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE);

    if (!hojaPrincipal) {
      ui.alert('❌ Error', `No se encontró la hoja "${HOJA_DESTINO_NOMBRE}" en el archivo destino.`, ui.ButtonSet.OK);
      return;
    }

    const hojaOrigen = spreadsheetLocal.getSheetByName("DatosKobo");

    if (!hojaOrigen) {
      ui.alert('❌ Error', 'No se encontró la hoja "DatosKobo". Primero importa los datos.', ui.ButtonSet.OK);
      return;
    }

    const datosOrigen = hojaOrigen.getDataRange().getValues();
    const datosDestino = hojaPrincipal.getDataRange().getValues();

    if (datosOrigen.length === 0 || datosOrigen.length === 1) {
      ui.alert('❌ Error', 'La hoja "DatosKobo" está vacía o solo tiene encabezados.', ui.ButtonSet.OK);
      return;
    }

    if (datosDestino.length === 0) {
      ui.alert('❌ Error', `La hoja "${HOJA_DESTINO_NOMBRE}" está vacía. Debe tener al menos los encabezados.`, ui.ButtonSet.OK);
      return;
    }

    const encabezadosOrigen = datosOrigen[0];
    const encabezadosDestino = datosDestino[0];

    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasIntervencionCasos(encabezadosOrigen, encabezadosDestino);

    Logger.log(`\n=== RESUMEN DE MAPEO ===`);
    Logger.log(`Columnas mapeadas: ${mapeoColumnas.length}`);
    Logger.log(`Columnas especiales: ${columnasEspeciales.length}`);

    const todasLasFilas = [];

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      const nuevaFila = new Array(encabezadosDestino.length).fill('');

      mapeoColumnas.forEach(mapeo => {
        nuevaFila[mapeo.destino] = filaOrigen[mapeo.origen] || '';
      });

      columnasEspeciales.forEach(especial => {
        if (especial.tipo === 'combinar') {
          const valores = especial.origenes.map(idx => filaOrigen[idx] || '').filter(v => v && v.toString().trim() !== '');

          // Si es el mapeo de Participante (nombre + apellidos), usar espacio
          if (especial.nombre.includes('Participante')) {
            nuevaFila[especial.destino] = valores.join(' ').trim();
          } else {
            // Para motivos, usar punto y coma
            nuevaFila[especial.destino] = valores.join('; ').trim();
          }
        }
      });

      todasLasFilas.push(nuevaFila);
    }

    Logger.log(`Total de filas a enviar: ${todasLasFilas.length}`);

    if (todasLasFilas.length === 0) {
      ui.alert('ℹ️ Sin datos', 'No hay datos para sincronizar.', ui.ButtonSet.OK);
      return;
    }

    const ultimaFila = encontrarUltimaFilaConDatos(hojaPrincipal);
    Logger.log(`Última fila con datos: ${ultimaFila}`);
    Logger.log(`Insertando en fila: ${ultimaFila + 1}`);

    hojaPrincipal.getRange(ultimaFila + 1, 1, todasLasFilas.length, encabezadosDestino.length).setValues(todasLasFilas);

    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', todasLasFilas.length.toString());

    let mensaje = `✅ Se enviaron ${todasLasFilas.length} filas a "${HOJA_DESTINO_NOMBRE}"\n\n`;
    mensaje += `✓ Inserción en fila: ${ultimaFila + 1}\n`;
    mensaje += `✓ Columnas mapeadas: ${mapeoColumnas.length}\n`;
    mensaje += `✓ Columnas especiales: ${columnasEspeciales.length}\n\n`;

    mensaje += `📋 Mapeo aplicado:\n`;
    mapeoColumnas.forEach(m => {
      mensaje += `  • ${m.nombre}\n`;
    });
    columnasEspeciales.forEach(e => {
      mensaje += `  • ${e.nombre}\n`;
    });

    ui.alert('✅ Sincronización Inicial Completada', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', 'Error al sincronizar: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.stack);
  }
}

/**
 * Sincronización automática (silenciosa)
 */
function sincronizarAutomatico() {
  try {
    actualizarDatosAutomatico();

    Utilities.sleep(1000);

    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID);
    const hojaPrincipal = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE);

    if (!hojaPrincipal) {
      Logger.log(`No se encontró la hoja "${HOJA_DESTINO_NOMBRE}" en el archivo destino`);
      return;
    }

    const spreadsheetLocal = SpreadsheetApp.getActiveSpreadsheet();
    const hojaOrigen = spreadsheetLocal.getSheetByName("DatosKobo");

    if (!hojaOrigen) {
      Logger.log('No se encontró la hoja "DatosKobo"');
      return;
    }

    const datosOrigen = hojaOrigen.getDataRange().getValues();
    const datosDestino = hojaPrincipal.getDataRange().getValues();

    if (datosOrigen.length === 0) {
      Logger.log('No hay datos en DatosKobo');
      return;
    }

    if (datosDestino.length === 0) {
      Logger.log('La hoja destino está vacía');
      return;
    }

    const encabezadosOrigen = datosOrigen[0];
    const encabezadosDestino = datosDestino[0];

    const { mapeoColumnas, columnasEspeciales } =
      mapearColumnasIntervencionCasos(encabezadosOrigen, encabezadosDestino);

    const datosExistentes = new Set();
    const indiceParticipanteDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'participante'
    );

    for (let i = 1; i < datosDestino.length; i++) {
      if (indiceParticipanteDestino >= 0) {
        const participante = datosDestino[i][indiceParticipanteDestino];
        if (participante) {
          datosExistentes.add(participante.toString().trim().toLowerCase());
        }
      }
    }

    const filasNuevas = [];

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      const nuevaFila = new Array(encabezadosDestino.length).fill('');

      mapeoColumnas.forEach(mapeo => {
        nuevaFila[mapeo.destino] = filaOrigen[mapeo.origen] || '';
      });

      columnasEspeciales.forEach(especial => {
        if (especial.tipo === 'combinar') {
          const valores = especial.origenes.map(idx => filaOrigen[idx] || '').filter(v => v && v.toString().trim() !== '');

          // Si es el mapeo de Participante (nombre + apellidos), usar espacio
          if (especial.nombre.includes('Participante')) {
            nuevaFila[especial.destino] = valores.join(' ').trim();
          } else {
            // Para motivos, usar punto y coma
            nuevaFila[especial.destino] = valores.join('; ').trim();
          }
        }
      });

      const participante = nuevaFila[indiceParticipanteDestino];
      const esDuplicado = participante && datosExistentes.has(participante.toString().trim().toLowerCase());

      if (!esDuplicado) {
        filasNuevas.push(nuevaFila);
        if (participante) {
          datosExistentes.add(participante.toString().trim().toLowerCase());
        }
      }
    }

    if (filasNuevas.length > 0) {
      const ultimaFila = encontrarUltimaFilaConDatos(hojaPrincipal);
      hojaPrincipal.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosDestino.length).setValues(filasNuevas);

      const propiedades = PropertiesService.getScriptProperties();
      propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
      propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', filasNuevas.length.toString());

      Logger.log(`Sincronización automática: ${filasNuevas.length} filas nuevas agregadas en fila ${ultimaFila + 1}`);
    } else {
      Logger.log('Sincronización automática: sin datos nuevos');
    }

  } catch (error) {
    Logger.log('Error en sincronización automática: ' + error.message);
    Logger.log('Stack: ' + error.stack);
  }
}

/**
 * Activa la sincronización automática
 */
function activarSincronizacionAutomatica() {
  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.prompt(
    'Activar Sincronización Automática',
    '¿Cada cuántos MINUTOS deseas sincronizar?\n\n' +
    '⚡ SINCRONIZACIÓN RÁPIDA (Recomendado):\n' +
    '5 = Cada 5 minutos (muy rápido)\n' +
    '10 = Cada 10 minutos (rápido)\n' +
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
    const triggers = ScriptApp.getProjectTriggers();
    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sincronizarAutomatico') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    ScriptApp.newTrigger('sincronizarAutomatico')
      .timeBased()
      .everyMinutes(minutos)
      .create();

    ui.alert(
      '✅ Sincronización Rápida Activada',
      `⚡ Los datos se sincronizarán automáticamente cada ${minutos} minutos con "${HOJA_DESTINO_NOMBRE}".\n\n` +
      `✓ Solo se agregarán datos NUEVOS\n` +
      `✓ Sincronización casi instantánea\n` +
      `✓ Mapeo: start→Fecha, nombre+apellidos→Participante, etc.\n` +
      `✓ Detección de duplicados por Participante`,
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

    let mensaje = `📍 Sistema: Intervención de Casos\n`;
    mensaje += `📄 Hoja destino: "${HOJA_DESTINO_NOMBRE}"\n`;
    mensaje += `📁 Archivo: ${SPREADSHEET_DESTINO_ID.substring(0, 20)}...\n\n`;
    mensaje += `🕒 Última sincronización: ${ultimaSincronizacion}\n`;
    mensaje += `📊 Filas agregadas: ${ultimasFilas}\n\n`;

    if (triggerActivo) {
      mensaje += '✅ Estado: ACTIVA (Sincronización rápida)\n\n';
      mensaje += '⚡ Los datos se sincronizan automáticamente cada pocos minutos.\n';
      mensaje += '📋 Mapeo: start→Fecha, nombre+apellidos→Participante';
    } else {
      mensaje += '⚠️ Estado: INACTIVA\n\n';
      mensaje += 'Para activar:\n';
      mensaje += '🎯 Intervención de Casos > ⚙️ Configurar > Activar Sincronización Automática';
    }

    ui.alert('Estado de Sincronización', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}
