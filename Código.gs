/**
 * Script para importar datos CSV desde KoboToolbox a Google Sheets
 * Versión simplificada y optimizada
 */

// URL directa de exportación de KoboToolbox
const KOBO_EXPORT_URL = "https://kf.kobotoolbox.org/api/v2/assets/aPAe8WZjdW8Pp3bxLVkPtc/export-settings/esqjDCRhVLeFK8ETYM7Dm85/data.csv";

// ID del archivo de Google Sheets donde está la hoja de destino
const SPREADSHEET_DESTINO_ID = "1T0YCTaiu6qxB6Hzq0nth3ZlJpCeKlGTrw2afncW11ME";

// Nombre de la hoja de destino en el otro archivo
const HOJA_DESTINO_NOMBRE = "Lista de Espera";

/**
 * Crea el menú personalizado al abrir la hoja
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('KoboToolbox')
    .addItem('📥 Importar Datos', 'importarCSVdesdeKobo')
    .addItem('🔄 Actualizar Datos', 'actualizarDatosAutomatico')
    .addItem('🔄 Sincronizar con Hoja Principal', 'sincronizarConHojaPrincipal')
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
  // Tomar las primeras líneas para analizar
  const primerasLineas = texto.split('\n').slice(0, 5).join('\n');

  // Contar ocurrencias de cada separador (fuera de comillas)
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

  // Retornar el separador más común
  Logger.log(`Detectados - Comas: ${comas}, Puntos y coma: ${puntosComa}`);
  return puntosComa > comas ? ';' : ',';
}

/**
 * Parsea CSV correctamente manejando campos con comillas y separadores
 */
