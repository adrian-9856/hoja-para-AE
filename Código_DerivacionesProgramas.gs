/**
 * Script para importar datos CSV desde KoboToolbox a Google Sheets
 * Sistema: Derivaciones de Programas → Lista de Espera
 */

// URL directa de exportación de KoboToolbox - DERIVACIONES DE PROGRAMAS
const KOBO_EXPORT_URL_PROG = "https://kf.kobotoolbox.org/api/v2/assets/an6ckBVY2QRQPhTdKiEfcF/export-settings/esTWru6BMfvmXmFEDJm2WG7/data.csv";

// ID del archivo de Google Sheets donde está la hoja de destino
const SPREADSHEET_DESTINO_ID_PROG = "1T0YCTaiu6qxB6Hzq0nth3ZlJpCeKlGTrw2afncW11ME";

// Nombre de la hoja de destino en el otro archivo
const HOJA_DESTINO_NOMBRE_PROG = "Lista de Espera";

/**
 * Encuentra la última fila con datos REALES (no vacía)
 * Busca desde abajo hacia arriba la primera fila que tenga contenido
 */
function encontrarUltimaFilaConDatosProg(hoja) {
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
function onOpenDerivacionesProgramas() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🏢 Derivaciones Programas')
    .addItem('📥 Importar Datos', 'importarCSVdesdeKoboProg')
    .addItem('🔄 Actualizar Datos', 'actualizarDatosAutomaticoProg')
    .addSeparator()
    .addItem('🔄 Sincronizar Solo Nuevos', 'sincronizarConHojaPrincipalProg')
    .addItem('📤 Sincronización Inicial (Enviar Todo)', 'sincronizacionInicialProg')
    .addSeparator()
    .addItem('🧹 Limpiar Hoja (Solo Encabezados)', 'limpiarHojaListaDeEsperaProg')
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Configurar')
      .addItem('Activar Sincronización Automática', 'activarSincronizacionAutomaticaProg')
      .addItem('Desactivar Sincronización Automática', 'desactivarSincronizacionAutomaticaProg')
      .addItem('Ver Estado de Sincronización', 'verEstadoSincronizacionProg'))
    .addToUi();
}

/**
 * Detecta el separador del CSV (coma o punto y coma)
 */
function detectarSeparadorProg(texto) {
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

  Logger.log(`[Programas] Detectados - Comas: ${comas}, Puntos y coma: ${puntosComa}`);
  return puntosComa > comas ? ';' : ',';
}

/**
 * Parsea CSV correctamente manejando campos con comillas y separadores
 */
