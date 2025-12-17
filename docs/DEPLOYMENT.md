# Deployment Guide

## Deployment Options

1. **Local Development** - Docker Compose
2. **Production - Docker Swarm** - Simple orchestration
3. **Production - Kubernetes** - Enterprise scale
4. **Cloud Platforms** - AWS, Azure, GCP
5. **On-Premise** - Air-gapped environments

## Prerequisites

### All Deployments
- SSL/TLS certificates
- Secure secrets management
- Database backups configured
- Monitoring and alerting setup

### Minimum Hardware
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 100GB SSD
- **Network**: 100 Mbps

### Production Hardware
- **CPU**: 16+ cores
- **RAM**: 32GB+
- **Storage**: 500GB+ SSD (NVMe recommended)
- **Network**: 1 Gbps+

## Docker Compose (Development)

```bash
# Clone and setup
git clone https://github.com/Mru00-hub/theopenhealthos.git
cd theopenhealthos

# Configure environment
cp .env.example .env
# Edit .env with secure passwords

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

## Docker Swarm (Production)

### Initialize Swarm
```bash
# On manager node
docker swarm init --advertise-addr <MANAGER-IP>

# On worker nodes
docker swarm join --token <TOKEN> <MANAGER-IP>:2377
```

### Deploy Stack
```bash
# Create secrets
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "db-password" | docker secret create postgres_password -

# Deploy
docker stack deploy -c docker-compose.prod.yml theopenhealthos

# Verify
docker stack services theopenhealthos
```

### Scale Services
```bash
docker service scale theopenhealthos_api-gateway=3
docker service scale theopenhealthos_ml-service=2
```

## Kubernetes

### Prerequisites
- Kubernetes cluster (1.25+)
- kubectl configured
- Helm 3+ installed

### Deploy with Helm
```bash
# Add repository
helm repo add theopenhealthos https://charts.openhealthos.org
helm repo update

# Install
helm install theopenhealthos theopenhealthos/theopenhealthos \
  --namespace health \
  --create-namespace \
  --set global.domain=health.yourdomain.com \
  --set postgresql.auth.password=secure-password
```

### Manual Deploy
```bash
# Apply configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmaps.yaml
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress.yaml
```

### Example Deployment
```yaml
# k8s/deployments/fhir-server.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fhir-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fhir-server
  template:
    metadata:
      labels:
        app: fhir-server
    spec:
      containers:
      - name: fhir-server
        image: hapiproject/hapi:latest
        ports:
        - containerPort: 8080
        env:
        - name: HAPI_FHIR_VERSION
          value: "R4"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
```

## Cloud Deployments

### AWS (EKS)
```bash
# Create EKS cluster
eksctl create cluster \
  --name theopenhealthos \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type m5.xlarge \
  --nodes 3

# Deploy
kubectl apply -f k8s/
```

### Azure (AKS)
```bash
# Create resource group
az group create --name theopenhealthos-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group theopenhealthos-rg \
  --name theopenhealthos-cluster \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3

# Get credentials
az aks get-credentials --resource-group theopenhealthos-rg --name theopenhealthos-cluster

# Deploy
kubectl apply -f k8s/
```

### GCP (GKE)
```bash
# Create cluster
gcloud container clusters create theopenhealthos \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-4

# Get credentials
gcloud container clusters get-credentials theopenhealthos --zone us-central1-a

# Deploy
kubectl apply -f k8s/
```

## Database Setup

### PostgreSQL (Production)
```bash
# Managed database recommended
# AWS RDS, Azure Database, Cloud SQL

# Connection string
postgresql://user:pass@host:5432/hos_db?sslmode=require

# Initialize schema
psql -h host -U user -d hos_db -f db/schema.sql
```

### MongoDB (Audit Logs)
```bash
# Managed service recommended
# MongoDB Atlas, Azure Cosmos DB

# Initialize
mongo "mongodb://host:27017/hos_audit" --eval "db.createCollection('audit_logs')"
```

## SSL/TLS Configuration

### Let's Encrypt (Free)
```bash
# Install certbot
apt-get install certbot

