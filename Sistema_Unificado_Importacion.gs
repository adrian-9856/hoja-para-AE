/**
 * =====================================================================
 * SISTEMA UNIFICADO DE IMPORTACIÓN - KOBOTOOLBOX → LISTA DE ESPERA
 * =====================================================================
 *
 * Este sistema REEMPLAZA los 3 códigos separados con UNO SOLO que:
 * ✅ Importa desde TODOS los formularios de KoboToolbox
 * ✅ Detecta duplicados de forma centralizada
 * ✅ Mapea automáticamente las columnas
 * ✅ Envía TODO a Lista de Espera de forma unificada
 * ✅ Es más fácil de mantener
 *
 * FORMULARIOS SOPORTADOS:
 * 1. Derivaciones (Lista de Espera)
 * 2. Derivaciones de Programas
 * 3. Formulario de Bienestar
 *
 * =====================================================================
 */

// =====================================================================
// CONFIGURACIÓN DE FORMULARIOS
// =====================================================================

/**
 * Configuración de todos los formularios de KoboToolbox
 * Agregar aquí cualquier formulario nuevo
 */
const FORMULARIOS_KOBO = {
  derivaciones: {
    nombre: 'Derivaciones',
    url: 'https://kf.kobotoolbox.org/api/v2/assets/aCxASXMEvmmwTfSM2ru4w9/export-settings/esXsXNnaVYrYn27GemkBprf/data.csv',
    hojaTemporal: 'DatosKoboDeriv',
    mapeo: {
      nombreCompleto: 'Nombre Completo',
      creamosId: 'Creamos ID',
      genero: 'Género',
      edad: 'Edad',
      malestar: 'Motivo de derivación u referencia',
      telefono: 'Teléfono',
      derivacion: 'Derivación o Referencia',
      quienDeriva: 'Nombre de quien deriva',
      programa: 'Programa de Creamos',
      servicio: 'Servicio'
    }
  },

  programas: {
    nombre: 'Derivaciones de Programas',
    url: 'https://kf.kobotoolbox.org/api/v2/assets/an6ckBVY2QRQPhTdKiEfcF/export-settings/esr6NXWYUDifrWNeZVUVgoC/data.csv',
    hojaTemporal: 'DatosKoboProg',
    mapeo: {
      nombreCompleto: 'Nombre Completo',
      creamosId: 'Creamos ID',
      genero: 'Género',
      edad: 'Edad',
      malestar: 'Motivo de referencia',
      telefono: 'Teléfono',
      derivacion: 'Derivación o Referencia',
      quienDeriva: 'Persona que refiere',
      programa: 'Programa que refiere',
      servicio: 'Servicio'
    }
  },

  bienestar: {
    nombre: 'Formulario de Bienestar',
    url: 'https://kf.kobotoolbox.org/api/v2/assets/aCxASXMEvmmwTfSM2ru4w9/export-settings/esXsXNnaVYrYn27GemkBprf/data.csv',
    hojaTemporal: 'DatosKoboBienestar',
    mapeo: {
      nombreCompleto: 'Completado por',
      creamosId: 'Creamos ID',
      malestar: '¿Cuál es su preocupación?',
      alertaSuicidio: 'activar_protocolo_suicidio'
    },
    procesarAlerta: true // Este formulario tiene alertas de suicidio
  }
};

// =====================================================================
// MENÚ PRINCIPAL
// =====================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('🔄 Importación KoboToolbox')
    .addItem('⚡ Importar TODOS los Formularios Ahora', 'importarTodosLosFormulariosAhora')
    .addSeparator()
    .addItem('📥 Importar Solo Derivaciones', 'importarDerivaciones')
    .addItem('📥 Importar Solo Programas', 'importarProgramas')
    .addItem('📥 Importar Solo Bienestar', 'importarBienestar')
    .addSeparator()
    .addItem('⏰ Activar Importación Automática (cada 10 min)', 'activarImportacionAutomatica')
    .addItem('⏹️ Desactivar Importación Automática', 'desactivarImportacionAutomatica')
    .addSeparator()
    .addItem('🔍 Ver Estado del Sistema', 'verEstadoSistema')
    .addItem('🧹 Limpiar Hojas Temporales', 'limpiarHojasTemporales')
    .addToUi();
}

