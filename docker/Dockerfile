FROM node:lts-alpine

WORKDIR /server

COPY package*.json ./
RUN mkdir ./src
COPY src ./src
COPY tsconfig.json ./
COPY docker/index.js ./

RUN npm ci

RUN npm run build

EXPOSE 8080

ENV PORT=8080
ENV BASE_URL=/
ENV SAVE_PATH=/uploads
ENV FILENAME_LENGTH=10
ENV ENABLE_SXCU=TRUE
ENV DEBUG=FALSE
ENV FORCE_HTTPS=FALSE
ENV FILE_LISTING=/files

CMD ["node", "index.js"]