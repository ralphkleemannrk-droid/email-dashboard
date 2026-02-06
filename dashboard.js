document.addEventListener('DOMContentLoaded', () => {
    dayjs.extend(window.dayjs_plugin_customParseFormat);

    const translations = {
        de: {
            dashboard_title: "E-Mail Statistik", 
            gauge_today: "Heute", 
            gauge_month: "Dieser Monat", 
            gauge_year: "Dieses Jahr", 
            widget_noise: "Noise-to-Signal Ratio", 
            widget_noise_desc: "Newsletter vs. Wichtig", 
            widget_sentiment: "Sentiment-Score", 
            widget_sentiment_desc: "Platzhalter", 
            widget_processing: "Est. Processing Time", 
            widget_processing_desc: "Basierend auf wichtigen E-Mails", 
            settings_title: "Einstellungen", 
            settings_accounts_title: "IMAP-Konten",
            settings_accounts_load: "Laden", 
            settings_accounts_delete: "Löschen", 
            settings_accounts_save: "Konto speichern & Abrufen", 
            settings_lists_title: "Whitelist / Blacklist",
            settings_lists_whitelist: "Whitelist (eine Domain/E-Mail pro Zeile)", 
            settings_lists_blacklist: "Blacklist (eine Domain/E-Mail pro Zeile)", 
            settings_privacy_title: "Datenschutz",
            settings_privacy_mode: "Privacy Mode (Sensible Daten ausblenden)", 
            alert_loading: "Lade E-Mail-Daten...", 
            alert_error: "Fehler beim Abrufen der Daten: ", 
            alert_saved: "Kontodaten gespeichert.", 
            alert_loaded: "Konto geladen.", 
            alert_deleted: "Konto gelöscht.",
            alert_no_account: "Kein Konto zum Laden ausgewählt.",
        },
        en: {
            dashboard_title: "Email Statistics", 
            gauge_today: "Today", 
            gauge_month: "This Month",
            gauge_year: "This Year", 
            widget_noise: "Noise-to-Signal Ratio", 
            widget_noise_desc: "Newsletter vs. Important", 
            widget_sentiment: "Sentiment Score", 
            widget_sentiment_desc: "Placeholder",
            widget_processing: "Est. Processing Time", 
            widget_processing_desc: "Based on important emails",
            settings_title: "Settings", 
            settings_accounts_title: "IMAP Accounts", 
            settings_accounts_load: "Load", 
            settings_accounts_delete: "Delete", 
            settings_accounts_save: "Save Account & Fetch",
            settings_lists_title: "Whitelist / Blacklist", 
            settings_lists_whitelist: "Whitelist (one domain/email per line)", 
            settings_lists_blacklist: "Blacklist (one domain/email per line)",
            settings_privacy_title: "Privacy", 
            settings_privacy_mode: "Privacy Mode (Blur sensitive data)",
            alert_loading: "Loading email data...", 
            alert_error: "Error fetching data: ", 
            alert_saved: "Account data saved.", 
            alert_loaded: "Account loaded.", 
            alert_deleted: "Account deleted.",
            alert_no_account: "No account selected to load.",
        }
    };

    const langSwitcher = document.getElementById('language-switcher');
    const setLanguage = (lang) => {
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.getAttribute('data-lang-key');
            if (translations[lang] && translations[lang][key]) {
                el.textContent = translations[lang][key];
            }
        });
        localStorage.setItem('dashboard-lang', lang);
    };
    if(langSwitcher) langSwitcher.addEventListener('change', (e) => setLanguage(e.target.value));

    const charts = {};
    const createGauge = (id) => {
        const container = document.getElementById(id);
        if (!container) return;
        container.innerHTML = '<canvas></canvas><div class="chart-text"><span class="text-3xl font-bold data-field privacy-blur">0</span></div>';
        const canvas = container.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        charts[id] = new Chart(ctx, {
            type: 'doughnut',
            data: { datasets: [{ data: [0, 100], backgroundColor: ['#3b82f6', '#e5e7eb'], borderWidth: 0 }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                cutout: '70%',
                circumference: 180, 
                rotation: -90, 
                plugins: { tooltip: { enabled: false }, legend: { display: false } } 
            }
        });
    };

    const updateGauge = (id, value, max = 1000) => {
        const chart = charts[id];
        const textEl = document.getElementById(id)?.querySelector('.chart-text span');
        if (chart && textEl) {
            const percentage = Math.min((value / max) * 100, 100);
            chart.data.datasets[0].data[0] = percentage;
            chart.data.datasets[0].data[1] = 100 - percentage;
            chart.update('none');
            textEl.textContent = value;
        }
    };

    const datePicker = document.getElementById('date-picker');
    const settingsButton = document.getElementById('settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalButton = document.getElementById('close-modal-button');
    const privacyToggle = document.getElementById('privacy-toggle');
    const imapForm = document.getElementById('imap-form');
    const hostInput = document.getElementById('imap-host');
    const portInput = document.getElementById('imap-port');
    const userInput = document.getElementById('imap-user');
    const passwordInput = document.getElementById('imap-password');
    const accountSelector = document.getElementById('account-selector');
    const loadAccountBtn = document.getElementById('load-account-button');
    const deleteAccountBtn = document.getElementById('delete-account-button');
    const whitelistText = document.getElementById('whitelist');
    const blacklistText = document.getElementById('blacklist');

    const showSkeleton = (isLoading) => {
        document.querySelectorAll('.data-field').forEach(el => {
            if (isLoading) {
                el.classList.add('skeleton');
                el.innerHTML = '<span class="opacity-0">...</span>';
            } else {
                el.classList.remove('skeleton');
            }
        });
    };

    const setPrivacyMode = (isPrivate) => {
        document.querySelectorAll('.privacy-blur').forEach(el => {
            el.classList.toggle('no-blur', !isPrivate);
        });
        if(privacyToggle) privacyToggle.checked = isPrivate;
        localStorage.setItem('dashboard-privacy', isPrivate);
    };

    if(privacyToggle) privacyToggle.addEventListener('change', (e) => setPrivacyMode(e.target.checked));
    if(settingsButton) settingsButton.addEventListener('click', () => settingsModal?.classList.remove('hidden'));
    if(closeModalButton) closeModalButton.addEventListener('click', () => settingsModal?.classList.add('hidden'));
    
    if(settingsModal) settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    const getAccounts = () => JSON.parse(localStorage.getItem('imap-accounts') || '{}');
    const saveAccounts = (accounts) => localStorage.setItem('imap-accounts', JSON.stringify(accounts));

    const populateAccountSelector = () => {
        const accounts = getAccounts();
        const currentAccount = localStorage.getItem('current-account');
        if(!accountSelector) return;
        accountSelector.innerHTML = '';
        Object.keys(accounts).forEach(email => {
            const option = document.createElement('option');
            option.value = email;
            option.textContent = email;
            option.selected = (email === currentAccount);
            accountSelector.appendChild(option);
        });
    };

    if(loadAccountBtn) loadAccountBtn.addEventListener('click', () => {
        const accounts = getAccounts();
        const selectedEmail = accountSelector.value;
        if (selectedEmail && accounts[selectedEmail]) {
            const acc = accounts[selectedEmail];
            hostInput.value = acc.host;
            portInput.value = acc.port;
            userInput.value = acc.user;
            passwordInput.value = acc.password;
            whitelistText.value = acc.whitelist || '';
            blacklistText.value = acc.blacklist || '';
            localStorage.setItem('current-account', selectedEmail);
            alert(translations[document.documentElement.lang].alert_loaded);
        } else {
            alert(translations[document.documentElement.lang].alert_no_account);
        }
    });

    if(deleteAccountBtn) deleteAccountBtn.addEventListener('click', () => {
        const accounts = getAccounts();
        const selectedEmail = accountSelector.value;
        if(selectedEmail && confirm(`Konto ${selectedEmail} wirklich löschen?`)) {
            delete accounts[selectedEmail];
            saveAccounts(accounts);
            populateAccountSelector();
            const currentAccount = localStorage.getItem('current-account');
            if (currentAccount === selectedEmail) {
                localStorage.removeItem('current-account');
                if(imapForm) imapForm.reset();
            }
            alert(translations[document.documentElement.lang].alert_deleted);
        }
    });

    const fetchData = async () => {
        const currentAccountEmail = localStorage.getItem('current-account');
        const accounts = getAccounts();
        if (!currentAccountEmail || !accounts[currentAccountEmail]) {
            if(settingsModal) settingsModal.classList.remove('hidden');
            return;
        }
        const account = accounts[currentAccountEmail];
        const body = {
            host: account.host, 
            port: account.port, 
            user: account.user, 
            password: account.password, 
            date: datePicker.value,
            whitelist: (account.whitelist || '').split('\n').filter(l => l.trim() !== ''),
            blacklist: (account.blacklist || '').split('\n').filter(l => l.trim() !== ''),
        };

        showSkeleton(true);
        const lang = document.documentElement.lang;
        try {
            const response = await fetch('/.netlify/functions/fetch-emails', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            updateUI(data);
        } catch (error) {
            console.error('Fetch error:', error);
            alert(`${translations[lang].alert_error}${error.message}`);
        } finally {
            showSkeleton(false);
            setPrivacyMode(localStorage.getItem('dashboard-privacy') === 'true');
        }
    };

    if(imapForm) imapForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const accounts = getAccounts();
        const user = userInput.value;
        accounts[user] = {
            host: hostInput.value, 
            port: portInput.value, 
            user: user, 
            password: passwordInput.value,
            whitelist: whitelistText.value, 
            blacklist: blacklistText.value,
        };
        saveAccounts(accounts);
        localStorage.setItem('current-account', user);
        populateAccountSelector();
        alert(translations[document.documentElement.lang].alert_saved);
        if(settingsModal) settingsModal.classList.add('hidden');
        fetchData();
    });

    const updateUI = (data) => {
        if(!data) return;
        updateGauge('gauge-today-container', data.counts.today, 100);
        updateGauge('gauge-month-container', data.counts.month, 1000);
        updateGauge('gauge-year-container', data.counts.year, 5000);
        
        const { important, newsletter } = data.categories;
        const noiseRatioEl = document.getElementById('noise-ratio');
        const sentimentScoreEl = document.getElementById('sentiment-score');
        const processingTimeEl = document.getElementById('processing-time');

        if(noiseRatioEl) {
            const noiseRatio = important > 0 ? (newsletter / important).toFixed(2) : (newsletter > 0 ? '∞' : '0.00');
            noiseRatioEl.textContent = noiseRatio;
        }
        if(sentimentScoreEl) sentimentScoreEl.textContent = '😊'; // Platzhalter für Analyse
        if(processingTimeEl){
            const time = important * 2;
            processingTimeEl.textContent = `${time} min`;
        }
    };

    const init = () => {
        const savedLang = localStorage.getItem('dashboard-lang') || 'de';
        if(langSwitcher) langSwitcher.value = savedLang;
        setLanguage(savedLang);
        
        if(datePicker) {
            datePicker.value = new Date().toISOString().split('T')[0];
            datePicker.addEventListener('change', fetchData);
        }

        createGauge('gauge-today-container');
        createGauge('gauge-month-container');
        createGauge('gauge-year-container');
        
        populateAccountSelector();
        
        const currentAccount = localStorage.getItem('current-account');
        const savedPrivacy = localStorage.getItem('dashboard-privacy') === 'true';
        setPrivacyMode(savedPrivacy);

        if (currentAccount) {
            fetchData();
        } else {
            showSkeleton(false);
            if(settingsModal) settingsModal.classList.remove('hidden');
        }
    };

    init();
});
