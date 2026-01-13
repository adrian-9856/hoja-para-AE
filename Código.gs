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

// ============ CONFIGURACIÓN PARA INTERVENCIÓN DE CASOS ============
// URL de exportación de KoboToolbox para Intervención de Casos
const KOBO_INTERVENCION_URL = "REEMPLAZAR_CON_URL_REAL";

// ID del archivo de Google Sheets para Intervención de Casos (puede ser el mismo documento)
const SPREADSHEET_INTERVENCION_ID = "REEMPLAZAR_CON_ID_REAL";

// Nombre de la hoja de destino para Intervención de Casos
const HOJA_INTERVENCION_NOMBRE = "Intervención de casos";

/**
 * Crea el menú personalizado al abrir la hoja
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // Menú para Lista de Espera
  ui.createMenu('📋 Lista de Espera')
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

  // Menú para Intervención de Casos
  ui.createMenu('🎯 Intervención de Casos')
    .addItem('🔄 Sincronizar Datos 2026', 'sincronizarIntervencionCasos')
    .addItem('📤 Sincronización Inicial 2026', 'sincronizacionInicialIntervencion')
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Configurar')
      .addItem('Activar Sincronización Automática', 'activarSincronizacionIntervencion')
      .addItem('Desactivar Sincronización Automática', 'desactivarSincronizacionIntervencion')
      .addItem('Ver Estado de Sincronización', 'verEstadoSincronizacionIntervencion'))
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
 * Función auxiliar para mapear columnas con reglas especiales
 * Maneja casos como combinar Nombres+Apellidos -> Nombre Completo
 */
