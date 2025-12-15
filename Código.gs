/**
 * Script para importar datos CSV desde KoboToolbox a Google Sheets
 * Versión simplificada y optimizada
 */

// URL directa de exportación de KoboToolbox
const KOBO_EXPORT_URL = "https://kf.kobotoolbox.org/api/v2/assets/an6ckBVY2QRQPhTdKiEfcF/export-settings/esqz6vy4DwctQCtVEhsSZqw/data.csv";

/**
 * Crea el menú personalizado al abrir la hoja
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('KoboToolbox')
    .addItem('📥 Importar Datos', 'importarCSVdesdeKobo')
    .addSeparator()
    .addSubMenu(ui.createMenu('📤 Copiar a Otra Hoja')
      .addItem('Copiar Todos los Datos', 'enviarDatosAOtraHoja')
      .addItem('Copiar Columnas Específicas', 'copiarColumnasEspecificas'))
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
