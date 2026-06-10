#!/bin/bash

# =============================================================================
# RH-Studio Auto-Installer
# =============================================================================
# Instalador automático para RH-Studio con Nginx, SSL y Docker
# =============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "=================================================="
echo "          RH-Studio Auto-Installer v1.0"
echo "=================================================="
echo -e "${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Este script debe ejecutarse como root (sudo)${NC}"
   exit 1
fi

# =============================================================================
# 1. Recopilar información del usuario
# =============================================================================
echo -e "\n${YELLOW}📋 Configuración inicial${NC}\n"

# Función para preguntar con valor por defecto
ask() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        value="${value:-$default}"
    else
        read -p "$prompt: " value
    fi
    
    declare "$var_name=$value"
}

# Pedir información
echo -e "${YELLOW}--- Datos del administrador ---${NC}"
ask "Nombre de usuario admin" "" ADMIN_USER
ask "Contraseña admin" "" ADMIN_PASSWORD

echo -e "\n${YELLOW}--- Configuración del dominio ---${NC}"
ask "Dominio (ej: studio.ejemplo.com)" "" DOMAIN

# Validaciones básicas
if [ -z "$ADMIN_USER" ] || [ -z "$ADMIN_PASSWORD" ] || [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ Todos los campos son requeridos${NC}"
    exit 1
fi

# Validar formato de dominio
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$ ]]; then
    echo -e "${RED}❌ Dominio inválido${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ Configuración básica completada${NC}"

# =============================================================================
# 2. Detectar sistema y preparar entorno
# =============================================================================
echo -e "\n${YELLOW}🔧 Preparando entorno...${NC}"

# Detectar SO
if [ -f /etc/debian_version ]; then
    OS="debian"
    PKG_MANAGER="apt-get"
elif [ -f /etc/redhat-release ]; then
    OS="rhel"
    PKG_MANAGER="yum"
elif [ -f /etc/alpine-release ]; then
    OS="alpine"
    PKG_MANAGER="apk"
else
    OS="unknown"
    PKG_MANAGER="unknown"
fi

echo -e "   Sistema: ${OS}"
echo -e "   Gestor: ${PKG_MANAGER}"

# =============================================================================
# 3. Instalar dependencias del sistema
# =============================================================================
echo -e "\n${YELLOW}📦 Instalando dependencias del sistema...${NC}"

if [ "$OS" = "debian" ]; then
    apt-get update
    apt-get install -y curl wget git certbot python3-certbot-nginx nginx
elif [ "$OS" = "rhel" ]; then
    yum install -y curl wget git certbot python3-certbot-nginx nginx
elif [ "$OS" = "alpine" ]; then
    apk add --no-cache curl wget git certbot python3 nginx
fi

echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# =============================================================================
# 4. Instalar Docker
# =============================================================================
echo -e "\n${YELLOW}🐳 Instalando Docker...${NC}"

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✅ Docker instalado${NC}"
else
    echo -e "${GREEN}✓ Docker ya está instalado${NC}"
fi

# =============================================================================
# 5. Preparar directorio de la aplicación
# =============================================================================
echo -e "\n${YELLOW}📁 Preparando directorio de la aplicación...${NC}"

APP_DIR="/opt/rh-studio"

# Clonar o actualizar repositorio
if [ -d "$APP_DIR/.git" ]; then
    echo "   Actualizando repositorio existente..."
    cd "$APP_DIR"
    git pull origin main
else
    echo "   Clonando repositorio..."
    git clone https://github.com/gohermes0099/rh-studio.git "$APP_DIR"
    cd "$APP_DIR"
fi

# Crear directorios necesarios
mkdir -p "$APP_DIR/data"
mkdir -p "$APP_DIR/uploads"
mkdir -p "$APP_DIR/downloads"
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/ssl"

echo -e "${GREEN}✅ Directorios preparados${NC}"

# =============================================================================
# 6. Configurar Nginx con dominio temporal (HTTP)
# =============================================================================
echo -e "\n${YELLOW}🔧 Configurando Nginx (HTTP temporal)...${NC}"

