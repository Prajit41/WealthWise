import os
import requests
import logging
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from functools import lru_cache
import json

# Configure logging
logger = logging.getLogger(__name__)

currency_bp = Blueprint('currency', __name__)

# Cache for exchange rates (in-memory)
_rate_cache = {}
_cache_expiry = {}

# Exchange rate API configuration
EXCHANGE_API_KEY = os.environ.get("EXCHANGE_API_KEY", "")
BASE_API_URL = "https://v6.exchangerate-api.com/v6"

# Fallback rates for development/offline mode
FALLBACK_RATES = {
    "USD": {"EUR": 0.85, "GBP": 0.73, "INR": 83.12, "JPY": 110.0, "CNY": 7.23, "AUD": 1.52, "CAD": 1.36, "CHF": 0.92, "SEK": 10.87, "NOK": 10.72, "DKK": 6.34, "ZAR": 18.85, "SGD": 1.35, "HKD": 7.85, "KRW": 1342.0, "BRL": 5.17, "MXN": 17.12, "AED": 3.67, "SAR": 3.75, "NGN": 775.0, "NZD": 1.67},
    "EUR": {"USD": 1.18, "GBP": 0.86, "INR": 97.84, "JPY": 129.53, "CNY": 8.52, "AUD": 1.79, "CAD": 1.60, "CHF": 1.08, "SEK": 12.80, "NOK": 12.63, "DKK": 7.46, "ZAR": 22.22, "SGD": 1.59, "HKD": 9.25, "KRW": 1580.36, "BRL": 6.09, "MXN": 20.18, "AED": 4.33, "SAR": 4.42, "NGN": 913.0, "NZD": 1.97},
    "GBP": {"USD": 1.37, "EUR": 1.16, "INR": 113.80, "JPY": 150.70, "CNY": 9.91, "AUD": 2.08, "CAD": 1.86, "CHF": 1.26, "SEK": 14.89, "NOK": 14.69, "DKK": 8.68, "ZAR": 25.84, "SGD": 1.85, "HKD": 10.76, "KRW": 1838.94, "BRL": 7.08, "MXN": 23.46, "AED": 5.03, "SAR": 5.14, "NGN": 1062.5, "NZD": 2.29}
}

def get_cache_key(base_currency):
    """Generate cache key for currency rates"""
    return f"rates_{base_currency}"

def is_cache_valid(base_currency):
    """Check if cached rates are still valid (not expired)"""
    cache_key = get_cache_key(base_currency)
    if cache_key not in _cache_expiry:
        return False
    
    expiry_time = _cache_expiry[cache_key]
    return datetime.now() < expiry_time

def get_cached_rates(base_currency):
    """Get cached exchange rates if valid"""
    cache_key = get_cache_key(base_currency)
    if is_cache_valid(base_currency) and cache_key in _rate_cache:
        logger.debug(f"Using cached rates for {base_currency}")
        return _rate_cache[cache_key]
    return None

def cache_rates(base_currency, rates):
    """Cache exchange rates with expiry time"""
    cache_key = get_cache_key(base_currency)
    _rate_cache[cache_key] = rates
    # Cache for 30 minutes
    _cache_expiry[cache_key] = datetime.now() + timedelta(minutes=30)
    logger.debug(f"Cached rates for {base_currency}")

def fetch_exchange_rates_from_api(base_currency):
    """Fetch exchange rates from external API"""
    try:
        if EXCHANGE_API_KEY:
            # Use authenticated API
            url = f"{BASE_API_URL}/{EXCHANGE_API_KEY}/latest/{base_currency}"
        else:
            # Use free tier without API key (limited requests)
            url = f"https://api.exchangerate-api.com/v4/latest/{base_currency}"
        
        logger.debug(f"Fetching rates from: {url}")
        
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Handle different API response formats
        if 'conversion_rates' in data:
            rates = data['conversion_rates']
        elif 'rates' in data:
            rates = data['rates']
        else:
            raise ValueError("Unexpected API response format")
        
        # Ensure base currency is included with rate 1.0
        rates[base_currency] = 1.0
        
        logger.info(f"Successfully fetched {len(rates)} exchange rates for {base_currency}")
        return rates
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error fetching exchange rates: {e}")
        raise
    except (ValueError, KeyError) as e:
        logger.error(f"Error parsing exchange rate data: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching exchange rates: {e}")
        raise

