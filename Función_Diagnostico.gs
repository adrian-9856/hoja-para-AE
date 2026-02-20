/**
 * FUNCIÓN DE DIAGNÓSTICO
 * Copia esta función a tu Google Apps Script y ejecútala
 * Te dirá exactamente qué está pasando con los duplicados
 */

/**
 * DIAGNÓSTICO PARA DERIVACIONES (Lista de Espera)
 */
function diagnosticarDerivaciones() {
  Logger.log('========================================');
  Logger.log('DIAGNÓSTICO: Derivaciones → Lista de Espera');
  Logger.log('========================================\n');

  try {
    // Obtener hojas
    const hojaDatosKobo = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DatosKoboDeriv');
    const archivoDestino = SpreadsheetApp.openById("1T0YCTaiu6qxB6Hzq0nth3ZlJpCeKlGTrw2afncW11ME");
    const hojaDestino = archivoDestino.getSheetByName("Lista de Espera");

    if (!hojaDatosKobo) {
      Logger.log('❌ ERROR: No se encuentra la hoja "DatosKoboDeriv"');
      return;
    }

    if (!hojaDestino) {
      Logger.log('❌ ERROR: No se encuentra la hoja "Lista de Espera"');
      return;
    }

    const datosOrigen = hojaDatosKobo.getDataRange().getValues();
    const datosDestino = hojaDestino.getDataRange().getValues();

    Logger.log('📊 DATOS ENCONTRADOS:');
    Logger.log(`  DatosKoboDeriv: ${datosOrigen.length - 1} filas (sin contar encabezados)`);
    Logger.log(`  Lista de Espera: ${datosDestino.length - 1} filas (sin contar encabezados)\n`);

    // Encontrar índices
    const encabezadosOrigen = datosOrigen[0];
    const encabezadosDestino = datosDestino[0];

    const indiceTelefonoOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );
    const indiceNombresOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombres'
    );
    const indiceApellidosOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'apellidos'
    );

    const indiceTelefonoDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );
    const indiceNombresDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombres'
    );

    Logger.log('📋 ÍNDICES DE COLUMNAS EN ORIGEN (DatosKoboDeriv):');
    Logger.log(`  Teléfono: ${indiceTelefonoOrigen}`);
    Logger.log(`  Nombres: ${indiceNombresOrigen}`);
    Logger.log(`  Apellidos: ${indiceApellidosOrigen}\n`);

    Logger.log('📋 ÍNDICES DE COLUMNAS EN DESTINO (Lista de Espera):');
    Logger.log(`  Teléfono: ${indiceTelefonoDestino}`);
    Logger.log(`  Nombres: ${indiceNombresDestino}\n`);

    // Construir IDs existentes
    const datosExistentes = new Set();
    for (let i = 1; i < datosDestino.length; i++) {
      const indicesDestino = {
        telefono: indiceTelefonoDestino,
        nombres: indiceNombresDestino,
        apellidos: -1
      };
      const idUnico = crearIDUnico(datosDestino[i], indicesDestino);
      if (idUnico) {
        datosExistentes.add(idUnico);
      }
    }

    Logger.log(`✅ IDs únicos en DESTINO: ${datosExistentes.size}`);
    Logger.log('Primeros 10 IDs en destino:');
    let count = 0;
    for (let id of datosExistentes) {
      if (count < 10) {
        Logger.log(`  ${count + 1}. ${id}`);
        count++;
      } else {
        break;
      }
    }
    Logger.log('');

    // Analizar datos de ORIGEN
    Logger.log('🔍 ANÁLISIS DE DATOS EN ORIGEN (DatosKoboDeriv):\n');

    const indicesOrigen = {
      telefono: indiceTelefonoOrigen,
      nombres: indiceNombresOrigen,
      apellidos: indiceApellidosOrigen
    };

    let nuevas = 0;
    let duplicadas = 0;
    let sinID = 0;

    for (let i = 1; i < datosOrigen.length; i++) {
      const fila = datosOrigen[i];
      const idUnico = crearIDUnico(fila, indicesOrigen);

      const telefono = indiceTelefonoOrigen >= 0 ? fila[indiceTelefonoOrigen] : '';
      const nombres = indiceNombresOrigen >= 0 ? fila[indiceNombresOrigen] : '';

      if (!idUnico) {
        sinID++;
        Logger.log(`  ⚠️  Fila ${i + 1}: SIN ID (Tel: "${telefono}", Nom: "${nombres}")`);
      } else if (datosExistentes.has(idUnico)) {
        duplicadas++;
        Logger.log(`  ❌ Fila ${i + 1}: DUPLICADO (ID: ${idUnico})`);
      } else {
        nuevas++;
        Logger.log(`  ✅ Fila ${i + 1}: NUEVA (ID: ${idUnico})`);
      }
    }

    Logger.log('\n========================================');
    Logger.log('📊 RESUMEN:');
    Logger.log(`  ✅ Filas NUEVAS: ${nuevas}`);
    Logger.log(`  ❌ Filas DUPLICADAS: ${duplicadas}`);
    Logger.log(`  ⚠️  Filas SIN ID: ${sinID}`);
    Logger.log('========================================\n');

    // Verificar si las funciones existen
    Logger.log('🔧 VERIFICACIÓN DE FUNCIONES:');
    try {
      const testID = crearIDUnico(['', '123456789', 'Juan', 'Perez'], {telefono: 1, nombres: 2, apellidos: 3});
      Logger.log(`  ✅ crearIDUnico() funciona correctamente`);
      Logger.log(`     Test: ${testID}`);
    } catch (e) {
      Logger.log(`  ❌ crearIDUnico() NO funciona: ${e.message}`);
    }

    try {
      const testNorm = normalizarTelefono('+593 445-566.7788');
      Logger.log(`  ✅ normalizarTelefono() funciona correctamente`);
      Logger.log(`     Test: "+593 445-566.7788" → "${testNorm}"`);
    } catch (e) {
      Logger.log(`  ❌ normalizarTelefono() NO funciona: ${e.message}`);
    }

    Logger.log('\n========================================');
    Logger.log('✅ DIAGNÓSTICO COMPLETO');
    Logger.log('========================================');

    // Mostrar también en UI
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Diagnóstico Completo',
      `📊 Resultados:\n\n` +
      `DatosKoboDeriv: ${datosOrigen.length - 1} filas\n` +
      `Lista de Espera: ${datosDestino.length - 1} filas\n\n` +
      `✅ Filas NUEVAS: ${nuevas}\n` +
      `❌ Filas DUPLICADAS: ${duplicadas}\n` +
      `⚠️ Filas SIN ID: ${sinID}\n\n` +
      `Revisa los LOGS (Ver → Registros de ejecución) para más detalles`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log(`❌ ERROR GENERAL: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
  }
}


/**
 * DIAGNÓSTICO PARA DERIVACIONES DE PROGRAMAS
 */
function diagnosticarDerivacionesProgramas() {
  Logger.log('========================================');
  Logger.log('DIAGNÓSTICO: Derivaciones Programas → Lista de Espera');
  Logger.log('========================================\n');

  try {
    // Obtener hojas
    const hojaDatosKobo = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DatosKoboProg');
    const archivoDestino = SpreadsheetApp.openById("1T0YCTaiu6qxB6Hzq0nth3ZlJpCeKlGTrw2afncW11ME");
    const hojaDestino = archivoDestino.getSheetByName("Lista de Espera");

    if (!hojaDatosKobo) {
      Logger.log('❌ ERROR: No se encuentra la hoja "DatosKoboProg"');
      return;
    }

    if (!hojaDestino) {
      Logger.log('❌ ERROR: No se encuentra la hoja "Lista de Espera"');
      return;
    }

    const datosOrigen = hojaDatosKobo.getDataRange().getValues();
    const datosDestino = hojaDestino.getDataRange().getValues();

    Logger.log('📊 DATOS ENCONTRADOS:');
    Logger.log(`  DatosKoboProg: ${datosOrigen.length - 1} filas (sin contar encabezados)`);
    Logger.log(`  Lista de Espera: ${datosDestino.length - 1} filas (sin contar encabezados)\n`);

    // Encontrar índices
    const encabezadosOrigen = datosOrigen[0];
    const encabezadosDestino = datosDestino[0];

    const indiceTelefonoOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );
    const indiceNombresOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombres'
    );
    const indiceApellidosOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'apellidos'
    );

    const indiceTelefonoDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'teléfono'
    );
    const indiceNombresDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombres'
    );

    Logger.log('📋 ÍNDICES DE COLUMNAS EN ORIGEN (DatosKoboProg):');
    Logger.log(`  Teléfono: ${indiceTelefonoOrigen}`);
    Logger.log(`  Nombres: ${indiceNombresOrigen}`);
    Logger.log(`  Apellidos: ${indiceApellidosOrigen}\n`);

    Logger.log('📋 ÍNDICES DE COLUMNAS EN DESTINO (Lista de Espera):');
    Logger.log(`  Teléfono: ${indiceTelefonoDestino}`);
    Logger.log(`  Nombres: ${indiceNombresDestino}\n`);

    // Construir IDs existentes
    const datosExistentes = new Set();
    for (let i = 1; i < datosDestino.length; i++) {
      const indicesDestino = {
        telefono: indiceTelefonoDestino,
        nombres: indiceNombresDestino,
        apellidos: -1
      };
      const idUnico = crearIDUnicoProg(datosDestino[i], indicesDestino);
      if (idUnico) {
        datosExistentes.add(idUnico);
      }
    }

    Logger.log(`✅ IDs únicos en DESTINO: ${datosExistentes.size}`);
    Logger.log('Primeros 10 IDs en destino:');
    let count = 0;
    for (let id of datosExistentes) {
      if (count < 10) {
        Logger.log(`  ${count + 1}. ${id}`);
        count++;
      } else {
        break;
      }
    }
    Logger.log('');

    // Analizar datos de ORIGEN
    Logger.log('🔍 ANÁLISIS DE DATOS EN ORIGEN (DatosKoboProg):\n');

    const indicesOrigen = {
      telefono: indiceTelefonoOrigen,
      nombres: indiceNombresOrigen,
      apellidos: indiceApellidosOrigen
    };

    let nuevas = 0;
    let duplicadas = 0;
    let sinID = 0;

    for (let i = 1; i < datosOrigen.length; i++) {
      const fila = datosOrigen[i];
      const idUnico = crearIDUnicoProg(fila, indicesOrigen);

      const telefono = indiceTelefonoOrigen >= 0 ? fila[indiceTelefonoOrigen] : '';
      const nombres = indiceNombresOrigen >= 0 ? fila[indiceNombresOrigen] : '';

      if (!idUnico) {
        sinID++;
        Logger.log(`  ⚠️  Fila ${i + 1}: SIN ID (Tel: "${telefono}", Nom: "${nombres}")`);
      } else if (datosExistentes.has(idUnico)) {
        duplicadas++;
        Logger.log(`  ❌ Fila ${i + 1}: DUPLICADO (ID: ${idUnico})`);
      } else {
        nuevas++;
        Logger.log(`  ✅ Fila ${i + 1}: NUEVA (ID: ${idUnico})`);
      }
    }

    Logger.log('\n========================================');
    Logger.log('📊 RESUMEN:');
    Logger.log(`  ✅ Filas NUEVAS: ${nuevas}`);
    Logger.log(`  ❌ Filas DUPLICADAS: ${duplicadas}`);
    Logger.log(`  ⚠️  Filas SIN ID: ${sinID}`);
    Logger.log('========================================\n');

    // Verificar si las funciones existen
    Logger.log('🔧 VERIFICACIÓN DE FUNCIONES:');
    try {
      const testID = crearIDUnicoProg(['', '123456789', 'Juan', 'Perez'], {telefono: 1, nombres: 2, apellidos: 3});
      Logger.log(`  ✅ crearIDUnicoProg() funciona correctamente`);
      Logger.log(`     Test: ${testID}`);
    } catch (e) {
      Logger.log(`  ❌ crearIDUnicoProg() NO funciona: ${e.message}`);
    }

    try {
      const testNorm = normalizarTelefonoProg('+593 445-566.7788');
      Logger.log(`  ✅ normalizarTelefonoProg() funciona correctamente`);
      Logger.log(`     Test: "+593 445-566.7788" → "${testNorm}"`);
    } catch (e) {
      Logger.log(`  ❌ normalizarTelefonoProg() NO funciona: ${e.message}`);
    }

    Logger.log('\n========================================');
    Logger.log('✅ DIAGNÓSTICO COMPLETO');
    Logger.log('========================================');

    // Mostrar también en UI
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Diagnóstico Completo',
      `📊 Resultados:\n\n` +
      `DatosKoboProg: ${datosOrigen.length - 1} filas\n` +
      `Lista de Espera: ${datosDestino.length - 1} filas\n\n` +
      `✅ Filas NUEVAS: ${nuevas}\n` +
      `❌ Filas DUPLICADAS: ${duplicadas}\n` +
      `⚠️ Filas SIN ID: ${sinID}\n\n` +
      `Revisa los LOGS (Ver → Registros de ejecución) para más detalles`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log(`❌ ERROR GENERAL: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
  }
}