function parsearCSVProg(texto, separador) {
  if (!separador) {
    separador = detectarSeparadorProg(texto);
    Logger.log(`[Programas] Usando separador: "${separador}"`);
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
function normalizarDatosProg(datos) {
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
 * Importa datos CSV desde KoboToolbox a la hoja "DatosKoboProg"
 */
function importarCSVdesdeKoboProg() {
  try {
    const ui = SpreadsheetApp.getUi();

    ui.alert('Importando datos', 'Por favor espera mientras se descargan los datos de Programas...', ui.ButtonSet.OK);

    const response = UrlFetchApp.fetch(KOBO_EXPORT_URL_PROG, {
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

    Logger.log('[Programas] CSV descargado correctamente. Tamaño: ' + csv.length + ' caracteres');

    const separador = detectarSeparadorProg(csv);
    Logger.log(`[Programas] Separador detectado: "${separador}"`);

    let datos;
    try {
      if (separador === ',') {
        datos = Utilities.parseCsv(csv);
        Logger.log('[Programas] Usando Utilities.parseCsv (coma)');
      } else {
        datos = parsearCSVProg(csv, separador);
        Logger.log('[Programas] Usando parser personalizado (punto y coma)');
      }
    } catch (e) {
      Logger.log('[Programas] Parser estándar falló, usando parser personalizado');
      datos = parsearCSVProg(csv, separador);
    }

    if (!datos || datos.length === 0) {
      throw new Error('No se encontraron datos para importar');
    }

    datos = normalizarDatosProg(datos);

    Logger.log(`[Programas] Datos parseados: ${datos.length} filas, ${datos[0].length} columnas`);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = spreadsheet.getSheetByName("DatosKoboProg");

    if (!hoja) {
      hoja = spreadsheet.insertSheet("DatosKoboProg");
    }

    hoja.clear();

    const numFilas = datos.length;
    const numColumnas = datos[0].length;

    hoja.getRange(1, 1, numFilas, numColumnas).setValues(datos);

    const rangoEncabezado = hoja.getRange(1, 1, 1, numColumnas);
    rangoEncabezado.setFontWeight('bold');
    rangoEncabezado.setBackground('#EA4335');
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
      `[Programas] Se importaron ${numFilas - 1} registros con ${numColumnas} columnas`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      'Error al importar: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    Logger.log('[Programas] Error detallado: ' + error.stack);
  }
}

/**
 * Actualiza los datos automáticamente (sin mostrar alertas)
 */
function actualizarDatosAutomaticoProg() {
  try {
    const response = UrlFetchApp.fetch(KOBO_EXPORT_URL_PROG, {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('[Programas] Error al actualizar: código ' + response.getResponseCode());
      return;
    }

    const csv = response.getContentText();

    if (!csv || csv.trim().length === 0) {
      Logger.log('[Programas] No hay datos para actualizar');
      return;
    }

    const separador = detectarSeparadorProg(csv);
    let datos;

    try {
      if (separador === ',') {
        datos = Utilities.parseCsv(csv);
      } else {
        datos = parsearCSVProg(csv, separador);
      }
    } catch (e) {
      datos = parsearCSVProg(csv, separador);
    }

    if (!datos || datos.length === 0) {
      Logger.log('[Programas] No se encontraron datos para actualizar');
      return;
    }

    datos = normalizarDatosProg(datos);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = spreadsheet.getSheetByName("DatosKoboProg");

    if (!hoja) {
      hoja = spreadsheet.insertSheet("DatosKoboProg");
    }

    hoja.clear();
    const numFilas = datos.length;
    const numColumnas = datos[0].length;

    hoja.getRange(1, 1, numFilas, numColumnas).setValues(datos);

    const rangoEncabezado = hoja.getRange(1, 1, 1, numColumnas);
    rangoEncabezado.setFontWeight('bold');
    rangoEncabezado.setBackground('#EA4335');
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
    propiedades.setProperty('ULTIMA_ACTUALIZACION_PROG', new Date().toLocaleString('es-ES'));

    Logger.log(`[Programas] Datos actualizados: ${numFilas - 1} registros`);

  } catch (error) {
    Logger.log('[Programas] Error en actualización automática: ' + error.message);
  }
}

/**
 * Mapeo de columnas para Derivaciones de Programas
 */
function mapearColumnasDerivacionesProgramas(encabezadosOrigen, encabezadosDestino) {
  const mapeoColumnas = [];
  const columnasEspeciales = [];
  const columnasIgnoradas = [];

  Logger.log('[Programas] === ENCABEZADOS ORIGEN ===');
  encabezadosOrigen.forEach((col, idx) => {
    Logger.log(`  [${idx}] ${col}`);
  });

  Logger.log('[Programas] === ENCABEZADOS DESTINO ===');
  encabezadosDestino.forEach((col, idx) => {
    Logger.log(`  [${idx}] ${col}`);
  });

  // Buscar índices en origen
  const indiceNombres = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'nombres'
  );
  const indiceApellidos = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'apellidos'
  );

  // Buscar índice de Nombre Completo en destino
  const indiceNombreCompleto = encabezadosDestino.findIndex(col =>
    col.toString().trim().toLowerCase() === 'nombre completo'
  );

  // Si hay Nombres+Apellidos en origen y Nombre Completo en destino
  if (indiceNombres >= 0 && indiceApellidos >= 0 && indiceNombreCompleto >= 0) {
    columnasEspeciales.push({
      tipo: 'combinar',
      origenes: [indiceNombres, indiceApellidos],
      destino: indiceNombreCompleto,
      nombre: 'Nombres + Apellidos → Nombre Completo'
    });
  }

  // Mapeo de columnas con nombres similares (case-insensitive y flexible)
  const mapeosFlexibles = {
    'servicio': 'servicio que solicita',
    'terapia individual': 'servicio que solicita',
    'servicio al que deriva': 'servicio que solicita',
    'programa de creamos': 'programa de creamos / organización',
    'organización': 'programa de creamos / organización',
    'nombre de organización': 'programa de creamos / organización',
    'nombre de quien deriva': 'nombre de quien deriva o refiere',
    'derivación o referencia': 'derivación o referencia',
    'motivo de derivación u referencia': 'motivo de derivación u referencia',
    'motivo de derivación': 'malestar principal',
    'teléfono': 'teléfono',
    'dirección': 'dirección'
  };

  // Mapear columnas normales
  for (let i = 0; i < encabezadosOrigen.length; i++) {
    const columnaOrigen = encabezadosOrigen[i].toString().trim().toLowerCase();

    // Saltar Nombres y Apellidos si ya se mapearon a Nombre Completo
    if ((i === indiceNombres || i === indiceApellidos) && indiceNombreCompleto >= 0) {
      continue;
    }

    // Buscar coincidencia exacta
    let indiceDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === columnaOrigen
    );

    // Si no hay coincidencia exacta, buscar en mapeos flexibles
    if (indiceDestino < 0 && mapeosFlexibles[columnaOrigen]) {
      indiceDestino = encabezadosDestino.findIndex(col =>
        col.toString().trim().toLowerCase() === mapeosFlexibles[columnaOrigen]
      );
    }

    if (indiceDestino >= 0) {
      mapeoColumnas.push({
        origen: i,
        destino: indiceDestino,
        nombre: encabezadosOrigen[i]
      });
    } else {
      columnasIgnoradas.push(encabezadosOrigen[i]);
    }
  }

  return { mapeoColumnas, columnasEspeciales, columnasIgnoradas };
}

/**
 * Sincroniza datos con la hoja principal
 */
function sincronizarConHojaPrincipalProg() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheetLocal = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID_PROG);
    const hojaPrincipal = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE_PROG);

    if (!hojaPrincipal) {
      ui.alert('❌ Error', `No se encontró la hoja "${HOJA_DESTINO_NOMBRE_PROG}" en el archivo destino.`, ui.ButtonSet.OK);
      return;
    }

    const hojaOrigen = spreadsheetLocal.getSheetByName("DatosKoboProg");

    if (!hojaOrigen) {
      ui.alert('❌ Error', 'No se encontró la hoja "DatosKoboProg". Primero importa los datos.', ui.ButtonSet.OK);
      return;
    }

    const datosOrigen = hojaOrigen.getDataRange().getValues();
    const datosDestino = hojaPrincipal.getDataRange().getValues();

    if (datosOrigen.length === 0) {
      ui.alert('❌ Error', 'La hoja "DatosKoboProg" está vacía.', ui.ButtonSet.OK);
      return;
    }

    if (datosDestino.length === 0) {
      ui.alert('❌ Error', `La hoja "${HOJA_DESTINO_NOMBRE_PROG}" está vacía. Debe tener al menos los encabezados.`, ui.ButtonSet.OK);
      return;
    }

    const encabezadosOrigen = datosOrigen[0];
    const encabezadosDestino = datosDestino[0];

    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasDerivacionesProgramas(encabezadosOrigen, encabezadosDestino);

    Logger.log(`[Programas] Columnas mapeadas: ${mapeoColumnas.length}`);
    Logger.log(`[Programas] Columnas especiales: ${columnasEspeciales.length}`);
    Logger.log(`[Programas] Columnas ignoradas: ${columnasIgnoradas.length}`);

    // Detectar filas nuevas (usar teléfono como identificador único)
    const datosExistentes = new Set();
    const indiceTelefonoDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );

    for (let i = 1; i < datosDestino.length; i++) {
      if (indiceTelefonoDestino >= 0) {
        const telefono = datosDestino[i][indiceTelefonoDestino];
        if (telefono) {
          datosExistentes.add(telefono.toString().trim());
        }
      }
    }

    const filasNuevas = [];
    const indiceTelefonoOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      const telefono = indiceTelefonoOrigen >= 0 ? filaOrigen[indiceTelefonoOrigen] : '';

      // CORRECCIÓN: Solo procesar filas que tengan teléfono
      // Si no tiene teléfono, saltarla para evitar duplicados
      if (!telefono || telefono.toString().trim() === '') {
        continue;
      }

      // Verificar si es duplicado (lógica corregida)
      const esDuplicado = datosExistentes.has(telefono.toString().trim());

      if (!esDuplicado) {
        const nuevaFila = new Array(encabezadosDestino.length).fill('');

        mapeoColumnas.forEach(mapeo => {
          nuevaFila[mapeo.destino] = filaOrigen[mapeo.origen] || '';
        });

        columnasEspeciales.forEach(especial => {
          if (especial.tipo === 'combinar') {
            const valores = especial.origenes.map(idx => filaOrigen[idx] || '').filter(v => v && v.toString().trim() !== '');
            nuevaFila[especial.destino] = valores.join(' ').trim();
          }
        });

        filasNuevas.push(nuevaFila);
        // Agregar al set para evitar duplicados en la misma sincronización
        datosExistentes.add(telefono.toString().trim());
      }
    }

    Logger.log(`[Programas] Filas nuevas detectadas: ${filasNuevas.length}`);

    if (filasNuevas.length === 0) {
      ui.alert(
        'ℹ️ Sin cambios',
        'No hay datos nuevos para sincronizar.\n\nTodos los registros ya existen en Lista de Espera.',
        ui.ButtonSet.OK
      );
      return;
    }

    // CORRECCIÓN: Usar función para encontrar última fila con datos reales
    const ultimaFila = encontrarUltimaFilaConDatosProg(hojaPrincipal);
    Logger.log(`[Programas] Última fila con datos: ${ultimaFila}`);
    Logger.log(`[Programas] Insertando en fila: ${ultimaFila + 1}`);

    // Insertar justo después de la última fila con datos
    hojaPrincipal.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosDestino.length).setValues(filasNuevas);

    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION_PROG', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS_PROG', filasNuevas.length.toString());

    let mensaje = `✅ Se agregaron ${filasNuevas.length} filas nuevas a "${HOJA_DESTINO_NOMBRE_PROG}"\n\n`;
    mensaje += `✓ Inserción en fila: ${ultimaFila + 1}\n`;
    mensaje += `✓ Columnas mapeadas: ${mapeoColumnas.length}\n`;
    mensaje += `✓ Columnas especiales: ${columnasEspeciales.length}\n`;

    if (columnasEspeciales.length > 0) {
      mensaje += `\n📋 Mapeos especiales:\n`;
      columnasEspeciales.forEach(e => {
        mensaje += `  • ${e.nombre}\n`;
      });
    }

    ui.alert('✅ Sincronización exitosa', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', 'Error al sincronizar: ' + error.message, ui.ButtonSet.OK);
    Logger.log('[Programas] Error: ' + error.stack);
  }
}