def get_fallback_rates(base_currency):
    """Get fallback exchange rates for development/offline mode"""
    logger.warning(f"Using fallback rates for {base_currency}")
    
    if base_currency in FALLBACK_RATES:
        rates = FALLBACK_RATES[base_currency].copy()
        rates[base_currency] = 1.0
        return rates
    
    # If base currency not in fallback data, provide basic rates
    basic_rates = {
        "USD": 1.0 if base_currency != "USD" else 1.0,
        "EUR": 0.85 if base_currency == "USD" else (1.18 if base_currency == "EUR" else 1.0),
        "GBP": 0.73 if base_currency == "USD" else (1.37 if base_currency == "GBP" else 1.0),
    }
    basic_rates[base_currency] = 1.0
    
    return basic_rates

@currency_bp.route('/rates')
def get_exchange_rates():
    """Get exchange rates for a base currency"""
    try:
        base_currency = request.args.get('base', 'USD').upper()
        
        # Validate currency code
        if len(base_currency) != 3:
            return jsonify({
                'success': False,
                'error': 'Invalid currency code. Please provide a 3-letter currency code.'
            }), 400
        
        # Check cache first
        cached_rates = get_cached_rates(base_currency)
        if cached_rates:
            return jsonify({
                'success': True,
                'base': base_currency,
                'rates': cached_rates,
                'cached': True,
                'timestamp': datetime.now().isoformat()
            })
        
        try:
            # Try to fetch from API
            rates = fetch_exchange_rates_from_api(base_currency)
            cache_rates(base_currency, rates)
            
            return jsonify({
                'success': True,
                'base': base_currency,
                'rates': rates,
                'cached': False,
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as api_error:
            logger.error(f"API fetch failed: {api_error}")
            
            # Use fallback rates
            rates = get_fallback_rates(base_currency)
            
            return jsonify({
                'success': True,
                'base': base_currency,
                'rates': rates,
                'cached': False,
                'fallback': True,
                'warning': 'Using fallback rates due to API unavailability',
                'timestamp': datetime.now().isoformat()
            })
    
    except Exception as e:
        logger.error(f"Error in get_exchange_rates: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@currency_bp.route('/convert')
def convert_currency():
    """Convert amount from one currency to another"""
    try:
        amount = request.args.get('amount', type=float)
        from_currency = request.args.get('from', '').upper()
        to_currency = request.args.get('to', '').upper()
        
        if not all([amount, from_currency, to_currency]):
            return jsonify({
                'success': False,
                'error': 'Missing required parameters: amount, from, to'
            }), 400
        
        if len(from_currency) != 3 or len(to_currency) != 3:
            return jsonify({
                'success': False,
                'error': 'Invalid currency codes. Please provide 3-letter currency codes.'
            }), 400
        
        if amount is None or amount <= 0:
            return jsonify({
                'success': False,
                'error': 'Amount must be greater than 0'
            }), 400
        
        # If same currency, return original amount
        if from_currency == to_currency:
            return jsonify({
                'success': True,
                'amount': amount,
                'from': from_currency,
                'to': to_currency,
                'converted_amount': amount,
                'rate': 1.0,
                'timestamp': datetime.now().isoformat()
            })
        
        # Get rates for the base currency (from_currency)
        try:
            rates = fetch_exchange_rates_from_api(from_currency)
        except Exception:
            rates = get_fallback_rates(from_currency)
        
        if to_currency not in rates:
            return jsonify({
                'success': False,
                'error': f'Conversion rate not available for {to_currency}'
            }), 400
        
        rate = rates[to_currency]
        if rate is None:
            rate = 1.0
        converted_amount = amount * rate
        
        return jsonify({
            'success': True,
            'amount': amount,
            'from': from_currency,
            'to': to_currency,
            'converted_amount': round(converted_amount, 2),
            'rate': rate,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in convert_currency: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@currency_bp.route('/currencies')
def get_supported_currencies():
    """Get list of supported currencies"""
    try:
        # This could be expanded to fetch from the API or maintain a comprehensive list
        supported_currencies = [
            'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'AUD', 'CAD', 'NZD', 
            'CHF', 'SEK', 'NOK', 'DKK', 'ZAR', 'SGD', 'HKD', 'KRW', 'BRL', 
            'MXN', 'AED', 'SAR', 'NGN', 'RUB', 'KES', 'GHS', 'EGP', 'MAD'
        ]
        
        return jsonify({
            'success': True,
            'currencies': supported_currencies,
            'count': len(supported_currencies)
        })
        
    except Exception as e:
        logger.error(f"Error in get_supported_currencies: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@currency_bp.route('/health')
def currency_health():
    """Health check endpoint for currency service"""
    try:
        # Test API connectivity
        test_rates = fetch_exchange_rates_from_api('USD')
        api_status = 'connected'
    except Exception as e:
        logger.warning(f"API health check failed: {e}")
        api_status = 'fallback'
    
    return jsonify({
        'success': True,
        'service': 'currency-exchange',
        'api_status': api_status,
        'cache_entries': len(_rate_cache),
        'timestamp': datetime.now().isoformat()
    })
