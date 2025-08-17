(function () {
  'use strict';

  // DOM elements
  const welcomeModal = document.getElementById('welcomeModal');
  const closeWelcomeBtn = document.getElementById('closeWelcome');
  const totalBalanceEl = document.getElementById('total-balance');
  const totalIncomeEl = document.getElementById('total-income');
  const totalExpensesEl = document.getElementById('total-expenses');
  const form = document.getElementById('transaction-form');
  const amountInput = document.getElementById('amount');
  const categorySelect = document.getElementById('category');
  const dateInput = document.getElementById('date');
  const transactionsTbody = document.getElementById('transactions-tbody');
  const submitBtn = document.getElementById('submit-btn');
  const cancelEditBtn = document.getElementById('cancel-edit');
  const clearAllBtn = document.getElementById('clear-all');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const scrollTopLink = document.getElementById('scroll-top');
  const currencySelect = document.getElementById('currency-select');
  const defaultCurrencySelect = document.getElementById('default-currency-select');
  const filterCurrencySelect = document.getElementById('filter-currency');
  const exportBtn = document.getElementById('export-json');
  const importBtn = document.getElementById('import-json');
  const importFileInput = document.getElementById('import-file');
  const conversionInfo = document.getElementById('conversion-info');
  const conversionText = document.querySelector('.conversion-text');
  // const chartCurrencyInfo = document.getElementById('chart-currency-info');
  const ratesUpdatedEl = document.getElementById('rates-updated');

  // Goal elements
  const goalForm = document.getElementById('goal-form');
  const goalTargetInput = document.getElementById('goal-target');
  const goalDeadlineInput = document.getElementById('goal-deadline');
  const clearGoalBtn = document.getElementById('clear-goal');
  const goalProgressBar = document.getElementById('goal-progress-bar');
  const goalRemainingEl = document.getElementById('goal-remaining');
  const goalDaysEl = document.getElementById('goal-days');
  const goalDailyEl = document.getElementById('goal-daily');
  const goalCurrencyDisplay = document.getElementById('goal-currency-display');

  const pieCanvas = document.getElementById('pieCanvas');
  const pieCtx = pieCanvas.getContext('2d');

  // State
  let transactions = [];
  let editingTransactionId = null;
  let lastAddedId = null;
  let selectedCurrency = null;
  let defaultCurrency = null;
  let exchangeRates = {};
  let lastRatesUpdate = null;
  let goal = null;
  let filterCurrency = 'all';
  let isAnimating = false;

  // Constants
  const STORAGE_KEY = 'pf_transactions';
  const THEME_KEY = 'pf_theme';
  const CURRENCY_KEY = 'pf_currency';
  const DEFAULT_CURRENCY_KEY = 'pf_default_currency';
  const GOAL_KEY = 'pf_goal';
  const ONBOARD_KEY = 'pf_onboard_v1';
  const RATES_KEY = 'pf_exchange_rates';
  const RATES_UPDATE_KEY = 'pf_rates_update';

  // Backend URL for currency service - will be set to Render URL after deployment
  const BACKEND_URL = window.location.origin;

  // Enhanced Utils with multi-currency support
  const formatCurrency = (value, currency = null) => {
    const currencyCode = currency || defaultCurrency || guessCurrency();
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    });
    return formatter.format(value);
  };

  function guessCurrency() {
    try {
      const locale = navigator.language || 'en-US';
      if (locale.startsWith('en-GB')) return 'GBP';
      if (locale.startsWith('en-AU')) return 'AUD';
      if (locale.startsWith('en-CA')) return 'CAD';
      if (locale.startsWith('en-IN')) return 'INR';
      if (locale.startsWith('de')) return 'EUR';
      if (locale.startsWith('fr')) return 'EUR';
      if (locale.startsWith('es')) return 'EUR';
      if (locale.startsWith('it')) return 'EUR';
      if (locale.startsWith('pt')) return 'EUR';
      if (locale.startsWith('ja')) return 'JPY';
      if (locale.startsWith('zh')) return 'CNY';
      return 'USD';
    } catch (_) {
      return 'USD';
    }
  }

  const todayStr = () => new Date().toISOString().slice(0, 10);

  const CURRENCIES = [
    'USD','EUR','GBP','INR','JPY','CNY','AUD','CAD','NZD','CHF','SEK','NOK','DKK','ZAR','SGD','HKD','KRW','BRL','MXN','AED','SAR','NGN'
  ];

  // Currency conversion functions
  async function fetchExchangeRates() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rates?base=${defaultCurrency}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        exchangeRates = data.rates;
        lastRatesUpdate = new Date().toISOString();
        localStorage.setItem(RATES_KEY, JSON.stringify(exchangeRates));
        localStorage.setItem(RATES_UPDATE_KEY, lastRatesUpdate);
        updateRatesDisplay();
        return true;
      } else {
        throw new Error(data.error || 'Failed to fetch rates');
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      // Use cached rates if available
      const cachedRates = localStorage.getItem(RATES_KEY);
      const cachedUpdate = localStorage.getItem(RATES_UPDATE_KEY);
      if (cachedRates && cachedUpdate) {
        exchangeRates = JSON.parse(cachedRates);
        lastRatesUpdate = cachedUpdate;
        updateRatesDisplay();
        return true;
      }
      return false;
    }
  }

  function convertCurrency(amount, fromCurrency, toCurrency) {
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) {
      return amount;
    }

    // Convert through default currency if rates are available
    if (exchangeRates && Object.keys(exchangeRates).length > 0) {
      if (fromCurrency === defaultCurrency) {
        return amount * (exchangeRates[toCurrency] || 1);
      } else if (toCurrency === defaultCurrency) {
        return amount / (exchangeRates[fromCurrency] || 1);
      } else {
        // Convert from -> default -> to
        const inDefault = amount / (exchangeRates[fromCurrency] || 1);
        return inDefault * (exchangeRates[toCurrency] || 1);
      }
    }

    return amount; // Fallback if no rates available
  }

  function updateRatesDisplay() {
    if (ratesUpdatedEl && lastRatesUpdate) {
      const updateTime = new Date(lastRatesUpdate);
      ratesUpdatedEl.textContent = updateTime.toLocaleString();
    }
  }

  function populateCurrencySelects() {
    const guessedCurrency = defaultCurrency || guessCurrency();
    
    // Populate transaction currency select
    currencySelect.innerHTML = '';
    for (const code of CURRENCIES) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      if (code === (selectedCurrency || guessedCurrency)) opt.selected = true;
      currencySelect.appendChild(opt);
    }

    // Populate default currency select
    defaultCurrencySelect.innerHTML = '';
    for (const code of CURRENCIES) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      if (code === guessedCurrency) opt.selected = true;
      defaultCurrencySelect.appendChild(opt);
    }

    // Chart currency info removed from header - no longer needed

    // Update goal currency display
    if (goalCurrencyDisplay) {
      goalCurrencyDisplay.textContent = guessedCurrency;
    }
  }

  function populateFilterCurrencySelect() {
    if (!filterCurrencySelect) return;
    
    // Get unique currencies from transactions
    const usedCurrencies = Array.from(new Set(transactions.map(t => t.currency).filter(Boolean)));
    
    filterCurrencySelect.innerHTML = '<option value="all">All Currencies</option>';
    for (const currency of usedCurrencies.sort()) {
      const opt = document.createElement('option');
      opt.value = currency;
      opt.textContent = currency;
      filterCurrencySelect.appendChild(opt);
    }
  }

  function saveCurrency(key, code) {
    localStorage.setItem(key, code);
  }

  function loadCurrency(key) {
    return localStorage.getItem(key) || null;
  }

  function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }

  function loadTransactions() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Ensure backward compatibility: add currency field if missing
        return parsed.map(t => ({
          ...t,
          currency: t.currency || defaultCurrency || 'USD'
        }));
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  function computeTotals() {
    let income = 0;
    let expenses = 0;
    
    for (const t of transactions) {
      const convertedAmount = convertCurrency(t.amount, t.currency, defaultCurrency);
      if (t.type === 'income') income += convertedAmount;
      else expenses += convertedAmount;
    }
    
    return {
      income,
      expenses,
      balance: income - expenses,
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function daysBetween(fromISO, toISO) {
    const start = new Date(fromISO);
    const end = new Date(toISO);
    const ms = end.setHours(0,0,0,0) - start.setHours(0,0,0,0);
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  function saveGoal() {
    if (goal) localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
  }

  function loadGoal() {
    const raw = localStorage.getItem(GOAL_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.target === 'number' && typeof parsed.deadline === 'string') {
        return parsed;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  function renderGoalStatus() {
    if (!goal || !Number.isFinite(goal.target) || goal.target <= 0 || !goal.deadline) {
      if (goalProgressBar) {
        goalProgressBar.style.width = '0%';
        goalProgressBar.style.opacity = '0.5';
      }
      if (goalRemainingEl) goalRemainingEl.textContent = 'No goal set';
      if (goalDaysEl) goalDaysEl.textContent = '';
      if (goalDailyEl) goalDailyEl.textContent = '';
      return;
    }

    const { balance } = computeTotals();
    const savedSoFar = Math.max(balance, 0);
    const remaining = Math.max(goal.target - savedSoFar, 0);
    const today = todayStr();
    const daysLeft = Math.max(daysBetween(today, goal.deadline), 0);
    const dailyNeeded = daysLeft > 0 ? remaining / daysLeft : remaining;

    const pct = goal.target > 0 ? clamp((savedSoFar / goal.target) * 100, 0, 100) : 0;
    
    if (goalProgressBar) {
      goalProgressBar.style.opacity = '1';
      goalProgressBar.style.width = `${pct}%`;
      
      if (remaining <= 0) {
        goalProgressBar.style.animation = 'celebrate 0.6s ease-in-out';
        setTimeout(() => {
          goalProgressBar.style.animation = '';
        }, 600);
      }
    }

    if (goalRemainingEl) {
      const text = remaining <= 0 ? 'Goal achieved! 🎉' : `Remaining: ${formatCurrency(remaining, defaultCurrency)}`;
      goalRemainingEl.textContent = text;
      if (remaining <= 0) {
        goalRemainingEl.style.color = 'var(--income)';
        goalRemainingEl.style.fontWeight = '700';
      } else {
        goalRemainingEl.style.color = 'var(--muted)';
        goalRemainingEl.style.fontWeight = '500';
      }
    }
    
    if (goalDaysEl) {
      goalDaysEl.textContent = daysLeft > 0 ? `Days left: ${daysLeft}` : 'Deadline reached';
    }
    
    if (goalDailyEl) {
      goalDailyEl.textContent = remaining <= 0 ? '' : `Save per day: ${formatCurrency(Math.ceil(dailyNeeded * 100) / 100, defaultCurrency)}`;
    }
  }

  function sortTransactionsDesc(a, b) {
    if (a.date === b.date) return b.id.localeCompare(a.id);
    return a.date < b.date ? 1 : -1;
  }

  function renderTransactions() {
    if (isAnimating) return;
    isAnimating = true;

    const prevScrollTop = transactionsTbody.parentElement.scrollTop;
    let items = [...transactions];

    // Apply currency filter
    if (filterCurrency !== 'all') {
      items = items.filter(t => t.currency === filterCurrency);
    }

    // Sort by date (newest first)
    items.sort(sortTransactionsDesc);

    const fragment = document.createDocumentFragment();
    for (const t of items) {
      const tr = document.createElement('tr');
      if (t.id === lastAddedId) tr.classList.add('row-enter');

      const categoryTd = document.createElement('td');
      categoryTd.textContent = t.category;

      const amountTd = document.createElement('td');
      amountTd.className = 'right';
      const amountSpan = document.createElement('span');
      amountSpan.className = `amount ${t.type}`;
      amountSpan.textContent = `${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, t.currency)}`;
      amountTd.appendChild(amountSpan);

      const currencyTd = document.createElement('td');
      const currencyBadge = document.createElement('span');
      currencyBadge.className = 'currency-badge';
      currencyBadge.textContent = t.currency || 'USD';
      currencyTd.appendChild(currencyBadge);

      const convertedTd = document.createElement('td');
      convertedTd.className = 'right';
      if (t.currency !== defaultCurrency) {
        const convertedAmount = convertCurrency(t.amount, t.currency, defaultCurrency);
        const convertedSpan = document.createElement('span');
        convertedSpan.className = 'converted-amount';
        convertedSpan.textContent = `${t.type === 'income' ? '+' : '-'}${formatCurrency(convertedAmount, defaultCurrency)}`;
        convertedTd.appendChild(convertedSpan);
      } else {
        convertedTd.textContent = '—';
      }

      const dateTd = document.createElement('td');
      dateTd.textContent = t.date;

      const actionsTd = document.createElement('td');
      actionsTd.className = 'right';
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary';
      editBtn.textContent = 'Edit';
      editBtn.dataset.action = 'edit';
      editBtn.dataset.id = t.id;

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      delBtn.textContent = 'Delete';
      delBtn.style.marginLeft = '8px';
      delBtn.dataset.action = 'delete';
      delBtn.dataset.id = t.id;

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(delBtn);

      tr.appendChild(categoryTd);
      tr.appendChild(amountTd);
      tr.appendChild(currencyTd);
      tr.appendChild(convertedTd);
      tr.appendChild(dateTd);
      tr.appendChild(actionsTd);

      fragment.appendChild(tr);
    }

    transactionsTbody.innerHTML = '';
    transactionsTbody.appendChild(fragment);
    transactionsTbody.parentElement.scrollTop = prevScrollTop;
    
    setTimeout(() => {
      isAnimating = false;
    }, 100);
  }

  function renderSummary() {
    const { income, expenses, balance } = computeTotals();
    
    animateNumber(totalIncomeEl, income, `+${formatCurrency(income, defaultCurrency)}`);
    animateNumber(totalExpensesEl, expenses, `-${formatCurrency(expenses, defaultCurrency)}`);
    animateNumber(totalBalanceEl, balance, formatCurrency(balance, defaultCurrency));
  }

  function animateNumber(element, targetValue, finalText) {
    if (!element) return;
    
    const startValue = 0;
    const duration = 800;
    const startTime = performance.now();
    
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue + (targetValue - startValue) * easeOutQuart;
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = finalText;
      }
    }
    
    requestAnimationFrame(update);
  }

  function updateConversionInfo() {
    if (!conversionInfo || !conversionText) return;

    const amount = parseFloat(amountInput.value) || 0;
    const fromCurrency = currencySelect.value;
    
    if (amount > 0 && fromCurrency && fromCurrency !== defaultCurrency) {
      const converted = convertCurrency(amount, fromCurrency, defaultCurrency);
      conversionText.textContent = `≈ ${formatCurrency(converted, defaultCurrency)} in ${defaultCurrency}`;
      conversionInfo.style.display = 'block';
    } else {
      conversionInfo.style.display = 'none';
    }
  }

  function clearCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function resizeCanvasToDisplaySize(canvas, ctx) {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    const displayWidth = Math.max(200, Math.floor(width));
    const displayHeight = Math.max(200, Math.floor(height));
    if (canvas.width !== displayWidth * ratio || canvas.height !== displayHeight * ratio) {
      canvas.width = displayWidth * ratio;
      canvas.height = displayHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }

  function drawPieChart() {
    if (!pieCanvas || !pieCtx) return;

    // Set fixed canvas size
    pieCanvas.width = 320;
    pieCanvas.height = 320;
    
    clearCanvas(pieCtx, pieCanvas);

    const { income, expenses } = computeTotals();
    const total = income + expenses;

    if (total === 0) {
      pieCtx.fillStyle = '#6b7280';
      pieCtx.font = 'bold 16px Inter, sans-serif';
      pieCtx.textAlign = 'center';
      pieCtx.textBaseline = 'middle';
      pieCtx.fillText('No data yet', pieCanvas.width / 2, pieCanvas.height / 2);
      return;
    }

    const centerX = pieCanvas.width / 2;
    const centerY = pieCanvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    let currentAngle = -Math.PI / 2;

    // Draw income slice
    if (income > 0) {
      const incomeAngle = (income / total) * 2 * Math.PI;
      pieCtx.beginPath();
      pieCtx.moveTo(centerX, centerY);
      pieCtx.arc(centerX, centerY, radius, currentAngle, currentAngle + incomeAngle);
      pieCtx.closePath();
      pieCtx.fillStyle = '#16a34a';
      pieCtx.fill();
      currentAngle += incomeAngle;
    }

    // Draw expenses slice
    if (expenses > 0) {
      const expensesAngle = (expenses / total) * 2 * Math.PI;
      pieCtx.beginPath();
      pieCtx.moveTo(centerX, centerY);
      pieCtx.arc(centerX, centerY, radius, currentAngle, currentAngle + expensesAngle);
      pieCtx.closePath();
      pieCtx.fillStyle = '#ef4444';
      pieCtx.fill();
    }

    // Draw border
    pieCtx.beginPath();
    pieCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    pieCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    pieCtx.lineWidth = 2;
    pieCtx.stroke();
  }

  function refreshAll() {
    renderTransactions();
    renderSummary();
    renderGoalStatus();
    drawPieChart();
    populateFilterCurrencySelect();
    updateConversionInfo();
  }

  // Event handlers
  function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(form);
    const type = formData.get('type');
    const amount = parseFloat(formData.get('amount'));
    const category = formData.get('category');
    const date = formData.get('date');
    const currency = currencySelect.value;

    if (!type || !amount || amount <= 0 || !category || !date || !currency) {
      alert('Please fill in all fields with valid values.');
      return;
    }

    const transaction = {
      id: editingTransactionId || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      amount,
      category,
      date,
      currency
    };

    if (editingTransactionId) {
      const index = transactions.findIndex(t => t.id === editingTransactionId);
      if (index !== -1) {
        transactions[index] = transaction;
      }
      editingTransactionId = null;
      submitBtn.textContent = 'Add Transaction';
      cancelEditBtn.hidden = true;
    } else {
      transactions.push(transaction);
      lastAddedId = transaction.id;
    }

    form.reset();
    dateInput.value = todayStr();
    currencySelect.value = selectedCurrency || defaultCurrency;
    saveTransactions();
    refreshAll();
  }

  function handleTransactionAction(e) {
    if (!e.target.dataset.action) return;

    const action = e.target.dataset.action;
    const id = e.target.dataset.id;

    if (action === 'delete') {
      if (confirm('Are you sure you want to delete this transaction?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        refreshAll();
      }
    } else if (action === 'edit') {
      const transaction = transactions.find(t => t.id === id);
      if (transaction) {
        document.querySelector(`input[name="type"][value="${transaction.type}"]`).checked = true;
        amountInput.value = transaction.amount;
        categorySelect.value = transaction.category;
        dateInput.value = transaction.date;
        currencySelect.value = transaction.currency;
        
        editingTransactionId = id;
        submitBtn.textContent = 'Update Transaction';
        cancelEditBtn.hidden = false;
        
        form.scrollIntoView({ behavior: 'smooth' });
        updateConversionInfo();
      }
    }
  }

  function handleCancelEdit() {
    editingTransactionId = null;
    submitBtn.textContent = 'Add Transaction';
    cancelEditBtn.hidden = true;
    form.reset();
    dateInput.value = todayStr();
    currencySelect.value = selectedCurrency || defaultCurrency;
    updateConversionInfo();
  }

  function handleClearAll() {
    if (confirm('Are you sure you want to clear all transactions? This action cannot be undone.')) {
      transactions = [];
      saveTransactions();
      refreshAll();
    }
  }

  function handleDefaultCurrencyChange() {
    const newDefaultCurrency = defaultCurrencySelect.value;
    if (newDefaultCurrency && newDefaultCurrency !== defaultCurrency) {
      defaultCurrency = newDefaultCurrency;
      saveCurrency(DEFAULT_CURRENCY_KEY, defaultCurrency);
      
      // Update displays
      if (chartCurrencyInfo) {
        chartCurrencyInfo.textContent = `(in ${defaultCurrency})`;
      }
      if (goalCurrencyDisplay) {
        goalCurrencyDisplay.textContent = defaultCurrency;
      }
      
      // Fetch new exchange rates
      fetchExchangeRates().then(() => {
        refreshAll();
      });
    }
  }

  function handleTransactionCurrencyChange() {
    selectedCurrency = currencySelect.value;
    saveCurrency(CURRENCY_KEY, selectedCurrency);
    updateConversionInfo();
  }

  function handleFilterCurrencyChange() {
    filterCurrency = filterCurrencySelect.value;
    renderTransactions();
  }

  function handleGoalSubmit(e) {
    e.preventDefault();

    const target = parseFloat(goalTargetInput.value);
    const deadline = goalDeadlineInput.value;

    if (!target || target <= 0 || !deadline) {
      alert('Please enter a valid target amount and deadline.');
      return;
    }

    goal = { target, deadline };
    saveGoal();
    renderGoalStatus();
  }

  function handleClearGoal() {
    if (confirm('Are you sure you want to clear your savings goal?')) {
      goal = null;
      localStorage.removeItem(GOAL_KEY);
      goalForm.reset();
      renderGoalStatus();
    }
  }

  function handleThemeToggle() {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    themeToggleBtn.textContent = isLight ? '☀️' : '🌙';
  }

  function handleExport() {
    const data = {
      transactions,
      goal,
      defaultCurrency,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    importFileInput.click();
  }

  function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const data = JSON.parse(event.target.result);
        
        if (data.transactions && Array.isArray(data.transactions)) {
          if (confirm('This will replace all current transactions. Continue?')) {
            // Ensure imported transactions have currency field
            transactions = data.transactions.map(t => ({
              ...t,
              currency: t.currency || defaultCurrency || 'USD'
            }));
            
            if (data.goal) {
              goal = data.goal;
              goalTargetInput.value = goal.target;
              goalDeadlineInput.value = goal.deadline;
              saveGoal();
            }
            
            saveTransactions();
            refreshAll();
            alert('Data imported successfully!');
          }
        } else {
          alert('Invalid file format. Please select a valid export file.');
        }
      } catch (error) {
        alert('Error reading file. Please ensure it\'s a valid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleScrollTop(e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleWelcomeClose() {
    welcomeModal.classList.add('hidden');
    localStorage.setItem(ONBOARD_KEY, 'true');
  }

  // Initialize app
  function init() {
    // Load saved data
    transactions = loadTransactions();
    selectedCurrency = loadCurrency(CURRENCY_KEY);
    defaultCurrency = loadCurrency(DEFAULT_CURRENCY_KEY) || guessCurrency();
    goal = loadGoal();

    // Load cached exchange rates
    const cachedRates = localStorage.getItem(RATES_KEY);
    const cachedUpdate = localStorage.getItem(RATES_UPDATE_KEY);
    if (cachedRates && cachedUpdate) {
      exchangeRates = JSON.parse(cachedRates);
      lastRatesUpdate = cachedUpdate;
    }

    // Set up theme
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light') {
      document.body.classList.add('light');
      themeToggleBtn.textContent = '☀️';
    }

    // Set up date input
    dateInput.value = todayStr();

    // Populate currency selects
    populateCurrencySelects();

    // Set up goal form if goal exists
    if (goal) {
      goalTargetInput.value = goal.target;
      goalDeadlineInput.value = goal.deadline;
    }

    // Show welcome modal for new users
    const hasSeenWelcome = localStorage.getItem(ONBOARD_KEY);
    if (!hasSeenWelcome) {
      welcomeModal.classList.remove('hidden');
    } else {
      welcomeModal.classList.add('hidden');
    }

    // Fetch exchange rates
    fetchExchangeRates();

    // Initial render
    refreshAll();

    // Set up event listeners
    form.addEventListener('submit', handleFormSubmit);
    transactionsTbody.addEventListener('click', handleTransactionAction);
    cancelEditBtn.addEventListener('click', handleCancelEdit);
    clearAllBtn.addEventListener('click', handleClearAll);
    themeToggleBtn.addEventListener('click', handleThemeToggle);
    scrollTopLink.addEventListener('click', handleScrollTop);
    defaultCurrencySelect.addEventListener('change', handleDefaultCurrencyChange);
    currencySelect.addEventListener('change', handleTransactionCurrencyChange);
    if (filterCurrencySelect) {
      filterCurrencySelect.addEventListener('change', handleFilterCurrencyChange);
    }
    amountInput.addEventListener('input', updateConversionInfo);
    goalForm.addEventListener('submit', handleGoalSubmit);
    clearGoalBtn.addEventListener('click', handleClearGoal);
    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', handleImport);
    importFileInput.addEventListener('change', handleFileImport);
    closeWelcomeBtn.addEventListener('click', handleWelcomeClose);

    // Update exchange rates every 30 minutes
    setInterval(() => {
      fetchExchangeRates();
    }, 30 * 60 * 1000);
  }

  // Start the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