/**
 * Sincronización inicial - Envía TODOS los datos
 */
function sincronizacionInicialProg() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheetLocal = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const confirmacion = ui.alert(
      '⚠️ Sincronización Inicial',
      'Esto enviará TODOS los datos de Programas a "Lista de Espera" sin verificar duplicados.\n\n' +
      '⚠️ ADVERTENCIA: Si los datos ya existen, se duplicarán.\n\n' +
      '¿Deseas continuar?',
      ui.ButtonSet.YES_NO
    );

    if (confirmacion !== ui.Button.YES) {
      return;
    }

    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID_PROG);
    const hojaPrincipal = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE_PROG);

    if (!hojaPrincipal) {
      ui.alert('❌ Error', `No se encontró la hoja "${HOJA_DESTINO_NOMBRE_PROG}" en el archivo destino.`, ui.ButtonSet.OK);
      return;
    }

    const hojaOrigen = spreadsheetLocal.getSheetByName("DatosKoboProg");

    if (!hojaOrigen) {
      ui.alert('❌ Error', 'No se encontró la hoja "DatosKoboProg". Primero importa los datos.', ui.ButtonSet.OK);
      return;
    }

    const datosOrigen = hojaOrigen.getDataRange().getValues();
    const datosDestino = hojaPrincipal.getDataRange().getValues();

    if (datosOrigen.length === 0 || datosOrigen.length === 1) {
      ui.alert('❌ Error', 'La hoja "DatosKoboProg" está vacía o solo tiene encabezados.', ui.ButtonSet.OK);
      return;
    }

    if (datosDestino.length === 0) {
      ui.alert('❌ Error', `La hoja "${HOJA_DESTINO_NOMBRE_PROG}" está vacía. Debe tener al menos los encabezados.`, ui.ButtonSet.OK);
      return;
    }

    const encabezadosOrigen = datosOrigen[0];
    const encabezadosDestino = datosDestino[0];

    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasDerivacionesProgramas(encabezadosOrigen, encabezadosDestino);

    Logger.log(`[Programas] Columnas mapeadas: ${mapeoColumnas.length}`);
    Logger.log(`[Programas] Columnas especiales: ${columnasEspeciales.length}`);

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
          nuevaFila[especial.destino] = valores.join(' ').trim();
        }
      });

      todasLasFilas.push(nuevaFila);
    }

    Logger.log(`[Programas] Total de filas a enviar: ${todasLasFilas.length}`);

    if (todasLasFilas.length === 0) {
      ui.alert('ℹ️ Sin datos', 'No hay datos para sincronizar.', ui.ButtonSet.OK);
      return;
    }

    const ultimaFila = encontrarUltimaFilaConDatosProg(hojaPrincipal);
    Logger.log(`[Programas] Última fila con datos: ${ultimaFila}`);
    Logger.log(`[Programas] Insertando en fila: ${ultimaFila + 1}`);

    hojaPrincipal.getRange(ultimaFila + 1, 1, todasLasFilas.length, encabezadosDestino.length).setValues(todasLasFilas);

    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION_PROG', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS_PROG', todasLasFilas.length.toString());

    let mensaje = `✅ Se enviaron ${todasLasFilas.length} filas a "${HOJA_DESTINO_NOMBRE_PROG}"\n\n`;
    mensaje += `✓ Inserción en fila: ${ultimaFila + 1}\n`;
    mensaje += `✓ Columnas mapeadas: ${mapeoColumnas.length}\n`;
    mensaje += `✓ Columnas especiales: ${columnasEspeciales.length}\n\n`;

    ui.alert('✅ Sincronización Inicial Completada', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', 'Error al sincronizar: ' + error.message, ui.ButtonSet.OK);
    Logger.log('[Programas] Error: ' + error.stack);
  }
}

