# Importador de Datos de KoboToolbox a Google Sheets

Este proyecto permite importar automáticamente datos desde KoboToolbox a una hoja de cálculo de Google Sheets usando Google Apps Script.

## 🚀 Características

- ✅ Importación automática de datos CSV desde KoboToolbox
- ✅ **Sin necesidad de configuración de credenciales** - URL directa preconfigurada
- ✅ Menú personalizado en Google Sheets
- ✅ Formateo automático de encabezados
- ✅ Copiar datos a otras hojas con opciones flexibles
- ✅ Selección de columnas específicas para reportes personalizados
- ✅ Manejo de errores robusto

## ✨ Funcionalidades Principales

### 📥 Importación Simple
- **Un solo clic**: Importa todos tus datos de KoboToolbox directamente
- **Actualización fácil**: Refresca los datos cuando quieras
- **Sin configuración**: Ya está listo para usar

### 📤 Copiar Datos a Otras Hojas
- **Copiar Todos los Datos**: Duplica todos los datos de DatosKobo a otra hoja
  - Opción de reemplazar datos existentes o agregar al final
  - Formateo automático de encabezados
  - Ideal para crear copias de seguridad o versiones diferentes

- **Copiar Columnas Específicas**: Selecciona solo las columnas que necesitas
  - Interfaz interactiva para elegir columnas
  - Crea vistas personalizadas de tus datos
  - Perfecto para reportes específicos

## 📋 Requisitos Previos

1. Una cuenta de Google con acceso a Google Sheets
2. Este script ya está configurado para un formulario específico de KoboToolbox

## 🔧 Instalación

### Paso 1: Crear un nuevo Google Sheets

