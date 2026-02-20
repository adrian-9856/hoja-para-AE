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
 * Verifica si una fecha es del año 2026
 */
function esFechaDel2026(fecha) {
  if (!fecha) return false;

  try {
    let fechaObj;

    // Si ya es un objeto Date
    if (fecha instanceof Date) {
      fechaObj = fecha;
    }
    // Si es un string
    else if (typeof fecha === 'string') {
      fechaObj = new Date(fecha);
    }
    // Si es un número (timestamp)
    else if (typeof fecha === 'number') {
      fechaObj = new Date(fecha);
    }
    else {
      return false;
    }

    // Verificar que sea una fecha válida
    if (isNaN(fechaObj.getTime())) {
      return false;
    }

    return fechaObj.getFullYear() === 2026;
  } catch (e) {
    Logger.log(`Error al verificar fecha: ${e.message}`);
    return false;
  }
}

/**
 * ARCHIVO Y LIMPIEZA AUTOMÁTICA
 * Mueve los datos sincronizados a una hoja de archivo y limpia DatosKobo
 * Esto asegura que DatosKobo solo tenga datos NUEVOS (no sincronizados)
 */
function archivarYLimpiar() {
  try {
    const hojaActual = SpreadsheetApp.getActiveSpreadsheet();
    const hojaDatosKobo = hojaActual.getSheetByName('DatosKobo');

    if (!hojaDatosKobo) {
      Logger.log('[Casos Archivo] No se encuentra la hoja DatosKobo');
      return false;
    }

    const datos = hojaDatosKobo.getDataRange().getValues();

    if (datos.length <= 1) {
      Logger.log('[Casos Archivo] No hay datos para archivar (solo encabezados)');
      return true;
    }

    // Crear o obtener hoja de Archivo
    let hojaArchivo = hojaActual.getSheetByName('Archivo_Casos');
    if (!hojaArchivo) {
      Logger.log('[Casos Archivo] Creando hoja Archivo_Casos...');
      hojaArchivo = hojaActual.insertSheet('Archivo_Casos');
      // Agregar encabezados
      hojaArchivo.getRange(1, 1, 1, datos[0].length).setValues([datos[0]]);
      Logger.log('[Casos Archivo] ✅ Hoja creada con encabezados');
    }

    // Obtener los datos a archivar (todo excepto encabezados)
    const datosParaArchivar = datos.slice(1);

    if (datosParaArchivar.length > 0) {
      // Encontrar última fila en archivo
      const ultimaFilaArchivo = encontrarUltimaFilaConDatos(hojaArchivo);

      // Agregar datos al archivo
      hojaArchivo.getRange(ultimaFilaArchivo + 1, 1, datosParaArchivar.length, datos[0].length)
        .setValues(datosParaArchivar);

      Logger.log(`[Casos Archivo] ✅ ${datosParaArchivar.length} filas archivadas en fila ${ultimaFilaArchivo + 1}`);

      // LIMPIAR DatosKobo - dejar solo encabezados
      if (datos.length > 1) {
        hojaDatosKobo.getRange(2, 1, datos.length - 1, datos[0].length).clearContent();
        Logger.log('[Casos Archivo] ✅ DatosKobo limpiado (solo encabezados)');
      }
    }

    return true;

  } catch (error) {
    Logger.log(`[Casos Archivo] ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Filtra datos importados eliminando los que ya están en el Archivo
 * Esto previene que datos ya procesados vuelvan a DatosKobo
 */
function filtrarDatosYaArchivados(datosImportados) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const hojaArchivo = spreadsheet.getSheetByName('Archivo_Casos');

    // Si no existe el archivo, retornar todos los datos (primera vez)
    if (!hojaArchivo) {
      Logger.log('[Casos Filtro] No existe Archivo_Casos, retornando todos los datos');
      return datosImportados;
    }

    const datosArchivo = hojaArchivo.getDataRange().getValues();

    // Si el archivo solo tiene encabezados, retornar todos
    if (datosArchivo.length <= 1) {
      Logger.log('[Casos Filtro] Archivo vacío, retornando todos los datos');
      return datosImportados;
    }

    const encabezadosImportados = datosImportados[0];
    const encabezadosArchivo = datosArchivo[0];

    // Encontrar índice de Nombres y Apellidos en IMPORTADOS
    const indiceNombresImp = encabezadosImportados.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombres'
    );
    const indiceApellidosImp = encabezadosImportados.findIndex(col =>
      col.toString().trim().toLowerCase() === 'apellidos'
    );

    // Encontrar índice de Nombres y Apellidos en ARCHIVO
    const indiceNombresArch = encabezadosArchivo.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombres'
    );
    const indiceApellidosArch = encabezadosArchivo.findIndex(col =>
      col.toString().trim().toLowerCase() === 'apellidos'
    );

    // Construir Set de participantes del archivo
    const participantesArchivados = new Set();
    for (let i = 1; i < datosArchivo.length; i++) {
      let participante = '';

      if (indiceNombresArch >= 0) {
        participante += (datosArchivo[i][indiceNombresArch] || '').toString().trim().toLowerCase();
      }
      if (indiceApellidosArch >= 0) {
        participante += ' ' + (datosArchivo[i][indiceApellidosArch] || '').toString().trim().toLowerCase();
      }

      participante = participante.trim();
      if (participante) {
        participantesArchivados.add(participante);
      }
    }

    Logger.log(`[Casos Filtro] Participantes en archivo: ${participantesArchivados.size}`);

    // Filtrar datos importados
    const datosFiltrados = [encabezadosImportados];
    let eliminados = 0;
    let conservados = 0;

    for (let i = 1; i < datosImportados.length; i++) {
      let participante = '';

      if (indiceNombresImp >= 0) {
        participante += (datosImportados[i][indiceNombresImp] || '').toString().trim().toLowerCase();
      }
      if (indiceApellidosImp >= 0) {
        participante += ' ' + (datosImportados[i][indiceApellidosImp] || '').toString().trim().toLowerCase();
      }

      participante = participante.trim();

      if (!participante || !participantesArchivados.has(participante)) {
        datosFiltrados.push(datosImportados[i]);
        conservados++;
      } else {
        eliminados++;
      }
    }

    Logger.log(`[Casos Filtro] Eliminados: ${eliminados}, Conservados: ${conservados}`);

    return datosFiltrados;

  } catch (error) {
    Logger.log(`[Casos Filtro] Error: ${error.message}`);
    return datosImportados;
  }
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
    .addItem('🔄 Sincronizar Solo Nuevos (2026)', 'sincronizarConHojaPrincipal')
    .addItem('📤 Sincronización Inicial (Enviar Todo 2026)', 'sincronizacionInicial')
    .addSeparator()
    .addItem('🗄️ Archivar y Limpiar Datos', 'archivarYLimpiar')
    .addItem('🧹 Limpiar Hoja (Solo Encabezados)', 'limpiarHojaIntervencionCasos')
    .addItem('🔄 Reseteo Completo (Todo Limpio)', 'reseteoCompleto')
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
 * Filtra datos importados eliminando los que ya están en el Archivo
 * Esto previene que datos ya procesados vuelvan a DatosKobo
 */
function filtrarDatosYaArchivados(datosImportados) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const hojaArchivo = spreadsheet.getSheetByName('Archivo_Casos');

    // Si no existe el archivo, retornar todos los datos (primera vez)
    if (!hojaArchivo) {
      Logger.log('[Casos Filtro] No existe Archivo_Casos, retornando todos los datos');
      return datosImportados;
    }

    const datosArchivo = hojaArchivo.getDataRange().getValues();

    // Si el archivo solo tiene encabezados, retornar todos
    if (datosArchivo.length <= 1) {
      Logger.log('[Casos Filtro] Archivo vacío, retornando todos los datos');
      return datosImportados;
    }

    const encabezadosImportados = datosImportados[0];
    const encabezadosArchivo = datosArchivo[0];

    // Encontrar índices de columnas clave en IMPORTADOS
    const indiceNombresImp = encabezadosImportados.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombre (s)'
    );
    const indiceApellidosImp = encabezadosImportados.findIndex(col =>
      col.toString().trim().toLowerCase() === 'apellidos (s)'
    );

    // Encontrar índices de columnas clave en ARCHIVO
    const indiceNombresArch = encabezadosArchivo.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombre (s)'
    );
    const indiceApellidosArch = encabezadosArchivo.findIndex(col =>
      col.toString().trim().toLowerCase() === 'apellidos (s)'
    );

    // Construir Set de participantes del archivo
    const participantesArchivados = new Set();
    for (let i = 1; i < datosArchivo.length; i++) {
      const nombre = indiceNombresArch >= 0 ? datosArchivo[i][indiceNombresArch] : '';
      const apellido = indiceApellidosArch >= 0 ? datosArchivo[i][indiceApellidosArch] : '';
      const participante = `${nombre} ${apellido}`.trim().toLowerCase();

      if (participante) {
        participantesArchivados.add(participante);
      }
    }

    Logger.log(`[Casos Filtro] Participantes en archivo: ${participantesArchivados.size}`);

    // Filtrar datos importados - solo los que NO están en el archivo
    const datosFiltrados = [encabezadosImportados]; // Mantener encabezados
    let eliminados = 0;
    let conservados = 0;

    for (let i = 1; i < datosImportados.length; i++) {
      const nombre = indiceNombresImp >= 0 ? datosImportados[i][indiceNombresImp] : '';
      const apellido = indiceApellidosImp >= 0 ? datosImportados[i][indiceApellidosImp] : '';
      const participante = `${nombre} ${apellido}`.trim().toLowerCase();

      if (!participante || !participantesArchivados.has(participante)) {
        // Es nuevo o no tiene nombre suficiente - conservar
        datosFiltrados.push(datosImportados[i]);
        conservados++;
      } else {
        // Ya está archivado - eliminar
        eliminados++;
      }
    }

    Logger.log(`[Casos Filtro] Eliminados: ${eliminados}, Conservados: ${conservados}`);

    return datosFiltrados;

  } catch (error) {
    Logger.log(`[Casos Filtro] Error: ${error.message}`);
    // En caso de error, retornar todos los datos
    return datosImportados;
  }
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

    // FILTRAR DATOS: Eliminar los que ya están en el Archivo
    datos = filtrarDatosYaArchivados(datos);
    Logger.log(`[Casos] Después del filtro: ${datos.length} filas`);

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

    // FILTRAR DATOS: Eliminar los que ya están en el Archivo
    datos = filtrarDatosYaArchivados(datos);
    Logger.log(`[Casos Auto] Después del filtro: ${datos.length} filas`);

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

    // Detectar filas nuevas usando Participante + Fecha de intervención
    // IMPORTANTE: Una persona PUEDE tener VARIAS intervenciones en diferentes fechas
    const intervencionesExistentes = new Set(); // ID único: Participante + Fecha

    const indiceParticipanteDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'participante'
    );

    const indiceFechaIntervencionDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'fecha de intervención' ||
      col.toString().trim().toLowerCase() === 'fecha intervención' ||
      col.toString().trim().toLowerCase() === 'fecha'
    );

    for (let i = 1; i < datosDestino.length; i++) {
      if (indiceParticipanteDestino >= 0) {
        const participante = datosDestino[i][indiceParticipanteDestino];
        const fechaIntervencion = indiceFechaIntervencionDestino >= 0 ? datosDestino[i][indiceFechaIntervencionDestino] : '';

        if (participante) {
          const participanteNorm = participante.toString().trim().toLowerCase();
          const fechaNorm = fechaIntervencion ? fechaIntervencion.toString().trim() : '';

          // Crear ID único: Participante + Fecha
          const idUnico = `${participanteNorm}|${fechaNorm}`;
          intervencionesExistentes.add(idUnico);
        }
      }
    }

    Logger.log(`\nIntervenciones existentes: ${intervencionesExistentes.size} registros únicos (Participante + Fecha)`);

    // Encontrar índice de la columna de fecha en origen (start)
    const indiceFechaOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'start'
    );

    const filasNuevas = [];
    let filasExcluidasPorFecha = 0;

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      // FILTRO: Verificar si la fecha es del 2026
      if (indiceFechaOrigen >= 0) {
        const fechaRegistro = filaOrigen[indiceFechaOrigen];
        if (!esFechaDel2026(fechaRegistro)) {
          filasExcluidasPorFecha++;
          continue; // Saltar esta fila si no es del 2026
        }
      }

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

      // Verificar si es duplicado usando Participante + Fecha
      const participante = nuevaFila[indiceParticipanteDestino];
      const fechaIntervencion = indiceFechaIntervencionDestino >= 0 ? nuevaFila[indiceFechaIntervencionDestino] : '';
      let esDuplicado = false;

      if (participante) {
        const participanteNorm = participante.toString().trim().toLowerCase();
        const fechaNorm = fechaIntervencion ? fechaIntervencion.toString().trim() : '';

        // Crear ID único para esta fila
        const idUnico = `${participanteNorm}|${fechaNorm}`;

        // Verificar si ya existe esta combinación Participante + Fecha
        if (intervencionesExistentes.has(idUnico)) {
          esDuplicado = true;
          Logger.log(`[Casos] Fila ${i + 1} omitida: duplicado (${participanteNorm} en ${fechaNorm})`);
        }
      }

      if (!esDuplicado) {
        filasNuevas.push(nuevaFila);
        // Agregar al set para evitar duplicados en la misma sincronización
        if (participante) {
          const participanteNorm = participante.toString().trim().toLowerCase();
          const fechaNorm = fechaIntervencion ? fechaIntervencion.toString().trim() : '';
          const idUnico = `${participanteNorm}|${fechaNorm}`;
          intervencionesExistentes.add(idUnico);
        }
      }
    }

    Logger.log(`\nFilas excluidas (no son 2026): ${filasExcluidasPorFecha}`);

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
    mensaje += `✓ Solo datos del 2026\n`;
    if (filasExcluidasPorFecha > 0) {
      mensaje += `✓ Excluidas ${filasExcluidasPorFecha} filas (otros años)\n`;
    }
    mensaje += `✓ Columnas mapeadas: ${mapeoColumnas.length}\n`;
    mensaje += `✓ Columnas especiales: ${columnasEspeciales.length}\n`;

    ui.alert('✅ Sincronización exitosa', mensaje, ui.ButtonSet.OK);

    // ARCHIVAR Y LIMPIAR automáticamente después de sincronizar
    Logger.log('[Casos] Archivando y limpiando datos...');
    const archivoExitoso = archivarYLimpiar();
    if (archivoExitoso) {
      Logger.log('[Casos] ✅ Datos archivados y DatosKobo limpiado');
    }

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

    // Encontrar índice de la columna de fecha en origen (start)
    const indiceFechaOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'start'
    );

    const todasLasFilas = [];
    let filasExcluidasPorFecha = 0;

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      // FILTRO: Verificar si la fecha es del 2026
      if (indiceFechaOrigen >= 0) {
        const fechaRegistro = filaOrigen[indiceFechaOrigen];
        if (!esFechaDel2026(fechaRegistro)) {
          filasExcluidasPorFecha++;
          continue; // Saltar esta fila si no es del 2026
        }
      }

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

    Logger.log(`\nFilas excluidas (no son 2026): ${filasExcluidasPorFecha}`);

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
    mensaje += `✓ Solo datos del 2026\n`;
    if (filasExcluidasPorFecha > 0) {
      mensaje += `✓ Excluidas ${filasExcluidasPorFecha} filas (otros años)\n`;
    }
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

    // Detectar intervenciones existentes usando Participante + Fecha
    const intervencionesExistentes = new Set();

    const indiceParticipanteDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'participante'
    );

    const indiceFechaIntervencionDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'fecha de intervención' ||
      col.toString().trim().toLowerCase() === 'fecha intervención' ||
      col.toString().trim().toLowerCase() === 'fecha'
    );

    for (let i = 1; i < datosDestino.length; i++) {
      if (indiceParticipanteDestino >= 0) {
        const participante = datosDestino[i][indiceParticipanteDestino];
        const fechaIntervencion = indiceFechaIntervencionDestino >= 0 ? datosDestino[i][indiceFechaIntervencionDestino] : '';

        if (participante) {
          const participanteNorm = participante.toString().trim().toLowerCase();
          const fechaNorm = fechaIntervencion ? fechaIntervencion.toString().trim() : '';
          const idUnico = `${participanteNorm}|${fechaNorm}`;
          intervencionesExistentes.add(idUnico);
        }
      }
    }

    Logger.log(`[Casos Auto] Intervenciones existentes: ${intervencionesExistentes.size}`);

    // Encontrar índice de la columna de fecha en origen (start)
    const indiceFechaOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'start'
    );

    const filasNuevas = [];

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      // FILTRO: Verificar si la fecha es del 2026
      if (indiceFechaOrigen >= 0) {
        const fechaRegistro = filaOrigen[indiceFechaOrigen];
        if (!esFechaDel2026(fechaRegistro)) {
          continue; // Saltar esta fila si no es del 2026
        }
      }

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

      // Verificar si es duplicado usando Participante + Fecha
      const participante = nuevaFila[indiceParticipanteDestino];
      const fechaIntervencion = indiceFechaIntervencionDestino >= 0 ? nuevaFila[indiceFechaIntervencionDestino] : '';
      let esDuplicado = false;

      if (participante) {
        const participanteNorm = participante.toString().trim().toLowerCase();
        const fechaNorm = fechaIntervencion ? fechaIntervencion.toString().trim() : '';
        const idUnico = `${participanteNorm}|${fechaNorm}`;

        // Verificar si ya existe esta combinación Participante + Fecha
        if (intervencionesExistentes.has(idUnico)) {
          esDuplicado = true;
        }
      }

      if (!esDuplicado) {
        filasNuevas.push(nuevaFila);
        if (participante) {
          const participanteNorm = participante.toString().trim().toLowerCase();
          const fechaNorm = fechaIntervencion ? fechaIntervencion.toString().trim() : '';
          const idUnico = `${participanteNorm}|${fechaNorm}`;
          intervencionesExistentes.add(idUnico);
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

      // ARCHIVAR Y LIMPIAR automáticamente después de sincronizar
      Logger.log('[Casos Auto] Archivando y limpiando datos...');
      archivarYLimpiar();
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

/**
 * Limpia todas las filas vacías manteniendo solo encabezados
 */
function limpiarHojaIntervencionCasos() {
  const ui = SpreadsheetApp.getUi();

  const confirmacion = ui.alert(
    '⚠️ Limpiar Intervención de Casos',
    '¿Estás seguro que deseas ELIMINAR todas las filas?\n\n' +
    'Esto NO eliminará los encabezados.\n' +
    'Solo eliminará todas las filas de datos.\n\n' +
    '⚠️ Esta acción NO se puede deshacer.',
    ui.ButtonSet.YES_NO
  );

  if (confirmacion !== ui.Button.YES) {
    return;
  }

  try {
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID);
    const hoja = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE);

    if (!hoja) {
      ui.alert('❌ Error', `No se encontró la hoja "${HOJA_DESTINO_NOMBRE}"`, ui.ButtonSet.OK);
      return;
    }

    const ultimaFila = hoja.getMaxRows();

    // Si hay más de 1 fila (encabezados), eliminar el resto
    if (ultimaFila > 1) {
      hoja.deleteRows(2, ultimaFila - 1);
    }

    ui.alert('✅ Limpieza exitosa', `Se eliminaron todas las filas de datos.\nSolo quedan los encabezados en "${HOJA_DESTINO_NOMBRE}".`, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Reseteo completo - Elimina DatosKobo y limpia Intervención de Casos
 */
function reseteoCompleto() {
  const ui = SpreadsheetApp.getUi();

  const confirmacion1 = ui.alert(
    '⚠️⚠️⚠️ RESETEO COMPLETO ⚠️⚠️⚠️',
    'Esta acción eliminará:\n\n' +
    '1. La hoja "DatosKobo" completamente\n' +
    '2. Todos los datos de "Intervención de casos"\n\n' +
    '⚠️ ESTO BORRARÁ TODO Y NO SE PUEDE DESHACER ⚠️\n\n' +
    '¿Estás SEGURO?',
    ui.ButtonSet.YES_NO
  );

  if (confirmacion1 !== ui.Button.YES) {
    return;
  }

  const confirmacion2 = ui.alert(
    '⚠️ ÚLTIMA CONFIRMACIÓN',
    'Escribe "SÍ" en la siguiente ventana para confirmar que deseas borrar TODO.',
    ui.ButtonSet.OK_CANCEL
  );

  if (confirmacion2 !== ui.Button.OK) {
    return;
  }

  const respuesta = ui.prompt(
    '⚠️ Confirmación Final',
    'Escribe exactamente: SI\n\n' +
    '(en mayúsculas, sin acentos)',
    ui.ButtonSet.OK_CANCEL
  );

  if (respuesta.getSelectedButton() !== ui.Button.OK || respuesta.getResponseText().trim() !== 'SI') {
    ui.alert('❌ Cancelado', 'Reseteo cancelado. No se eliminó nada.', ui.ButtonSet.OK);
    return;
  }

  try {
    const spreadsheetLocal = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Eliminar hoja DatosKobo
    const hojaDatosKobo = spreadsheetLocal.getSheetByName("DatosKobo");
    if (hojaDatosKobo) {
      spreadsheetLocal.deleteSheet(hojaDatosKobo);
      Logger.log('Hoja DatosKobo eliminada');
    }

    // 2. Limpiar hoja de Intervención de casos
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID);
    const hojaDestino = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE);

    if (hojaDestino) {
      const ultimaFila = hojaDestino.getMaxRows();
      if (ultimaFila > 1) {
        hojaDestino.deleteRows(2, ultimaFila - 1);
      }
      Logger.log('Hoja Intervención de casos limpiada');
    }

    ui.alert(
      '✅ Reseteo Completo Exitoso',
      '✓ Hoja "DatosKobo" eliminada\n' +
      '✓ Hoja "Intervención de casos" limpiada\n\n' +
      'Ahora puedes:\n' +
      '1. Importar Datos - Para traer nuevos datos de KoboToolbox\n' +
      '2. Sincronización Inicial - Para enviar todo a Intervención de casos',
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('❌ Error', 'Error durante el reseteo: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error en reseteoCompleto: ' + error.stack);
  }
}
