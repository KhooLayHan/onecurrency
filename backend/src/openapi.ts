import { env } from "./env";

export const openAPIDocumentation = {
  openapi: "3.0.0",
  info: {
    title: "OneCurrency API",
    version: "1.0.0",
    description: "API documentation for OneCurrency e-wallet application",
  },
  servers: [
    {
      url: `http://localhost:${env.API_PORT}/api/v1`,
      description: "Local development server",
    },
  ],
  tags: [
    { name: "Health", description: "Health check endpoints" },
    { name: "Auth", description: "Authentication endpoints" },
    { name: "Deposits", description: "Deposit and payment processing" },
    { name: "Users", description: "User management and KYC" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token from better-auth session",
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};