cat > "$APP_DIR/nginx.conf" << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Server HTTP (temporal, luego redirige a HTTPS)
    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;

        location /health {
            return 200 "OK";
            add_header Content-Type text/plain;
        }

        location / {
            proxy_pass http://app:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_cache_bypass $http_upgrade;
        }

        # API proxy
        location /api/ {
            proxy_pass http://app:3001;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # WebSocket support
        location /ws {
            proxy_pass http://app:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
EOF

# Reemplazar placeholder con el dominio real
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$APP_DIR/nginx.conf"

# Copiar configuración de Nginx
cp "$APP_DIR/nginx.conf" /etc/nginx/nginx.conf

# Reiniciar Nginx
nginx -t && systemctl reload nginx || nginx -t && service nginx reload

echo -e "${GREEN}✅ Nginx configurado (HTTP)${NC}"

# =============================================================================
# 7. Build y start de la aplicación con Docker
# =============================================================================
echo -e "\n${YELLOW}🐳 Construyendo y iniciando aplicación...${NC}"

cd "$APP_DIR"

# Build Docker image
docker build -t rh-studio:latest .

# Start con docker-compose
docker-compose up -d

# Esperar a que la app esté lista
echo -e "   Esperando a que la aplicación responda..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api/settings > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Aplicación iniciada${NC}"
        break
    fi
    sleep 1
done

echo -e "${GREEN}✅ Aplicación corriendo${NC}"

# =============================================================================
# 8. Obtener certificado SSL con Let's Encrypt
# =============================================================================
echo -e "\n${YELLOW}🔒 Obteniendo certificado SSL...${NC}"

# Detener Nginx temporalmente
systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null

# Generar certificado
certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --keep-until-expiring

# Crear directorio para SSL
mkdir -p "$APP_DIR/ssl"

# Copiar certificados
cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem "$APP_DIR/ssl/cert.pem"
cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem "$APP_DIR/ssl/key.pem"

chmod 600 "$APP_DIR/ssl/"*

echo -e "${GREEN}✅ Certificado SSL obtenido${NC}"

# =============================================================================
# 9. Actualizar Nginx con HTTPS
# =============================================================================
echo -e "\n${YELLOW}🔧 Actualizando Nginx con HTTPS...${NC}"

cat > "$APP_DIR/nginx.conf" << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name DOMAIN_PLACEHOLDER;

        # SSL Configuration
        ssl_certificate /app/ssl/cert.pem;
        ssl_certificate_key /app/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Logging
        access_log /var/log/nginx/access.log;
        error_log /var/log/nginx/error.log;

        # Gzip
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

        # Health check
        location /health {
            return 200 "OK";
            add_header Content-Type text/plain;
        }

        # Main application
        location / {
            proxy_pass http://app:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # API proxy
        location /api/ {
            proxy_pass http://app:3001;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket support
        location /ws {
            proxy_pass http://app:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
EOF

sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$APP_DIR/nginx.conf"
cp "$APP_DIR/nginx.conf" /etc/nginx/nginx.conf

# Reiniciar Nginx
nginx -t && systemctl restart nginx || nginx -t && service nginx restart

echo -e "${GREEN}✅ Nginx con HTTPS configurado${NC}"

# =============================================================================
# 10. Configurar SSL renewal automático
# =============================================================================
echo -e "\n${YELLOW}🔄 Configurando renovación automática de SSL...${NC}"

# Crear script de renovación
cat > /etc/cron.d/certbot-renew << EOF
0 0 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"
EOF

echo -e "${GREEN}✅ Renovación automática configurada${NC}"

# =============================================================================
# 11. Guardar credenciales iniciales en la base de datos
# =============================================================================
echo -e "\n${YELLOW}🔑 Configurando usuario administrador...${NC}"

# Insertar usuario admin en settings
docker exec rh-studio-app node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/data/rh-studio.db');
db.exec(\"INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_user', '$ADMIN_USER')\");
db.exec(\"INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', '$ADMIN_PASSWORD')\");
db.exec(\"INSERT OR IGNORE INTO settings (key, value) VALUES ('domain', '$DOMAIN')\");
console.log('✅ Admin configured');
db.close();
"

# =============================================================================
# 12. Finalización
# =============================================================================
echo -e "\n${GREEN}"
echo "=================================================="
echo "         ✅ Instalación completada!"
echo "=================================================="
echo -e "${NC}"

echo -e "${YELLOW}📋 Resumen:${NC}"
echo -e "   🌐 URL: https://$DOMAIN"
echo -e "   👤 Usuario: $ADMIN_USER"
echo -e "   📁 Directorio: $APP_DIR"
echo -e "   🐳 Docker: rh-studio-app, rh-studio-nginx"
echo ""
echo -e "${YELLOW}📌 Comandos útiles:${NC}"
echo "   Ver estado:    docker-compose -f $APP_DIR/docker-compose.yml ps"
echo "   Ver logs:      docker-compose -f $APP_DIR/docker-compose.yml logs -f"
echo "   Reiniciar:    docker-compose -f $APP_DIR/docker-compose.yml restart"
echo "   Detener:      docker-compose -f $APP_DIR/docker-compose.yml down"
echo ""
echo -e "${GREEN}🎉 RH-Studio está listo!${NC}"