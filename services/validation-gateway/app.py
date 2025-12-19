import time
import random
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, format='%(asctime)s - [VALIDATION] - %(message)s')
logger = logging.getLogger('validation-gateway')

app = Flask(__name__)
CORS(app)

@app.route('/health')
def health():
    return jsonify({'status': 'online', 'service': 'validation-gateway'})

@app.route('/validate', methods=['POST'])
def validate_model():
    data = request.get_json()
    model_id = data.get('model_id')
    metrics = data.get('metrics', {})
    
    logger.info(f"⚖️ VALIDATION REQUEST: {model_id} | Metrics: {metrics}")
    
    # 1. Safety Policy Rules
    # Randomly fail bias check to simulate real-world "Safety Stops"
    bias_check_passed = random.choice([True, True, True, False]) 
    
    checks = {
        'min_accuracy': metrics.get('accuracy', 0) > 0.85,
        'bias_audit': bias_check_passed, 
        'security_scan': True
    }
    
    passed = all(checks.values())
    
    if passed:
        logger.info(f"✅ APPROVED: {model_id} passed all safety checks.")
    else:
        logger.warning(f"⛔ REJECTED: {model_id} failed safety checks. Details: {checks}")
    
    response = {
        'model_id': model_id,
        'approved': passed,
        'audit_log': checks,
        'timestamp': time.time()
    }
    
    return jsonify(response)

if __name__ == '__main__':
    logger.info("Validation Gateway is listening on port 5002")
    app.run(host='0.0.0.0', port=5002)
