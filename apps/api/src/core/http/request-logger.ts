import { pinoHttp } from "pino-http";

export const requestLogger = pinoHttp({
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie"
    ],
    remove: true
  }
});

