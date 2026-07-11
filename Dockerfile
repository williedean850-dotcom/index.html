FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production

# Copy app source
COPY . .

# Set environment
ENV NODE_ENV=production

EXPOSE 3000

# Start the server
CMD ["node","server.js"]
