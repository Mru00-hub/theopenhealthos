import time
import random
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({'status': 'online', 'service': 'validation-gateway'})

@app.route('/validate', methods=['POST'])
def validate_model():
    data = request.get_json()
    model_id = data.get('model_id')
    metrics = data.get('metrics', {})
    
    # 1. Safety Policy Rules
    checks = {
        'min_accuracy': metrics.get('accuracy', 0) > 0.85,
        'bias_audit': random.choice([True, True, True, False]), # 1 in 4 chance of bias failure
        'security_scan': True
    }
    
    passed = all(checks.values())
    
    response = {
        'model_id': model_id,
        'approved': passed,
        'audit_log': checks,
        'timestamp': time.time()
    }
    
    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)
