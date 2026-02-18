/**
 * FIX: NO ELIMINAR REGISTROS DE TERAPIAS
 *
 * PROBLEMA ORIGINAL:
 * Cuando se marcaba "Proceso culminado" o "deserciones" en la columna Estado
 * de la hoja Terapias, el sistema ELIMINABA la fila del registro.
 *
 * SOLUCIÓN:
 * El registro se COPIA a la hoja correspondiente (Procesos Culminados o Deserciones)
 * pero ya NO se elimina de Terapias. El registro queda con su color de fondo:
 *   🟢 Verde = Proceso culminado
 *   🔴 Rojo  = Deserción
 *
 * INSTRUCCIONES:
 * Reemplaza la función procesarFinalizacionTerapia() en tu archivo principal
 * con esta versión corregida.
 */

/**
 * Procesa la finalización de terapia (Proceso culminado o deserciones)
 * VERSIÓN CORREGIDA: NO elimina el registro de Terapias
 */
function procesarFinalizacionTerapia(sheetOrigen, fila, tipoFinal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const datos = sheetOrigen.getRange(fila, 1, 1, 9).getValues()[0];
  const terapeuta   = datos[0]; // A: Terapeuta
  const participante = datos[1]; // B: Participante
  const creemosId   = datos[2]; // C: Creamos ID
  const genero      = datos[3]; // D: Género
  const numSesion   = datos[4]; // E: No. Sesión
  const inasistencias = datos[8] || 0; // I: Inasistencias

  if (!participante || participante.toString().trim() === '') {
    ss.toast('⚠️ Error: No hay participante en esta fila', 'Error', 3);
    return;
  }

  const nombre = participante.toString().trim();
  let motivo = '';

  // Solo para DESERCIONES pedir motivo con diálogo
  if (tipoFinal === 'deserciones') {
    try {
      Logger.log('📋 Solicitando motivo de deserción para: ' + nombre);
      motivo = mostrarDialogoMotivoDesercion(nombre, terapeuta, numSesion);
      Logger.log('✅ Motivo recibido: ' + motivo);

      if (!motivo || motivo === '') {
        Logger.log('⚠️ Usuario canceló o no seleccionó motivo');
        sheetOrigen.getRange(fila, 6).setValue('En proceso');
        ss.toast('❌ Deserción cancelada\n\nNo se seleccionó motivo', 'Cancelado', 3);
        return;
      }
    } catch (error) {
      Logger.log('❌ Error mostrando diálogo: ' + error.message);
      sheetOrigen.getRange(fila, 6).setValue('En proceso');
      ss.toast(
        '⚠️ ERROR: No se puede mostrar el diálogo\n\n' +
        'Para que funcione el diálogo de deserciones, debe:\n' +
        '1. Ir al menú: 🏥 Apoyo Emocional\n' +
        '2. Hacer clic en: ✏️ Instalar Trigger onEdit\n' +
        '3. Autorizar los permisos\n\n' +
        'Error: ' + error.message,
        'Trigger No Instalado',
        15
      );
      return;
    }
  } else if (tipoFinal === 'Proceso culminado') {
    motivo = 'Proceso terapéutico completado';
    Logger.log('✅ Proceso culminado - motivo automático');
  }

  Logger.log('💾 Guardando motivo en columna H: ' + tipoFinal + ': ' + motivo);
  sheetOrigen.getRange(fila, 8).setValue(tipoFinal + ': ' + motivo);

  Logger.log('📧 Enviando email a la directora');
  const emailEnviado = enviarEmailFinalizacion(nombre, terapeuta, tipoFinal, motivo, numSesion);

  if (!emailEnviado) {
    Logger.log('⚠️ Email no enviado, pero continuando con el proceso');
    ss.toast(
      '⚠️ ADVERTENCIA\n\n' +
      'El caso se procesó correctamente PERO el email\n' +
      'NO se pudo enviar.\n\n' +
      'Verifica la configuración de email:\n' +
      'Menú → 📧 Configurar Email Director',
      'Email No Enviado',
      6
    );
  }

  // Copiar a la hoja correspondiente
  let ok = false;
  if (tipoFinal === 'Proceso culminado') {
    Logger.log('📂 Copiando a Procesos Culminados...');
    ok = copiarACulminados(nombre, terapeuta, creemosId, numSesion, motivo);
  } else if (tipoFinal === 'deserciones') {
    Logger.log('📂 Copiando a Deserciones...');
    ok = copiarADeserciones(nombre, terapeuta, creemosId, numSesion, motivo);
  }

  if (ok) {
    Logger.log('✅ Copia exitosa');

    if (tipoFinal === 'deserciones') {
      // Marcar en rojo - NO eliminar el registro
      sheetOrigen.getRange(fila, 1, 1, 9).setBackground('#f8d7da');
      SpreadsheetApp.flush();

      ss.toast(
        '✅ DESERCIÓN PROCESADA\n\n' +
        'Participante: ' + nombre + '\n' +
        'Motivo: ' + motivo + '\n' +
        'Sesiones: ' + numSesion + '\n\n' +
        '✅ Copiado a hoja Deserciones\n' +
        '📋 Registro conservado en Terapias (marcado en rojo)',
        'Deserción Registrada',
        6
      );
      // ✅ NO se elimina la fila de Terapias

    } else if (tipoFinal === 'Proceso culminado') {
      // Marcar en verde - NO eliminar el registro
      sheetOrigen.getRange(fila, 1, 1, 9).setBackground('#d4edda');
      SpreadsheetApp.flush();

      ss.toast(
        '✅ PROCESO CULMINADO\n\n' +
        'Participante: ' + nombre + '\n' +
        'Sesiones: ' + numSesion + '\n\n' +
        '✅ Copiado a Procesos Culminados\n' +
        '📋 Registro conservado en Terapias (marcado en verde)',
        'Proceso Completado',
        6
      );
      // ✅ NO se elimina la fila de Terapias
    }

  } else {
    Logger.log('❌ Error al copiar a la hoja');
    ss.toast('❌ Error al copiar a la hoja de ' + tipoFinal, 'Error', 5);
  }
}
