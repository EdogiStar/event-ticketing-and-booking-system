const configuredPort = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(configuredPort) || configuredPort < 0 || configuredPort > 65535) {
  throw new TypeError('PORT must be an integer from 0 to 65535');
}

export const config = Object.freeze({ port: configuredPort });
