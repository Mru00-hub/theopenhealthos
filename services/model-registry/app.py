import time
from flask import Flask, jsonify, request

app = Flask(__name__)

# The Database of Models
registry_db = {
    'readmission-v1': {'type': 'classification', 'status': 'production', 'owner': 'hospital-team', 'version': 'v1.0.2'},
    'sepsis-v2': {'type': 'timeseries', 'status': 'staging', 'owner': 'icu-team', 'version': 'v2.1.0'}
}

@app.route('/health')
def health():
    return jsonify({'status': 'online', 'service': 'model-registry', 'count': len(registry_db)})

@app.route('/models', methods=['GET'])
def list_models():
    return jsonify(registry_db)

@app.route('/models/register', methods=['POST'])
def register_model():
    data = request.get_json()
    model_id = data.get('name')
    
    # New models start as 'pending_validation'
    registry_db[model_id] = {
        'type': data.get('type', 'custom'),
        'status': 'pending_validation',
        'owner': data.get('owner', 'external'),
        'version': data.get('version', 'v0.0.1'),
        'registered_at': time.time()
    }
    
    return jsonify({'status': 'registered', 'id': model_id, 'lifecycle': 'pending_validation'})

@app.route('/models/<model_id>/promote', methods=['POST'])
def promote_model(model_id):
    if model_id in registry_db:
        registry_db[model_id]['status'] = 'production'
        return jsonify({'status': 'promoted', 'id': model_id})
    return jsonify({'error': 'Model not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
