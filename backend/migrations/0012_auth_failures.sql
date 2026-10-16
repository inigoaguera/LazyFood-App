-- Contador diario de códigos OTP fallidos, por email y por IP.
-- El límite por código (5 intentos) y por email (10 códigos/hora) dejaba probar
-- unos 50 códigos por hora de forma sostenida contra un email conocido: en
-- semanas, el código de 6 dígitos acababa saliendo. Con un tope diario el
-- ataque deja de ser viable.
--
-- key: 'email:<email>' o 'ip:<CF-Connecting-IP>'.
--
-- Ejecutar con:
--   wrangler d1 execute lazyfood-db --file=./migrations/0012_auth_failures.sql --remote

CREATE TABLE IF NOT EXISTS auth_failures (
  key   TEXT NOT NULL,
  day   TEXT NOT NULL,              -- 'YYYY-MM-DD' en UTC
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, day)
);
