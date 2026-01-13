/**
 * Script para importar datos CSV desde KoboToolbox a Google Sheets
 * Versión simplificada y optimizada
 */

// URL directa de exportación de KoboToolbox
const KOBO_EXPORT_URL = "https://kf.kobotoolbox.org/api/v2/assets/an6ckBVY2QRQPhTdKiEfcF/export-settings/esTWru6BMfvmXmFEDJm2WG7/data.csv";

// ID del archivo de Google Sheets donde está la hoja de destino
const SPREADSHEET_DESTINO_ID = "1T0YCTaiu6qxB6Hzq0nth3ZlJpCeKlGTrw2afncW11ME";

// Nombre de la hoja de destino en el otro archivo
const HOJA_DESTINO_NOMBRE = "Lista de Espera";

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
  ui.createMenu('KoboToolbox')
    .addItem('📥 Importar Datos', 'importarCSVdesdeKobo')
    .addItem('🔄 Actualizar Datos', 'actualizarDatosAutomatico')
    .addSeparator()
    .addItem('🔄 Sincronizar Solo Nuevos', 'sincronizarConHojaPrincipal')
    .addItem('📤 Sincronización Inicial (Enviar Todo)', 'sincronizacionInicial')
    .addSeparator()
    .addSubMenu(ui.createMenu('📤 Copiar a Otra Hoja')
      .addItem('Copiar Todos los Datos', 'enviarDatosAOtraHoja')
      .addItem('Copiar Columnas Específicas', 'copiarColumnasEspecificas'))
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
 * Copia todos los datos de DatosKobo a otra hoja
 */
function enviarDatosAOtraHoja() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const hojaOrigen = spreadsheet.getSheetByName("DatosKobo");

    if (!hojaOrigen) {
      ui.alert('Error', 'No se encontró la hoja "DatosKobo". Primero importa los datos.', ui.ButtonSet.OK);
      return;
    }

    const datosOrigen = hojaOrigen.getDataRange().getValues();

    if (datosOrigen.length === 0) {
      ui.alert('Error', 'La hoja "DatosKobo" está vacía.', ui.ButtonSet.OK);
      return;
    }

    const respuesta = ui.prompt(
      'Nombre de la hoja destino',
      'Ingresa el nombre de la nueva hoja:',
      ui.ButtonSet.OK_CANCEL
    );

    if (respuesta.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    const nombreHoja = respuesta.getResponseText().trim();

    if (!nombreHoja) {
      ui.alert('Error', 'Debes ingresar un nombre válido.', ui.ButtonSet.OK);
      return;
    }

    let hojaDestino = spreadsheet.getSheetByName(nombreHoja);

    if (hojaDestino) {
      const confirmar = ui.alert(
        'Hoja existe',
        `La hoja "${nombreHoja}" ya existe. ¿Deseas reemplazar su contenido?`,
        ui.ButtonSet.YES_NO
      );

      if (confirmar !== ui.Button.YES) {
        return;
      }

      hojaDestino.clear();
    } else {
      hojaDestino = spreadsheet.insertSheet(nombreHoja);
    }

    const numFilas = datosOrigen.length;
    const numColumnas = datosOrigen[0].length;

    hojaDestino.getRange(1, 1, numFilas, numColumnas).setValues(datosOrigen);

    const encabezado = hojaDestino.getRange(1, 1, 1, numColumnas);
    encabezado.setFontWeight('bold');
    encabezado.setBackground('#34A853');
    encabezado.setFontColor('#ffffff');
    encabezado.setWrap(true);

    for (let i = 1; i <= numColumnas; i++) {
      hojaDestino.autoResizeColumn(i);
    }

    hojaDestino.setFrozenRows(1);

    ui.alert('✅ Éxito', `${numFilas - 1} filas copiadas a "${nombreHoja}"`, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.stack);
  }
}

/**
 * Copia solo columnas específicas a otra hoja
 */
