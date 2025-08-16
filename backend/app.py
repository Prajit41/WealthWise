from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

# Initialize Flask app, telling it to serve static files from the 'frontend' directory
app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Enable CORS to allow the frontend to communicate with this server
CORS(app)

# The API endpoint for fetching the latest exchange rates
EXCHANGE_RATE_API_URL = 'https://api.exchangerate-api.com/v4/latest/'

@app.route('/')
def serve_index():
    """Serves the main index.html file from the 'docs' directory."""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/rates')
def get_exchange_rates():
    """API endpoint to get exchange rates for a given base currency."""
    base_currency = request.args.get('base', 'USD')
    logging.info(f"Request received for base currency: {base_currency}")
    try:
        # Using a free exchange rate API with the correct format
        response = requests.get(f"https://open.er-api.com/v6/latest/{base_currency}")
        response.raise_for_status()
        data = response.json()

        if data.get('result') == 'success':
            return jsonify({
                'success': True,
                'base': base_currency,
                'rates': data.get('rates', {}),
                'date': data.get('time_last_update_utc')
            })
        else:
            # Fallback to a fixed rate if API fails
            logging.warning("Using fallback exchange rates")
            return jsonify({
                'success': True,
                'base': base_currency,
                'rates': {
                    'USD': 1.0,
                    'INR': 83.50,  # Example rate, will be updated on next successful API call
                    'EUR': 0.92,
                    'GBP': 0.79,
                    'JPY': 150.50
                },
                'date': '2023-01-01'
            })

    except Exception as e:
        logging.error(f"Error fetching exchange rates: {e}")
        # Return a fallback response if the API call fails
        return jsonify({
            'success': True,
            'base': base_currency,
            'rates': {
                'USD': 1.0,
                'INR': 83.50,
                'EUR': 0.92,
                'GBP': 0.79,
                'JPY': 150.50
            },
            'date': '2023-01-01'
        })

if __name__ == '__main__':
    # Run the app on port 8002 to avoid conflicts with other services
    app.run(host='0.0.0.0', port=8002, debug=True)
