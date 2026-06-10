# RH-Studio Dockerfile
# Production image using sql.js (no native compilation needed)

FROM node:20-alpine

WORKDIR /app

# Copy workspace files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Install all dependencies
RUN npm install

# Copy all source code
COPY . .

# Build client and server
RUN npm run build

# Create directories for data
RUN mkdir -p /app/data /app/uploads /app/downloads /app/logs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/settings || exit 1

# Start server
CMD ["node", "server/dist/index.js"]