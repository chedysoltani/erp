# ────────── Stage 1: Build ──────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk update && apk upgrade --no-cache

COPY package*.json ./
RUN npm install

COPY . .

ARG API_URL=https://votre-domaine.com/api
RUN sed -i "s|https://votre-domaine.com/api|${API_URL}|g" \
    src/environments/environment.prod.ts

RUN npx ng build --configuration production

# ────────── Stage 2: Production ─────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

RUN apk update && apk upgrade --no-cache

# Embed nginx SPA config inline — no external config file needed
RUN rm /etc/nginx/conf.d/default.conf && \
    { \
      echo 'server {'; \
      echo '    listen 80;'; \
      echo '    server_name _;'; \
      echo '    root /usr/share/nginx/html;'; \
      echo '    index index.html;'; \
      echo ''; \
      echo '    # Angular SPA routing'; \
      echo '    location / {'; \
      echo '        try_files $uri $uri/ /index.html;'; \
      echo '    }'; \
      echo ''; \
      echo '    # Cache agressif pour assets avec hash (Angular outputHashing)'; \
      echo '    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {'; \
      echo '        expires 1y;'; \
      echo '        add_header Cache-Control "public, immutable";'; \
      echo '        access_log off;'; \
      echo '    }'; \
      echo ''; \
      echo '    add_header X-Frame-Options "SAMEORIGIN" always;'; \
      echo '    add_header X-Content-Type-Options "nosniff" always;'; \
      echo '    add_header X-XSS-Protection "1; mode=block" always;'; \
      echo '}'; \
    } > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist/frontend /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