function copiarColumnasEspecificas() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const hojaOrigen = spreadsheet.getSheetByName("DatosKobo");

    if (!hojaOrigen) {
      ui.alert('Error', 'No se encontró la hoja "DatosKobo".', ui.ButtonSet.OK);
      return;
    }

    const datosOrigen = hojaOrigen.getDataRange().getValues();

    if (datosOrigen.length === 0) {
      ui.alert('Error', 'La hoja "DatosKobo" está vacía.', ui.ButtonSet.OK);
      return;
    }

    const encabezados = datosOrigen[0];
    let mensaje = 'Columnas disponibles:\n\n';

    for (let i = 0; i < encabezados.length && i < 30; i++) {
      const nombre = encabezados[i].toString().substring(0, 40);
      mensaje += `${i + 1}. ${nombre}\n`;
    }

    if (encabezados.length > 30) {
      mensaje += `\n... y ${encabezados.length - 30} columnas más`;
    }

    const respuesta = ui.prompt(
      'Seleccionar columnas',
      mensaje + '\n\nIngresa los números separados por comas (ej: 1,3,5):',
      ui.ButtonSet.OK_CANCEL
    );

    if (respuesta.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    const columnasTexto = respuesta.getResponseText().trim();
    const columnasSeleccionadas = columnasTexto.split(',').map(num => parseInt(num.trim()) - 1);

    if (columnasSeleccionadas.some(col => isNaN(col) || col < 0 || col >= encabezados.length)) {
      ui.alert('Error', 'Columnas inválidas. Verifica los números.', ui.ButtonSet.OK);
      return;
    }

    const respuestaNombre = ui.prompt(
      'Nombre de hoja',
      'Ingresa el nombre de la nueva hoja:',
      ui.ButtonSet.OK_CANCEL
    );

    if (respuestaNombre.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    const nombreHoja = respuestaNombre.getResponseText().trim();

    let hojaDestino = spreadsheet.getSheetByName(nombreHoja);

    if (hojaDestino) {
      hojaDestino.clear();
    } else {
      hojaDestino = spreadsheet.insertSheet(nombreHoja);
    }

    const datosNuevos = datosOrigen.map(fila =>
      columnasSeleccionadas.map(idx => fila[idx])
    );

    hojaDestino.getRange(1, 1, datosNuevos.length, datosNuevos[0].length).setValues(datosNuevos);

    const encabezado = hojaDestino.getRange(1, 1, 1, datosNuevos[0].length);
    encabezado.setFontWeight('bold');
    encabezado.setBackground('#34A853');
    encabezado.setFontColor('#ffffff');
    encabezado.setWrap(true);

    for (let i = 1; i <= datosNuevos[0].length; i++) {
      hojaDestino.autoResizeColumn(i);
    }

    hojaDestino.setFrozenRows(1);

    ui.alert('✅ Éxito', `${datosNuevos[0].length} columnas copiadas a "${nombreHoja}"`, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.stack);
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
 * Función auxiliar para mapear columnas con reglas especiales
 */
function mapearColumnasConReglas(encabezadosOrigen, encabezadosPrincipal) {
  const mapeoColumnas = [];
  const columnasIgnoradas = [];
  const columnasEspeciales = [];

  const indiceNombres = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'nombres'
  );
  const indiceApellidos = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'apellidos'
  );

  const indiceNombreCompleto = encabezadosPrincipal.findIndex(col =>
    col.toString().trim().toLowerCase() === 'nombre completo'
  );

  if (indiceNombres >= 0 && indiceApellidos >= 0 && indiceNombreCompleto >= 0) {
    columnasEspeciales.push({
      tipo: 'combinar',
      origenes: [indiceNombres, indiceApellidos],
      destino: indiceNombreCompleto,
      nombre: 'Nombres + Apellidos → Nombre Completo'
    });
  }

  const mapeosFlexibles = {
    'servicio': 'servicio que solicita',
    'programa de creamos': 'programa de creamos / organización',
    'nombre de quien deriva': 'nombre de quien deriva o refiere',
    'derivación o referencia': 'derivación o referencia',
    'motivo de derivación u referencia': 'motivo de derivación u referencia',
    'teléfono': 'teléfono',
    'dirección': 'dirección'
  };

  for (let i = 0; i < encabezadosOrigen.length; i++) {
    const columnaOrigen = encabezadosOrigen[i].toString().trim().toLowerCase();

    if ((i === indiceNombres || i === indiceApellidos) && indiceNombreCompleto >= 0) {
      continue;
    }

    let indicePrincipal = encabezadosPrincipal.findIndex(col =>
      col.toString().trim().toLowerCase() === columnaOrigen
    );

    if (indicePrincipal < 0 && mapeosFlexibles[columnaOrigen]) {
      indicePrincipal = encabezadosPrincipal.findIndex(col =>
        col.toString().trim().toLowerCase() === mapeosFlexibles[columnaOrigen]
      );
    }

    if (indicePrincipal >= 0) {
      mapeoColumnas.push({
        origen: i,
        principal: indicePrincipal,
        nombre: encabezadosOrigen[i]
      });
    } else {
      columnasIgnoradas.push(encabezadosOrigen[i]);
    }
  }

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
    const datosPrincipal = hojaPrincipal.getDataRange().getValues();

    if (datosOrigen.length === 0) {
      ui.alert('❌ Error', 'La hoja "DatosKobo" está vacía.', ui.ButtonSet.OK);
      return;
    }

    if (datosPrincipal.length === 0) {
      ui.alert('❌ Error', `La hoja "${HOJA_DESTINO_NOMBRE}" está vacía. Debe tener al menos los encabezados.`, ui.ButtonSet.OK);
      return;
    }

    const encabezadosOrigen = datosOrigen[0];
    const encabezadosPrincipal = datosPrincipal[0];

    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasConReglas(encabezadosOrigen, encabezadosPrincipal);

    Logger.log(`Columnas mapeadas: ${mapeoColumnas.length}`);
    Logger.log(`Columnas especiales: ${columnasEspeciales.length}`);
    Logger.log(`Columnas ignoradas: ${columnasIgnoradas.length}`);

    Logger.log('=== MAPEO DE COLUMNAS ===');
    mapeoColumnas.forEach(m => {
      Logger.log(`  "${encabezadosOrigen[m.origen]}" → "${encabezadosPrincipal[m.principal]}"`);
    });
    columnasEspeciales.forEach(e => {
      Logger.log(`  [ESPECIAL] ${e.nombre}`);
    });
    if (columnasIgnoradas.length > 0) {
      Logger.log('Columnas ignoradas: ' + columnasIgnoradas.join(', '));
    }

    const datosExistentes = new Set();
    const indiceTelefonoDestino = encabezadosPrincipal.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );

    for (let i = 1; i < datosPrincipal.length; i++) {
      if (indiceTelefonoDestino >= 0) {
        const telefono = datosPrincipal[i][indiceTelefonoDestino];
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
      const esNueva = !telefono || !datosExistentes.has(telefono.toString().trim());

      if (esNueva) {
        const nuevaFila = new Array(encabezadosPrincipal.length).fill('');

        mapeoColumnas.forEach(mapeo => {
          nuevaFila[mapeo.principal] = filaOrigen[mapeo.origen] || '';
        });

        columnasEspeciales.forEach(especial => {
          if (especial.tipo === 'combinar') {
            const valores = especial.origenes.map(idx => filaOrigen[idx] || '');
            nuevaFila[especial.destino] = valores.filter(v => v).join(' ').trim();
          }
        });

        filasNuevas.push(nuevaFila);
      }
    }

    Logger.log(`Filas nuevas detectadas: ${filasNuevas.length}`);

    if (filasNuevas.length === 0) {
      ui.alert(
        'ℹ️ Sin cambios',
        'No hay datos nuevos para sincronizar.\n\nTodos los registros ya existen en la hoja principal.',
        ui.ButtonSet.OK
      );
      return;
    }

    // CORRECCIÓN: Usar función mejorada para encontrar última fila con datos
    const ultimaFila = encontrarUltimaFilaConDatos(hojaPrincipal);
    Logger.log(`Última fila con datos: ${ultimaFila}`);

    // Insertar justo después de la última fila con datos
    hojaPrincipal.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosPrincipal.length).setValues(filasNuevas);

    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', filasNuevas.length.toString());

    let mensaje = `✅ Se agregaron ${filasNuevas.length} filas nuevas a "${HOJA_DESTINO_NOMBRE}"\n\n`;
    mensaje += `✓ Inserción en fila: ${ultimaFila + 1}\n`;
    mensaje += `✓ Columnas mapeadas: ${mapeoColumnas.length}\n`;
    mensaje += `✓ Columnas especiales: ${columnasEspeciales.length}\n`;

    if (columnasEspeciales.length > 0) {
      mensaje += `\n📋 Mapeos especiales:\n`;
      columnasEspeciales.forEach(e => {
        mensaje += `  • ${e.nombre}\n`;
      });
    }

    if (columnasIgnoradas.length > 0) {
      mensaje += `\n⚠️ Columnas ignoradas: ${columnasIgnoradas.length}\n`;
      mensaje += `(Estas columnas no existen en "Lista de Espera")\n`;
      const primerasIgnoradas = columnasIgnoradas.slice(0, 5);
      primerasIgnoradas.forEach(col => mensaje += `  • ${col}\n`);
      if (columnasIgnoradas.length > 5) {
        mensaje += `  ... y ${columnasIgnoradas.length - 5} más`;
      }
    }

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
      'Esto enviará TODOS los datos de DatosKobo a "Lista de Espera" sin verificar duplicados.\n\n' +
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
    const datosPrincipal = hojaPrincipal.getDataRange().getValues();

    if (datosOrigen.length === 0 || datosOrigen.length === 1) {
      ui.alert('❌ Error', 'La hoja "DatosKobo" está vacía o solo tiene encabezados.', ui.ButtonSet.OK);
      return;
    }

    if (datosPrincipal.length === 0) {
      ui.alert('❌ Error', `La hoja "${HOJA_DESTINO_NOMBRE}" está vacía. Debe tener al menos los encabezados.`, ui.ButtonSet.OK);
      return;
    }

    const encabezadosOrigen = datosOrigen[0];
    const encabezadosPrincipal = datosPrincipal[0];

    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasConReglas(encabezadosOrigen, encabezadosPrincipal);

    Logger.log(`Columnas mapeadas: ${mapeoColumnas.length}`);
    Logger.log(`Columnas especiales: ${columnasEspeciales.length}`);
    Logger.log(`Columnas ignoradas: ${columnasIgnoradas.length}`);

    Logger.log('=== MAPEO DE COLUMNAS ===');
    mapeoColumnas.forEach(m => {
      Logger.log(`  "${encabezadosOrigen[m.origen]}" → "${encabezadosPrincipal[m.principal]}"`);
    });
    columnasEspeciales.forEach(e => {
      Logger.log(`  [ESPECIAL] ${e.nombre}`);
    });
    if (columnasIgnoradas.length > 0) {
      Logger.log('Columnas ignoradas: ' + columnasIgnoradas.join(', '));
    }

    const todasLasFilas = [];

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      const nuevaFila = new Array(encabezadosPrincipal.length).fill('');

      mapeoColumnas.forEach(mapeo => {
        nuevaFila[mapeo.principal] = filaOrigen[mapeo.origen] || '';
      });

      columnasEspeciales.forEach(especial => {
        if (especial.tipo === 'combinar') {
          const valores = especial.origenes.map(idx => filaOrigen[idx] || '');
          nuevaFila[especial.destino] = valores.filter(v => v).join(' ').trim();
        }
      });

      todasLasFilas.push(nuevaFila);
    }

    Logger.log(`Total de filas a enviar: ${todasLasFilas.length}`);

    if (todasLasFilas.length === 0) {
      ui.alert('ℹ️ Sin datos', 'No hay datos para sincronizar.', ui.ButtonSet.OK);
      return;
    }

    // CORRECCIÓN: Usar función mejorada para encontrar última fila con datos
    const ultimaFila = encontrarUltimaFilaConDatos(hojaPrincipal);
    Logger.log(`Última fila con datos: ${ultimaFila}`);

    hojaPrincipal.getRange(ultimaFila + 1, 1, todasLasFilas.length, encabezadosPrincipal.length).setValues(todasLasFilas);

    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', todasLasFilas.length.toString());

    let mensaje = `✅ Se enviaron ${todasLasFilas.length} filas a "${HOJA_DESTINO_NOMBRE}"\n\n`;
    mensaje += `✓ Inserción en fila: ${ultimaFila + 1}\n`;
    mensaje += `✓ Columnas mapeadas: ${mapeoColumnas.length}\n`;
    mensaje += `✓ Columnas especiales: ${columnasEspeciales.length}\n`;

    if (columnasEspeciales.length > 0) {
      mensaje += `\n📋 Mapeos especiales:\n`;
      columnasEspeciales.forEach(e => {
        mensaje += `  • ${e.nombre}\n`;
      });
    }

    if (columnasIgnoradas.length > 0) {
      mensaje += `\n⚠️ Columnas ignoradas: ${columnasIgnoradas.length}\n`;
      mensaje += `(Estas columnas no existen en "Lista de Espera")\n`;
      const primerasIgnoradas = columnasIgnoradas.slice(0, 5);
      primerasIgnoradas.forEach(col => mensaje += `  • ${col}\n`);
      if (columnasIgnoradas.length > 5) {
        mensaje += `  ... y ${columnasIgnoradas.length - 5} más`;
      }
    }

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
    const datosPrincipal = hojaPrincipal.getDataRange().getValues();

    if (datosOrigen.length === 0) {
      Logger.log('No hay datos en DatosKobo');
      return;
    }

    if (datosPrincipal.length === 0) {
      Logger.log('La hoja destino está vacía');
      return;
    }

    const encabezadosOrigen = datosOrigen[0];
    const encabezadosPrincipal = datosPrincipal[0];

    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasConReglas(encabezadosOrigen, encabezadosPrincipal);

    Logger.log(`Columnas mapeadas: ${mapeoColumnas.length}, Columnas especiales: ${columnasEspeciales.length}, Columnas ignoradas: ${columnasIgnoradas.length}`);

    const datosExistentes = new Set();
    const indiceTelefonoDestino = encabezadosPrincipal.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );

    for (let i = 1; i < datosPrincipal.length; i++) {
      if (indiceTelefonoDestino >= 0) {
        const telefono = datosPrincipal[i][indiceTelefonoDestino];
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
      const esNueva = !telefono || !datosExistentes.has(telefono.toString().trim());

      if (esNueva) {
        const nuevaFila = new Array(encabezadosPrincipal.length).fill('');

        mapeoColumnas.forEach(mapeo => {
          nuevaFila[mapeo.principal] = filaOrigen[mapeo.origen] || '';
        });

        columnasEspeciales.forEach(especial => {
          if (especial.tipo === 'combinar') {
            const valores = especial.origenes.map(idx => filaOrigen[idx] || '');
            nuevaFila[especial.destino] = valores.filter(v => v).join(' ').trim();
          }
        });

        filasNuevas.push(nuevaFila);
      }
    }

    if (filasNuevas.length > 0) {
      // CORRECCIÓN: Usar función mejorada para encontrar última fila con datos
      const ultimaFila = encontrarUltimaFilaConDatos(hojaPrincipal);
      Logger.log(`Última fila con datos: ${ultimaFila}`);

      hojaPrincipal.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosPrincipal.length).setValues(filasNuevas);

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
      `✓ Las columnas coincidentes se mapearán automáticamente\n` +
      `✓ Las columnas que no existen en destino se IGNORARÁN`,
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
    mensaje += `📁 Archivo destino: ${SPREADSHEET_DESTINO_ID.substring(0, 20)}...\n\n`;
    mensaje += `🕒 Última sincronización: ${ultimaSincronizacion}\n`;
    mensaje += `📊 Filas agregadas: ${ultimasFilas}\n\n`;

    if (triggerActivo) {
      mensaje += '✅ Estado: ACTIVA (Sincronización rápida)\n\n';
      mensaje += '⚡ Los datos se sincronizan automáticamente cada pocos minutos.\n';
      mensaje += 'Las nuevas respuestas de KoboToolbox se enviarán casi de inmediato.';
    } else {
      mensaje += '⚠️ Estado: INACTIVA\n\n';
      mensaje += 'Para activar sincronización rápida:\n';
      mensaje += 'KoboToolbox > ⚙️ Configurar > Activar Sincronización Automática\n\n';
      mensaje += 'Recomendado: 15 minutos para sincronización casi instantánea';
    }

    ui.alert('Estado de Sincronización', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}
