/**
 * Script para importar datos CSV desde KoboToolbox a Google Sheets
 *
 * CONFIGURACIÓN:
 * La URL de exportación ya está configurada para acceso directo.
 * Solo necesitas usar el menú KoboToolbox > Importar Datos
 */

// URL directa de exportación de KoboToolbox (configurada para este proyecto)
const KOBO_EXPORT_URL = "https://kf.kobotoolbox.org/api/v2/assets/an6ckBVY2QRQPhTdKiEfcF/export-settings/esqz6vy4DwctQCtVEhsSZqw/data.csv";

/**
 * Función para configurar las credenciales de KoboToolbox
 * Ejecuta esta función una sola vez para guardar tu API Token y Asset ID
 */
function configurarCredenciales() {
  const ui = SpreadsheetApp.getUi();

  // Solicitar API Token
  const tokenResponse = ui.prompt(
    'Configuración de KoboToolbox',
    'Ingresa tu API Token de KoboToolbox (obtenerlo desde https://kf.kobotoolbox.org/token/):',
    ui.ButtonSet.OK_CANCEL
  );

  if (tokenResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Configuración cancelada');
    return;
  }

  const apiToken = tokenResponse.getResponseText().trim();

  // Solicitar Asset ID
  const assetResponse = ui.prompt(
    'Configuración de KoboToolbox',
    'Ingresa el ID de tu formulario (Asset ID):',
    ui.ButtonSet.OK_CANCEL
  );

  if (assetResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Configuración cancelada');
    return;
  }

  const assetId = assetResponse.getResponseText().trim();

  // Guardar en propiedades del script
  const propiedades = PropertiesService.getScriptProperties();
  propiedades.setProperty('KOBO_API_TOKEN', apiToken);
  propiedades.setProperty('KOBO_ASSET_ID', assetId);

  // Intentar obtener el export-settings ID automáticamente
  try {
    const exportSettingsId = obtenerExportSettingsId(apiToken, assetId);
    if (exportSettingsId) {
      propiedades.setProperty('KOBO_EXPORT_SETTINGS_ID', exportSettingsId);
      ui.alert('Configuración guardada correctamente. Export Settings ID obtenido automáticamente. Ahora puedes usar la función importarCSVdesdeKobo()');
    } else {
      ui.alert('Configuración guardada. No se pudo obtener Export Settings ID automáticamente. Puedes configurarlo manualmente con configurarExportSettings()');
    }
  } catch (error) {
    ui.alert('Configuración guardada. Puedes configurar Export Settings ID manualmente con configurarExportSettings()');
  }
}

/**
 * Función para configurar manualmente el Export Settings ID
 */
function configurarExportSettings() {
  const ui = SpreadsheetApp.getUi();

  const exportResponse = ui.prompt(
    'Configuración de Export Settings',
    'Ingresa el Export Settings ID (lo encuentras en la URL de export-settings):',
    ui.ButtonSet.OK_CANCEL
  );

  if (exportResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Configuración cancelada');
    return;
  }

  const exportSettingsId = exportResponse.getResponseText().trim();

  const propiedades = PropertiesService.getScriptProperties();
  propiedades.setProperty('KOBO_EXPORT_SETTINGS_ID', exportSettingsId);

  ui.alert('Export Settings ID guardado correctamente');
}

/**
 * Obtiene automáticamente el Export Settings ID desde la API
 */
