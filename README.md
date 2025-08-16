# Personal Finance Tracker

A comprehensive web-based personal finance tracker with advanced multi-currency support, real-time exchange rates, and intuitive financial visualization.

## Features

- **Multi-Currency Support**: Track transactions in 22+ major world currencies
- **Real-Time Exchange Rates**: Automatic currency conversion with live rates
- **User-Selectable Default Currency**: Choose your preferred display currency
- **Transaction Management**: Add, edit, and categorize income/expenses
- **Savings Goals**: Set and track financial goals with progress visualization
- **Interactive Charts**: Visual pie chart breakdown of income vs expenses
- **Transaction History**: Searchable and filterable transaction records
- **Data Export/Import**: JSON-based backup and restore functionality
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark/Light Theme**: Toggle between visual themes

## Technology Stack

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Advanced styling with CSS Grid, Flexbox, and glassmorphism effects
- **JavaScript (ES6+)**: Client-side logic and state management
- **Canvas API**: Chart rendering
- **Local Storage**: Data persistence

### Backend
- **Python 3**: Server-side programming
- **Flask**: Lightweight web framework
- **Flask-CORS**: Cross-origin resource sharing
- **Gunicorn**: Production WSGI server

### External Services
- **ExchangeRate-API**: Real-time currency conversion rates

## Quick Start

### Prerequisites
- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. **Clone or download this project**

2. **Install dependencies**:
   ```bash
   pip install flask flask-cors requests gunicorn
   ```

3. **Run the application**:
   ```bash
   python main.py
   ```
   
   Or for production:
   ```bash
   gunicorn --bind 0.0.0.0:5000 main:app
   ```

4. **Open your browser** and navigate to `http://localhost:5000`

### Optional: Currency API Setup

For production use with live exchange rates:

1. Get a free API key from [ExchangeRate-API](https://exchangerate-api.com/)
2. Set the environment variable:
   ```bash
   export EXCHANGE_RATE_API_KEY=your_api_key_here
   ```

The application works without an API key using fallback exchange rates for development.

## Usage

### Adding Transactions
1. Select transaction type (Income/Expense)
2. Enter description and amount
3. Choose currency from the dropdown
4. Click "Add Transaction"

### Setting Default Currency
1. Use the currency selector in the Balance section
2. All charts and totals will display in your chosen currency
3. Individual transactions retain their original currency

### Managing Goals
1. Set a target amount and deadline
2. Track progress with the visual progress bar
3. Monitor remaining amount and days

### Viewing History
1. Browse all transactions in the Transaction History section
2. Filter by currency using the dropdown
3. Edit or delete transactions as needed

## Project Structure

```
personal-finance-tracker/
├── main.py              # Application entry point
├── app.py               # Flask application setup
├── currency_service.py  # Currency conversion service
├── index.html           # Main web interface
├── script.js            # Frontend JavaScript logic
├── style.css            # Styling and visual design
├── pyproject.toml       # Python dependencies
└── README.md            # This file
```

## Data Storage

The application uses browser localStorage for data persistence. No external database is required. Your data includes:

- Transaction records with currency information
- User preferences (default currency, theme)
- Savings goals and progress
- Application settings

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please refer to the project documentation or create an issue in the project repository.