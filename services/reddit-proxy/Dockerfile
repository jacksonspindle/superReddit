FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY index.js ./
# bust cache v2
EXPOSE 3001
CMD ["node", "index.js"]