function obtenerExportSettingsId(apiToken, assetId) {
  const url = `https://kf.kobotoolbox.org/api/v2/assets/${assetId}/export-settings/`;

  const opciones = {
    method: 'get',
    headers: {
      'Authorization': `Token ${apiToken}`
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, opciones);

  if (response.getResponseCode() === 200) {
    const data = JSON.parse(response.getContentText());
    // Buscar el primer export-settings que tenga data_url_csv
    if (data.results && data.results.length > 0) {
      for (let exportSetting of data.results) {
        if (exportSetting.data_url_csv) {
          return exportSetting.uid;
        }
      }
    }
  }

  return null;
}

/**
 * Importa datos CSV desde KoboToolbox a la hoja "DatosKobo"
 * Usa la URL directa de export-settings configurada
 */
function importarCSVdesdeKobo() {
  try {
    // Realizar la petición a la URL directa (no requiere autenticación)
    const response = UrlFetchApp.fetch(KOBO_EXPORT_URL, {
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();

    // Verificar el código de respuesta
    if (statusCode !== 200) {
      throw new Error(`Error al obtener datos de KoboToolbox (código ${statusCode}): ${response.getContentText()}`);
    }

    // Obtener el contenido CSV
    const csv = response.getContentText();

    // Parsear el CSV (KoboToolbox usa coma como separador por defecto)
    const datos = Utilities.parseCsv(csv);

    if (datos.length === 0) {
      SpreadsheetApp.getUi().alert('No se encontraron datos en el formulario de KoboToolbox');
      return;
    }

    // Obtener o crear la hoja de destino
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = spreadsheet.getSheetByName("DatosKobo");

    if (!hoja) {
      hoja = spreadsheet.insertSheet("DatosKobo");
    }

    // Limpiar contenido anterior
    hoja.clearContents();

    // Escribir los datos
    hoja.getRange(1, 1, datos.length, datos[0].length).setValues(datos);

    // Formatear la primera fila como encabezado
    const encabezado = hoja.getRange(1, 1, 1, datos[0].length);
    encabezado.setFontWeight('bold');
    encabezado.setBackground('#4285f4');
    encabezado.setFontColor('#ffffff');

    // Autoajustar columnas
    for (let i = 1; i <= datos[0].length; i++) {
      hoja.autoResizeColumn(i);
    }

    // Congelar la primera fila
    hoja.setFrozenRows(1);

    SpreadsheetApp.getUi().alert(`Importación exitosa: ${datos.length - 1} registros importados`);

  } catch (error) {
    SpreadsheetApp.getUi().alert('Error al importar datos: ' + error.message);
    Logger.log('Error detallado: ' + error.stack);
  }
}

/**
 * Importa datos usando un separador personalizado (para casos especiales)
 * @param {string} separador - El separador a usar (por defecto ',')
 */
function importarCSVconSeparadorPersonalizado(separador) {
  separador = separador || ';';

  try {
    const propiedades = PropertiesService.getScriptProperties();
    const apiToken = propiedades.getProperty('KOBO_API_TOKEN');
    const assetId = propiedades.getProperty('KOBO_ASSET_ID');
    const exportSettingsId = propiedades.getProperty('KOBO_EXPORT_SETTINGS_ID');

    if (!apiToken || !assetId) {
      throw new Error('Configuración no encontrada. Ejecuta configurarCredenciales() primero.');
    }

    let url;
    if (exportSettingsId) {
      url = `https://kf.kobotoolbox.org/api/v2/assets/${assetId}/export-settings/${exportSettingsId}/data.csv`;
    } else {
      url = `https://kf.kobotoolbox.org/api/v2/assets/${assetId}/data/?format=csv`;
    }

    const opciones = {
      method: 'get',
      headers: {
        'Authorization': `Token ${apiToken}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, opciones);

    if (response.getResponseCode() !== 200) {
      throw new Error(`Error ${response.getResponseCode()}: ${response.getContentText()}`);
    }

    const csv = response.getContentText();
    const datos = Utilities.parseCsv(csv, separador);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let hoja = spreadsheet.getSheetByName("DatosKobo");

    if (!hoja) {
      hoja = spreadsheet.insertSheet("DatosKobo");
    }

    hoja.clearContents();
    hoja.getRange(1, 1, datos.length, datos[0].length).setValues(datos);

    SpreadsheetApp.getUi().alert(`Importación exitosa con separador '${separador}': ${datos.length - 1} registros`);

  } catch (error) {
    SpreadsheetApp.getUi().alert('Error: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * Crea un menú personalizado en Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('KoboToolbox')
    .addItem('📥 Importar Datos', 'importarCSVdesdeKobo')
    .addSeparator()
    .addSubMenu(ui.createMenu('📤 Enviar a Otra Hoja')
      .addItem('Copiar Todos los Datos', 'enviarDatosAOtraHoja')
      .addItem('Copiar Columnas Específicas', 'copiarColumnasEspecificas'))
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Avanzado')
      .addItem('Configurar Credenciales (opcional)', 'configurarCredenciales')
      .addItem('Verificar Conexión', 'verificarConexion'))
    .addToUi();
}

/**
 * Función auxiliar para importar con punto y coma
 */
function importarConPuntoComa() {
  importarCSVconSeparadorPersonalizado(';');
}

/**
 * Envía/copia datos de DatosKobo a otra hoja
 */
function enviarDatosAOtraHoja() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // Verificar que existe la hoja DatosKobo
    const hojaOrigen = spreadsheet.getSheetByName("DatosKobo");

    if (!hojaOrigen) {
      ui.alert('Error', 'No se encontró la hoja "DatosKobo". Primero importa los datos.', ui.ButtonSet.OK);
      return;
    }

    // Obtener datos de la hoja origen
    const datosOrigen = hojaOrigen.getDataRange().getValues();

    if (datosOrigen.length === 0) {
      ui.alert('Error', 'La hoja "DatosKobo" está vacía.', ui.ButtonSet.OK);
      return;
    }

    // Preguntar el nombre de la hoja destino
    const respuesta = ui.prompt(
      'Enviar datos a otra hoja',
      'Ingresa el nombre de la hoja destino (se creará si no existe):',
      ui.ButtonSet.OK_CANCEL
    );

    if (respuesta.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    const nombreHojaDestino = respuesta.getResponseText().trim();

    if (!nombreHojaDestino) {
      ui.alert('Error', 'Debes ingresar un nombre válido para la hoja.', ui.ButtonSet.OK);
      return;
    }

    // Obtener o crear la hoja destino
    let hojaDestino = spreadsheet.getSheetByName(nombreHojaDestino);

    if (!hojaDestino) {
      hojaDestino = spreadsheet.insertSheet(nombreHojaDestino);
    }

    // Preguntar si desea limpiar o agregar
    const tipoEnvio = ui.alert(
      'Tipo de envío',
      '¿Deseas REEMPLAZAR los datos existentes o AGREGAR al final?',
      ui.ButtonSet.YES_NO_CANCEL
    );

    let filaInicio = 1;

    if (tipoEnvio === ui.Button.YES) {
      // Reemplazar - limpiar hoja
      hojaDestino.clearContents();
    } else if (tipoEnvio === ui.Button.NO) {
      // Agregar - encontrar última fila
      filaInicio = hojaDestino.getLastRow() + 1;

      // Si la hoja está vacía o solo tiene encabezados, incluir encabezados
      if (filaInicio === 1) {
        // Incluir encabezados
      } else {
        // No incluir encabezados, solo datos
        const datosSinEncabezado = datosOrigen.slice(1);
        hojaDestino.getRange(filaInicio, 1, datosSinEncabezado.length, datosSinEncabezado[0].length).setValues(datosSinEncabezado);

        ui.alert('Éxito', `${datosSinEncabezado.length} filas agregadas a "${nombreHojaDestino}"`, ui.ButtonSet.OK);
        return;
      }
    } else {
      return; // Cancelado
    }

    // Escribir los datos
    hojaDestino.getRange(filaInicio, 1, datosOrigen.length, datosOrigen[0].length).setValues(datosOrigen);

    // Formatear encabezado si es la primera fila
    if (filaInicio === 1) {
      const encabezado = hojaDestino.getRange(1, 1, 1, datosOrigen[0].length);
      encabezado.setFontWeight('bold');
      encabezado.setBackground('#34A853');
      encabezado.setFontColor('#ffffff');

      // Autoajustar columnas
      for (let i = 1; i <= datosOrigen[0].length; i++) {
        hojaDestino.autoResizeColumn(i);
      }

      hojaDestino.setFrozenRows(1);
    }

    ui.alert('Éxito', `${datosOrigen.length - 1} filas copiadas a "${nombreHojaDestino}"`, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('Error', 'Error al enviar datos: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error detallado: ' + error.stack);
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

    // Mostrar columnas disponibles
    const encabezados = datosOrigen[0];
    let mensaje = 'Columnas disponibles:\n\n';
    encabezados.forEach((col, index) => {
      mensaje += `${index + 1}. ${col}\n`;
    });

    const respuesta = ui.prompt(
      'Seleccionar columnas',
      mensaje + '\nIngresa los números de columnas separados por comas (ej: 1,3,5):',
      ui.ButtonSet.OK_CANCEL
    );

    if (respuesta.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    // Parsear columnas seleccionadas
    const columnasTexto = respuesta.getResponseText().trim();
    const columnasSeleccionadas = columnasTexto.split(',').map(num => parseInt(num.trim()) - 1);

    // Validar columnas
    if (columnasSeleccionadas.some(col => col < 0 || col >= encabezados.length || isNaN(col))) {
      ui.alert('Error', 'Columnas inválidas. Verifica los números ingresados.', ui.ButtonSet.OK);
      return;
    }

    // Preguntar nombre de hoja destino
    const respuestaNombre = ui.prompt(
      'Nombre de hoja destino',
      'Ingresa el nombre de la hoja destino:',
      ui.ButtonSet.OK_CANCEL
    );

    if (respuestaNombre.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    const nombreHojaDestino = respuestaNombre.getResponseText().trim();

    // Crear o obtener hoja destino
    let hojaDestino = spreadsheet.getSheetByName(nombreHojaDestino);

    if (!hojaDestino) {
      hojaDestino = spreadsheet.insertSheet(nombreHojaDestino);
    } else {
      hojaDestino.clearContents();
    }

    // Extraer solo las columnas seleccionadas
    const datosNuevos = datosOrigen.map(fila => {
      return columnasSeleccionadas.map(colIndex => fila[colIndex]);
    });

    // Escribir datos
    hojaDestino.getRange(1, 1, datosNuevos.length, datosNuevos[0].length).setValues(datosNuevos);

    // Formatear encabezado
    const encabezado = hojaDestino.getRange(1, 1, 1, datosNuevos[0].length);
    encabezado.setFontWeight('bold');
    encabezado.setBackground('#34A853');
    encabezado.setFontColor('#ffffff');

    for (let i = 1; i <= datosNuevos[0].length; i++) {
      hojaDestino.autoResizeColumn(i);
    }

    hojaDestino.setFrozenRows(1);

    ui.alert('Éxito', `${datosNuevos[0].length} columnas copiadas a "${nombreHojaDestino}"`, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('Error', error.message, ui.ButtonSet.OK);
    Logger.log('Error: ' + error.stack);
  }
}

/**
 * Función para verificar la conexión con KoboToolbox
 */
function verificarConexion() {
  try {
    const propiedades = PropertiesService.getScriptProperties();
    const apiToken = propiedades.getProperty('KOBO_API_TOKEN');
    const assetId = propiedades.getProperty('KOBO_ASSET_ID');

    if (!apiToken || !assetId) {
      SpreadsheetApp.getUi().alert('No hay credenciales configuradas');
      return;
    }

    const url = `https://kf.kobotoolbox.org/api/v2/assets/${assetId}/`;

    const opciones = {
      method: 'get',
      headers: {
        'Authorization': `Token ${apiToken}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, opciones);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      const data = JSON.parse(response.getContentText());
      SpreadsheetApp.getUi().alert(
        'Conexión exitosa',
        `Formulario: ${data.name}\nRespuestas: ${data.deployment__submission_count}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      SpreadsheetApp.getUi().alert(`Error ${statusCode}: ${response.getContentText()}`);
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert('Error: ' + error.message);
  }
}