/**
 * Sincronización automática (silenciosa)
 */
function sincronizarAutomaticoProg() {
  try {
    actualizarDatosAutomaticoProg();

    Utilities.sleep(1000);

    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID_PROG);
    const hojaPrincipal = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE_PROG);

    if (!hojaPrincipal) {
      Logger.log(`[Programas] No se encontró la hoja "${HOJA_DESTINO_NOMBRE_PROG}"`);
      return;
    }

    const spreadsheetLocal = SpreadsheetApp.getActiveSpreadsheet();
    const hojaOrigen = spreadsheetLocal.getSheetByName("DatosKoboProg");

    if (!hojaOrigen) {
      Logger.log('[Programas] No se encontró la hoja "DatosKoboProg"');
      return;
    }

    const datosOrigen = hojaOrigen.getDataRange().getValues();
    const datosDestino = hojaPrincipal.getDataRange().getValues();

    if (datosOrigen.length === 0 || datosDestino.length === 0) {
      Logger.log('[Programas] Sin datos en origen o destino');
      return;
    }

    const encabezadosOrigen = datosOrigen[0];
    const encabezadosDestino = datosDestino[0];

    const { mapeoColumnas, columnasEspeciales } =
      mapearColumnasDerivacionesProgramas(encabezadosOrigen, encabezadosDestino);

    const datosExistentes = new Set();
    const indiceTelefonoDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );

    for (let i = 1; i < datosDestino.length; i++) {
      if (indiceTelefonoDestino >= 0) {
        const telefono = datosDestino[i][indiceTelefonoDestino];
        if (telefono) {
          datosExistentes.add(telefono.toString().trim());
        }
      }
    }

    const filasNuevas = [];
    const indiceTelefonoOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      const telefono = indiceTelefonoOrigen >= 0 ? filaOrigen[indiceTelefonoOrigen] : '';

      // CORRECCIÓN: Solo procesar filas que tengan teléfono
      // Si no tiene teléfono, saltarla para evitar duplicados
      if (!telefono || telefono.toString().trim() === '') {
        continue;
      }

      // Verificar si es duplicado (lógica corregida)
      const esDuplicado = datosExistentes.has(telefono.toString().trim());

      if (!esDuplicado) {
        const nuevaFila = new Array(encabezadosDestino.length).fill('');

        mapeoColumnas.forEach(mapeo => {
          nuevaFila[mapeo.destino] = filaOrigen[mapeo.origen] || '';
        });

        columnasEspeciales.forEach(especial => {
          if (especial.tipo === 'combinar') {
            const valores = especial.origenes.map(idx => filaOrigen[idx] || '').filter(v => v && v.toString().trim() !== '');
            nuevaFila[especial.destino] = valores.join(' ').trim();
          }
        });

        filasNuevas.push(nuevaFila);
        // Agregar al set para evitar duplicados en la misma sincronización
        datosExistentes.add(telefono.toString().trim());
      }
    }

    if (filasNuevas.length > 0) {
      const ultimaFila = encontrarUltimaFilaConDatosProg(hojaPrincipal);
      hojaPrincipal.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosDestino.length).setValues(filasNuevas);

      const propiedades = PropertiesService.getScriptProperties();
      propiedades.setProperty('ULTIMA_SINCRONIZACION_PROG', new Date().toLocaleString('es-ES'));
      propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS_PROG', filasNuevas.length.toString());

      Logger.log(`[Programas] Sincronización automática: ${filasNuevas.length} filas nuevas en fila ${ultimaFila + 1}`);
    } else {
      Logger.log('[Programas] Sincronización automática: sin datos nuevos');
    }

  } catch (error) {
    Logger.log('[Programas] Error en sincronización automática: ' + error.message);
  }
}

