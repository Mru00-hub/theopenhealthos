from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'ml-service'})

@app.route('/')
def index():
    return jsonify({'message': 'ML Service', 'version': '0.1.0'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