1. Ve a [Google Sheets](https://sheets.google.com)
2. Crea una nueva hoja de cálculo
3. Nómbrala como prefieras (ej: "Datos KoboToolbox")

### Paso 2: Abrir el Editor de Apps Script

1. En tu hoja de cálculo, ve a **Extensiones** > **Apps Script**
2. Elimina cualquier código existente en el editor
3. Copia y pega el contenido del archivo `Código.gs` de este repositorio
4. Guarda el proyecto (Ctrl+S o Cmd+S)

### Paso 3: ¡Listo para Usar!

1. Vuelve a tu hoja de Google Sheets
2. Recarga la página (F5) para que aparezca el nuevo menú
3. Verás un nuevo menú llamado **KoboToolbox** en la barra superior
4. Ya puedes empezar a importar datos

> **Nota**: Es posible que Google te pida autorizar el script la primera vez. Sigue los pasos de autorización.

## 📊 Uso

### 📥 Importar Datos de KoboToolbox

Es súper simple:

1. Haz clic en **KoboToolbox** > **📥 Importar Datos**
2. Espera unos segundos mientras se descargan los datos
3. Los datos aparecerán automáticamente en una hoja llamada "DatosKobo"
4. ¡Listo! Tus datos están listos para usar

**Características de la importación:**
- ✅ Encabezados formateados automáticamente (azul, negrita)
- ✅ Columnas ajustadas al contenido
- ✅ Primera fila congelada para fácil navegación
- ✅ Actualización en tiempo real desde KoboToolbox

### 📤 Enviar Datos a Otra Hoja

#### Copiar Todos los Datos
1. Primero importa los datos de KoboToolbox
2. **KoboToolbox** > **📤 Enviar a Otra Hoja** > **Copiar Todos los Datos**
3. Ingresa el nombre de la hoja destino
4. Elige si quieres:
   - **REEMPLAZAR** los datos existentes (Sí)
   - **AGREGAR** al final de la hoja (No)

#### Copiar Solo Columnas Específicas
1. **KoboToolbox** > **📤 Enviar a Otra Hoja** > **Copiar Columnas Específicas**
2. Verás una lista numerada de todas las columnas disponibles
3. Ingresa los números de las columnas que quieres copiar (ej: `1,3,5,7`)
4. Ingresa el nombre de la hoja destino
5. Los datos seleccionados se copiarán automáticamente

**Ejemplo de uso:**
```
Columnas disponibles:
1. _id
2. Nombre
3. Edad
4. Ciudad
5. Email

Ingresa: 2,3,4

Resultado: Se copiarán solo las columnas Nombre, Edad y Ciudad
```

## 🔄 Automatización (Opcional)

Puedes configurar una importación automática programada:

1. En el editor de Apps Script, haz clic en el icono del reloj ⏰ (Activadores)
2. Haz clic en **+ Agregar activador**
3. Configura:
   - **Función**: `importarCSVdesdeKobo`
   - **Tipo de activador**: Basado en tiempo
   - **Tipo**: Temporizador por horas/días según necesites
   - **Intervalo**: Por ejemplo, cada hora o cada día
4. Guarda el activador

## ❗ Solución de Problemas

### Error al importar datos

**Causa**: Problema de conexión o el formulario de KoboToolbox no está disponible.

**Solución**:
1. Verifica tu conexión a internet
2. Intenta nuevamente en unos minutos
3. Verifica que el formulario de KoboToolbox siga activo

### No aparece el menú KoboToolbox

**Causa**: El script no se ha cargado correctamente.

**Solución**:
1. Recarga la página (F5 o Ctrl+R)
2. Espera unos segundos a que cargue el menú
3. Si persiste, ve a **Extensiones** > **Apps Script** y verifica que el código esté guardado

### Los datos no se actualizan

**Causa**: Los datos en caché o no hay nuevos datos en KoboToolbox.

**Solución**:
1. La hoja "DatosKobo" se reemplaza completamente cada vez que importas
2. Si necesitas mantener versiones anteriores, usa "Copiar Todos los Datos" antes de importar nuevamente
3. Verifica que haya nuevas respuestas en tu formulario de KoboToolbox

### Error de permisos al ejecutar

**Causa**: Google Apps Script requiere autorización.

**Solución**:
1. La primera vez que uses el script, Google te pedirá autorización
2. Haz clic en "Revisar permisos"
3. Selecciona tu cuenta de Google
4. Haz clic en "Permitir"
5. Es seguro - solo permite que el script acceda a esta hoja específica

## 🔐 Seguridad

- ✅ **Acceso directo mediante URL preconfigurada** - No necesitas ingresar credenciales
- ✅ Solo usuarios con acceso a la hoja pueden ejecutar el script
- ✅ Los datos se importan directamente desde KoboToolbox sin almacenamiento intermedio
- ⚠️ No compartas tu hoja de cálculo con personas no autorizadas

## 📝 Funciones Disponibles

### Funciones Principales (Accesibles desde el Menú)

| Función | Descripción | Acceso |
|---------|-------------|--------|
| `importarCSVdesdeKobo()` | Importa datos desde KoboToolbox | Menú: **KoboToolbox** > 📥 Importar Datos |
| `enviarDatosAOtraHoja()` | Copia todos los datos a otra hoja | Menú: **KoboToolbox** > 📤 Enviar a Otra Hoja > Copiar Todos los Datos |
| `copiarColumnasEspecificas()` | Copia columnas seleccionadas a otra hoja | Menú: **KoboToolbox** > 📤 Enviar a Otra Hoja > Copiar Columnas Específicas |

### Funciones Avanzadas (Opcionales)

| Función | Descripción |
|---------|-------------|
| `configurarCredenciales()` | (Opcional) Configura credenciales personalizadas para otro formulario |
| `verificarConexion()` | Verifica el estado de la conexión |
| `onOpen()` | Crea el menú personalizado al abrir la hoja |

## 🆘 Soporte

Si encuentras problemas:

1. Revisa la sección de **Solución de Problemas** arriba
2. Verifica los logs en **Apps Script** > **Ejecuciones**
3. Asegúrate de que tu formulario tenga datos para importar

## 📄 Licencia

Este proyecto es de código abierto y está disponible para uso personal y comercial.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si encuentras un bug o tienes una mejora, no dudes en abrir un issue o pull request.

---

**Última actualización**: Diciembre 2024
