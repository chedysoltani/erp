# Guide de Déploiement Production — SIT ERP
## Hostinger VPS · Docker · Nginx Proxy Manager · GitHub Actions

---

## Architecture

```
Internet
   │
   ▼
[Nginx Proxy Manager]  :80 / :443  — SSL Let's Encrypt
   ├── api.votre-domaine.com     →  [erp_backend]    Node 22 :3001
   ├── app.votre-domaine.com     →  [erp_frontend]   Nginx :80
   └── db.votre-domaine.com      →  [erp_phpmyadmin] phpMyAdmin :80
                                          │
                                 (erp-net, réseau interne)
                                          │
                                     [erp_mysql]
                                    MySQL 8.0 :3306
```

### DNS Records (Hostinger DNS Zone Editor)

| Type | Hôte | Pointe vers | Description |
|------|------|-------------|-------------|
| **A** | `api` | `YOUR_VPS_IP` | Backend Express API |
| **A** | `app` | `YOUR_VPS_IP` | Frontend Angular |
| **A** | `db` | `YOUR_VPS_IP` | phpMyAdmin — gestionnaire MySQL |

### Réseaux Docker

| Réseau | Type | Membres |
|--------|------|---------|
| `proxy-net` | externe (créé par NPM) | NPM, erp_backend, erp_frontend, erp_phpmyadmin |
| `erp-net` | interne bridge | erp_backend, erp_mysql, erp_phpmyadmin |

### Volumes persistants

| Volume | Chemin dans le container | Usage |
|--------|-------------------------|-------|
| `mysql_data` | `/var/lib/mysql` | Données MySQL |
| `uploads_data` | `/app/uploads` | Documents et fichiers uploadés |

---

## Prérequis

- VPS Hostinger Ubuntu 22.04 (minimum 2 vCPU / 4 GB RAM recommandé)
- Un nom de domaine enregistré avec accès à la zone DNS
- Un compte GitHub avec le dépôt SIT ERP
- Nginx Proxy Manager déjà installé et accessible sur le VPS

---

## Étape 1 : Initialisation du VPS

Connectez-vous en SSH à votre VPS :

```bash
ssh root@YOUR_VPS_IP
```

Mettez à jour le système et installez Docker :

```bash
apt update && apt upgrade -y
apt install -y git curl ufw

# Installer Docker Engine
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Configurer le pare-feu
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 81/tcp   # NPM admin panel
ufw enable

# Créer le réseau partagé Docker (requis avant tout autre service)
docker network create proxy-net

# Créer le dossier de l'application
mkdir -p /opt/erp
```

---

## Étape 2 : Déployer Nginx Proxy Manager

> Si NPM est déjà en cours d'exécution sur votre VPS, passez directement à l'Étape 3.

```bash
mkdir -p /opt/nginx-proxy-manager && cd /opt/nginx-proxy-manager

cat > docker-compose.yml << 'EOF'
version: "3.9"
services:
  app:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - npm_data:/data
      - npm_letsencrypt:/etc/letsencrypt
    networks:
      - proxy-net
volumes:
  npm_data:
  npm_letsencrypt:
networks:
  proxy-net:
    external: true
    name: proxy-net
EOF

docker compose up -d
```

**Première connexion** — ouvrez `http://YOUR_VPS_IP:81` :
- Email par défaut : `admin@example.com`
- Mot de passe par défaut : `changeme`
- Changez-les immédiatement.

---

## Étape 3 : Configurer les variables d'environnement sur le VPS

```bash
cd /opt/erp
git clone https://github.com/VOTRE_USERNAME/windsurf-project-2.git .
cp .env.example .env
nano .env
```

Remplissez chaque variable avec les vraies valeurs :

| Variable | Comment la générer / remplir |
|----------|------------------------------|
| `DB_ROOT_PASSWORD` | Mot de passe fort (ex : `openssl rand -hex 16`) |
| `DB_PASSWORD` | Mot de passe différent du root |
| `JWT_SECRET` | `openssl rand -hex 64` |
| `ALLOWED_ORIGINS` | `https://app.votre-domaine.com` (sans slash final) |
| `GITHUB_REPOSITORY` | `votre_username/windsurf-project-2` |
| `IMAGE_TAG` | `latest` |
| `GEMINI_API_KEY` | Votre clé depuis Google AI Studio |

Sauvegardez avec `CTRL+O`, `Entrée`, `CTRL+X`.

---

## Étape 4 : Configurer les Secrets GitHub Actions

Dans le dépôt GitHub → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret | Description | Exemple |
|--------|-------------|---------|
| `VPS_HOST` | IP publique du VPS Hostinger | `176.32.45.12` |
| `VPS_USER` | Utilisateur SSH | `root` |
| `VPS_SSH_KEY` | Clé privée SSH complète | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `GHCR_TOKEN` | GitHub PAT avec scope `read:packages` | `ghp_xxxxxxxxxxxx` |
| `API_URL` | URL complète de l'API backend | `https://api.votre-domaine.com/api` |

