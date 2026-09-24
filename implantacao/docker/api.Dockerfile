FROM node:22-alpine AS dependencias
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM dependencias AS compilacao
COPY . .
RUN pnpm compilar

FROM node:22-alpine AS producao
WORKDIR /app
ENV AMBIENTE_EXECUCAO=producao
RUN addgroup -S aplicacao && adduser -S aplicacao -G aplicacao
COPY --from=dependencias /app/node_modules ./node_modules
COPY --from=compilacao /app/dist ./dist
COPY contratos ./contratos
COPY banco ./banco
COPY package.json ./package.json
USER aplicacao
EXPOSE 50051
CMD ["node", "dist/src/principal.js"]