/**
 * Activa la sincronización automática
 */
function activarSincronizacionAutomaticaProg() {
  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.prompt(
    'Activar Sincronización Automática',
    '¿Cada cuántos MINUTOS deseas sincronizar?\n\n' +
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
    const triggers = ScriptApp.getProjectTriggers();
    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sincronizarAutomaticoProg') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    ScriptApp.newTrigger('sincronizarAutomaticoProg')
      .timeBased()
      .everyMinutes(minutos)
      .create();

    ui.alert(
      '✅ Sincronización Activada',
      `⚡ Los datos se sincronizarán cada ${minutos} minutos con "${HOJA_DESTINO_NOMBRE_PROG}".\n\n` +
      `✓ Solo se agregarán datos NUEVOS\n` +
      `✓ Detección de duplicados por Teléfono\n` +
      `✓ Inserción en la posición correcta`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Desactiva la sincronización automática
 */
function desactivarSincronizacionAutomaticaProg() {
  const ui = SpreadsheetApp.getUi();

  try {
    const triggers = ScriptApp.getProjectTriggers();
    let eliminados = 0;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sincronizarAutomaticoProg') {
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
function verEstadoSincronizacionProg() {
  const ui = SpreadsheetApp.getUi();

  try {
    const propiedades = PropertiesService.getScriptProperties();
    const ultimaSincronizacion = propiedades.getProperty('ULTIMA_SINCRONIZACION_PROG') || 'Nunca';
    const ultimasFilas = propiedades.getProperty('ULTIMA_SINCRONIZACION_FILAS_PROG') || '0';

    const triggers = ScriptApp.getProjectTriggers();
    let triggerActivo = null;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sincronizarAutomaticoProg') {
        triggerActivo = trigger;
        break;
      }
    }

    let mensaje = `📍 Sistema: Derivaciones Programas → Lista de Espera\n`;
    mensaje += `📄 Hoja destino: "${HOJA_DESTINO_NOMBRE_PROG}"\n`;
    mensaje += `📁 Archivo: ${SPREADSHEET_DESTINO_ID_PROG.substring(0, 20)}...\n\n`;
    mensaje += `🕒 Última sincronización: ${ultimaSincronizacion}\n`;
    mensaje += `📊 Filas agregadas: ${ultimasFilas}\n\n`;

    if (triggerActivo) {
      mensaje += '✅ Estado: ACTIVA (Sincronización rápida)\n\n';
      mensaje += '⚡ Los datos se sincronizan automáticamente cada pocos minutos.';
    } else {
      mensaje += '⚠️ Estado: INACTIVA\n\n';
      mensaje += 'Para activar:\n';
      mensaje += '🏢 Derivaciones Programas > ⚙️ Configurar > Activar Sincronización Automática';
    }

    ui.alert('Estado de Sincronización', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Limpia todas las filas vacías manteniendo solo encabezados
 */
function limpiarHojaListaDeEsperaProg() {
  const ui = SpreadsheetApp.getUi();

  const confirmacion = ui.alert(
    '⚠️ Limpiar Lista de Espera',
    '¿Estás seguro que deseas ELIMINAR todas las filas vacías?\n\n' +
    'Esto NO eliminará los encabezados.\n' +
    'Solo eliminará filas sin contenido real.',
    ui.ButtonSet.YES_NO
  );

  if (confirmacion !== ui.Button.YES) {
    return;
  }

  try {
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID_PROG);
    const hoja = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE_PROG);

    if (!hoja) {
      ui.alert('❌ Error', 'No se encontró la hoja "Lista de Espera"', ui.ButtonSet.OK);
      return;
    }

    const ultimaFila = hoja.getMaxRows();

    // Si hay más de 1 fila (encabezados), eliminar el resto
    if (ultimaFila > 1) {
      hoja.deleteRows(2, ultimaFila - 1);
    }

    ui.alert('✅ Limpieza exitosa', 'Se eliminaron todas las filas vacías.\nSolo quedan los encabezados.', ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}
