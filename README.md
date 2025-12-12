# Importador de Datos de KoboToolbox a Google Sheets

Este proyecto permite importar automáticamente datos desde KoboToolbox a una hoja de cálculo de Google Sheets usando Google Apps Script.

## 🚀 Características

- ✅ Importación automática de datos CSV desde KoboToolbox
- ✅ Autenticación segura mediante API Token
- ✅ Gestión de credenciales mediante propiedades del script
- ✅ Menú personalizado en Google Sheets
- ✅ Formateo automático de encabezados
- ✅ Manejo de errores robusto
- ✅ Soporte para diferentes separadores CSV

## 📋 Requisitos Previos

1. Una cuenta de KoboToolbox (https://kf.kobotoolbox.org)
2. Un formulario creado en KoboToolbox con datos recopilados
3. Una cuenta de Google con acceso a Google Sheets

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

### Paso 3: Obtener tu API Token de KoboToolbox

1. Inicia sesión en [KoboToolbox](https://kf.kobotoolbox.org)
2. Ve a tu perfil haciendo clic en tu nombre de usuario (esquina superior derecha)
3. Selecciona **Account Settings** (Configuración de cuenta)
4. En el menú lateral, haz clic en **Security** (Seguridad)
5. Busca la sección **API Key** o ve directamente a https://kf.kobotoolbox.org/token/
6. Copia tu token (es una cadena larga de caracteres alfanuméricos)

### Paso 4: Obtener el Asset ID de tu formulario

Hay dos formas de obtener el Asset ID:

#### Opción A: Desde la URL del formulario
1. Ve a tu proyecto en KoboToolbox
2. Abre el formulario que deseas importar
3. La URL tendrá este formato: `https://kf.kobotoolbox.org/#/forms/[ASSET_ID]/`
4. Copia el `ASSET_ID` de la URL

#### Opción B: Usando la API
1. Ve a https://kf.kobotoolbox.org/api/v2/assets/
2. Busca tu formulario en la lista y copia el valor de `uid`

### Paso 5: Configurar las Credenciales

1. Vuelve a tu hoja de Google Sheets
2. Recarga la página (F5) para que aparezca el nuevo menú
3. Verás un nuevo menú llamado **KoboToolbox** en la barra superior
4. Haz clic en **KoboToolbox** > **Configurar Credenciales**
5. Cuando se te solicite, ingresa:
   - Tu **API Token** (del Paso 3)
   - El **Asset ID** de tu formulario (del Paso 4)
6. Haz clic en **OK**

> **Nota**: Es posible que Google te pida autorizar el script la primera vez. Sigue los pasos de autorización.

## 📊 Uso

### Importar Datos

Una vez configuradas las credenciales, puedes importar datos de dos formas:

#### Opción 1: Usando el Menú (Recomendado)
1. Haz clic en **KoboToolbox** > **Importar Datos**
2. Los datos se importarán automáticamente a una nueva hoja llamada "DatosKobo"

#### Opción 2: Ejecutando la Función Manualmente
1. Ve a **Extensiones** > **Apps Script**
2. Selecciona la función `importarCSVdesdeKobo` en el menú desplegable
3. Haz clic en el botón **Ejecutar** (▶)

### Verificar Conexión

Para verificar que tus credenciales están correctas:

1. Ve a **Extensiones** > **Apps Script**
2. Selecciona la función `verificarConexion`
3. Haz clic en **Ejecutar**
4. Verás un mensaje con el nombre del formulario y el número de respuestas

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

### Error 404: "Page not found"

**Causa**: El Asset ID es incorrecto, el formulario no existe, o el endpoint de la API es incorrecto.

**Solución**:
1. Verifica que el Asset ID sea correcto (debe ser un UID como `aXyZ123ABC`)
2. Ejecuta `configurarCredenciales()` nuevamente con el ID correcto
3. Asegúrate de que el formulario exista en tu cuenta de KoboToolbox
4. Verifica que el formulario tenga datos/submissions (si está vacío, podría dar error)
5. Si usas KoboToolbox EU, cambia `kf.kobotoolbox.org` a `eu.kobotoolbox.org` en el código

### Error 401: "Authentication credentials were not provided"

**Causa**: El API Token es incorrecto o no se ha configurado.

**Solución**:
1. Obtén un nuevo API Token desde https://kf.kobotoolbox.org/token/
2. Ejecuta `configurarCredenciales()` nuevamente
3. Pega el token completo sin espacios adicionales

### Error 403: "You do not have permission"

**Causa**: El token no tiene permisos para acceder al formulario.

**Solución**:
1. Verifica que estés usando el token de la cuenta correcta
2. Asegúrate de tener permisos de lectura sobre el formulario
3. Si el formulario pertenece a otra cuenta, solicita acceso al propietario

### El CSV no se importa correctamente (caracteres extraños)

**Causa**: Problema con el separador del CSV.

**Solución**:
- Usa el menú **KoboToolbox** > **Importar con separador ;** si tu CSV usa punto y coma
- O edita la función para usar el separador correcto

## 🔐 Seguridad

- ✅ Las credenciales se almacenan de forma segura usando `PropertiesService`
- ✅ El API Token nunca se guarda en el código
- ✅ Solo usuarios con acceso a la hoja pueden ejecutar el script
- ⚠️ No compartas tu hoja de cálculo con personas no autorizadas

## 📝 Funciones Disponibles

| Función | Descripción |
|---------|-------------|
| `onOpen()` | Crea el menú personalizado al abrir la hoja |
| `configurarCredenciales()` | Configura el API Token y Asset ID |
| `importarCSVdesdeKobo()` | Importa datos desde KoboToolbox |
| `importarCSVconSeparadorPersonalizado(separador)` | Importa usando un separador específico |
| `verificarConexion()` | Verifica que las credenciales sean correctas |

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
