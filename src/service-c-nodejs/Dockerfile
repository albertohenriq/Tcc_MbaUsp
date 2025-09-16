# Use a imagem oficial do Node.js
FROM node:18-slim

# Criar diretório da aplicação
WORKDIR /usr/src/app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY . .

# Expor portas (REST e gRPC)
EXPOSE 3002
EXPOSE 50053

# Comando para iniciar a aplicação
CMD ["npm", "start"]