// =====================================================================
// FUNCIÓN PRINCIPAL: IMPORTAR TODOS LOS FORMULARIOS
// =====================================================================

/**
 * Importa datos de TODOS los formularios de KoboToolbox
 * y los envía a Lista de Espera
 */
function importarTodosLosFormulariosAhora() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  ss.toast('Importando desde TODOS los formularios...', 'Procesando', -1);

  Logger.log('═══════════════════════════════════════');
  Logger.log('🔄 INICIANDO IMPORTACIÓN UNIFICADA');
  Logger.log('═══════════════════════════════════════');

  const resultados = {
    derivaciones: 0,
    programas: 0,
    bienestar: 0,
    errores: [],
    duplicados: 0,
    alertas: 0
  };

  try {
    // Importar cada formulario
    for (const [key, config] of Object.entries(FORMULARIOS_KOBO)) {
      Logger.log('\n📋 Procesando: ' + config.nombre);
      Logger.log('   URL: ' + config.url.substring(0, 50) + '...');

      try {
        const resultado = importarFormulario(config);
        resultados[key] = resultado.nuevos;
        resultados.duplicados += resultado.duplicados;
        resultados.alertas += resultado.alertas;

        Logger.log('✅ ' + config.nombre + ': ' + resultado.nuevos + ' nuevos');
      } catch (error) {
        Logger.log('❌ Error en ' + config.nombre + ': ' + error.message);
        resultados.errores.push(config.nombre + ': ' + error.message);
      }
    }

    ss.toast('', '', 1);

    // Mostrar resumen
    let mensaje = '═══ IMPORTACIÓN COMPLETADA ═══\n\n';
    mensaje += '📊 NUEVOS REGISTROS:\n';
    mensaje += '• Derivaciones: ' + resultados.derivaciones + '\n';
    mensaje += '• Programas: ' + resultados.programas + '\n';
    mensaje += '• Bienestar: ' + resultados.bienestar + '\n\n';
    mensaje += '📍 Total nuevos: ' + (resultados.derivaciones + resultados.programas + resultados.bienestar) + '\n';
    mensaje += '⚠️ Duplicados omitidos: ' + resultados.duplicados + '\n';

    if (resultados.alertas > 0) {
      mensaje += '\n🆘 ALERTAS DE SUICIDIO: ' + resultados.alertas + '\n';
      mensaje += '(Emails enviados automáticamente)';
    }

    if (resultados.errores.length > 0) {
      mensaje += '\n\n❌ ERRORES:\n';
      resultados.errores.forEach(error => {
        mensaje += '• ' + error + '\n';
      });
    }

    ui.alert('Importación Completada', mensaje, ui.ButtonSet.OK);

    Logger.log('\n═══════════════════════════════════════');
    Logger.log('✅ IMPORTACIÓN FINALIZADA');
    Logger.log('   Total nuevos: ' + (resultados.derivaciones + resultados.programas + resultados.bienestar));
    Logger.log('   Duplicados: ' + resultados.duplicados);
    Logger.log('   Alertas: ' + resultados.alertas);
    Logger.log('═══════════════════════════════════════');

  } catch (error) {
    ss.toast('', '', 1);
    Logger.log('❌ ERROR GENERAL: ' + error.message);
    Logger.log('   Stack: ' + error.stack);

    ui.alert(
      'Error en Importación',
      'Error: ' + error.message + '\n\n' +
      'Revisa el log en: Ver → Registros de ejecución',
      ui.ButtonSet.OK
    );
  }
}

// =====================================================================
// IMPORTACIÓN DE FORMULARIO INDIVIDUAL
// =====================================================================

/**
 * Importa un formulario específico de KoboToolbox
 * @param {Object} config - Configuración del formulario
 * @returns {Object} Resultado con contadores
 */