**Générer une paire de clés SSH dédiée (depuis votre machine locale) :**

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/erp_deploy_key
ssh-copy-id -i ~/.ssh/erp_deploy_key.pub root@YOUR_VPS_IP
# Copier la clé PRIVÉE dans le secret VPS_SSH_KEY sur GitHub
cat ~/.ssh/erp_deploy_key
```

---

## Étape 5 : Premier déploiement

Se connecter à GHCR sur le VPS (une seule fois) :

```bash
echo "VOTRE_GITHUB_PAT" | docker login ghcr.io -u VOTRE_USERNAME --password-stdin
```

Déclencher le premier pipeline en poussant sur `main` :

```bash
git push origin main
```

Le workflow GitHub Actions va automatiquement :
1. Builder l'image backend et la pousser sur GHCR
2. Builder l'image frontend avec l'URL de l'API et la pousser sur GHCR
3. SSH dans le VPS, `git pull`, `docker compose pull`, `docker compose up -d`

Vérifier l'état des containers :

```bash
docker compose -f /opt/erp/docker-compose.yml ps
```

Résultat attendu :

| Nom | Status |
|-----|--------|
| `erp_mysql` | `healthy` |
| `erp_backend` | `running` |
| `erp_frontend` | `running` |
| `erp_phpmyadmin` | `running` |

---

## Étape 6 : Configurer les Proxy Hosts dans NPM

### A. Backend API (`api.votre-domaine.com`)

1. NPM admin → **Proxy Hosts → Add Proxy Host**
2. **Domain Names** : `api.votre-domaine.com`
3. **Scheme** : `http` | **Forward Hostname** : `erp_backend` | **Forward Port** : `3001`
4. **Block Common Exploits** : ON
5. Onglet **SSL** → Request a new SSL Certificate → Force SSL ON → Save

### B. Frontend Angular (`app.votre-domaine.com`)

1. Add Proxy Host
2. **Domain Names** : `app.votre-domaine.com`
3. **Scheme** : `http` | **Forward Hostname** : `erp_frontend` | **Forward Port** : `80`
4. **Block Common Exploits** : ON
5. Onglet **SSL** → Request a new SSL Certificate → Force SSL ON → Save

### C. phpMyAdmin (`db.votre-domaine.com`)

1. Add Proxy Host
2. **Domain Names** : `db.votre-domaine.com`
3. **Scheme** : `http` | **Forward Hostname** : `erp_phpmyadmin` | **Forward Port** : `80`
4. **Block Common Exploits** : ON
5. Onglet **SSL** → Request a new SSL Certificate → Force SSL ON → Save

> **Sécurité** : Limitez l'accès à phpMyAdmin à votre IP uniquement via NPM → Access Lists.

---

## Commandes de maintenance

### Logs en temps réel

```bash
docker compose -f /opt/erp/docker-compose.yml logs -f backend
docker compose -f /opt/erp/docker-compose.yml logs -f mysql
```

### Redémarrer un service

```bash
docker compose -f /opt/erp/docker-compose.yml restart backend
```

### Accéder à MySQL en ligne de commande

```bash
docker exec -it erp_mysql mysql -u root -p sit_erp_db
```

### Exécuter une migration SQL manuellement

```bash
docker exec -i erp_mysql mysql -u ${DB_USER} -p${DB_PASSWORD} sit_erp_db \
  < /opt/erp/database/nouvelle_migration.sql
```

### Backup de la base de données

```bash
mkdir -p /opt/erp/backups
docker exec erp_mysql mysqldump -u root -p${DB_ROOT_PASSWORD} sit_erp_db \
  > /opt/erp/backups/sit_erp_db_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurer un backup

```bash
docker exec -i erp_mysql mysql -u root -p${DB_ROOT_PASSWORD} sit_erp_db \
  < /opt/erp/backups/sit_erp_db_YYYYMMDD_HHMMSS.sql
```

### Redéploiement manuel (sans CI/CD)

```bash
cd /opt/erp
git pull origin main
docker compose pull backend frontend
docker compose up -d --remove-orphans
docker image prune -f
```

---

## Dépannage

| Problème | Cause probable | Solution |
|----------|---------------|---------|
| Backend ne démarre pas | MySQL pas encore prêt | L'entrypoint.sh attend automatiquement (30 tentatives × 2s). Vérifier `docker compose logs backend` |
| Erreur CORS | `ALLOWED_ORIGINS` incorrect | Vérifier la valeur dans `.env` (sans slash final), puis `docker compose restart backend` |
| Routes Angular retournent 404 | Problème SPA routing | Le nginx config est embarqué dans l'image — vérifier que l'image est bien reconstruite |
| SSL ne s'émet pas | DNS pas propagé ou port 80 fermé | `nslookup api.votre-domaine.com` — vérifier `ufw status` |
| Fichiers uploadés perdus | Volume non monté | `docker inspect erp_backend \| grep -A5 Mounts` |
| phpMyAdmin inaccessible | Container pas démarré | `docker compose -f /opt/erp/docker-compose.yml up -d phpmyadmin` |

---

## Vérification finale

1. `https://api.votre-domaine.com/api/users` retourne `401 Unauthorized` → l'API répond
2. `https://app.votre-domaine.com` affiche la page de login Angular
3. Connexion admin fonctionne
4. `https://db.votre-domaine.com` affiche l'interface phpMyAdmin → connexion avec `root`
5. Upload d'un document → fichier persiste après `docker compose restart backend`
6. Push sur `main` → pipeline GitHub Actions vert, nouveaux containers déployés
