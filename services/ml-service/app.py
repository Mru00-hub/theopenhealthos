import time
import logging
import random
import json
from flask import Flask, jsonify, request

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('hos-ml-ops')

app = Flask(__name__)

# --- 1. MODEL REGISTRY & STATE ---
model_registry = {
    "current_version": "v1.0.0",
    "history": ["v1.0.0"],
    "status": "active",
    "deployment_mode": "champion_challenger" # Supporting A/B testing pattern
}

# --- 2. PERFORMANCE MONITORING ---
inference_stats = {
    'total_requests': 0,
    'total_drift_alerts': 0,
    'avg_latency_ms': 45.0 # Baseline
}

# --- 3. HELPER: DRIFT MONITOR ---
def check_data_drift(features):
    drift_alerts = []
    # Simulating training baseline: Age 20-80, BP 90-160
    if features.get('age', 0) > 85:
        drift_alerts.append("Age deviation (>85)")
    if features.get('systolic_bp', 120) > 170:
        drift_alerts.append("BP critical outlier (>170)")
    
    if drift_alerts:
        inference_stats['total_drift_alerts'] += 1
        
    return drift_alerts

# --- 4. HELPER: EXPLAINABILITY ENGINE (Enhanced) ---
def generate_explanation(features, risk_score):
    contributors = []
    if features.get('age', 0) > 60:
        contributors.append({
            "feature": "Age", 
            "impact": "+15%", 
            "reason": "Geriatric risk factor",
            "confidence_interval": {"lower": 12, "upper": 18} 
        })
    if features.get('condition') == "Hypertension":
        contributors.append({
            "feature": "Condition", 
            "impact": "+25%", 
            "reason": "Strong correlation with readmission",
            "confidence_interval": {"lower": 22, "upper": 28}
        })
    if len(contributors) == 0:
        contributors.append({"feature": "Baseline", "impact": "10%", "reason": "General population risk"})
    return contributors

# --- CORE LOGIC: PREDICTION ---
def predict_single(features):
    start_time = time.time()
    
    # 1. Check Drift
    drift_warnings = check_data_drift(features)
    is_out_of_distribution = len(drift_warnings) > 0
    
    # 2. Calculate Score (Mock logic)
    base_risk = 30
    if features.get('age', 0) > 50: base_risk += 20
    if features.get('condition') == 'Hypertension': base_risk += 30
    risk_score = min(base_risk + random.randint(-5, 5), 99)
    
    # 3. Generate XAI
    explanation = generate_explanation(features, risk_score)
    
    # Update Stats
    inference_stats['total_requests'] += 1
    latency = (time.time() - start_time) * 1000
    inference_stats['avg_latency_ms'] = (inference_stats['avg_latency_ms'] + latency) / 2
    
    return {
        'metadata': {
            'model_version': model_registry['current_version'],
            'generated_at': time.time()
        },
        'prediction': {
            'risk_score': risk_score,
            'label': 'High Risk' if risk_score > 50 else 'Low Risk'
        },
        'explainability': {
            'contributors': explanation,
            'method': 'SHAP-Approximation'
        },
        'safety_guardrails': {
            'drift_detected': is_out_of_distribution,
            'drift_reasons': drift_warnings,
            'confidence': 'LOW' if is_out_of_distribution else 'HIGH'
        }
    }

# --- ROUTES ---

@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy', 
        'service': 'ml-service', 
        'model_version': model_registry['current_version']
    })

@app.route('/metrics')
def metrics():
    return jsonify(inference_stats)

# LIFECYCLE: Validate Model Safety
@app.route('/validate', methods=['POST'])
def validate_model():
    # Simulate running a test suite against a holdout dataset
    logger.info("Running validation suite...")
    time.sleep(1.0) 
    
    test_metrics = {
        'accuracy': 0.92,
        'sensitivity': 0.88,  # Critical for healthcare (Catching True Positives)
        'specificity': 0.90,
        'auc_roc': 0.94
    }
    
    # Automated Safety Gates
    passed = all([
        test_metrics['sensitivity'] >= 0.85, 
        test_metrics['auc_roc'] >= 0.90
    ])
    
    return jsonify({
        'validation_passed': passed,
        'metrics': test_metrics,
        'safety_audit': ['bias_check_passed', 'fairness_check_passed']
    })

# LIFECYCLE: Train & Promote
@app.route('/train', methods=['POST'])
def train_model():
    data = request.get_json()
    logger.info(f"Starting retraining pipeline for {data.get('modelType')}...")
    
    # Simulate heavy training
    time.sleep(1.5)
    
    # Versioning Logic
    old_v = model_registry['current_version']
    major, minor, patch = map(int, old_v.replace('v', '').split('.'))
    new_v = f"v{major}.{minor + 1}.0"
    
    # Auto-Promote
    model_registry['current_version'] = new_v
    model_registry['history'].append(new_v)
    
    return jsonify({
        'status': 'success',
        'lifecycle_event': 'VERSION_PROMOTION',
        'previous_version': old_v,
        'new_version': new_v,
        'note': 'Model auto-validated and promoted to Champion'
    })

# LIFECYCLE: Emergency Rollback
@app.route('/rollback', methods=['POST'])
def rollback():
    if len(model_registry['history']) < 2:
        return jsonify({'error': 'No previous version available'}), 400
    
    # Revert to previous
    bad_version = model_registry['history'].pop()
    model_registry['current_version'] = model_registry['history'][-1]
    
    logger.warning(f"ROLLBACK INITIATED. Reverted {bad_version} -> {model_registry['current_version']}")
    
    return jsonify({
        'status': 'rolled_back',
        'rolled_back_from': bad_version,
        'current_active_version': model_registry['current_version']
    })

# INFERENCE: Single Prediction
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    features = data.get('features', {})
    logger.info(f"Inference request (Single) for Model {model_registry['current_version']}")
    return jsonify(predict_single(features))

# INFERENCE: Batch Prediction (High Throughput)
@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    data = request.get_json()
    patients = data.get('patients', [])
    logger.info(f"Batch Inference request for {len(patients)} patients")
    
    results = [predict_single(p) for p in patients]
    return jsonify({'batch_size': len(patients), 'results': results})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