function importarFormulario(config) {
  Logger.log('  📡 Descargando CSV...');

  // 1. Descargar CSV
  const response = UrlFetchApp.fetch(config.url, {
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: false
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Error HTTP ' + response.getResponseCode());
  }

  const csv = response.getContentText();

  if (!csv || csv.trim().length === 0) {
    throw new Error('CSV vacío');
  }

  // Verificar que NO sea HTML
  if (csv.trim().toLowerCase().startsWith('<!doctype') ||
      csv.trim().toLowerCase().startsWith('<html')) {
    throw new Error('El link devuelve HTML, no CSV. Verifica que sea público.');
  }

  Logger.log('  ✅ CSV descargado (' + csv.length + ' caracteres)');

  // 2. Parsear CSV
  let datos;
  try {
    datos = Utilities.parseCsv(csv);
  } catch (e) {
    Logger.log('  ⚠️ parseCsv falló, usando parser manual');
    datos = parsearCSVManual(csv);
  }

  if (!datos || datos.length <= 1) {
    Logger.log('  ℹ️ Sin datos nuevos');
    return { nuevos: 0, duplicados: 0, alertas: 0 };
  }

  Logger.log('  📊 Filas parseadas: ' + datos.length);

  // 3. Procesar cada fila
  const encabezados = datos[0];
  let nuevos = 0;
  let duplicados = 0;
  let alertas = 0;

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];

    // Ajustar longitud
    while (fila.length < encabezados.length) {
      fila.push('');
    }

    try {
      const resultado = procesarFilaYEnviarAListaEspera(fila, encabezados, config);

      if (resultado.esNuevo) {
        nuevos++;
      } else if (resultado.esDuplicado) {
        duplicados++;
      }

      if (resultado.tieneAlerta) {
        alertas++;
      }

    } catch (error) {
      Logger.log('  ⚠️ Error procesando fila ' + (i + 1) + ': ' + error.message);
    }
  }

  Logger.log('  📈 Resultado: ' + nuevos + ' nuevos, ' + duplicados + ' duplicados, ' + alertas + ' alertas');

  return { nuevos, duplicados, alertas };
}

// =====================================================================
// PROCESAMIENTO Y ENVÍO A LISTA DE ESPERA
// =====================================================================

/**
 * Procesa una fila y la envía a Lista de Espera si es nueva
 * @param {Array} fila - Datos de la fila
 * @param {Array} encabezados - Nombres de columnas
 * @param {Object} config - Configuración del formulario
 * @returns {Object} Resultado del procesamiento
 */
function procesarFilaYEnviarAListaEspera(fila, encabezados, config) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const listaEspera = ss.getSheetByName('Lista de Espera');

  if (!listaEspera) {
    throw new Error('No se encontró la hoja "Lista de Espera"');
  }

  // 1. Extraer datos usando el mapeo
  const datos = extraerDatosConMapeo(fila, encabezados, config.mapeo);

  // Validar que tenga nombre
  if (!datos.nombreCompleto || datos.nombreCompleto.trim() === '') {
    return { esNuevo: false, esDuplicado: false, tieneAlerta: false };
  }

  // 2. Verificar duplicados en Lista de Espera
  const esDuplicado = verificarDuplicadoEnListaEspera(datos.nombreCompleto, datos.telefono);

  if (esDuplicado) {
    Logger.log('    ⚠️ Duplicado: ' + datos.nombreCompleto);
    return { esNuevo: false, esDuplicado: true, tieneAlerta: false };
  }

  // 3. Verificar alerta de suicidio
  let tieneAlerta = false;
  if (config.procesarAlerta && datos.alertaSuicidio) {
    const valorAlerta = datos.alertaSuicidio.toString().toLowerCase();
    if (valorAlerta === 'sí' || valorAlerta === 'si' || valorAlerta === 'yes') {
      tieneAlerta = true;
      enviarAlertaSuicidioUnificada(datos, config.nombre);
    }
  }

  // 4. Agregar a Lista de Espera
  const nuevaFila = listaEspera.getLastRow() + 1;

  const registro = [
    new Date(),                    // A: Fecha
    nuevaFila - 1,                 // B: Número
    datos.nombreCompleto,          // C: Nombre Completo
    datos.creamosId || '',         // D: Creamos ID
    datos.genero || '',            // E: Género
    datos.edad || '',              // F: Edad
    datos.malestar || '',          // G: Malestar Principal
    datos.telefono || '',          // H: Teléfono
    datos.derivacion || config.nombre, // I: Derivación
    datos.quienDeriva || 'Sistema Automático', // J: Quien deriva
    datos.programa || '',          // K: Programa
    datos.servicio || 'Apoyo Psicológico', // L: Servicio
    '',                            // M: Terapeuta Asignado
    'Pendiente'                    // N: Asistió a Cita
  ];

  listaEspera.getRange(nuevaFila, 1, 1, 14).setValues([registro]);

  // Marcar en color según la fuente
  let color = '#e8f5e9'; // Verde claro por defecto
  if (tieneAlerta) {
    color = '#ffcccc'; // Rojo claro para alertas
  }
  listaEspera.getRange(nuevaFila, 1, 1, 14).setBackground(color);

  Logger.log('    ✅ Nuevo: ' + datos.nombreCompleto + (tieneAlerta ? ' (ALERTA)' : ''));

  return { esNuevo: true, esDuplicado: false, tieneAlerta };
}

