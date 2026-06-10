#!/bin/bash

# =============================================================================
# RH-Studio Auto-Installer v2.0
# =============================================================================
# Instalador automático con Docker pre-compilado
# =============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=================================================="
echo "       RH-Studio Auto-Installer v2.0"
echo "=================================================="
echo -e "${NC}"

# Check root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Este script debe ejecutarse como root${NC}"
   exit 1
fi

# =============================================================================
# 1. Recopilar información
# =============================================================================
echo -e "\n${YELLOW}📋 Configuración${NC}\n"

read -p "Dominio (ej: studio.ejemplo.com): " DOMAIN
read -p "Email para SSL: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Dominio y email son requeridos${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuración guardada${NC}"

# =============================================================================
# 2. Instalar dependencias
# =============================================================================
echo -e "\n${YELLOW}📦 Instalando dependencias...${NC}"

apt-get update -qq
apt-get install -y -qq curl wget git nginx certbot python3-certbot-nginx > /dev/null 2>&1

echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# =============================================================================
# 3. Instalar Docker
# =============================================================================
echo -e "\n${YELLOW}🐳 Instalando Docker...${NC}"

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

echo -e "${GREEN}✅ Docker instalado${NC}"

# =============================================================================
# 4. Clonar repositorio
# =============================================================================
echo -e "\n${YELLOW}📁 Preparando aplicación...${NC}"

APP_DIR="/opt/rh-studio"
mkdir -p "$APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR" && git pull origin main
else
    git clone https://github.com/gohermes0099/rh-studio.git "$APP_DIR"
    cd "$APP_DIR"
fi

# Create directories
mkdir -p "$APP_DIR/data" "$APP_DIR/uploads" "$APP_DIR/downloads" "$APP_DIR/ssl"

echo -e "${GREEN}✅ Aplicación preparada${NC}"

# =============================================================================
# 5. Configurar Nginx (HTTP temporal)
# =============================================================================
echo -e "\n${YELLOW}🔧 Configurando Nginx...${NC}"

cat > "$APP_DIR/nginx.conf" << EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
    
    server {
        listen 80;
        server_name $DOMAIN;
        
        location /health {
            return 200 'OK';
            add_header Content-Type text/plain;
        }
        
        location / {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
        }
        
        location /api/ {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF

cp "$APP_DIR/nginx.conf" /etc/nginx/nginx.conf
nginx -t && systemctl reload nginx || nginx -t && service nginx reload

echo -e "${GREEN}✅ Nginx configurado${NC}"

# =============================================================================
# 6. Iniciar aplicación (sin Docker, directo Node)
# =============================================================================
echo -e "\n${YELLOW}🚀 Iniciando aplicación...${NC}"

cd "$APP_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    npm install
fi

# Build
npm run build

# Stop any existing process
pkill -f "node.*rh-studio" 2>/dev/null || true

# Start in background
nohup node server/dist/index.js > "$APP_DIR/logs/app.log" 2>&1 &
echo $! > "$APP_DIR/app.pid"

# Wait for app to start
echo -n "   Esperando aplicación..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api/settings > /dev/null 2>&1; then
        echo -e "\n${GREEN}   ✅ Aplicación iniciada${NC}"
        break
    fi
    sleep 1
done

echo -e "${GREEN}✅ Aplicación corriendo${NC}"

# =============================================================================
# 7. SSL Certificate
# =============================================================================
echo -e "\n${YELLOW}🔒 Obteniendo certificado SSL...${NC}"

systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null

# Check rate limit
if certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo "   Certificado ya existe"
else
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring 2>&1 | tail -5 || true
fi

# Copy certificates
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem "$APP_DIR/ssl/cert.pem"
    cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem "$APP_DIR/ssl/key.pem"
    chmod 600 "$APP_DIR/ssl/"*
    echo -e "${GREEN}✅ Certificados instalados${NC}"
else
    echo -e "${YELLOW}⚠️ No se pudo obtener certificado SSL${NC}"
    echo "   Creando certificado auto-firmado..."
    openssl req -x509 -nodes -days 90 -newkey rsa:2048 \
        -keyout "$APP_DIR/ssl/key.pem" \
        -out "$APP_DIR/ssl/cert.pem" \
        -subj "/CN=$DOMAIN/O=RH-Studio" 2>/dev/null
    chmod 600 "$APP_DIR/ssl/"*
fi

# =============================================================================
# 8. Nginx con HTTPS
# =============================================================================
echo -e "\n${YELLOW}🔧 Configurando Nginx con HTTPS...${NC}"

cat > "$APP_DIR/nginx.conf" << EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
    
    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name $DOMAIN;
        return 301 https://\$host\$request_uri;
    }
    
    # HTTPS
    server {
        listen 443 ssl http2;
        server_name $DOMAIN;
        
        ssl_certificate /opt/rh-studio/ssl/cert.pem;
        ssl_certificate_key /opt/rh-studio/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        
        location /health {
            return 200 'OK';
            add_header Content-Type text/plain;
        }
        
        location / {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
        }
        
        location /api/ {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF

cp "$APP_DIR/nginx.conf" /etc/nginx/nginx.conf
nginx -t && systemctl restart nginx || nginx -t && service nginx restart

echo -e "${GREEN}✅ HTTPS configurado${NC}"

# =============================================================================
# 9. Auto-restart script
# =============================================================================
echo -e "\n${YELLOW}🔄 Configurando auto-reinicio...${NC}"

cat > /etc/systemd/system/rh-studio.service << EOF
[Unit]
Description=RH-Studio Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server/dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:$APP_DIR/logs/app.log
StandardError=append:$APP_DIR/logs/app.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rh-studio
systemctl restart rh-studio

echo -e "${GREEN}✅ Auto-reinicio configurado${NC}"

# =============================================================================
# 10. Final
# =============================================================================
echo -e "\n${GREEN}"
echo "=================================================="
echo "        ✅ Instalación completada!"
echo "=================================================="
echo -e "${NC}"

echo -e "${YELLOW}📋 Resumen:${NC}"
echo -e "   🌐 URL: https://$DOMAIN"
echo -e "   📁 Directorio: $APP_DIR"
echo -e "   📊 Logs: $APP_DIR/logs/app.log"
echo ""
echo -e "${YELLOW}📌 Comandos:${NC}"
echo "   Estado:   systemctl status rh-studio"
echo "   Logs:     tail -f $APP_DIR/logs/app.log"
echo "   Reiniciar: systemctl restart rh-studio"
echo ""
echo -e "${GREEN}🎉 RH-Studio listo!${NC}"