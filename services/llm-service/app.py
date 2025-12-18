import time
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({'status': 'online', 'service': 'llm-service', 'model': 'Clinical-GPT-4-Turbo'})

@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    prompt = data.get('prompt', '')
    context = data.get('context', {})
    
    # Mocking LLM latency
    time.sleep(1.0)
    
    # Mocking Clinical Responses
    if 'summarize' in prompt.lower():
        output = f"Patient is a {context.get('age', 45)}yo male with history of {context.get('condition', 'unknown')}. Vitals stable but trending hypertensive."
    elif 'reasoning' in prompt.lower():
        output = "Based on elevated BP and Age > 65, increased risk of cardiovascular event. Recommend ACE inhibitors review."
    else:
        output = "Clinical Context Analysis Complete. No immediate red flags."
        
    return jsonify({
        'response': output,
        'tokens_used': 145,
        'model': 'gpt-4-clinical-tuned'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003)
