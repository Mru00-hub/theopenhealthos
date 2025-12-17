import time
import logging
from flask import Flask, jsonify, request

# Configure logging to show up in Docker logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('ml-service')

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'ml-service', 'model_version': 'v1.0.2'})

@app.route('/')
def index():
    return jsonify({'message': 'ML Service Active', 'version': '0.1.0'})

# NEW: The Training Endpoint
@app.route('/train', methods=['POST'])
def train_model():
    data = request.get_json()
    model_type = data.get('modelType', 'generic')
    epochs = data.get('epochs', 10)
    
    logger.info(f"Received training job for {model_type} with {epochs} epochs")
    
    # 1. Simulate "Loading Data"
    logger.info("Loading dataset from Data Lake...")
    time.sleep(1) 
    
    # 2. Simulate "Training" (The heavy lifting)
    logger.info("Training XGBoost Classifier...")
    time.sleep(2) 
    
    # 3. Simulate "Saving"
    new_version = f"v{int(time.time())}"
    logger.info(f"Model saved to /models/{model_type}_{new_version}.pkl")
    
    return jsonify({
        'status': 'success',
        'message': 'Training complete',
        'model_version': new_version,
        'metrics': {
            'accuracy': 0.89,
            'f1_score': 0.87,
            'training_time': '3.2s'
        }
    })

if __name__ == '__main__':
    # Important: Host 0.0.0.0 allows access from outside the container
    app.run(host='0.0.0.0', port=5000)
