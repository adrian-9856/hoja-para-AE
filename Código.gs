/**
 * Script para importar datos CSV desde KoboToolbox a Google Sheets
 *
 * CONFIGURACIÓN NECESARIA:
 * 1. Obtén tu API Token desde: https://kf.kobotoolbox.org/token/
 * 2. Configura las propiedades del script con tu token y asset ID
 * 3. Ejecuta configurarCredenciales() una vez para guardar la configuración
 */

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

  ui.alert('Configuración guardada correctamente. Ahora puedes usar la función importarCSVdesdeKobo()');
}

/**
 * Importa datos CSV desde KoboToolbox a la hoja "DatosKobo"
 * Usa la API v2 de KoboToolbox con autenticación
 */
function importarCSVdesdeKobo() {
  try {
    // Obtener credenciales guardadas
    const propiedades = PropertiesService.getScriptProperties();
    const apiToken = propiedades.getProperty('KOBO_API_TOKEN');
    const assetId = propiedades.getProperty('KOBO_ASSET_ID');

    // Validar que existan las credenciales
    if (!apiToken || !assetId) {
      SpreadsheetApp.getUi().alert(
        'Error de configuración',
        'Por favor ejecuta primero la función "configurarCredenciales" para configurar tu API Token y Asset ID.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    // Construir la URL de la API de KoboToolbox
    const url = `https://kf.kobotoolbox.org/api/v2/assets/${assetId}/data.csv`;

    // Configurar la petición con autenticación
    const opciones = {
      method: 'get',
      headers: {
        'Authorization': `Token ${apiToken}`
      },
      muteHttpExceptions: true
    };

    // Realizar la petición
    const response = UrlFetchApp.fetch(url, opciones);
    const statusCode = response.getResponseCode();

    // Verificar el código de respuesta
    if (statusCode !== 200) {
      throw new Error(`Error en la API de KoboToolbox (código ${statusCode}): ${response.getContentText()}`);
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

    if (!apiToken || !assetId) {
      throw new Error('Configuración no encontrada. Ejecuta configurarCredenciales() primero.');
    }

    const url = `https://kf.kobotoolbox.org/api/v2/assets/${assetId}/data.csv`;

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
    .addItem('Configurar Credenciales', 'configurarCredenciales')
    .addItem('Importar Datos', 'importarCSVdesdeKobo')
    .addSeparator()
    .addItem('Importar con separador ;', 'importarConPuntoComa')
    .addToUi();
}

/**
 * Función auxiliar para importar con punto y coma
 */
function importarConPuntoComa() {
  importarCSVconSeparadorPersonalizado(';');
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
