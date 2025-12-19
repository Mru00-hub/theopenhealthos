import time
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, format='%(asctime)s - [LLM-SERVICE] - %(message)s')
logger = logging.getLogger('llm-service')

app = Flask(__name__)
CORS(app)

@app.route('/health')
def health():
    return jsonify({'status': 'online', 'service': 'llm-service', 'model': 'Clinical-GPT-4-Turbo'})

@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    prompt = data.get('prompt', '')
    context = data.get('context', {})
    
    logger.info(f"🧠 GENERATING: {prompt[:30]}... (Context Keys: {list(context.keys())})")
    
    # Mocking LLM latency to feel real
    time.sleep(1.0)
    
    # Context-Aware Responses
    if 'summarize' in prompt.lower():
        output = f"Patient is a {context.get('age', 45)}yo male. History of {context.get('condition', 'unknown')}. Vitals trending hypertensive."
    elif 'reasoning' in prompt.lower():
        output = "Based on elevated BP and Age > 65, there is increased risk of cardiovascular event. Recommend ACE inhibitors review."
    else:
        output = "Clinical Context Analysis Complete. No immediate red flags."
        
    return jsonify({
        'response': output,
        'tokens_used': 145,
        'model': 'gpt-4-clinical-tuned'
    })

if __name__ == '__main__':
    logger.info("LLM Service is listening on port 5003")
    app.run(host='0.0.0.0', port=5003)