// =====================================================================
// FUNCIONES AUXILIARES
// =====================================================================

/**
 * Extrae datos de una fila usando el mapeo de columnas
 */
function extraerDatosConMapeo(fila, encabezados, mapeo) {
  const datos = {};

  for (const [clave, nombreColumna] of Object.entries(mapeo)) {
    // Buscar la columna (flexible, case-insensitive)
    const indice = encabezados.findIndex(h =>
      h && h.toString().toLowerCase().includes(nombreColumna.toLowerCase())
    );

    if (indice >= 0) {
      datos[clave] = fila[indice];
    } else {
      datos[clave] = '';
    }
  }

  return datos;
}

/**
 * Verifica si una persona ya existe en Lista de Espera
 * Usa nombre Y teléfono para máxima precisión
 */
function verificarDuplicadoEnListaEspera(nombre, telefono) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const listaEspera = ss.getSheetByName('Lista de Espera');

  if (!listaEspera) return false;

  const datos = listaEspera.getDataRange().getValues();
  const nombreNorm = nombre.toString().trim().toLowerCase();
  const telefonoNorm = normalizarTelefono(telefono);

  for (let i = 1; i < datos.length; i++) {
    const nombreExistente = (datos[i][2] || '').toString().trim().toLowerCase(); // Columna C
    const telefonoExistente = normalizarTelefono(datos[i][7]); // Columna H

    // Duplicado si coincide nombre
    if (nombreExistente === nombreNorm) {
      return true;
    }

    // Duplicado si coincide teléfono (y ambos tienen teléfono)
    if (telefonoNorm && telefonoExistente && telefonoNorm === telefonoExistente) {
      return true;
    }
  }

  return false;
}

/**
 * Normaliza un teléfono para comparación
 */
function normalizarTelefono(telefono) {
  if (!telefono) return '';

  return telefono.toString()
    .trim()
    .replace(/[\s\-\(\)\.]/g, '')
    .replace(/^(\+593|593|0)/g, '');
}

/**
 * Parser manual de CSV para casos donde Utilities.parseCsv falla
 */
function parsearCSVManual(csv) {
  const lineas = csv.split('\n').filter(l => l.trim().length > 0);
  const filas = [];

  lineas.forEach(linea => {
    const fila = [];
    let actual = '';
    let dentroComillas = false;

    for (let i = 0; i < linea.length; i++) {
      const char = linea[i];

      if (char === '"') {
        dentroComillas = !dentroComillas;
      } else if (char === ',' && !dentroComillas) {
        fila.push(actual);
        actual = '';
      } else {
        actual += char;
      }
    }
    fila.push(actual);
    filas.push(fila);
  });

  return filas;
}

/**
 * Envía email de alerta de suicidio
 */
