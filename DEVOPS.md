# DevOps Documentation for Comentix

This document provides instructions for deploying and maintaining the Comentix service.

## Architecture Overview
- **Frontend/Backend**: Next.js (App Router)
- **Database**: SQLite (managed via Prisma)
- **Proxy**: Nginx (Reverse Proxy)
- **Process Manager**: PM2

## 1. System Requirements
- OS: Ubuntu 20.04+ (or any Linux distribution with Node.js support)
- Node.js: v18 or higher
- npm or pnpm
- Nginx

## 2. Environment Variables
Create a `.env` file in the root directory with the following variables:

```env
DATABASE_URL="file:./dev.db"
YOUTUBE_API_KEY="your_youtube_api_key"
ADMIN_PASSWORD="your_admin_password"
```

## 3. Installation Steps

### Clone the repository
```bash
git clone <repository_url>
cd comentix
```

### Install dependencies
```bash
npm install
```

### Database Setup
Initialize the SQLite database and generate the Prisma client:
```bash
npx prisma generate
npx prisma db push
```

## 4. Production Build and Deployment

### Build the application
```bash
npm run build
```

### Start with PM2
It is recommended to use PM2 to keep the application running in the background.
```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start the application
pm2 start npm --name "comentix" -- start
```

## 5. Nginx Configuration

Create a new Nginx configuration file (e.g., `/etc/nginx/sites-available/comentix`):

```nginx
server {
    listen 80;
    server_name yourdomain.com; # Replace with your domain

    # Redirect HTTP to HTTPS (uncomment after setting up SSL)
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass http://localhost:3000; # Next.js default port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Optimization for Next.js static files
    location /_next/static {
        proxy_cache_valid 60m;
        proxy_pass http://localhost:3000;
    }
}
```

Enable the configuration and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/comentix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL Configuration (Certbot)
To secure the application with HTTPS:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 7. Maintenance

### Updating the application
```bash
git pull
npm install
npx prisma generate
npx prisma db push
npm run build
pm2 restart comentix
```

### Checking logs
```bash
pm2 logs comentix
```
