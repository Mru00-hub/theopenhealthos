import time
import logging
import requests 
import random
from flask import Flask, jsonify, request
from flask_cors import CORS

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('hos-ml-orchestrator')

app = Flask(__name__)
CORS(app)

# --- SERVICE DISCOVERY (Distributed Architecture) ---
REGISTRY_URL = "http://model-registry:5001"
VALIDATION_URL = "http://validation-gateway:5002"
LLM_URL = "http://llm-service:5003"

model_versions = {}

def get_next_version(model_id):
    current = model_versions.get(model_id, 0)
    model_versions[model_id] = current + 1
    return f"v{1}.{model_versions[model_id]}"

logger.info(f"ML Service Online. Configuration:")
logger.info(f" - Registry: {REGISTRY_URL}")
logger.info(f" - Validation: {VALIDATION_URL}")

# --- LOCAL INTELLIGENCE ENGINES (Preserved from your previous version) ---

def check_drift(features):
    """Simulates drift detection logic locally"""
    alerts = []
    # Drift Rules
    if features.get('age', 0) > 85: alerts.append("Age deviation (>85)")
    if features.get('systolic_bp', 120) > 170: alerts.append("BP critical outlier")
    return alerts

def generate_shap(features, risk_score):
    """Simulates SHAP explainability locally"""
    contributors = []
    if features.get('age', 0) > 60:
        contributors.append({"feature": "Age", "impact": "+15%", "reason": "Geriatric risk"})
    if features.get('condition') == "Hypertension":
        contributors.append({"feature": "Condition", "impact": "+25%", "reason": "Comorbidity"})
    
    if not contributors:
        contributors.append({"feature": "Baseline", "impact": "10%", "reason": "Standard Risk"})
    return contributors

def run_plugin_logic(model_id, features):
    if 'readmission' in model_id:
        score = 40 + (20 if features.get('age', 0) > 60 else 0)
        return {'score': score, 'label': 'High Risk' if score > 50 else 'Low Risk'}
    elif 'sepsis' in model_id:
        score = 10 + (50 if features.get('systolic_bp', 120) < 100 else 0)
        return {'score': score, 'label': 'Sepsis Alert' if score > 40 else 'Normal'}
    else:
        return {'score': random.randint(10, 90), 'label': 'General Risk'}
        
# --- ROUTES ---

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'online', 'service': 'ml-orchestrator', 'mode': 'distributed'})

# 1. ORCHESTRATED INFERENCE (The Main Event)
@app.route('/predict/<model_id>', methods=['POST'])
def predict(model_id):
    logger.info(f"Received PREDICT request for: {model_id}")
    # A. GOVERNANCE CHECK (Call Model Registry)
    try:
        # Verify model exists and is in production
        logger.info(f"Checking Governance at {REGISTRY_URL}/models...")
        reg_res = requests.get(f"{REGISTRY_URL}/models")
        catalog = reg_res.json()
        model_meta = catalog.get(model_id)
        
        if not model_meta:
            # Soft fallback for simulation if registry is empty
            logger.warning(f"Model {model_id} not found in registry. Using fallback.")
            model_meta = {'status': 'production', 'version': 'v1.0.0 (Fallback)'}
        elif model_meta.get('status') != 'production':
            return jsonify({'error': 'Model not authorized for production'}), 403
            
    except Exception as e:
        logger.error(f"Registry Error: {e}")
        # Fail open for demo purposes, or return 503 in strict mode
        model_meta = {'version': 'unknown', 'status': 'registry_offline'}

    # B. EXECUTION (Run Local Logic)
    features = request.json.get('features', {})
    result = run_plugin_logic(model_id, features)
    
    # C. SAFETY (Run Drift & XAI)
    drift_alerts = check_drift(features)
    xai = generate_shap(features, result['score'])

    response = {
        'metadata': {'model': model_id, 'version': model_meta.get('version')},
        'prediction': {'risk_score': result['score'], 'label': result['label']},
        'safety_guardrails': {'drift_detected': len(drift_alerts) > 0, 'drift_reasons': drift_alerts},
        'explainability': {'contributors': xai}
    }
    logger.info("Inference successful.")
    return jsonify(response)

# 2. LIFECYCLE PIPELINE (Train -> Register -> Validate -> Promote)
@app.route('/train', methods=['POST'])
def train_pipeline():
    model_name = request.json.get('modelType', 'custom-v1')
    new_version = get_next_version(model_name)
    
    logger.info(f"Starting Training: {model_name} -> {new_version}")
    
    # 1. Simulate Training Time
    time.sleep(1)
    
    # 2. Randomize Metrics (Realism)
    # Accuracy fluctuates between 82% and 98%
    accuracy = round(random.uniform(0.82, 0.98), 3)
    metrics = {'accuracy': accuracy, 'bias_score': 0.02}
    
    try:
        # 3. Register New Version
        reg_payload = {'name': model_name, 'owner': 'hospital-ai', 'version': new_version}
        requests.post(f"{REGISTRY_URL}/models/register", json=reg_payload, timeout=5)
        
        # 4. Validate
        val_res = requests.post(f"{VALIDATION_URL}/validate", json={'model_id': model_name, 'metrics': metrics}, timeout=5)
        val_data = val_res.json()
        is_approved = val_data.get('approved', False)
        
        # 5. Promote if Good
        final_status = "rejected"
        if is_approved:
            requests.post(f"{REGISTRY_URL}/models/{model_name}/promote")
            final_status = "promoted_to_production"
            
        return jsonify({
            'status': final_status,
            'validation_report': {
                'model_id': f"{model_name}-{new_version}",
                'accuracy': accuracy,
                'approved': is_approved
            }
        })
    except Exception as e:
        logger.error(f"Pipeline Error: {e}")
        return jsonify({'error': str(e)}), 500
        
# 3. GEN-AI PROXY
@app.route('/genai/consult', methods=['POST'])
def genai_consult():
    try:
        # Forward to LLM Service
        resp = requests.post(f"{LLM_URL}/generate", json=request.json, timeout=5)
        return jsonify(resp.json())
    except Exception as e:
        logger.exception("GenAI Consult failure") 
        return jsonify({'error': 'LLM Service Unavailable', 'details': str(e)}), 503

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