function parsearCSV(texto, separador) {
  // Si no se especifica separador, detectarlo automáticamente
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
        // Comillas dobles escapadas
        campoActual += '"';
        i++; // Saltar la siguiente comilla
      } else {
        // Alternar estado de comillas
        dentroDeComillas = !dentroDeComillas;
      }
    } else if (char === separador && !dentroDeComillas) {
      // Fin de campo
      filaActual.push(campoActual.trim());
      campoActual = '';
    } else if ((char === '\n' || char === '\r') && !dentroDeComillas) {
      // Fin de fila
      if (char === '\r' && siguiente === '\n') {
        i++; // Saltar \n en \r\n
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
      // Agregar carácter al campo actual
      campoActual += char;
    }
  }

  // Agregar última fila si existe
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
    // Agregar columnas vacías si faltan
    while (datos[i].length < numColumnas) {
      datos[i].push('');
    }
    // Recortar si hay más columnas
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

    // Mostrar mensaje de carga
    ui.alert('Importando datos', 'Por favor espera mientras se descargan los datos...', ui.ButtonSet.OK);

    // Descargar CSV
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

    // Detectar separador
    const separador = detectarSeparador(csv);
    Logger.log(`Separador detectado: "${separador}"`);

    // Parsear CSV
    let datos;
    try {
      // Intentar con Utilities.parseCsv si usa coma
      if (separador === ',') {
        datos = Utilities.parseCsv(csv);
        Logger.log('Usando Utilities.parseCsv (coma)');
      } else {
        // Usar parser personalizado para punto y coma
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

    // Normalizar datos
    datos = normalizarDatos(datos);

    Logger.log(`Datos parseados: ${datos.length} filas, ${datos[0].length} columnas`);

    // Obtener o crear la hoja
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = spreadsheet.getSheetByName("DatosKobo");

    if (!hoja) {
      hoja = spreadsheet.insertSheet("DatosKobo");
    }

    // Limpiar hoja
    hoja.clear();

    // Escribir datos
    const numFilas = datos.length;
    const numColumnas = datos[0].length;

    hoja.getRange(1, 1, numFilas, numColumnas).setValues(datos);

    // Formatear encabezado
    const rangoEncabezado = hoja.getRange(1, 1, 1, numColumnas);
    rangoEncabezado.setFontWeight('bold');
    rangoEncabezado.setBackground('#4285f4');
    rangoEncabezado.setFontColor('#ffffff');
    rangoEncabezado.setWrap(true);
    rangoEncabezado.setVerticalAlignment('middle');

    // Ajustar altura de encabezado
    hoja.setRowHeight(1, 60);

    // Autoajustar columnas con límites
    for (let i = 1; i <= numColumnas; i++) {
      hoja.autoResizeColumn(i);
      const anchoActual = hoja.getColumnWidth(i);

      // Establecer ancho mínimo de 100px y máximo de 300px
      if (anchoActual < 100) {
        hoja.setColumnWidth(i, 100);
      } else if (anchoActual > 300) {
        hoja.setColumnWidth(i, 300);
      }
    }

    // Congelar primera fila
    hoja.setFrozenRows(1);

    // Activar la hoja
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

    // Preguntar nombre de hoja destino
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

    // Crear o limpiar hoja destino
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

    // Copiar datos
    const numFilas = datosOrigen.length;
    const numColumnas = datosOrigen[0].length;

    hojaDestino.getRange(1, 1, numFilas, numColumnas).setValues(datosOrigen);

    // Formatear encabezado
    const encabezado = hojaDestino.getRange(1, 1, 1, numColumnas);
    encabezado.setFontWeight('bold');
    encabezado.setBackground('#34A853');
    encabezado.setFontColor('#ffffff');
    encabezado.setWrap(true);

    // Ajustar columnas
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

    // Mostrar columnas
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

    // Parsear columnas
    const columnasTexto = respuesta.getResponseText().trim();
    const columnasSeleccionadas = columnasTexto.split(',').map(num => parseInt(num.trim()) - 1);

    // Validar
    if (columnasSeleccionadas.some(col => isNaN(col) || col < 0 || col >= encabezados.length)) {
      ui.alert('Error', 'Columnas inválidas. Verifica los números.', ui.ButtonSet.OK);
      return;
    }

    // Preguntar nombre de hoja
    const respuestaNombre = ui.prompt(
      'Nombre de hoja',
      'Ingresa el nombre de la nueva hoja:',
      ui.ButtonSet.OK_CANCEL
    );

    if (respuestaNombre.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    const nombreHoja = respuestaNombre.getResponseText().trim();

    // Crear hoja
    let hojaDestino = spreadsheet.getSheetByName(nombreHoja);

    if (hojaDestino) {
      hojaDestino.clear();
    } else {
      hojaDestino = spreadsheet.insertSheet(nombreHoja);
    }

    // Extraer columnas seleccionadas
    const datosNuevos = datosOrigen.map(fila =>
      columnasSeleccionadas.map(idx => fila[idx])
    );

    // Escribir datos
    hojaDestino.getRange(1, 1, datosNuevos.length, datosNuevos[0].length).setValues(datosNuevos);

    // Formatear
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
 * Esta función se usa para triggers automáticos
 */
function actualizarDatosAutomatico() {
  try {
    // Descargar CSV
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

    // Detectar separador y parsear
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

    // Normalizar datos
    datos = normalizarDatos(datos);

    // Obtener o crear la hoja
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = spreadsheet.getSheetByName("DatosKobo");

    if (!hoja) {
      hoja = spreadsheet.insertSheet("DatosKobo");
    }

    // Limpiar y escribir datos
    hoja.clear();
    const numFilas = datos.length;
    const numColumnas = datos[0].length;

    hoja.getRange(1, 1, numFilas, numColumnas).setValues(datos);

    // Formatear encabezado
    const rangoEncabezado = hoja.getRange(1, 1, 1, numColumnas);
    rangoEncabezado.setFontWeight('bold');
    rangoEncabezado.setBackground('#4285f4');
    rangoEncabezado.setFontColor('#ffffff');
    rangoEncabezado.setWrap(true);
    rangoEncabezado.setVerticalAlignment('middle');

    hoja.setRowHeight(1, 60);

    // Autoajustar columnas
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

    // Registrar última actualización
    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_ACTUALIZACION', new Date().toLocaleString('es-ES'));

    Logger.log(`Datos actualizados: ${numFilas - 1} registros`);

  } catch (error) {
    Logger.log('Error en actualización automática: ' + error.message);
  }
}

/**
 * Configura la actualización automática
 */
function configurarActualizacionAutomatica() {
  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.prompt(
    'Configurar Actualización Automática',
    '¿Cada cuántas horas deseas actualizar los datos?\n\n' +
    'Opciones recomendadas:\n' +
    '1 = Cada hora\n' +
    '6 = Cada 6 horas\n' +
    '12 = Cada 12 horas\n' +
    '24 = Una vez al día\n\n' +
    'Ingresa el número de horas:',
    ui.ButtonSet.OK_CANCEL
  );

  if (respuesta.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const horas = parseInt(respuesta.getResponseText().trim());

  if (isNaN(horas) || horas < 1 || horas > 24) {
    ui.alert('Error', 'Por favor ingresa un número válido entre 1 y 24', ui.ButtonSet.OK);
    return;
  }

  try {
    // Eliminar triggers existentes
    const triggers = ScriptApp.getProjectTriggers();
    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'actualizarDatosAutomatico') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Crear nuevo trigger
    ScriptApp.newTrigger('actualizarDatosAutomatico')
      .timeBased()
      .everyHours(horas)
      .create();

    ui.alert(
      '✅ Activado',
      `Los datos se actualizarán automáticamente cada ${horas} hora(s).\n\n` +
      `Próxima actualización: dentro de ${horas} hora(s)`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('❌ Error', 'Error al configurar actualización: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * Desactiva la actualización automática
 */
function desactivarActualizacionAutomatica() {
  const ui = SpreadsheetApp.getUi();

  try {
    const triggers = ScriptApp.getProjectTriggers();
    let eliminados = 0;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'actualizarDatosAutomatico') {
        ScriptApp.deleteTrigger(trigger);
        eliminados++;
      }
    }

    if (eliminados > 0) {
      ui.alert('✅ Desactivado', 'La actualización automática ha sido desactivada', ui.ButtonSet.OK);
    } else {
      ui.alert('ℹ️ Información', 'No había ninguna actualización automática activa', ui.ButtonSet.OK);
    }

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Muestra el estado de la actualización automática
 */
function verEstadoActualizacion() {
  const ui = SpreadsheetApp.getUi();

  try {
    const triggers = ScriptApp.getProjectTriggers();
    let triggerActivo = null;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'actualizarDatosAutomatico') {
        triggerActivo = trigger;
        break;
      }
    }

    const propiedades = PropertiesService.getScriptProperties();
    const ultimaActualizacion = propiedades.getProperty('ULTIMA_ACTUALIZACION') || 'Nunca';

    let mensaje = `Última actualización: ${ultimaActualizacion}\n\n`;

    if (triggerActivo) {
      const tipo = triggerActivo.getEventType();
      mensaje += '✅ Estado: ACTIVO\n\n';
      mensaje += 'La hoja se actualiza automáticamente según el intervalo configurado.';
    } else {
      mensaje += '⚠️ Estado: INACTIVO\n\n';
      mensaje += 'Para activar la actualización automática, ve a:\n';
      mensaje += 'KoboToolbox > ⚙️ Configurar > Activar Actualización Automática';
    }

    ui.alert('Estado de Actualización', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}


/**
 * Sincroniza datos de DatosKobo con la hoja principal en archivo externo
 * Solo agrega filas nuevas y columnas que coinciden (las demás se ignoran)
 */
function sincronizarConHojaPrincipal() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheetLocal = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // Acceder al archivo externo de Google Sheets
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID);
    const hojaPrincipal = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE);

    if (!hojaPrincipal) {
      ui.alert('❌ Error', `No se encontró la hoja "${HOJA_DESTINO_NOMBRE}" en el archivo destino.`, ui.ButtonSet.OK);
      return;
    }

    // Obtener hoja de origen (local)
    const hojaOrigen = spreadsheetLocal.getSheetByName("DatosKobo");

    if (!hojaOrigen) {
      ui.alert('❌ Error', 'No se encontró la hoja "DatosKobo". Primero importa los datos.', ui.ButtonSet.OK);
      return;
    }

    // Obtener datos
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

    // Encabezados
    const encabezadosOrigen = datosOrigen[0];
    const encabezadosPrincipal = datosPrincipal[0];

    // Encontrar columnas coincidentes (solo mapear las que existen en destino)
    const mapeoColumnas = [];
    const columnasIgnoradas = [];

    for (let i = 0; i < encabezadosOrigen.length; i++) {
      const columnaOrigen = encabezadosOrigen[i].toString().trim();
      const indicePrincipal = encabezadosPrincipal.findIndex(col =>
        col.toString().trim().toLowerCase() === columnaOrigen.toLowerCase()
      );

      if (indicePrincipal >= 0) {
        mapeoColumnas.push({ origen: i, principal: indicePrincipal, nombre: columnaOrigen });
      } else {
        columnasIgnoradas.push(columnaOrigen);
      }
    }

    Logger.log(`Columnas coincidentes: ${mapeoColumnas.length}`);
    Logger.log(`Columnas ignoradas: ${columnasIgnoradas.length}`);

    // Detectar filas nuevas (usar primeras 3 columnas como identificador)
    const datosExistentes = new Set();

    for (let i = 1; i < datosPrincipal.length; i++) {
      // Crear un identificador único combinando las primeras 3 columnas
      const id = datosPrincipal[i].slice(0, 3).join('|');
      datosExistentes.add(id);
    }

    // Filtrar solo filas nuevas
    const filasNuevas = [];

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];
      const id = filaOrigen.slice(0, 3).join('|');

      if (!datosExistentes.has(id)) {
        // Crear fila con datos mapeados (solo columnas que existen en destino)
        const nuevaFila = new Array(encabezadosPrincipal.length).fill('');

        mapeoColumnas.forEach(mapeo => {
          nuevaFila[mapeo.principal] = filaOrigen[mapeo.origen] || '';
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

    // Agregar filas nuevas al final
    const ultimaFila = hojaPrincipal.getLastRow();
    hojaPrincipal.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosPrincipal.length).setValues(filasNuevas);

    // Registrar sincronización
    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', filasNuevas.length.toString());

    let mensaje = `Se agregaron ${filasNuevas.length} filas nuevas a "${HOJA_DESTINO_NOMBRE}"\n\n`;
    mensaje += `Columnas sincronizadas: ${mapeoColumnas.length}`;

    if (columnasIgnoradas.length > 0) {
      mensaje += `\n\n⚠️ Columnas ignoradas: ${columnasIgnoradas.length}\n`;
      mensaje += `(Solo se sincronizan columnas que ya existen en la hoja destino)`;
    }

    ui.alert('✅ Sincronización exitosa', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', 'Error al sincronizar: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.stack);
  }
}

/**
 * Función de sincronización automática (silenciosa)
 * Sincroniza con archivo externo de Google Sheets
 */
function sincronizarAutomatico() {
  try {
    // Primero actualizar DatosKobo
    actualizarDatosAutomatico();

    // Esperar un segundo
    Utilities.sleep(1000);

    // Acceder al archivo externo de Google Sheets
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_DESTINO_ID);
    const hojaPrincipal = spreadsheetDestino.getSheetByName(HOJA_DESTINO_NOMBRE);

    if (!hojaPrincipal) {
      Logger.log(`No se encontró la hoja "${HOJA_DESTINO_NOMBRE}" en el archivo destino`);
      return;
    }

    // Obtener hoja de origen (local)
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

    // Mapear solo columnas que existen en destino (ignorar nuevas)
    const mapeoColumnas = [];
    const columnasIgnoradas = [];

    for (let i = 0; i < encabezadosOrigen.length; i++) {
      const columnaOrigen = encabezadosOrigen[i].toString().trim();
      const indicePrincipal = encabezadosPrincipal.findIndex(col =>
        col.toString().trim().toLowerCase() === columnaOrigen.toLowerCase()
      );

      if (indicePrincipal >= 0) {
        mapeoColumnas.push({ origen: i, principal: indicePrincipal });
      } else {
        columnasIgnoradas.push(columnaOrigen);
      }
    }

    Logger.log(`Columnas mapeadas: ${mapeoColumnas.length}, Columnas ignoradas: ${columnasIgnoradas.length}`);

    // Detectar filas nuevas
    const datosExistentes = new Set();

    for (let i = 1; i < datosPrincipal.length; i++) {
      const id = datosPrincipal[i].slice(0, 3).join('|');
      datosExistentes.add(id);
    }

    const filasNuevas = [];

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];
      const id = filaOrigen.slice(0, 3).join('|');

      if (!datosExistentes.has(id)) {
        const nuevaFila = new Array(encabezadosPrincipal.length).fill('');

        mapeoColumnas.forEach(mapeo => {
          nuevaFila[mapeo.principal] = filaOrigen[mapeo.origen] || '';
        });

        filasNuevas.push(nuevaFila);
      }
    }

    if (filasNuevas.length > 0) {
      const ultimaFila = hojaPrincipal.getLastRow();
      hojaPrincipal.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosPrincipal.length).setValues(filasNuevas);

      const propiedades = PropertiesService.getScriptProperties();
      propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
      propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', filasNuevas.length.toString());

      Logger.log(`Sincronización automática: ${filasNuevas.length} filas nuevas agregadas`);
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
    '¿Cada cuántas horas deseas sincronizar los datos?\n\n' +
    'Recomendaciones:\n' +
    '1 = Cada hora (muy frecuente)\n' +
    '6 = Cada 6 horas (recomendado)\n' +
    '12 = Cada 12 horas\n' +
    '24 = Una vez al día\n\n' +
    'Ingresa el número de horas:',
    ui.ButtonSet.OK_CANCEL
  );

  if (respuesta.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const horas = parseInt(respuesta.getResponseText().trim());

  if (isNaN(horas) || horas < 1 || horas > 24) {
    ui.alert('❌ Error', 'Ingresa un número válido entre 1 y 24', ui.ButtonSet.OK);
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
      .everyHours(horas)
      .create();

    ui.alert(
      '✅ Sincronización Activada',
      `Los datos se sincronizarán automáticamente cada ${horas} hora(s) con "${HOJA_DESTINO_NOMBRE}".\n\n` +
      `✓ Solo se agregarán datos NUEVOS\n` +
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

    let mensaje = `Hoja de destino: "${HOJA_DESTINO_NOMBRE}"\n`;
    mensaje += `Archivo destino ID: ${SPREADSHEET_DESTINO_ID}\n\n`;
    mensaje += `Última sincronización: ${ultimaSincronizacion}\n`;
    mensaje += `Filas agregadas: ${ultimasFilas}\n\n`;

    if (triggerActivo) {
      mensaje += '✅ Estado: ACTIVA\n\n';
      mensaje += 'La sincronización automática está funcionando.';
    } else {
      mensaje += '⚠️ Estado: INACTIVA\n\n';
      mensaje += 'Para activar:\nKoboToolbox > ⚙️ Configurar > Activar Sincronización Automática';
    }

    ui.alert('Estado de Sincronización', mensaje, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}