function mapearColumnasConReglas(encabezadosOrigen, encabezadosPrincipal) {
  const mapeoColumnas = [];
  const columnasIgnoradas = [];
  const columnasEspeciales = [];

  // Buscar índices de columnas especiales en origen
  const indiceNombres = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'nombres'
  );
  const indiceApellidos = encabezadosOrigen.findIndex(col =>
    col.toString().trim().toLowerCase() === 'apellidos'
  );

  // Buscar índice de Nombre Completo en destino
  const indiceNombreCompleto = encabezadosPrincipal.findIndex(col =>
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
    'programa de creamos': 'programa de creamos / organización',
    'nombre de quien deriva': 'nombre de quien deriva o refiere',
    'derivación o referencia': 'derivación o referencia',
    'motivo de derivación u referencia': 'motivo de derivación u referencia',
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
    let indicePrincipal = encabezadosPrincipal.findIndex(col =>
      col.toString().trim().toLowerCase() === columnaOrigen
    );

    // Si no hay coincidencia exacta, buscar en mapeos flexibles
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

    // Usar mapeo inteligente con reglas especiales
    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasConReglas(encabezadosOrigen, encabezadosPrincipal);

    Logger.log(`Columnas mapeadas: ${mapeoColumnas.length}`);
    Logger.log(`Columnas especiales: ${columnasEspeciales.length}`);
    Logger.log(`Columnas ignoradas: ${columnasIgnoradas.length}`);

    // Log detallado del mapeo
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

    // Detectar filas nuevas (usar teléfono como identificador único)
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

    // Filtrar solo filas nuevas
    const filasNuevas = [];
    const indiceTelefonoOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      // Verificar si es fila nueva usando teléfono
      const telefono = indiceTelefonoOrigen >= 0 ? filaOrigen[indiceTelefonoOrigen] : '';
      const esNueva = !telefono || !datosExistentes.has(telefono.toString().trim());

      if (esNueva) {
        // Crear fila con datos mapeados
        const nuevaFila = new Array(encabezadosPrincipal.length).fill('');

        // Mapear columnas normales
        mapeoColumnas.forEach(mapeo => {
          nuevaFila[mapeo.principal] = filaOrigen[mapeo.origen] || '';
        });

        // Aplicar mapeos especiales (combinar Nombres + Apellidos)
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

    // Agregar filas nuevas al final
    const ultimaFila = hojaPrincipal.getLastRow();
    hojaPrincipal.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosPrincipal.length).setValues(filasNuevas);

    // Registrar sincronización
    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', filasNuevas.length.toString());

    let mensaje = `Se agregaron ${filasNuevas.length} filas nuevas a "${HOJA_DESTINO_NOMBRE}"\n\n`;
    mensaje += `✓ Columnas mapeadas: ${mapeoColumnas.length}\n`;
    mensaje += `✓ Columnas especiales: ${columnasEspeciales.length}\n`;

    // Mostrar mapeos especiales
    if (columnasEspeciales.length > 0) {
      mensaje += `\n📋 Mapeos especiales:\n`;
      columnasEspeciales.forEach(e => {
        mensaje += `  • ${e.nombre}\n`;
      });
    }

    if (columnasIgnoradas.length > 0) {
      mensaje += `\n⚠️ Columnas ignoradas: ${columnasIgnoradas.length}\n`;
      mensaje += `(Estas columnas no existen en "Lista de Espera")\n`;
      // Mostrar primeras 5 columnas ignoradas
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
 * Sincronización inicial - Envía TODOS los datos sin verificar duplicados
 * Usar solo la primera vez para sincronizar datos existentes
 */
function sincronizacionInicial() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheetLocal = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // Confirmar con el usuario
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

    if (datosOrigen.length === 0 || datosOrigen.length === 1) {
      ui.alert('❌ Error', 'La hoja "DatosKobo" está vacía o solo tiene encabezados.', ui.ButtonSet.OK);
      return;
    }

    if (datosPrincipal.length === 0) {
      ui.alert('❌ Error', `La hoja "${HOJA_DESTINO_NOMBRE}" está vacía. Debe tener al menos los encabezados.`, ui.ButtonSet.OK);
      return;
    }

    // Encabezados
    const encabezadosOrigen = datosOrigen[0];
    const encabezadosPrincipal = datosPrincipal[0];

    // Usar mapeo inteligente con reglas especiales
    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasConReglas(encabezadosOrigen, encabezadosPrincipal);

    Logger.log(`Columnas mapeadas: ${mapeoColumnas.length}`);
    Logger.log(`Columnas especiales: ${columnasEspeciales.length}`);
    Logger.log(`Columnas ignoradas: ${columnasIgnoradas.length}`);

    // Log detallado del mapeo
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

    // Enviar TODAS las filas (sin verificar duplicados)
    const todasLasFilas = [];

    for (let i = 1; i < datosOrigen.length; i++) {
      const filaOrigen = datosOrigen[i];

      // Crear fila con datos mapeados
      const nuevaFila = new Array(encabezadosPrincipal.length).fill('');

      // Mapear columnas normales
      mapeoColumnas.forEach(mapeo => {
        nuevaFila[mapeo.principal] = filaOrigen[mapeo.origen] || '';
      });

      // Aplicar mapeos especiales (combinar Nombres + Apellidos)
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

    // Agregar todas las filas al final
    const ultimaFila = hojaPrincipal.getLastRow();
    hojaPrincipal.getRange(ultimaFila + 1, 1, todasLasFilas.length, encabezadosPrincipal.length).setValues(todasLasFilas);

    // Registrar sincronización
    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_FILAS', todasLasFilas.length.toString());

    let mensaje = `✅ Se enviaron ${todasLasFilas.length} filas a "${HOJA_DESTINO_NOMBRE}"\n\n`;
    mensaje += `✓ Columnas mapeadas: ${mapeoColumnas.length}\n`;
    mensaje += `✓ Columnas especiales: ${columnasEspeciales.length}\n`;

    // Mostrar mapeos especiales
    if (columnasEspeciales.length > 0) {
      mensaje += `\n📋 Mapeos especiales:\n`;
      columnasEspeciales.forEach(e => {
        mensaje += `  • ${e.nombre}\n`;
      });
    }

    if (columnasIgnoradas.length > 0) {
      mensaje += `\n⚠️ Columnas ignoradas: ${columnasIgnoradas.length}\n`;
      mensaje += `(Estas columnas no existen en "Lista de Espera")\n`;
      // Mostrar primeras 5 columnas ignoradas
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

    // Usar mapeo inteligente con reglas especiales
    const { mapeoColumnas, columnasEspeciales, columnasIgnoradas } =
      mapearColumnasConReglas(encabezadosOrigen, encabezadosPrincipal);

    Logger.log(`Columnas mapeadas: ${mapeoColumnas.length}, Columnas especiales: ${columnasEspeciales.length}, Columnas ignoradas: ${columnasIgnoradas.length}`);

    // Detectar filas nuevas (usar teléfono como identificador único)
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

      // Verificar si es fila nueva usando teléfono
      const telefono = indiceTelefonoOrigen >= 0 ? filaOrigen[indiceTelefonoOrigen] : '';
      const esNueva = !telefono || !datosExistentes.has(telefono.toString().trim());

      if (esNueva) {
        // Crear fila con datos mapeados
        const nuevaFila = new Array(encabezadosPrincipal.length).fill('');

        // Mapear columnas normales
        mapeoColumnas.forEach(mapeo => {
          nuevaFila[mapeo.principal] = filaOrigen[mapeo.origen] || '';
        });

        // Aplicar mapeos especiales (combinar Nombres + Apellidos)
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

  // Validar que sea 5, 10, 15 o 30 minutos
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

    // Crear nuevo trigger con sincronización por minutos
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


// ============================================================================
// FUNCIONES PARA INTERVENCIÓN DE CASOS (Solo datos 2026)
// ============================================================================

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
 */
function sincronizarIntervencionCasos() {
  const ui = SpreadsheetApp.getUi();

  try {
    // Descargar CSV de KoboToolbox
    const response = UrlFetchApp.fetch(KOBO_INTERVENCION_URL, {
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

    // Acceder al archivo destino
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_INTERVENCION_ID);
    const hojaDestino = spreadsheetDestino.getSheetByName(HOJA_INTERVENCION_NOMBRE);

    if (!hojaDestino) {
      ui.alert('❌ Error', `No se encontró la hoja "${HOJA_INTERVENCION_NOMBRE}"`, ui.ButtonSet.OK);
      return;
    }

    const datosDestino = hojaDestino.getDataRange().getValues();

    if (datosDestino.length === 0) {
      ui.alert('❌ Error', 'La hoja de destino está vacía', ui.ButtonSet.OK);
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
      ui.alert(
        'ℹ️ Sin datos nuevos',
        `No hay datos nuevos del 2026 para sincronizar.\n\n${registrosFiltrados} registros filtrados (no son del 2026)`,
        ui.ButtonSet.OK
      );
      return;
    }

    // Agregar filas nuevas
    const ultimaFila = hojaDestino.getLastRow();
    hojaDestino.getRange(ultimaFila + 1, 1, filasNuevas.length, encabezadosDestino.length).setValues(filasNuevas);

    // Registrar sincronización
    const propiedades = PropertiesService.getScriptProperties();
    propiedades.setProperty('ULTIMA_SINCRONIZACION_INTERVENCION', new Date().toLocaleString('es-ES'));
    propiedades.setProperty('ULTIMA_SINCRONIZACION_INTERVENCION_FILAS', filasNuevas.length.toString());

    ui.alert(
      '✅ Sincronización exitosa',
      `Se agregaron ${filasNuevas.length} registros del 2026 a "${HOJA_INTERVENCION_NOMBRE}"\n\n` +
      `${registrosFiltrados} registros filtrados (no son del 2026)`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('❌ Error', 'Error al sincronizar: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.stack);
  }
}

/**
 * Sincronización inicial de Intervención de Casos (solo 2026)
 */
function sincronizacionInicialIntervencion() {
  const ui = SpreadsheetApp.getUi();

  const confirmacion = ui.alert(
    '⚠️ Sincronización Inicial - Solo 2026',
    'Esto enviará TODOS los datos del 2026 a "Intervención de casos".\n\n¿Deseas continuar?',
    ui.ButtonSet.YES_NO
  );

  if (confirmacion !== ui.Button.YES) {
    return;
  }

  sincronizarIntervencionCasos();
}

/**
 * Sincronización automática de Intervención de Casos (silenciosa, solo 2026)
 */
function sincronizarAutomaticoIntervencion() {
  try {
    // Descargar CSV
    const response = UrlFetchApp.fetch(KOBO_INTERVENCION_URL, {
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
    const spreadsheetDestino = SpreadsheetApp.openById(SPREADSHEET_INTERVENCION_ID);
    const hojaDestino = spreadsheetDestino.getSheetByName(HOJA_INTERVENCION_NOMBRE);

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
      propiedades.setProperty('ULTIMA_SINCRONIZACION_INTERVENCION', new Date().toLocaleString('es-ES'));
      propiedades.setProperty('ULTIMA_SINCRONIZACION_INTERVENCION_FILAS', filasNuevas.length.toString());

      Logger.log(`Intervención de Casos: ${filasNuevas.length} registros nuevos del 2026`);
    } else {
      Logger.log('Intervención de Casos: sin datos nuevos del 2026');
    }

  } catch (error) {
    Logger.log('Error en sincronización automática de Intervención: ' + error.message);
  }
}

/**
 * Activa la sincronización automática para Intervención de Casos
 */
function activarSincronizacionIntervencion() {
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
      if (trigger.getHandlerFunction() === 'sincronizarAutomaticoIntervencion') {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Crear nuevo trigger
    ScriptApp.newTrigger('sincronizarAutomaticoIntervencion')
      .timeBased()
      .everyMinutes(minutos)
      .create();

    ui.alert(
      '✅ Sincronización Activada',
      `⚡ Los datos del 2026 se sincronizarán automáticamente cada ${minutos} minutos con "${HOJA_INTERVENCION_NOMBRE}".\n\n` +
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
 * Desactiva la sincronización automática de Intervención de Casos
 */
function desactivarSincronizacionIntervencion() {
  const ui = SpreadsheetApp.getUi();

  try {
    const triggers = ScriptApp.getProjectTriggers();
    let eliminados = 0;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sincronizarAutomaticoIntervencion') {
        ScriptApp.deleteTrigger(trigger);
        eliminados++;
      }
    }

    if (eliminados > 0) {
      ui.alert('✅ Desactivado', 'La sincronización automática de Intervención de Casos ha sido desactivada', ui.ButtonSet.OK);
    } else {
      ui.alert('ℹ️ Información', 'No había sincronización automática activa', ui.ButtonSet.OK);
    }

  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Muestra el estado de la sincronización de Intervención de Casos
 */
function verEstadoSincronizacionIntervencion() {
  const ui = SpreadsheetApp.getUi();

  try {
    const propiedades = PropertiesService.getScriptProperties();
    const ultimaSincronizacion = propiedades.getProperty('ULTIMA_SINCRONIZACION_INTERVENCION') || 'Nunca';
    const ultimasFilas = propiedades.getProperty('ULTIMA_SINCRONIZACION_INTERVENCION_FILAS') || '0';

    const triggers = ScriptApp.getProjectTriggers();
    let triggerActivo = null;

    for (let trigger of triggers) {
      if (trigger.getHandlerFunction() === 'sincronizarAutomaticoIntervencion') {
        triggerActivo = trigger;
        break;
      }
    }

    let mensaje = `📍 Hoja de destino: "${HOJA_INTERVENCION_NOMBRE}"\n`;
    mensaje += `📁 Archivo destino: ${SPREADSHEET_INTERVENCION_ID.substring(0, 20)}...\n`;
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
