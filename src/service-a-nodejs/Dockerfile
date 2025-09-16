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
EXPOSE 3000
EXPOSE 50051

# Comando para iniciar a aplicação
CMD ["npm", "start"]