# Get certificate
certbot certonly --standalone -d health.yourdomain.com

# Auto-renewal
echo "0 0 * * 0 certbot renew" | crontab -
```

### Load Balancer SSL
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: theopenhealthos-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - health.yourdomain.com
    secretName: health-tls
  rules:
  - host: health.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 8000
```

## Secrets Management

### Kubernetes Secrets
```bash
# Create secrets
kubectl create secret generic hos-secrets \
  --from-literal=jwt-secret=your-secret \
  --from-literal=db-password=your-password

# Use in deployment
env:
- name: JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: hos-secrets
      key: jwt-secret
```

### HashiCorp Vault
```bash
# Store secret
vault kv put secret/theopenhealthos/jwt jwt_secret=your-secret

# Access in app
vault kv get -field=jwt_secret secret/theopenhealthos/jwt
```

## Monitoring

### Prometheus + Grafana
```bash
# Install with Helm
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

### Application Metrics
- Service health endpoints: `/health`
- Metrics endpoint: `/metrics`
- Custom dashboards in `monitoring/grafana/`

## Backup Strategy

### Automated Backups
```bash
# PostgreSQL
pg_dump -h host -U user hos_db | gzip > backup-$(date +%Y%m%d).sql.gz

# MongoDB
mongodump --uri="mongodb://host:27017/hos_audit" --gzip --archive=backup.gz

# Upload to S3
aws s3 cp backup.sql.gz s3://backups/theopenhealthos/
```

### Backup Schedule
- **Daily**: Full database backup (3am)
- **Hourly**: Transaction logs
- **Retention**: 30 days online, 1 year archive

## Disaster Recovery

### RTO/RPO Targets
- **RTO**: 1 hour
- **RPO**: 15 minutes

### Recovery Steps
1. Restore database from latest backup
2. Deploy application from last known good version
3. Verify data integrity
4. Switch DNS to recovery site
5. Monitor for issues

## Security Hardening

### Network Security
- Enable firewall (only required ports)
- Use private networks for internal services
- Enable DDoS protection
- Implement rate limiting

### Application Security
```yaml
# Security headers
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-headers
data:
  headers: |
    X-Frame-Options: DENY
    X-Content-Type-Options: nosniff
    Strict-Transport-Security: max-age=31536000
    Content-Security-Policy: default-src 'self'
```

### Compliance
- Enable audit logging
- Encrypt all data at rest
- Use TLS 1.3 for all connections
- Regular security scans
- Penetration testing (annually)

## Performance Tuning

### Database Optimization
```sql
-- PostgreSQL
CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_observations_patient ON observations(patient_id, date);

-- Vacuum and analyze
VACUUM ANALYZE;
```

### Caching
```yaml
# Redis configuration
redis:
  maxmemory: 2gb
  maxmemory-policy: allkeys-lru
  save: "900 1 300 10"
```

### Load Testing
```bash
# Apache Bench
ab -n 10000 -c 100 http://localhost:8000/api/v1/patients

# K6
k6 run loadtest.js
```

## Troubleshooting

### Check Logs
```bash
# Docker
docker-compose logs -f service-name

# Kubernetes
kubectl logs -f deployment/fhir-server
```

### Common Issues
**Service won't start**: Check secrets and environment variables
**Database connection failed**: Verify connection string and credentials
**High memory usage**: Check for memory leaks, increase limits
**Slow API responses**: Enable caching, check database indexes

## Upgrade Procedure

```bash
# Backup first
./scripts/backup.sh

# Pull new version
git pull origin main

# Update containers
docker-compose down
docker-compose pull
docker-compose up -d

# Run migrations
docker-compose exec api-gateway npm run migrate

# Verify
curl http://localhost:8000/health
```

## Rollback

```bash
# Kubernetes
kubectl rollout undo deployment/api-gateway

# Docker Swarm
docker service update --rollback theopenhealthos_api-gateway
```

## Support

- Issues: https://github.com/Mru00-hub/theopenhealthos/issues
- Email: mrudulabhalke75917@gmail.com