/**
 * DIAGNÓSTICO PARA INTERVENCIÓN DE CASOS
 */
function diagnosticarIntervencionCasos() {
  Logger.log('========================================');
  Logger.log('DIAGNÓSTICO: Intervención de Casos');
  Logger.log('========================================\n');

  try {
    // Obtener hojas
    const hojaDatosKobo = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DatosKobo');
    const hojaDestino = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Intervención de casos');

    if (!hojaDatosKobo) {
      Logger.log('❌ ERROR: No se encuentra la hoja "DatosKobo"');
      return;
    }

    if (!hojaDestino) {
      Logger.log('❌ ERROR: No se encuentra la hoja "Intervención de casos"');
      return;
    }

    const datosOrigen = hojaDatosKobo.getDataRange().getValues();
    const datosDestino = hojaDestino.getDataRange().getValues();

    Logger.log('📊 DATOS ENCONTRADOS:');
    Logger.log(`  DatosKobo: ${datosOrigen.length - 1} filas (sin contar encabezados)`);
    Logger.log(`  Intervención de casos: ${datosDestino.length - 1} filas (sin contar encabezados)\n`);

    // Encontrar índices
    const encabezadosOrigen = datosOrigen[0];
    const encabezadosDestino = datosDestino[0];

    const indiceNombresOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'nombre (s)'
    );
    const indiceApellidosOrigen = encabezadosOrigen.findIndex(col =>
      col.toString().trim().toLowerCase() === 'apellidos (s)'
    );

    const indiceParticipanteDestino = encabezadosDestino.findIndex(col =>
      col.toString().trim().toLowerCase() === 'participante'
    );

    Logger.log('📋 ÍNDICES DE COLUMNAS EN ORIGEN (DatosKobo):');
    Logger.log(`  Nombre (s): ${indiceNombresOrigen}`);
    Logger.log(`  Apellidos (s): ${indiceApellidosOrigen}\n`);

    Logger.log('📋 ÍNDICES DE COLUMNAS EN DESTINO (Intervención de casos):');
    Logger.log(`  Participante: ${indiceParticipanteDestino}\n`);

    // Construir participantes existentes
    const datosExistentes = new Set();
    for (let i = 1; i < datosDestino.length; i++) {
      if (indiceParticipanteDestino >= 0) {
        const participante = datosDestino[i][indiceParticipanteDestino];
        if (participante) {
          datosExistentes.add(participante.toString().trim().toLowerCase());
        }
      }
    }

    Logger.log(`✅ Participantes únicos en DESTINO: ${datosExistentes.size}`);
    Logger.log('Primeros 10 participantes en destino:');
    let count = 0;
    for (let participante of datosExistentes) {
      if (count < 10) {
        Logger.log(`  ${count + 1}. ${participante}`);
        count++;
      } else {
        break;
      }
    }
    Logger.log('');

    // Analizar datos de ORIGEN
    Logger.log('🔍 ANÁLISIS DE DATOS EN ORIGEN (DatosKobo):\n');

    let nuevas = 0;
    let duplicadas = 0;
    let sinNombre = 0;

    for (let i = 1; i < datosOrigen.length; i++) {
      const fila = datosOrigen[i];

      const nombre = indiceNombresOrigen >= 0 ? fila[indiceNombresOrigen] : '';
      const apellido = indiceApellidosOrigen >= 0 ? fila[indiceApellidosOrigen] : '';
      const participante = `${nombre} ${apellido}`.trim().toLowerCase();

      if (!participante) {
        sinNombre++;
        Logger.log(`  ⚠️  Fila ${i + 1}: SIN NOMBRE`);
      } else if (datosExistentes.has(participante)) {
        duplicadas++;
        Logger.log(`  ❌ Fila ${i + 1}: DUPLICADO (Participante: ${participante})`);
      } else {
        nuevas++;
        Logger.log(`  ✅ Fila ${i + 1}: NUEVA (Participante: ${participante})`);
      }
    }

    Logger.log('\n========================================');
    Logger.log('📊 RESUMEN:');
    Logger.log(`  ✅ Filas NUEVAS: ${nuevas}`);
    Logger.log(`  ❌ Filas DUPLICADAS: ${duplicadas}`);
    Logger.log(`  ⚠️  Filas SIN NOMBRE: ${sinNombre}`);
    Logger.log('========================================\n');

    Logger.log('✅ DIAGNÓSTICO COMPLETO');

    // Mostrar también en UI
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Diagnóstico Completo',
      `📊 Resultados:\n\n` +
      `DatosKobo: ${datosOrigen.length - 1} filas\n` +
      `Intervención de casos: ${datosDestino.length - 1} filas\n\n` +
      `✅ Filas NUEVAS: ${nuevas}\n` +
      `❌ Filas DUPLICADAS: ${duplicadas}\n` +
      `⚠️ Filas SIN NOMBRE: ${sinNombre}\n\n` +
      `Revisa los LOGS (Ver → Registros de ejecución) para más detalles`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log(`❌ ERROR GENERAL: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
  }
}
