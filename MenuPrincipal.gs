/**
 * MENÚ PRINCIPAL UNIFICADO
 * Este archivo crea los menús cuando se abre la hoja
 *
 * IMPORTANTE: Google Apps Script solo ejecuta funciones llamadas EXACTAMENTE "onOpen()"
 * Por eso este archivo debe existir y tener el nombre correcto.
 */

/**
 * Se ejecuta automáticamente cuando se abre la hoja de Google Sheets
 * Esta es la ÚNICA función que Google Apps Script reconoce automáticamente
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // MENÚ 1: Lista de Espera (Derivaciones)
  ui.createMenu('📋 Lista de Espera')
    .addItem('📥 Importar Datos', 'importarCSVdesdeKoboDeriv')
    .addItem('🔄 Actualizar Datos', 'actualizarDatosAutomaticoDeriv')
    .addSeparator()
    .addItem('🔄 Sincronizar Solo Nuevos', 'sincronizarConHojaPrincipalDeriv')
    .addItem('📤 Sincronización Inicial (Enviar Todo)', 'sincronizacionInicialDeriv')
    .addSeparator()
    .addItem('🗄️ Archivar y Limpiar Datos', 'archivarYLimpiarDeriv')
    .addSeparator()
    .addItem('🧹 Limpiar Hoja (Solo Encabezados)', 'limpiarHojaListaDeEspera')
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Configurar')
      .addItem('Activar Sincronización Automática', 'activarSincronizacionAutomaticaDeriv')
      .addItem('Desactivar Sincronización Automática', 'desactivarSincronizacionAutomaticaDeriv')
      .addItem('Ver Estado de Sincronización', 'verEstadoSincronizacionDeriv'))
    .addToUi();

  // MENÚ 2: Derivaciones Programas
  ui.createMenu('🏢 Derivaciones Programas')
    .addItem('📥 Importar Datos', 'importarCSVdesdeKoboProg')
    .addItem('🔄 Actualizar Datos', 'actualizarDatosAutomaticoProg')
    .addSeparator()
    .addItem('🔄 Sincronizar Solo Nuevos', 'sincronizarConHojaPrincipalProg')
    .addItem('📤 Sincronización Inicial (Enviar Todo)', 'sincronizacionInicialProg')
    .addSeparator()
    .addItem('🗄️ Archivar y Limpiar Datos', 'archivarYLimpiarProg')
    .addItem('🧹 Limpiar Hoja (Solo Encabezados)', 'limpiarHojaListaDeEsperaProg')
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Configurar')
      .addItem('Activar Sincronización Automática', 'activarSincronizacionAutomaticaProg')
      .addItem('Desactivar Sincronización Automática', 'desactivarSincronizacionAutomaticaProg')
      .addItem('Ver Estado de Sincronización', 'verEstadoSincronizacionProg'))
    .addSeparator()
    .addItem('🔍 Diagnosticar Columnas', 'diagnosticarColumnasProgramas')
    .addToUi();

  Logger.log('✅ Menús creados correctamente: "📋 Lista de Espera" y "🏢 Derivaciones Programas"');
}
