# Getting Started with TheOpenHealthOS

## Prerequisites

- **Docker**: 20.10+ and Docker Compose
- **Node.js**: 18+ (for simulators)
- **Python**: 3.9+ (for ML service)
- **Git**: For cloning the repository
- **4GB RAM minimum** (8GB recommended)
- **10GB disk space**

## Quick Start (5 minutes)

### 1. Clone the Repository
```bash
git clone https://github.com/Mru00-hub/theopenhealthos.git
cd theopenhealthos
```

### 2. Create Environment File
```bash
cp .env.example .env
```

Edit `.env` and set secure passwords:
```bash
JWT_SECRET=your-secret-key-change-this
POSTGRES_PASSWORD=secure-password
MONGO_PASSWORD=secure-password
RABBITMQ_PASSWORD=secure-password
```

### 3. Start All Services
```bash
docker-compose up -d
```

### 4. Verify Services
```bash
# Check all services are running
docker-compose ps

# Should show all services as "healthy" or "running"
```

### 5. Access the Simulators
- **Layer 1 - Architecture Explorer**: http://localhost:3001
- **Layer 2 - Microservices Simulator**: http://localhost:3000
- **Layer 3 - Patient Journey**: http://localhost:3002

### 6. Access Services
- **FHIR Server**: http://localhost:8080/fhir
- **API Gateway**: http://localhost:8000
- **RabbitMQ Management**: http://localhost:15672 (user: hos_admin)

## First Steps

### Test the FHIR Server
```bash
# Get server metadata
curl http://localhost:8080/fhir/metadata

# Create a test patient
curl -X POST http://localhost:8080/fhir/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Patient",
    "name": [{"family": "Doe", "given": ["John"]}],
    "gender": "male"
  }'
```

### Run the Microservices Simulator
1. Open http://localhost:3000
2. Click "Start All Services"
3. Click "Patient Admission Flow"
4. Watch the services interact in real-time

### Explore the Architecture
1. Open http://localhost:3001
2. Click through each layer to understand the system
3. View data flows and component relationships

## Development Workflow

### Working on a Service

```bash
# Stop just one service
docker-compose stop ml-service

# Rebuild and restart
docker-compose up -d --build ml-service

# View logs
docker-compose logs -f ml-service
```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests (requires services running)
npm run test:integration

# FHIR compliance tests
npm run test:fhir
```

### Making Changes

```bash
# Create a feature branch
git checkout -b feature/my-feature

# Make changes, then run linting
npm run lint
npm run format

# Run tests
npm test

# Commit and push
git add .
git commit -m "feat: add new feature"
git push origin feature/my-feature
```

## Common Tasks

### Add a New Patient
```javascript
// Using the API Gateway
fetch('http://localhost:8000/api/v1/patients', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    name: 'Jane Smith',
    age: 35,
    mrn: 'MRN-12345'
  })
})
```

### Send Device Data
```bash
# HL7 message via device gateway
echo "MSH|^~\&|Device|Hospital|..." | nc localhost 2575
```

### Train an ML Model
```bash
# Access ML service
curl -X POST http://localhost:5000/models/train \
  -H "Content-Type: application/json" \
  -d '{"model_type": "readmission", "dataset": "patients_2024"}'
```

## Troubleshooting

### Services Won't Start
```bash
# Check for port conflicts
docker-compose down
lsof -i :8080  # Check if port is in use

# Remove old volumes and restart
docker-compose down -v
docker-compose up -d
```

### FHIR Server Not Responding
```bash
# Check logs
docker-compose logs fhir-server

# Restart with fresh database
docker-compose down
docker volume rm openhealthos_fhir-data
docker-compose up -d fhir-server
```

### Out of Memory
```bash
# Increase Docker memory limit to 4GB minimum
# Docker Desktop → Settings → Resources → Memory
```

### Database Connection Errors
```bash
# Wait for database to be ready
docker-compose up -d postgres
sleep 10
docker-compose up -d
```

## Next Steps

- Read the [Architecture Guide](ARCHITECTURE.md) for deep dive
- Check the [API Reference](API_REFERENCE.md) for endpoints
- Review [Deployment Guide](DEPLOYMENT.md) for production setup
- Join our [Discord community](#) for support
- Browse [examples/](../examples/) for code samples

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/yourusername/openhealthos/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/openhealthos/discussions)
- **Email**: mrudulabhalke75917@gmail.com

## Contributing

Ready to contribute? See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