function enviarAlertaSuicidioUnificada(datos, nombreFormulario) {
  try {
    const props = PropertiesService.getDocumentProperties();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Obtener emails de terapeutas
    const terapeutas = ['Gerber', 'Melissa', 'Diana', 'Karina'];
    const emails = [];

    terapeutas.forEach(t => {
      const email = props.getProperty('EMAIL_' + t.toUpperCase());
      if (email) emails.push(email);
    });

    const emailDirector = props.getProperty('EMAIL_DIRECTOR');
    if (emailDirector) emails.push(emailDirector);

    if (emails.length === 0) {
      Logger.log('    ⚠️ No hay emails configurados para alertas');
      return;
    }

    const asunto = '🆘 ALERTA URGENTE - Protocolo de Suicidio Activado';
    const cuerpo =
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '🆘 ALERTA URGENTE - PROTOCOLO DE SUICIDIO\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '⚠️ Se ha activado el protocolo de suicidio en:\n' +
      '   ' + nombreFormulario + '\n\n' +
      '⏰ Fecha/Hora: ' + new Date().toLocaleString() + '\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '📋 INFORMACIÓN DEL PARTICIPANTE\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '👤 Nombre: ' + datos.nombreCompleto + '\n' +
      '📞 Teléfono: ' + (datos.telefono || 'No proporcionado') + '\n' +
      '📋 Creamos ID: ' + (datos.creamosId || 'No proporcionado') + '\n' +
      '📝 Preocupación: ' + (datos.malestar || 'No especificada') + '\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '⚠️ ACCIÓN REQUERIDA INMEDIATAMENTE\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '1. Contactar al participante INMEDIATAMENTE\n' +
      '2. Evaluar el nivel de riesgo\n' +
      '3. Activar protocolo de intervención en crisis\n' +
      '4. Documentar todas las acciones tomadas\n\n' +
      '🔗 Google Sheet: ' + ss.getName() + '\n' +
      '🔗 URL: ' + ss.getUrl();

    emails.forEach(email => {
      MailApp.sendEmail(email, asunto, cuerpo);
    });

    Logger.log('    📧 Alerta enviada a ' + emails.length + ' destinatarios');

  } catch (error) {
    Logger.log('    ❌ Error enviando alerta: ' + error.message);
  }
}

// =====================================================================
// FUNCIONES INDIVIDUALES POR FORMULARIO
// =====================================================================

function importarDerivaciones() {
  const config = FORMULARIOS_KOBO.derivaciones;
  const ui = SpreadsheetApp.getUi();

  SpreadsheetApp.getActiveSpreadsheet().toast('Importando Derivaciones...', 'Procesando', -1);

  try {
    const resultado = importarFormulario(config);

    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);

    ui.alert(
      'Derivaciones Importadas',
      'Nuevos: ' + resultado.nuevos + '\n' +
      'Duplicados: ' + resultado.duplicados,
      ui.ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
    ui.alert('Error', error.message, ui.ButtonSet.OK);
  }
}

function importarProgramas() {
  const config = FORMULARIOS_KOBO.programas;
  const ui = SpreadsheetApp.getUi();

  SpreadsheetApp.getActiveSpreadsheet().toast('Importando Programas...', 'Procesando', -1);

  try {
    const resultado = importarFormulario(config);

    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);

    ui.alert(
      'Programas Importados',
      'Nuevos: ' + resultado.nuevos + '\n' +
      'Duplicados: ' + resultado.duplicados,
      ui.ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
    ui.alert('Error', error.message, ui.ButtonSet.OK);
  }
}

function importarBienestar() {
  const config = FORMULARIOS_KOBO.bienestar;
  const ui = SpreadsheetApp.getUi();

  SpreadsheetApp.getActiveSpreadsheet().toast('Importando Bienestar...', 'Procesando', -1);

  try {
    const resultado = importarFormulario(config);

    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);

    let mensaje = 'Nuevos: ' + resultado.nuevos + '\n' +
                  'Duplicados: ' + resultado.duplicados;

    if (resultado.alertas > 0) {
      mensaje += '\n\n🆘 Alertas: ' + resultado.alertas;
    }

    ui.alert('Bienestar Importado', mensaje, ui.ButtonSet.OK);
  } catch (error) {
    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
    ui.alert('Error', error.message, ui.ButtonSet.OK);
  }
}

// =====================================================================
// TRIGGER AUTOMÁTICO
// =====================================================================

