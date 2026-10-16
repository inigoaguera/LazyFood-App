// Namespace 'errors': mensajes por código de error. Los códigos vienen del
// Worker (`{ error: { code, message } }`) o de la propia app (AI_PARSE…). Se
// usan a través de errMsg(e) en src/i18n/index.js; el `message` del servidor
// sólo se enseña si el código no está aquí.
export default {
  generic: 'Algo ha fallado',
  network: 'No hay conexión. Inténtalo de nuevo en un momento.',
  code: {
    // Sesión y acceso
    UNAUTHORIZED: 'Tu sesión ha caducado. Vuelve a entrar.',
    BAD_EMAIL: 'Ese email no parece válido',
    RATE_LIMIT: 'Demasiados intentos. Espera un momento.',
    OTP_LOCKED: 'Demasiados intentos fallidos. Pide un código nuevo.',
    OTP_DAILY_LOCK: 'Demasiados códigos fallidos hoy. Entra con el link del email o vuelve mañana.',
    EMAIL_FAIL: 'No he podido enviar el email',
    BAD_TOKEN: 'Código o link incorrecto',
    BAD_INPUT: 'Falta el código o el email',
    USED: 'Este código o link ya se usó',
    EXPIRED: 'Caducado, pide otro código',
    NO_USER: 'Usuario no encontrado',
    // Casas e invitaciones
    BAD_NAME: 'La casa necesita un nombre',
    FORBIDDEN: 'No perteneces a esta casa',
    OWNER_ONLY: 'Sólo el propietario de la casa puede hacer esto',
    HOUSEHOLD_NOT_FOUND: 'Casa no encontrada',
    LAST_OWNER: 'Eres el único propietario. Asciende a otro miembro o borra la casa.',
    INVITE_INVALID: 'Invitación no válida',
    INVITE_EXPIRED: 'Invitación caducada',
    USED_UP: 'Invitación agotada',
    // Datos
    NOT_FOUND: 'No encontrado',
    BAD_SLOT: 'Falta el hueco del menú',
    SERVER_ERROR: 'Error del servidor. Inténtalo de nuevo.',
    // IA
    NO_KEY: 'La IA no está configurada en el servidor',
    BAD_BODY: 'Petición mal formada',
    BAD_MODEL: 'Modelo de IA no permitido',
    BAD_PAYLOAD: 'Petición a la IA mal formada',
    NO_HOUSEHOLD: 'Falta la casa activa',
    TOO_LARGE: 'La imagen es demasiado grande',
    UPSTREAM: 'No he podido contactar con la IA',
    AI_TIMEOUT: 'La IA ha tardado demasiado en responder',
    AI_QUOTA: 'Has llegado al límite diario de la IA. Vuelve mañana.',
    AI_PARSE: 'No he entendido la respuesta de la IA',
    AI_EMPTY: 'La IA ha devuelto una respuesta vacía',
    // Locales (sin servidor de por medio)
    NO_HOUSEHOLD_LOCAL: 'No hay ninguna casa activa',
    NO_PROXY: 'La app no tiene configurada la dirección del servidor',
  },
};
