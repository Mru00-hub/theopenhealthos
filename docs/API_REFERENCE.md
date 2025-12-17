# API Reference

## Base URLs

- **Local Development**: `http://localhost:8000`
- **API Gateway**: `/api/v1`
- **FHIR Server**: `http://localhost:8080/fhir`

## Authentication

All API requests require authentication via JWT tokens.

```bash
# Get access token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}'

# Use token in requests
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/patients
```

## Core APIs

### Patients

#### List Patients
```http
GET /api/v1/patients
```

**Query Parameters:**
- `limit` (integer): Max results (default: 50)
- `offset` (integer): Pagination offset
- `search` (string): Search by name or MRN

**Response:**
```json
{
  "total": 150,
  "patients": [
    {
      "id": "pt-123",
      "mrn": "MRN-12345",
      "name": "John Doe",
      "dob": "1985-06-15",
      "gender": "male"
    }
  ]
}
```

#### Get Patient
```http
GET /api/v1/patients/{id}
```

#### Create Patient
```http
POST /api/v1/patients
Content-Type: application/json

{
  "mrn": "MRN-12345",
  "name": "Jane Smith",
  "dob": "1990-03-20",
  "gender": "female"
}
```

#### Update Patient
```http
PUT /api/v1/patients/{id}
```

#### Delete Patient
```http
DELETE /api/v1/patients/{id}
```

### Vital Signs

#### Record Vitals
```http
POST /api/v1/patients/{id}/vitals
Content-Type: application/json

{
  "timestamp": "2024-12-17T10:30:00Z",
  "heartRate": 72,
  "bloodPressure": "120/80",
  "temperature": 98.6,
  "spo2": 98
}
```

#### Get Vital History
```http
GET /api/v1/patients/{id}/vitals?start=2024-01-01&end=2024-12-31
```

### Medical Devices

#### Register Device
```http
POST /api/v1/devices
Content-Type: application/json

{
  "deviceId": "DEV-001",
  "type": "vital-signs-monitor",
  "manufacturer": "Acme Medical",
  "model": "VM-3000"
}
```

#### Send Device Data
```http
POST /api/v1/devices/{deviceId}/data
Content-Type: application/json

{
  "patientId": "pt-123",
  "readings": {
    "heartRate": 75,
    "spo2": 97
  }
}
```

### ML Predictions

#### Get Risk Score
```http
POST /api/v1/ml/predict/readmission
Content-Type: application/json

{
  "patientId": "pt-123",
  "features": {
    "age": 65,
    "comorbidities": ["diabetes", "hypertension"],
    "previousAdmissions": 2
  }
}
```

**Response:**
```json
{
  "riskScore": 0.72,
  "confidence": 0.85,
  "factors": ["age", "previousAdmissions"],
  "recommendation": "High risk - consider discharge planning"
}
```

#### Train Model
```http
POST /api/v1/ml/models/train
Content-Type: application/json

{
  "modelType": "readmission",
  "datasetId": "dataset-2024",
  "hyperparameters": {
    "learningRate": 0.001,
    "epochs": 100
  }
}
```

### Clinical Decision Support

#### Get Recommendations
```http
POST /api/v1/cdss/recommend
Content-Type: application/json

{
  "patientId": "pt-123",
  "context": "medication-review",
  "conditions": ["hypertension", "diabetes"]
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "type": "drug-interaction",
      "severity": "moderate",
      "message": "Check ACE inhibitor dosage with current potassium levels"
    }
  ]
}
```

## FHIR API

Full FHIR R4 support via HAPI FHIR server.

### Base URL
`http://localhost:8080/fhir`

### Common Resources

#### Patient
```http
GET /fhir/Patient/123
POST /fhir/Patient
PUT /fhir/Patient/123
```

#### Observation (Vitals, Labs)
```http
GET /fhir/Observation?patient=123&category=vital-signs
POST /fhir/Observation
```

#### MedicationRequest
```http
GET /fhir/MedicationRequest?patient=123&status=active
POST /fhir/MedicationRequest
```

### Search Parameters

```http
# Search patients by name
GET /fhir/Patient?name=Smith

# Search observations by patient and date
GET /fhir/Observation?patient=123&date=ge2024-01-01

# Include related resources
GET /fhir/Patient/123?_revinclude=Observation:patient
```

## Error Responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid patient ID format",
    "details": ["ID must be alphanumeric"]
  }
}
```

**Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error

## Rate Limits

- **Anonymous**: 100 requests/hour
- **Authenticated**: 1000 requests/hour
- **Premium**: 10,000 requests/hour

## WebSocket API

### Connect
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'patient.pt-123.vitals'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time vital signs:', data);
};
```

### Channels
- `patient.{id}.vitals` - Real-time vital signs
- `alerts` - System-wide alerts
- `device.{id}.status` - Device status updates

## SDKs

### JavaScript/Node.js
```bash
npm install @theopenhealthos/client
```

```javascript
import { TheOpenHealthOS } from '@theopenhealthos/client';

const client = new TheOpenHealthOS({
  baseUrl: 'http://localhost:8000',
  apiKey: 'your-api-key'
});

const patients = await client.patients.list();
```

### Python
```bash
pip install theopenhealthos-client
```

```python
from theopenhealthos import Client

client = Client(api_key='your-api-key')
patients = client.patients.list()
```

## Pagination

All list endpoints support pagination:

```http
GET /api/v1/patients?limit=50&offset=0
```

**Response includes:**
```json
{
  "total": 500,
  "limit": 50,
  "offset": 0,
  "next": "/api/v1/patients?limit=50&offset=50",
  "results": [...]
}
```

## Filtering

Most endpoints support filtering:

```http
GET /api/v1/patients?gender=female&age_gt=50&age_lt=70
```

**Operators:**
- `eq` - Equal (default)
- `gt` - Greater than
- `lt` - Less than
- `gte` - Greater than or equal
- `lte` - Less than or equal
- `in` - In list

## Versioning

API version in URL: `/api/v1/`, `/api/v2/`

**Version Support:**
- Current: v1
- Deprecated: None yet
- EOL Policy: 12 months notice

## Further Documentation

- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [Authentication Guide](AUTH.md)
- [Webhooks](WEBHOOKS.md)
- [SDK Documentation](SDK.md)