function activarImportacionAutomatica() {
  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.alert(
    'Activar Importación Automática',
    '¿Deseas activar la importación automática cada 10 minutos?\n\n' +
    'El sistema importará TODOS los formularios:\n' +
    '• Derivaciones\n' +
    '• Programas\n' +
    '• Bienestar\n\n' +
    'Y los enviará a Lista de Espera automáticamente.',
    ui.ButtonSet.YES_NO
  );

  if (respuesta !== ui.Button.YES) return;

  try {
    // Eliminar triggers existentes
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'importarTodosLosFormulariosAhora') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Crear nuevo trigger
    ScriptApp.newTrigger('importarTodosLosFormulariosAhora')
      .timeBased()
      .everyMinutes(10)
      .create();

    ui.alert(
      '✅ Importación Automática Activada',
      'El sistema importará TODOS los formularios cada 10 minutos.\n\n' +
      'Los datos nuevos se agregarán automáticamente a Lista de Espera.',
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('Error', error.message, ui.ButtonSet.OK);
  }
}

function desactivarImportacionAutomatica() {
  const ui = SpreadsheetApp.getUi();

  try {
    const triggers = ScriptApp.getProjectTriggers();
    let eliminados = 0;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'importarTodosLosFormulariosAhora') {
        ScriptApp.deleteTrigger(trigger);
        eliminados++;
      }
    });

    ui.alert(
      '✅ Importación Desactivada',
      'Se eliminaron ' + eliminados + ' triggers.\n\n' +
      'La importación automática está desactivada.',
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('Error', error.message, ui.ButtonSet.OK);
  }
}

// =====================================================================
// UTILIDADES
// =====================================================================

function verEstadoSistema() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Verificar hoja Lista de Espera
  const listaEspera = ss.getSheetByName('Lista de Espera');
  const tieneListaEspera = listaEspera ? '✅' : '❌';
  const totalRegistros = listaEspera ? listaEspera.getLastRow() - 1 : 0;

  // Verificar triggers
  const triggers = ScriptApp.getProjectTriggers();
  const triggerActivo = triggers.some(t => t.getHandlerFunction() === 'importarTodosLosFormulariosAhora');

  // Verificar emails
  const props = PropertiesService.getDocumentProperties();
  const emailDirector = props.getProperty('EMAIL_DIRECTOR');

  let mensaje = '═══ ESTADO DEL SISTEMA ═══\n\n';
  mensaje += '📋 HOJA LISTA DE ESPERA:\n';
  mensaje += tieneListaEspera + ' ' + (listaEspera ? 'Existe' : 'No existe') + '\n';
  mensaje += '   Registros: ' + totalRegistros + '\n\n';

  mensaje += '⏰ IMPORTACIÓN AUTOMÁTICA:\n';
  mensaje += (triggerActivo ? '✅ Activa' : '❌ Inactiva') + '\n';
  mensaje += (triggerActivo ? '   (cada 10 minutos)' : '   (usa el menú para activar)') + '\n\n';

  mensaje += '📧 CONFIGURACIÓN DE EMAILS:\n';
  mensaje += (emailDirector ? '✅ Configurado' : '❌ No configurado') + '\n';
  if (emailDirector) {
    mensaje += '   ' + emailDirector + '\n';
  }
  mensaje += '\n';

  mensaje += '📊 FORMULARIOS CONFIGURADOS:\n';
  mensaje += '• Derivaciones ✅\n';
  mensaje += '• Programas ✅\n';
  mensaje += '• Bienestar ✅\n';

  ui.alert('Estado del Sistema', mensaje, ui.ButtonSet.OK);
}

function limpiarHojasTemporales() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const respuesta = ui.alert(
    'Limpiar Hojas Temporales',
    '¿Deseas eliminar las hojas temporales de importación?\n\n' +
    '• DatosKoboDeriv\n' +
    '• DatosKoboProg\n' +
    '• DatosKoboBienestar\n\n' +
    'Esto NO afectará a Lista de Espera.',
    ui.ButtonSet.YES_NO
  );

  if (respuesta !== ui.Button.YES) return;

  const hojas = ['DatosKoboDeriv', 'DatosKoboProg', 'DatosKoboBienestar'];
  let eliminadas = 0;

  hojas.forEach(nombre => {
    const hoja = ss.getSheetByName(nombre);
    if (hoja) {
      ss.deleteSheet(hoja);
      eliminadas++;
    }
  });

  ui.alert(
    '✅ Limpieza Completada',
    'Se eliminaron ' + eliminadas + ' hojas temporales.',
    ui.ButtonSet.OK
  );
}
