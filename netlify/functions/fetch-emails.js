const { ImapFlow } = require('imapflow');

// Helper function to get date strings in IMAP format
const getImapDate = (date) => {
    const year = date.getFullYear();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const day = date.getDate();
    return `${day}-${month}-${year}`;
};

// Main handler for the Netlify function
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let client;
    try {
        const { host, port, user, password, date, whitelist = [], blacklist = [] } = JSON.parse(event.body);

        if (!host || !port || !user || !password || !date) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required IMAP credentials or date.' }),
            };
        }
        
        const targetDate = new Date(date);
        
        // Define date ranges for search queries
        const searchCriteria = {
            today: { since: getImapDate(targetDate) },
            month: { since: getImapDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)) },
            year: { since: getImapDate(new Date(targetDate.getFullYear(), 0, 1)) },
        };

        client = new ImapFlow({
            host,
            port,
            secure: true,
            auth: { user, pass: password },
            logger: false // Set to true for detailed IMAP logging in Netlify logs
        });

        await client.connect();
        await client.mailboxOpen('INBOX', { readOnly: true });

        // --- Perform counts for gauges ---
        const counts = {};
        counts.today = await client.search(searchCriteria.today, {uid: true}).then(uids => uids.length);
        counts.month = await client.search(searchCriteria.month, {uid: true}).then(uids => uids.length);
        counts.year = await client.search(searchCriteria.year, {uid: true}).then(uids => uids.length);

        // --- Categorize emails received today ---
        const categories = {
            important: 0,
            newsletter: 0,
            other: 0
        };

        const todayUids = await client.search(searchCriteria.today, { uid: true });

        if (todayUids.length > 0) {
            const messages = client.fetch(todayUids, { headers: true, envelope: true });
            for await (const msg of messages) {
                const headers = msg.headers;
                const from = (msg.envelope.from?.[0]?.address || '').toLowerCase();
                const subject = (msg.envelope.subject || '').toLowerCase();

                // 1. Blacklist check (highest priority)
                if (blacklist.some(b => from.includes(b.toLowerCase()))) {
                    categories.other++;
                    continue;
                }

                // 2. Newsletter check
                if (headers.has('list-unsubscribe')) {
                    categories.newsletter++;
                    continue;
                }

                // 3. Important check
                const isWhitelisted = whitelist.some(w => from.includes(w.toLowerCase()));
                const hasImportantDomain = ['.gov', '.de'].some(domain => from.endsWith(domain)); // Simplified check
                const hasImportantKeyword = ['frist', 'bescheid', 'rechnung', 'mahnnung'].some(kw => subject.includes(kw));
                
                if (isWhitelisted || hasImportantDomain || hasImportantKeyword) {
                    categories.important++;
                    continue;
                }
                
                // 4. If none of the above, it's 'other'
                categories.other++;
            }
        }

        await client.logout();

        return {
            statusCode: 200,
            body: JSON.stringify({
                counts,
                categories,
            }),
        };

    } catch (err) {
        console.error('IMAP function error:', err);
        
        let errorMessage = 'An unexpected error occurred.';
        if (err.response) { // imapflow specific error
            errorMessage = `IMAP Error: ${err.response.text}`;
        } else if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
            errorMessage = 'Connection failed. Check IMAP host and port.';
        } else if (err instanceof SyntaxError) {
             errorMessage = 'Invalid JSON in request body.';
        } else {
            errorMessage = err.message;
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: errorMessage }),
        };
    } finally {
        // Ensure client is logged out even if errors occurred
        if (client && client.usable) {
            await client.logout().catch(e => console.error('Failed to logout client:', e));
        }
    }
};
