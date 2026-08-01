-- Contador de intentos fallidos por código OTP.
-- Sin esto, /auth/verify no tiene ningún límite: quien conozca un email puede
-- probar combinaciones de 6 dígitos durante los 15 minutos de validez del código.
--
-- Ejecutar con:
--   wrangler d1 execute lazyfood-db --file=./migrations/0009_otp_attempts.sql --remote

ALTER TABLE auth_tokens ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
