-- Añade un código OTP de 6 dígitos a cada token de auth.
-- Permite al usuario verificar la sesión introduciendo el código en la app
-- en lugar de pulsar el link del email. Crítico para PWAs en iOS, donde el
-- link siempre abre en Safari y nunca en la PWA standalone.
--
-- wrangler d1 execute lazyfood-db --file=./migrations/0008_auth_otp_code.sql --remote

ALTER TABLE auth_tokens ADD COLUMN code TEXT;
