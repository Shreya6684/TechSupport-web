// ========================================
// TECHSUPPORT - SINGLE APPLICATION SCRIPT
// ========================================

const ticketStorageKey = "tickets";
const customerStorageKey = "customers";
const agentStorageKey = "agents";
const chatStorageKey = "chatMessages";
const authUsersStorageKey = "techSupportUsers";
const authSessionStorageKey = "techSupportSession";

const demoTickets = [
    { id: "#TS-1021", customer: "Rahul Kumar", email: "rahul@gmail.com", category: "Network", priority: "High", subject: "WiFi connection problem", description: "WiFi is not connecting properly.", status: "Resolved" },
    { id: "#TS-1022", customer: "Ananya Singh", email: "ananya@gmail.com", category: "Software", priority: "Medium", subject: "Software installation issue", description: "Unable to install required software.", status: "New" },
    { id: "#TS-1023", customer: "Priya Das", email: "priya@gmail.com", category: "Hardware", priority: "Low", subject: "Keyboard problem", description: "Some keyboard keys are not working.", status: "Closed" },
    { id: "#TS-1024", customer: "Arjun Mehta", email: "arjun@gmail.com", category: "Network", priority: "Medium", subject: "Internet speed issue", description: "Internet speed is very slow.", status: "In Progress" }
];

const demoCustomers = [
    { name: "Rahul Kumar", email: "rahul@gmail.com", phone: "9876543210", tickets: 12, status: "Active" },
    { name: "Ananya Singh", email: "ananya@gmail.com", phone: "9123456780", tickets: 8, status: "Active" },
    { name: "Priya Das", email: "priya@gmail.com", phone: "8765432109", tickets: 5, status: "Inactive" },
    { name: "Arjun Mehta", email: "arjun@gmail.com", phone: "9988776655", tickets: 15, status: "Active" }
];

const demoAgents = [
    { name: "Rahul Verma", email: "rahul@techsupport.com", department: "Network Support", tickets: 18, status: "Online" },
    { name: "Neha Singh", email: "neha@techsupport.com", department: "Software Support", tickets: 14, status: "Online" },
    { name: "Amit Kumar", email: "amit@techsupport.com", department: "Hardware Support", tickets: 10, status: "Offline" },
    { name: "Priya Sharma", email: "priya@techsupport.com", department: "Customer Support", tickets: 22, status: "Online" }
];

let tickets = loadCollection(ticketStorageKey, demoTickets, "id");
let customers = loadCollection(customerStorageKey, demoCustomers, "email");
let agents = loadCollection(agentStorageKey, demoAgents, "email");
customers = deduplicateCustomers(customers);
saveCustomers();
syncCustomersFromTickets();
let chatMessages = loadChatMessages();
let activeCustomer = "";
let activeCustomerName = "";
let authUsers = loadAuthUsers();
authUsers = syncAuthUsersWithRecords();
let authSession = loadAuthSession();

function loadAuthUsers() {
    const stored = localStorage.getItem(authUsersStorageKey);
    if (stored) return parseJson(stored, []);
    const starterUsers = [
        { id: "TS-ADMIN", name: "Shreya Sharma", email: "admin@techsupport.com", password: "admin123", role: "admin" },
        { id: "TS-AGENT", name: "Rahul Verma", email: "rahul@techsupport.com", password: "agent123", role: "agent" },
        { id: "TS-AG-NEHA", name: "Neha Singh", email: "neha@techsupport.com", password: "agent123", role: "agent" },
        { id: "TS-AG-AMIT", name: "Amit Kumar", email: "amit@techsupport.com", password: "agent123", role: "agent" },
        { id: "TS-AG-PRIYA", name: "Priya Sharma", email: "priya@techsupport.com", password: "agent123", role: "agent" },
        { id: "TS-CUSTOMER", name: "Rahul Kumar", email: "rahul@gmail.com", password: "customer123", role: "customer" },
        { id: "TS-CU-ANANYA", name: "Ananya Singh", email: "ananya@gmail.com", password: "customer123", role: "customer" },
        { id: "TS-CU-PRIYA", name: "Priya Das", email: "priya@gmail.com", password: "customer123", role: "customer" },
        { id: "TS-CU-ARJUN", name: "Arjun Mehta", email: "arjun@gmail.com", password: "customer123", role: "customer" }
    ];
    localStorage.setItem(authUsersStorageKey, JSON.stringify(starterUsers));
    return starterUsers;
}

function createAuthUserId(role, name, userList) {
    const prefix = role === "agent" ? "TS-AG-" : (role === "customer" ? "TS-CU-" : "TS-AD-");
    const slug = String(name || "USER").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 16) || "USER";
    const baseId = prefix + slug;
    let userId = baseId;
    let suffix = 2;
    while (userList.some(function(user) { return user.id === userId; })) {
        userId = baseId + suffix;
        suffix++;
    }
    return userId;
}

function syncAuthUsersWithRecords() {
    const storedUsers = parseJson(localStorage.getItem(authUsersStorageKey), authUsers);
    authUsers = Array.isArray(storedUsers) ? storedUsers : [];
    let changed = false;
    const usedIds = new Set();

    authUsers.forEach(function(user) {
        if (!user || !user.email || !user.role) return;
        user.email = String(user.email).trim().toLowerCase();
        if (!user.id || usedIds.has(user.id)) {
            user.id = createAuthUserId(user.role, user.name || user.email.split("@")[0], authUsers);
            changed = true;
        }
        usedIds.add(user.id);
    });

    if (!authUsers.some(function(user) { return user.role === "admin"; })) {
        authUsers.push({ id: "TS-ADMIN", name: "Shreya Sharma", email: "admin@techsupport.com", password: "admin123", role: "admin" });
        changed = true;
    }

    const records = agents.map(function(agent) { return { record: agent, role: "agent", password: "agent123" }; })
        .concat(customers.map(function(customer) { return { record: customer, role: "customer", password: "customer123" }; }));
    records.forEach(function(entry) {
        const email = String(entry.record.email || "").trim().toLowerCase();
        if (!email) return;
        const existing = authUsers.find(function(user) { return String(user.email || "").toLowerCase() === email; });
        if (existing) {
            if (existing.role === entry.role && existing.name !== entry.record.name) {
                existing.name = entry.record.name;
                changed = true;
            }
            return;
        }
        authUsers.push({
            id: createAuthUserId(entry.role, entry.record.name || email.split("@")[0], authUsers),
            name: entry.record.name,
            email: email,
            password: entry.password,
            role: entry.role
        });
        changed = true;
    });

    if (changed) localStorage.setItem(authUsersStorageKey, JSON.stringify(authUsers));
    return authUsers;
}

function loadAuthSession() {
    const session = parseJson(sessionStorage.getItem(authSessionStorageKey), null);
    if (session && session.id && session.role) return session;
    const legacySession = parseJson(localStorage.getItem(authSessionStorageKey), null);
    if (legacySession && legacySession.id && legacySession.role) {
        sessionStorage.setItem(authSessionStorageKey, JSON.stringify(legacySession));
        localStorage.removeItem(authSessionStorageKey);
        return legacySession;
    }
    return null;
}

function saveAuthSession(user) {
    authSession = { id: user.id, name: user.name, email: user.email, role: user.role };
    sessionStorage.setItem(authSessionStorageKey, JSON.stringify(authSession));
}

function authDestination(role) {
    return role === "customer" ? "customer-dashboard.html" : "index.html";
}

function setupAuthPage() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const feedback = document.getElementById("authFeedback");
    const title = document.getElementById("authTitle");
    const subtitle = document.getElementById("authSubtitle");
    const loginIdentity = document.getElementById("loginIdentity");

    document.querySelectorAll("[data-auth-mode]").forEach(function(tab) {
        tab.addEventListener("click", function() {
            const isLogin = tab.dataset.authMode === "login";
            loginForm.hidden = !isLogin;
            registerForm.hidden = isLogin;
            document.querySelectorAll("[data-auth-mode]").forEach(function(item) {
                const selected = item === tab;
                item.classList.toggle("is-active", selected);
                item.setAttribute("aria-selected", String(selected));
            });
            title.textContent = isLogin ? "Welcome back" : "Create your account";
            subtitle.textContent = isLogin ? "Sign in with your user ID or email." : "Choose a role and set up your local demo account.";
            feedback.textContent = "";
            feedback.classList.remove("is-success");
        });
    });

    loginForm.addEventListener("submit", function(event) {
        event.preventDefault();
        authUsers = syncAuthUsersWithRecords();
        const identity = loginIdentity.value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;
        const user = authUsers.find(function(account) {
            return (account.id.toLowerCase() === identity || account.email.toLowerCase() === identity) && account.password === password;
        });
        if (!user) {
            feedback.textContent = "User ID/email or password is incorrect.";
            feedback.classList.remove("is-success");
            return;
        }
        saveAuthSession(user);
        window.location.href = authDestination(user.role);
    });

    registerForm.addEventListener("submit", function(event) {
        event.preventDefault();
        customers = parseJson(localStorage.getItem(customerStorageKey), customers);
        agents = parseJson(localStorage.getItem(agentStorageKey), agents);
        authUsers = syncAuthUsersWithRecords();
        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim().toLowerCase();
        const role = document.getElementById("registerRole").value;
        const password = document.getElementById("registerPassword").value;
        if (authUsers.some(function(account) { return account.email.toLowerCase() === email; })) {
            feedback.textContent = "An account with this email already exists. Sign in instead.";
            feedback.classList.remove("is-success");
            return;
        }
        const rolePrefix = role === "customer" ? "CU" : (role === "agent" ? "AG" : "AD");
        let userId = "TS-" + rolePrefix + "-" + Math.floor(1000 + Math.random() * 9000);
        while (authUsers.some(function(account) { return account.id === userId; })) {
            userId = "TS-" + rolePrefix + "-" + Math.floor(1000 + Math.random() * 9000);
        }
        const user = { id: userId, name: name, email: email, password: password, role: role };
        authUsers.push(user);
        localStorage.setItem(authUsersStorageKey, JSON.stringify(authUsers));
        if (role === "customer" && !customers.some(function(customer) { return customer.email.toLowerCase() === email; })) {
            customers.push({ name: name, email: email, phone: "Not Added", tickets: 0, status: "Active" });
            saveCustomers();
        }
        if (role === "agent" && !agents.some(function(agent) { return agent.email.toLowerCase() === email; })) {
            agents.push({ name: name, email: email, department: "Customer Support", tickets: 0, status: "Online" });
            saveAgents();
        }
        loginIdentity.value = userId;
        document.getElementById("loginPassword").value = "";
        document.querySelector('[data-auth-mode="login"]').click();
        feedback.textContent = "Account created. Your User ID is " + userId + ". Sign in with this ID and your password.";
        feedback.classList.add("is-success");
    });
}

function applyRoleAccess(session) {
    const pageName = window.location.pathname.split("/").pop().toLowerCase();
    const pagesByRole = {
        admin: ["index.html", "tickets.html", "chat.html", "knowledge.html", "customers.html", "agents.html", "analytics.html", "feedback.html", "reports.html"],
        agent: ["index.html", "tickets.html", "chat.html", "knowledge.html", "customers.html"],
        customer: ["customer-dashboard.html", "chat.html", "knowledge.html"]
    };
    const allowedPages = pagesByRole[session.role] || [];
    if (!allowedPages.includes(pageName)) {
        window.location.replace(authDestination(session.role));
        return;
    }
    if (pageName === "index.html") {
        setText("dashboardGreeting", "Good Morning, " + session.name.split(" ")[0] + "!");
    }
    document.querySelectorAll(".sidebar a[href]").forEach(function(link) {
        const target = link.getAttribute("href").split("?")[0].toLowerCase();
        if (session.role === "customer" && pageName !== "customer-dashboard.html") {
            const customerLinks = {
                "index.html": { href: "customer-dashboard.html", label: "My Dashboard" },
                "customer-dashboard.html": { href: "customer-dashboard.html", label: "My Dashboard" },
                "tickets.html": { href: "customer-dashboard.html#my-tickets", label: "My Tickets" },
                "chat.html": { href: "chat.html", label: "Live Chat" },
                "knowledge.html": { href: "knowledge.html", label: "Knowledge Base" },
                "customers.html": { href: "customer-dashboard.html#my-profile", label: "My Profile" },
                "feedback.html": { href: "customer-dashboard.html#feedback", label: "Feedback" }
            };
            const customerLink = customerLinks[target];
            const item = link.closest("li");
            if (customerLink && item) {
                link.setAttribute("href", customerLink.href);
                const icon = link.querySelector("i");
                link.innerHTML = (icon ? icon.outerHTML + " " : "") + customerLink.label;
                item.hidden = false;
                item.classList.toggle("active", target === pageName);
            } else if (item && target.endsWith(".html")) {
                item.hidden = true;
            }
            return;
        }
        if (target.endsWith(".html") && target !== "login.html") {
            const item = link.closest("li");
            if (item) item.hidden = !allowedPages.includes(target);
        }
    });
    const topbar = document.querySelector(".topbar, .reports-topbar");
    const profile = topbar && topbar.querySelector(".profile");
    const reportsProfile = topbar && topbar.querySelector(".reports-profile");
    if (profile) {
        const profileName = profile.querySelector(".profile-info strong");
        const profileRole = profile.querySelector(".profile-info small");
        const profileImage = profile.querySelector(".profile-image");
        if (profileName) profileName.textContent = session.name;
        if (profileRole) profileRole.textContent = session.role.charAt(0).toUpperCase() + session.role.slice(1);
        if (profileImage) profileImage.textContent = session.name.charAt(0).toUpperCase();
    } else if (reportsProfile) {
        const profileName = reportsProfile.querySelector("strong");
        const profileRole = reportsProfile.querySelector("small");
        const profileImage = reportsProfile.querySelector(".reports-avatar");
        if (profileName) profileName.textContent = session.name;
        if (profileRole) profileRole.textContent = session.role === "admin" ? "Administrator" : session.role.charAt(0).toUpperCase() + session.role.slice(1);
        if (profileImage) profileImage.textContent = session.name.charAt(0).toUpperCase();
    } else if (topbar && !topbar.querySelector(".current-user-chip")) {
        const identity = document.createElement("div");
        identity.className = "current-user-chip";
        identity.innerHTML = `<strong>${escapeHtml(session.name)}</strong><span>${escapeHtml(session.role)}</span>`;
        const actions = topbar.querySelector(".topbar-actions");
        (actions || topbar).appendChild(identity);
    }
}

function renderCustomerPortal() {
    const portal = document.getElementById("customerPortal");
    if (!portal || !authSession || authSession.role !== "customer") return;
    const customerEmail = authSession.email.toLowerCase();
    const ownTickets = tickets.filter(function(ticket) { return String(ticket.email || "").toLowerCase() === customerEmail; });
    const resolvedTickets = ownTickets.filter(function(ticket) { return ticket.status === "Resolved" || ticket.status === "Closed"; });
    const openTickets = ownTickets.filter(function(ticket) { return ticket.status !== "Resolved" && ticket.status !== "Closed"; });
    setText("portalName", authSession.name);
    setText("portalAvatar", authSession.name.charAt(0).toUpperCase());
    setText("portalWelcome", "Welcome back, " + authSession.name.split(" ")[0]);
    setText("profileCustomerName", authSession.name);
    setText("profileCustomerEmail", authSession.email);
    setText("profileCustomerId", authSession.id);
    setText("profileCustomerPhone", (customers.find(function(customer) { return String(customer.email || "").toLowerCase() === customerEmail; }) || {}).phone || "Not added");
    setText("myTicketCount", ownTickets.length);
    setText("myOpenTicketCount", openTickets.length);
    setText("myResolvedTicketCount", resolvedTickets.length);

    const ticketRows = document.getElementById("myTicketRows");
    const noTickets = document.getElementById("noCustomerTickets");
    ticketRows.innerHTML = ownTickets.map(function(ticket) {
        return `<tr><td>${escapeHtml(ticket.id)}</td><td>${escapeHtml(ticket.subject)}</td><td>${escapeHtml(ticket.category)}</td><td>${escapeHtml(ticket.priority)}</td><td><span class="portal-status">${escapeHtml(ticket.status)}</span></td></tr>`;
    }).join("");
    noTickets.hidden = ownTickets.length > 0;

    const ticketSelect = document.getElementById("feedbackTicket");
    ticketSelect.innerHTML = '<option value="">General feedback</option>' + ownTickets.map(function(ticket) {
        return `<option value="${escapeHtml(ticket.id)}">${escapeHtml(ticket.id)} - ${escapeHtml(ticket.subject)}</option>`;
    }).join("");
    renderCustomerFeedback();
}

function customerFeedbackStorageKey() {
    return "customerFeedback:" + encodeURIComponent(authSession.email.toLowerCase());
}

function renderCustomerFeedback() {
    const feedbackList = document.getElementById("myFeedbackList");
    if (!feedbackList || !authSession || authSession.role !== "customer") return;
    const storedFeedback = parseJson(localStorage.getItem(customerFeedbackStorageKey()), []);
    const feedbackItems = Array.isArray(storedFeedback) ? storedFeedback : [];
    feedbackList.innerHTML = feedbackItems.length ? feedbackItems.slice().reverse().map(function(item) {
        return `<article class="portal-feedback-item"><p>${escapeHtml(item.message)}</p><span>${escapeHtml(item.ticketId || "General feedback")} · ${escapeHtml(item.rating)}/5 · ${escapeHtml(item.time)}</span></article>`;
    }).join("") : '<p class="portal-empty">You have not sent feedback yet.</p>';
}

function saveCustomerFeedback(event) {
    event.preventDefault();
    if (!authSession || authSession.role !== "customer") return;
    const message = document.getElementById("feedbackMessage").value.trim();
    if (!message) return;
    const storedFeedback = parseJson(localStorage.getItem(customerFeedbackStorageKey()), []);
    const feedbackItems = Array.isArray(storedFeedback) ? storedFeedback : [];
    const feedbackEntry = {
        id: "customer-feedback-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        name: authSession.name,
        email: authSession.email,
        ticketId: document.getElementById("feedbackTicket").value,
        rating: Number(document.getElementById("feedbackRating").value),
        message: message,
        time: nowTime(),
        date: new Date().toLocaleDateString(),
        source: "customer"
    };
    feedbackItems.push(feedbackEntry);
    localStorage.setItem(customerFeedbackStorageKey(), JSON.stringify(feedbackItems));
    const storedSharedFeedback = parseJson(localStorage.getItem("feedback"), []);
    const sharedFeedback = Array.isArray(storedSharedFeedback) ? storedSharedFeedback : [];
    sharedFeedback.push(feedbackEntry);
    localStorage.setItem("feedback", JSON.stringify(sharedFeedback));
    document.getElementById("customerFeedbackForm").reset();
    setText("customerFeedbackStatus", "Your feedback has been saved.");
    renderCustomerPortal();
}

function saveCustomerTicket(event) {
    event.preventDefault();
    if (!authSession || authSession.role !== "customer") return;
    tickets = parseJson(localStorage.getItem(ticketStorageKey), tickets);
    const ticket = {
        id: nextTicketId(),
        customer: authSession.name,
        email: authSession.email,
        category: document.getElementById("customerTicketCategory").value,
        priority: document.getElementById("customerTicketPriority").value,
        subject: document.getElementById("customerTicketSubject").value.trim(),
        description: document.getElementById("customerTicketDescription").value.trim(),
        status: "New"
    };
    tickets.push(ticket);
    saveTickets();
    customers = parseJson(localStorage.getItem(customerStorageKey), customers);
    addCustomerFromTicket(ticket);
    document.getElementById("customerTicketForm").reset();
    setText("customerTicketStatus", "Ticket " + ticket.id + " submitted successfully. Track it below.");
    refreshAllViews();
}

function deduplicateCustomers(customerList) {
    const uniqueCustomers = [];
    const customerIndexes = {};

    customerList.forEach(function(customer) {
        const customerKey = String(customer.name || customer.email).trim().toLowerCase();
        const existingIndex = customerIndexes[customerKey];

        if (existingIndex === undefined) {
            customerIndexes[customerKey] = uniqueCustomers.length;
            uniqueCustomers.push(customer);
            return;
        }

        const existingCustomer = uniqueCustomers[existingIndex];
        existingCustomer.tickets = Math.max(
            Number(existingCustomer.tickets || 0),
            Number(customer.tickets || 0)
        );
        if ((!existingCustomer.phone || existingCustomer.phone === "Not Added") && customer.phone) {
            existingCustomer.phone = customer.phone;
        }
        if (existingCustomer.status !== "Active" && customer.status === "Active") {
            existingCustomer.status = customer.status;
        }
    });

    return uniqueCustomers;
}

function syncCustomersFromTickets() {
    tickets.forEach(function(ticket) {
        const existing = customers.find(function(customer) {
            return customer.email === ticket.email;
        });
        if (!existing) {
            customers.push({
                name: ticket.customer,
                email: ticket.email,
                phone: "Not Added",
                tickets: tickets.filter(function(item) { return item.email === ticket.email; }).length,
                status: "Active"
            });
        }
    });
    customers = deduplicateCustomers(customers);
    saveCustomers();
}

function parseJson(value, fallback) {
    try { return JSON.parse(value); } catch (error) { return fallback; }
}

function cloneRecord(record) {
    return JSON.parse(JSON.stringify(record));
}

function loadCollection(key, defaults, identityKey) {
    const stored = localStorage.getItem(key);
    const records = stored ? parseJson(stored, []) : defaults.map(cloneRecord);
    defaults.forEach(function(defaultRecord) {
        if (!records.some(function(record) { return record[identityKey] === defaultRecord[identityKey]; })) {
            records.push(cloneRecord(defaultRecord));
        }
    });
    localStorage.setItem(key, JSON.stringify(records));
    return records;
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value == null ? "" : String(value);
    return element.innerHTML;
}

function nowTime() {
    return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function saveTickets() { localStorage.setItem(ticketStorageKey, JSON.stringify(tickets)); }
function saveCustomers() { localStorage.setItem(customerStorageKey, JSON.stringify(customers)); }
function saveAgents() { localStorage.setItem(agentStorageKey, JSON.stringify(agents)); }

function getAgentTicketCount(agent, ticketList) {
    const resolvedTickets = ticketList.filter(function(ticket) {
        const owner = ticket.resolvedBy || {};
        return (ticket.status === "Resolved" || ticket.status === "Closed") &&
            ((owner.email && String(owner.email).toLowerCase() === String(agent.email || "").toLowerCase()) ||
                (owner.id && agent.id && owner.id === agent.id));
    }).length;
    return Number(agent.tickets || 0) + resolvedTickets;
}

// ---------- TICKETS ----------

function nextTicketId() {
    let nextNumber = 1021;
    tickets.forEach(function(ticket) {
        const number = parseInt(String(ticket.id).replace("#TS-", ""), 10);
        if (!isNaN(number) && number >= nextNumber) nextNumber = number + 1;
    });
    return "#TS-" + nextNumber;
}

function createTicket() {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `<div class="modal-box"><div class="modal-header"><h2>Create New Ticket</h2><button type="button" onclick="closeModal()">&times;</button></div>
        <form onsubmit="saveTicket(event)"><label>Customer Name</label><input id="ticketCustomerName" required><label>Email</label><input type="email" id="ticketCustomerEmail" required>
        <label>Category</label><select id="ticketCategory"><option>Network</option><option>Software</option><option>Hardware</option><option>Account</option><option>Other</option></select>
        <label>Priority</label><select id="ticketPriority"><option>Low</option><option>Medium</option><option>High</option></select><label>Subject</label><input id="ticketSubject" required>
        <label>Description</label><textarea id="ticketDescription" rows="4" required></textarea><div class="modal-buttons"><button type="button" onclick="closeModal()">Cancel</button><button type="submit">Create Ticket</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveTicket(event) {
    event.preventDefault();
    tickets = parseJson(localStorage.getItem(ticketStorageKey), tickets);
    customers = parseJson(localStorage.getItem(customerStorageKey), customers);
    authUsers = syncAuthUsersWithRecords();
    const customerEmail = document.getElementById("ticketCustomerEmail").value.trim().toLowerCase();
    const hadCustomerAccount = authUsers.some(function(user) { return user.email === customerEmail && user.role === "customer"; });
    const ticket = {
        id: nextTicketId(),
        customer: document.getElementById("ticketCustomerName").value.trim(),
        email: document.getElementById("ticketCustomerEmail").value.trim(),
        category: document.getElementById("ticketCategory").value,
        priority: document.getElementById("ticketPriority").value,
        subject: document.getElementById("ticketSubject").value.trim(),
        description: document.getElementById("ticketDescription").value.trim(),
        status: "New"
    };
    tickets.push(ticket);
    saveTickets();
    addCustomerFromTicket(ticket);
    authUsers = syncAuthUsersWithRecords();
    const customerAccount = authUsers.find(function(user) { return user.email === customerEmail && user.role === "customer"; });
    closeModal();
    refreshAllViews();
    const loginDetails = !hadCustomerAccount && customerAccount ? "\nCustomer login ID: " + customerAccount.id + "\nTemporary password: customer123" : "";
    alert("Ticket created successfully: " + ticket.id + loginDetails);
}

function displayTickets() {
    const table = document.getElementById("ticketTableBody");
    if (!table) return;
    const filter = document.getElementById("statusFilter");
    const selectedStatus = filter ? filter.value : "all";
    table.innerHTML = "";
    tickets.forEach(function(ticket, index) {
        if (selectedStatus !== "all" && ticket.status !== selectedStatus) return;
        const row = document.createElement("tr");
        row.innerHTML = `<td><strong>${escapeHtml(ticket.id)}</strong></td><td>${escapeHtml(ticket.customer)}<br><small>${escapeHtml(ticket.email)}</small></td><td>${escapeHtml(ticket.subject)}</td><td>${escapeHtml(ticket.category)}</td><td><span class="priority ${String(ticket.priority).toLowerCase()}">${escapeHtml(ticket.priority)}</span></td><td><span class="status ${String(ticket.status).toLowerCase().replace(" ", "-")}">${escapeHtml(ticket.status)}</span></td><td>${actionButtons("ticket", index)}</td>`;
        table.appendChild(row);
    });
}

function displayRecentTickets() {
    const table = document.getElementById("recentTicketsBody");
    if (!table) return;
    table.innerHTML = "";
    tickets.slice().reverse().slice(0, 3).forEach(function(ticket) {
        const index = tickets.indexOf(ticket);
        const row = document.createElement("tr");
        row.innerHTML = `<td><strong>${escapeHtml(ticket.id)}</strong></td><td>${escapeHtml(ticket.customer)}</td><td>${escapeHtml(ticket.subject)}</td><td><span class="priority ${String(ticket.priority).toLowerCase()}">${escapeHtml(ticket.priority)}</span></td><td><span class="status ${String(ticket.status).toLowerCase().replace(" ", "-")}">${escapeHtml(ticket.status)}</span></td><td>${actionButtons("ticket", index)}</td>`;
        table.appendChild(row);
    });
}

function actionButtons(type, index) {
    return `<div class="ticket-actions"><button class="view-btn" onclick="viewRecord('${type}', ${index})" title="View"><i class="fa-solid fa-eye"></i></button><button class="status-btn" onclick="editRecord('${type}', ${index})" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="delete-btn" onclick="deleteRecord('${type}', ${index})" title="Delete"><i class="fa-solid fa-trash"></i></button></div>`;
}

function getRecords(type) {
    if (type === "ticket") return tickets;
    if (type === "customer") return customers;
    return agents;
}

function viewRecord(type, index) {
    const record = getRecords(type)[index];
    if (record) alert(Object.keys(record).map(function(key) { return key + ": " + record[key]; }).join("\n"));
}

function editRecord(type, index) {
    const record = getRecords(type)[index];
    if (!record) return;
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    const fields = type === "ticket"
        ? `<label>Status</label><select id="editStatus"><option ${record.status === "New" ? "selected" : ""}>New</option><option ${record.status === "In Progress" ? "selected" : ""}>In Progress</option><option ${record.status === "Waiting" ? "selected" : ""}>Waiting</option><option ${record.status === "Resolved" ? "selected" : ""}>Resolved</option><option ${record.status === "Closed" ? "selected" : ""}>Closed</option></select>`
        : type === "customer"
            ? `<label>Phone</label><input id="editPhone" value="${escapeHtml(record.phone)}"><label>Status</label><select id="editStatus"><option ${record.status === "Active" ? "selected" : ""}>Active</option><option ${record.status === "Inactive" ? "selected" : ""}>Inactive</option></select>`
            : `<label>Department</label><select id="editDepartment"><option ${record.department === "Network Support" ? "selected" : ""}>Network Support</option><option ${record.department === "Software Support" ? "selected" : ""}>Software Support</option><option ${record.department === "Hardware Support" ? "selected" : ""}>Hardware Support</option><option ${record.department === "Customer Support" ? "selected" : ""}>Customer Support</option></select><label>Status</label><select id="editStatus"><option ${record.status === "Online" ? "selected" : ""}>Online</option><option ${record.status === "Offline" ? "selected" : ""}>Offline</option></select>`;
    modal.innerHTML = `<div class="modal-box"><div class="modal-header"><h2>Edit ${type}</h2><button type="button" onclick="closeModal()">&times;</button></div><form onsubmit="saveEdit(event, '${type}', ${index})">${fields}<div class="modal-buttons"><button type="button" onclick="closeModal()">Cancel</button><button type="submit">Save Changes</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveEdit(event, type, index) {
    event.preventDefault();
    const record = getRecords(type)[index];
    if (!record) return;
    if (type === "ticket") {
        const previousStatus = record.status;
        const nextStatus = document.getElementById("editStatus").value;
        const wasComplete = previousStatus === "Resolved" || previousStatus === "Closed";
        const isComplete = nextStatus === "Resolved" || nextStatus === "Closed";
        record.status = nextStatus;
        if (!wasComplete && isComplete && authSession && authSession.role === "agent") {
            record.resolvedBy = {
                id: authSession.id,
                name: authSession.name,
                email: authSession.email
            };
            record.resolvedAt = new Date().toISOString();
        }
    }
    if (type === "customer") {
        record.phone = document.getElementById("editPhone").value.trim();
        record.status = document.getElementById("editStatus").value;
    }
    if (type === "agent") {
        record.department = document.getElementById("editDepartment").value;
        record.status = document.getElementById("editStatus").value;
    }
    if (type === "ticket") saveTickets();
    if (type === "customer") saveCustomers();
    if (type === "agent") saveAgents();
    closeModal();
    refreshAllViews();
}

function deleteRecord(type, index) {
    const records = getRecords(type);
    if (!records[index] || !confirm("Delete this " + type + "?")) return;
    records.splice(index, 1);
    if (type === "ticket") saveTickets();
    if (type === "customer") saveCustomers();
    if (type === "agent") saveAgents();
    refreshAllViews();
}

function viewTicket(index) { viewRecord("ticket", index); }
function changeStatus(index) {

    let ticketsData = JSON.parse(localStorage.getItem("tickets") || "[]");
    let ticket = ticketsData[index];

    if (!ticket) {
        alert("Ticket not found!");
        return;
    }

    // New → In Progress
    if (ticket.status === "New") {

        ticket.status = "In Progress";

        alert(
            "🔵 Ticket Started!\n\n" +
            "Ticket: " + ticket.id +
            "\nStatus: In Progress"
        );
    }

    // In Progress → Resolved
    else if (ticket.status === "In Progress") {

        let solution = prompt(
            "Enter the solution provided for this ticket:"
        );

        if (!solution) {
            return;
        }

        ticket.solution = solution;
        ticket.status = "Resolved";

        alert(
            "✅ Ticket Resolved!\n\n" +
            "Ticket: " + ticket.id +
            "\nStatus: Resolved"
        );
    }

    // Resolved → Closed
    else if (ticket.status === "Resolved") {

        let confirmClose = confirm(
            "Has the customer confirmed that the issue is solved?\n\n" +
            "Click OK to close the ticket."
        );

        if (!confirmClose) {
            return;
        }

        ticket.status = "Closed";

        alert(
            "🎉 Ticket Completed!\n\n" +
            "Ticket: " + ticket.id +
            "\nStatus: Closed"
        );
    }

    // Already closed
    else if (ticket.status === "Closed") {

        alert("✔ This ticket is already completed.");
        return;
    }

    localStorage.setItem("tickets", JSON.stringify(ticketsData));

    // Refresh ticket table and dashboard
    if (typeof refreshTicketViews === "function") {
        refreshTicketViews();
    }

    if (typeof updateAnalytics === "function") {
        updateAnalytics();
    }
}
function deleteTicket(index) { deleteRecord("ticket", index); }

// ---------- DASHBOARD ----------

function updateDashboardStats() {
    const open = tickets.filter(function(ticket) { return ticket.status === "New" || ticket.status === "In Progress"; }).length;
    const resolved = tickets.filter(function(ticket) { return ticket.status === "Resolved" || ticket.status === "Closed"; }).length;
    setText("dashboardTotalTickets", tickets.length);
    setText("dashboardOpenTickets", open);
    setText("dashboardResolvedTickets", resolved);
    setText("dashboardCustomerCount", customers.length);
    setText("totalTickets", tickets.length);
    setText("newTickets", tickets.filter(function(ticket) { return ticket.status === "New"; }).length);
    setText("progressTickets", tickets.filter(function(ticket) { return ticket.status === "In Progress"; }).length);
    setText("resolvedTickets", resolved);
    setText("summaryNewTickets", tickets.filter(function(ticket) { return ticket.status === "New"; }).length);
    setText("summaryProgressTickets", tickets.filter(function(ticket) { return ticket.status === "In Progress"; }).length);
    setText("summaryWaitingTickets", tickets.filter(function(ticket) { return ticket.status === "Waiting"; }).length);
    setText("summaryResolvedTickets", resolved);
    setText("customerTotalCount", customers.length);
    setText("customerActiveCount", customers.filter(function(customer) { return customer.status === "Active"; }).length);
    setText("customerSupportRequestCount", tickets.length);
    setText("agentTotalCount", agents.length);
    setText("agentOnlineCount", agents.filter(function(agent) { return agent.status === "Online"; }).length);
    setText("agentActiveTicketCount", tickets.filter(function(ticket) { return ticket.status === "New" || ticket.status === "In Progress"; }).length);
}

// ---------- CUSTOMERS ----------

function addCustomerFromTicket(ticket) {
    const existing = customers.find(function(customer) { return customer.email === ticket.email; });
    if (existing) existing.tickets = Number(existing.tickets || 0) + 1;
    else customers.push({ name: ticket.customer, email: ticket.email, phone: "Not Added", tickets: 1, status: "Active" });
    saveCustomers();
}

function addCustomer() {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `<div class="modal-box"><div class="modal-header"><h2>Add Customer</h2><button type="button" onclick="closeModal()">&times;</button></div><form onsubmit="saveCustomer(event)"><label>Name</label><input id="customerName" required><label>Email</label><input type="email" id="customerEmail" required><label>Phone</label><input id="customerPhone" required><div class="modal-buttons"><button type="button" onclick="closeModal()">Cancel</button><button type="submit">Add Customer</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveCustomer(event) {
    event.preventDefault();
    customers = parseJson(localStorage.getItem(customerStorageKey), customers);
    authUsers = syncAuthUsersWithRecords();
    const email = document.getElementById("customerEmail").value.trim();
    const name = document.getElementById("customerName").value.trim();
    if (customers.some(function(customer) {
        return customer.email.toLowerCase() === email.toLowerCase()
            || customer.name.toLowerCase() === name.toLowerCase();
    })) {
        alert("A customer with this name or email already exists.");
        return;
    }
    customers.push({ name: name, email: email, phone: document.getElementById("customerPhone").value.trim(), tickets: 0, status: "Active" });
    saveCustomers();
    authUsers = syncAuthUsersWithRecords();
    const customerAccount = authUsers.find(function(user) { return user.email === email.toLowerCase() && user.role === "customer"; });
    closeModal();
    refreshAllViews();
    if (customerAccount) alert("Customer added. Login ID: " + customerAccount.id + "\nTemporary password: customer123");
}

function displayCustomers() {
    const table = document.getElementById("customerTableBody");
    if (!table) return;
    table.innerHTML = customers.map(function(customer, index) { return `<tr><td><strong>${escapeHtml(customer.name)}</strong></td><td>${escapeHtml(customer.email)}</td><td>${escapeHtml(customer.phone)}</td><td>${customer.tickets}</td><td><span class="status resolved">${escapeHtml(customer.status)}</span></td><td>${actionButtons("customer", index)}</td></tr>`; }).join("");
}

function viewCustomer(index) { viewRecord("customer", index); }

// ---------- AGENTS ----------

function addAgent() {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `<div class="modal-box"><div class="modal-header"><h2>Add Agent</h2><button type="button" onclick="closeModal()">&times;</button></div><form onsubmit="saveAgent(event)"><label>Name</label><input id="agentName" required><label>Email</label><input type="email" id="agentEmail" required><label>Department</label><select id="agentDepartment"><option>Network Support</option><option>Software Support</option><option>Hardware Support</option><option>Customer Support</option></select><div class="modal-buttons"><button type="button" onclick="closeModal()">Cancel</button><button type="submit">Add Agent</button></div></form></div>`;
    document.body.appendChild(modal);
}

function saveAgent(event) {
    event.preventDefault();
    agents = parseJson(localStorage.getItem(agentStorageKey), agents);
    authUsers = syncAuthUsersWithRecords();
    const email = document.getElementById("agentEmail").value.trim();
    if (agents.some(function(agent) { return agent.email === email; })) {
        alert("An agent with this email already exists.");
        return;
    }
    const name = document.getElementById("agentName").value.trim();
    agents.push({ name: name, email: email, department: document.getElementById("agentDepartment").value, tickets: 0, status: "Online" });
    saveAgents();
    authUsers = syncAuthUsersWithRecords();
    const agentAccount = authUsers.find(function(user) { return user.email === email.toLowerCase() && user.role === "agent"; });
    closeModal();
    refreshAllViews();
    if (agentAccount) alert("Agent added. Login ID: " + agentAccount.id + "\nTemporary password: agent123");
}

function displayAgents() {
    const table = document.getElementById("agentTableBody");
    if (!table) return;
    table.innerHTML = agents.map(function(agent, index) { return `<tr><td><strong>${escapeHtml(agent.name)}</strong></td><td>${escapeHtml(agent.email)}</td><td>${escapeHtml(agent.department)}</td><td>${agent.tickets}</td><td><span class="status resolved">${escapeHtml(agent.status)}</span></td><td>${actionButtons("agent", index)}</td></tr>`; }).join("");
}

function viewAgent(index) { viewRecord("agent", index); }

// ---------- LIVE CHAT ----------

function loadChatMessages() {
    const stored = localStorage.getItem(chatStorageKey) || localStorage.getItem("techSupportChatMessages");
    let messages = stored ? parseJson(stored, {}) : {};
    if (Array.isArray(messages)) {
        const firstCustomer = customers[0];
        messages = firstCustomer ? { [getChatCustomerKey(firstCustomer)]: messages } : {};
    }
    customers.forEach(function(customer) {
        const customerKey = getChatCustomerKey(customer);
        if (!Array.isArray(messages[customerKey])) {
            messages[customerKey] = Array.isArray(messages[customer.name]) ? messages[customer.name] : [];
        }
    });
    Object.keys(messages).forEach(function(customerKey) {
        messages[customerKey] = (Array.isArray(messages[customerKey]) ? messages[customerKey] : []).map(function(message) {
            if (!message || typeof message !== "object") return null;
            return {
                sender: message.sender === "agent" ? "agent" : "customer",
                text: typeof message.text === "string" ? message.text : (typeof message.message === "string" ? message.message : ""),
                time: typeof message.time === "string" ? message.time : nowTime()
            };
        }).filter(function(message) {
            if (!message || typeof message.text !== "string") return false;
            if (message.text === "Hello, may I help you with your support request?" || message.text === "Thanks for the details. Please give me a moment while I check this for you." || message.text.indexOf("Thanks for the details about \"") === 0) return false;
            return true;
        });
    });
    localStorage.setItem(chatStorageKey, JSON.stringify(messages));
    return messages;
}

function saveChatMessages() { localStorage.setItem(chatStorageKey, JSON.stringify(chatMessages)); }

function getChatCustomerKey(customer) {
    return String(customer.email || customer.name).trim().toLowerCase();
}

function renderChatUsers() {
    const list = document.getElementById("chatUsersList");
    if (!list) return;
    const userList = list.closest(".chat-users");
    if (authSession && authSession.role === "customer") {
        if (userList) userList.hidden = true;
        return;
    }
    if (userList) userList.hidden = false;
    list.innerHTML = customers.map(function(customer) {
        const customerKey = getChatCustomerKey(customer);
        const history = chatMessages[customerKey] || [];
        const lastMessage = history.length ? history[history.length - 1].text : "No messages yet";
        return `<div class="chat-user${customerKey === activeCustomer ? " active-user" : ""}" data-customer="${escapeHtml(customerKey)}" data-customer-name="${escapeHtml(customer.name)}"><div class="user-avatar">${escapeHtml(customer.name.charAt(0))}</div><div><strong>${escapeHtml(customer.name)}</strong><p>${escapeHtml(lastMessage)}</p></div></div>`;
    }).join("");
}
function renderMessages(customerName) {

    const messages = document.getElementById("messages");

    if (!messages) {
        return;
    }

    const history = chatMessages[customerName] || [];
    messages.innerHTML = history.length ? history.map(function(message, index) {

        return `
            <div class="message ${message.sender === "agent" ? "agent-message" : "customer-message"}" data-message-index="${index}">

                <p>${escapeHtml(message.text)}</p>

                <span>${escapeHtml(message.time)}</span>
                ${canDeleteChatMessage(message) ? '<button type="button" class="message-delete" aria-label="Delete message" title="Delete message"><i class="fa-solid fa-trash"></i> Delete</button>' : ""}

            </div>
        `;

    }).join("") : '<p class="chat-empty-state">No messages yet.</p>';

    messages.scrollTop = messages.scrollHeight;
}

function canDeleteChatMessage(message) {
    if (!authSession) return false;
    return authSession.role !== "customer" || message.sender === "customer";
}

function deleteChatMessage(customerName, messageIndex) {
    const history = chatMessages[customerName];
    if (!history || messageIndex < 0 || messageIndex >= history.length) return;
    history.splice(messageIndex, 1);
    saveChatMessages();
    renderMessages(customerName);
    renderChatUsers();
}

function addChatMessage(customerName, sender, text) {
    if (!chatMessages[customerName]) chatMessages[customerName] = [];
    chatMessages[customerName].push({ sender: sender, text: text, time: nowTime() });
    saveChatMessages();
    renderMessages(customerName);
    renderChatUsers();
}

function selectChat(customerElement) {
    activeCustomer = customerElement.dataset.customer;
    activeCustomerName = customerElement.dataset.customerName;
    document.querySelectorAll(".chat-user").forEach(function(user) { user.classList.toggle("active-user", user === customerElement); });
    setText("chatHeaderName", activeCustomerName);
    setText("chatHeaderAvatar", activeCustomerName.charAt(0));
    setText("chatHeaderStatus", "Customer");
    document.getElementById("messageInput").disabled = false;
    document.querySelector(".chat-input-area button").disabled = false;
    renderMessages(activeCustomer);
}

function sendMessage() {

    const input = document.getElementById("messageInput");

    if (!input) {
        return;
    }

    const message = input.value.trim();

    if (message === "" || !activeCustomer) {
        return;
    }

    addChatMessage(activeCustomer, authSession && authSession.role === "customer" ? "customer" : "agent", message);

    input.value = "";
}

function filterPageContent(query) {
    const normalizedQuery = query.trim().toLowerCase();
    const selectors = ["table tbody tr", ".chat-user", ".knowledge-card", ".article-item", ".customer-card", ".agent-card"];
    selectors.forEach(function(selector) {
        document.querySelectorAll(selector).forEach(function(item) {
            item.style.display = !normalizedQuery || item.textContent.toLowerCase().includes(normalizedQuery) ? "" : "none";
        });
    });
}

function showNotification() {
    const existing = document.querySelector(".notification-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = "notification-toast";
    toast.innerHTML = '<strong>Notifications</strong><span>You have 3 support updates.</span>';
    document.body.appendChild(toast);
    window.setTimeout(function() { toast.remove(); }, 3500);
}

// ---------- KNOWLEDGE BASE AND COMMON ACTIONS ----------

const articles = {
    network: { title: "Network & WiFi", text: "Check router power, restart the router and reconnect your device." },
    wifi: { title: "WiFi is not connecting", text: "Restart the router and make sure your device is using the correct network." },
    software: { title: "Software Issues", text: "Restart the application, then reinstall it from the official source if the issue continues." },
    hardware: { title: "Hardware", text: "Check cables and power, then test the device with another compatible port." },
    email: { title: "Email Support", text: "Check your connection, refresh the inbox and verify your account details." },
    security: { title: "Security", text: "Use the password reset flow and never share your password with anyone." },
    mobile: { title: "Mobile Support", text: "Restart the device, update the application and check available storage." },
    password: { title: "Password Reset", text: "Select Forgot Password on the login page and follow the email instructions." }
};

function showArticle(type) {
    const article = articles[type];
    const box = document.getElementById("articleBox");
    if (article && box) box.innerHTML = `<div class="card-header"><div><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.text)}</p></div></div>`;
}

function openChat() { window.location.href = "chat.html"; }
function openCustomers() { window.location.href = "customers.html"; }
function openReports() { alert("Reports are being prepared from the current ticket data."); }
function logout(event) {
    if (event) event.preventDefault();
    sessionStorage.removeItem(authSessionStorageKey);
    localStorage.removeItem(authSessionStorageKey);
    authSession = null;
    window.location.href = "login.html";
}
function closeModal() { const modal = document.querySelector(".modal-overlay"); if (modal) modal.remove(); }

function refreshAllViews() {
    displayTickets();
    displayRecentTickets();
    displayCustomers();
    displayAgents();
    updateDashboardStats();
    renderChatUsers();
    renderCustomerPortal();
}

document.addEventListener("DOMContentLoaded", function() {
    if (document.body.classList.contains("auth-page")) {
        if (authSession) {
            window.location.replace(authDestination(authSession.role));
            return;
        }
        setupAuthPage();
        return;
    }
    authSession = loadAuthSession();
    if (!authSession) {
        window.location.replace("login.html");
        return;
    }
    applyRoleAccess(authSession);
    refreshAllViews();
    const customerFeedbackForm = document.getElementById("customerFeedbackForm");
    if (customerFeedbackForm) customerFeedbackForm.addEventListener("submit", saveCustomerFeedback);
    const customerTicketForm = document.getElementById("customerTicketForm");
    if (customerTicketForm) customerTicketForm.addEventListener("submit", saveCustomerTicket);
    document.querySelectorAll(".search-box input, .feedback-search input, .reports-search input").forEach(function(searchInput) {
        searchInput.addEventListener("input", function() { filterPageContent(searchInput.value); });
    });
    document.querySelectorAll(".notification, .feedback-notification, .reports-notification").forEach(function(notification) {
        notification.addEventListener("click", showNotification);
    });
    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter) statusFilter.addEventListener("change", displayTickets);
    const knowledgeSearch = document.getElementById("knowledgeSearch");
    if (knowledgeSearch) knowledgeSearch.addEventListener("input", function() {
        const query = knowledgeSearch.value.toLowerCase();
        document.querySelectorAll(".knowledge-card, .article-item").forEach(function(item) { item.style.display = item.textContent.toLowerCase().includes(query) ? "" : "none"; });
    });
    const chatList = document.getElementById("chatUsersList");
    if (chatList) {
        const messagesPanel = document.getElementById("messages");
        messagesPanel.addEventListener("click", function(event) {
            const deleteButton = event.target.closest(".message-delete");
            if (deleteButton) {
                event.stopPropagation();
                const messageElement = deleteButton.closest(".message");
                deleteChatMessage(activeCustomer, Number(messageElement.dataset.messageIndex));
                return;
            }
            const selectedMessage = event.target.closest(".message");
            messagesPanel.querySelectorAll(".message.is-selected").forEach(function(message) {
                if (message !== selectedMessage) message.classList.remove("is-selected");
            });
            if (selectedMessage && selectedMessage.querySelector(".message-delete")) {
                selectedMessage.classList.toggle("is-selected");
            }
        });
        if (authSession.role === "customer") {
            document.body.classList.add("chat-customer-mode");
            activeCustomer = authSession.email.toLowerCase();
            activeCustomerName = authSession.name;
            setText("chatHeaderName", activeCustomerName);
            setText("chatHeaderAvatar", activeCustomerName.charAt(0));
            setText("chatHeaderStatus", "Support team online");
            const chatAgent = document.querySelector(".chat-agent");
            if (chatAgent) chatAgent.innerHTML = '<i class="fa-solid fa-circle"></i> Support team online';
            document.getElementById("messageInput").disabled = false;
            document.getElementById("messageInput").placeholder = "Message the support team...";
            document.querySelector(".chat-input-area button").disabled = false;
            renderMessages(activeCustomer);
        } else {
            chatList.addEventListener("click", function(event) { const user = event.target.closest(".chat-user"); if (user) selectChat(user); });
            renderChatUsers();
            const firstUser = document.querySelector(".chat-user");
            if (firstUser) selectChat(firstUser);
        }
    }
    const messageInput = document.getElementById("messageInput");
    if (messageInput) messageInput.addEventListener("keydown", function(event) { if (event.key === "Enter") { event.preventDefault(); sendMessage(); } });
});

window.addEventListener("storage", function(event) {
    if (event.key === ticketStorageKey) tickets = parseJson(event.newValue, []);
    if (event.key === customerStorageKey) customers = parseJson(event.newValue, []);
    if (event.key === agentStorageKey) agents = parseJson(event.newValue, []);
    if (event.key === authUsersStorageKey) authUsers = parseJson(event.newValue, []);
    if (event.key === customerStorageKey || event.key === agentStorageKey) authUsers = syncAuthUsersWithRecords();
    if (event.key === chatStorageKey) {
        chatMessages = parseJson(event.newValue, {});
        if (activeCustomer) renderMessages(activeCustomer);
    }
    if (event.key === "feedback" && document.getElementById("feedbackList")) loadFeedback();
    if (event.key === ticketStorageKey && document.getElementById("reportAgentRows")) updateReports(false);
    if ((event.key === ticketStorageKey || event.key === agentStorageKey) && document.getElementById("agentPerformanceList")) updateAnalytics();
    refreshAllViews();
});

setInterval(function() {
    const latestTickets = parseJson(localStorage.getItem(ticketStorageKey), tickets);
    const latestCustomers = parseJson(localStorage.getItem(customerStorageKey), customers);
    const latestAgents = parseJson(localStorage.getItem(agentStorageKey), agents);
    const latestAuthUsers = parseJson(localStorage.getItem(authUsersStorageKey), authUsers);
    if (JSON.stringify(latestTickets) !== JSON.stringify(tickets) || JSON.stringify(latestCustomers) !== JSON.stringify(customers) || JSON.stringify(latestAgents) !== JSON.stringify(agents) || JSON.stringify(latestAuthUsers) !== JSON.stringify(authUsers)) {
        tickets = latestTickets;
        customers = latestCustomers;
        agents = latestAgents;
        authUsers = latestAuthUsers;
        authUsers = syncAuthUsersWithRecords();
        chatMessages = loadChatMessages();
        refreshAllViews();
        if (document.getElementById("analyticsTotalTickets")) updateAnalytics();
    }
}, 2000);
// ===============================
// ANALYTICS
// ===============================

function updateAnalytics() {

    // Get latest data
    let analyticsTickets =
        JSON.parse(localStorage.getItem("tickets")) || [];

    let analyticsCustomers =
        JSON.parse(localStorage.getItem("customers")) || [];

    let analyticsAgents =
        JSON.parse(localStorage.getItem("agents")) || [];


    // ---------------------------
    // BASIC COUNTS
    // ---------------------------

    let totalTickets = analyticsTickets.length;

    let openTickets = analyticsTickets.filter(function(ticket) {

        return ticket.status === "New" ||
               ticket.status === "In Progress";

    }).length;


    let resolvedTickets = analyticsTickets.filter(function(ticket) {

        return ticket.status === "Resolved" ||
               ticket.status === "Closed";

    }).length;


    let totalCustomers = analyticsCustomers.length;


    let totalElement =
        document.getElementById("analyticsTotalTickets");

    let openElement =
        document.getElementById("analyticsOpenTickets");

    let resolvedElement =
        document.getElementById("analyticsResolvedTickets");

    let customerElement =
        document.getElementById("analyticsCustomers");


    if (totalElement) {
        totalElement.textContent = totalTickets;
    }

    if (openElement) {
        openElement.textContent = openTickets;
    }

    if (resolvedElement) {
        resolvedElement.textContent = resolvedTickets;
    }

    if (customerElement) {
        customerElement.textContent = totalCustomers;
    }


    // ---------------------------
    // TICKET STATUS
    // ---------------------------

    let newTickets = analyticsTickets.filter(function(ticket) {
        return ticket.status === "New";
    }).length;


    let progressTickets = analyticsTickets.filter(function(ticket) {
        return ticket.status === "In Progress";
    }).length;


    let resolvedOnly = analyticsTickets.filter(function(ticket) {
        return ticket.status === "Resolved";
    }).length;


    let closedTickets = analyticsTickets.filter(function(ticket) {
        return ticket.status === "Closed";
    }).length;


    let newCount = document.getElementById("newCount");
    let progressCount = document.getElementById("progressCount");
    let resolvedCount = document.getElementById("resolvedCount");
    let closedCount = document.getElementById("closedCount");


    if (newCount) {
        newCount.textContent = newTickets;
    }

    if (progressCount) {
        progressCount.textContent = progressTickets;
    }

    if (resolvedCount) {
        resolvedCount.textContent = resolvedOnly;
    }

    if (closedCount) {
        closedCount.textContent = closedTickets;
    }


    // Percentage for bars

    if (totalTickets > 0) {

        document.getElementById("newBar").style.width =
            (newTickets / totalTickets * 100) + "%";

        document.getElementById("progressBar").style.width =
            (progressTickets / totalTickets * 100) + "%";

        document.getElementById("resolvedBar").style.width =
            (resolvedOnly / totalTickets * 100) + "%";

        document.getElementById("closedBar").style.width =
            (closedTickets / totalTickets * 100) + "%";

    } else {

        document.getElementById("newBar").style.width = "0%";
        document.getElementById("progressBar").style.width = "0%";
        document.getElementById("resolvedBar").style.width = "0%";
        document.getElementById("closedBar").style.width = "0%";
    }


    // ---------------------------
    // CATEGORY
    // ---------------------------

    let categoryStats = {};

    analyticsTickets.forEach(function(ticket) {

        let category = ticket.category || "Other";

        if (!categoryStats[category]) {
            categoryStats[category] = 0;
        }

        categoryStats[category]++;
    });


    let categoryBox =
        document.getElementById("categoryStats");


    if (categoryBox) {

        categoryBox.innerHTML = "";

        for (let category in categoryStats) {

            categoryBox.innerHTML += `
                <div class="category-item">
                    <span>${category}</span>
                    <strong>${categoryStats[category]}</strong>
                </div>
            `;
        }

        if (Object.keys(categoryStats).length === 0) {

            categoryBox.innerHTML =
                `<p style="color:#777;">No ticket data available.</p>`;
        }
    }


    // ---------------------------
    // PRIORITY
    // ---------------------------

    let priorityStats = {};

    analyticsTickets.forEach(function(ticket) {

        let priority = ticket.priority || "Medium";

        if (!priorityStats[priority]) {
            priorityStats[priority] = 0;
        }

        priorityStats[priority]++;
    });


    let priorityBox =
        document.getElementById("priorityStats");


    if (priorityBox) {

        priorityBox.innerHTML = "";

        for (let priority in priorityStats) {

            priorityBox.innerHTML += `
                <div class="priority-item">
                    <span>${priority}</span>
                    <strong>${priorityStats[priority]}</strong>
                </div>
            `;
        }

        if (Object.keys(priorityStats).length === 0) {

            priorityBox.innerHTML =
                `<p style="color:#777;">No ticket data available.</p>`;
        }
    }


    const agentPerformanceList = document.getElementById("agentPerformanceList");
    if (agentPerformanceList) {
        agentPerformanceList.innerHTML = analyticsAgents.length ? analyticsAgents.map(function(agent) {
            return `<div class="agent-performance-row"><div class="agent-info"><div class="agent-avatar">${escapeHtml(String(agent.name || "A").charAt(0).toUpperCase())}</div><div><strong>${escapeHtml(agent.name || "Agent")}</strong><small>${escapeHtml(agent.department || "Support")}</small></div></div><div class="agent-ticket-count"><strong>${getAgentTicketCount(agent, analyticsTickets)}</strong><span>Tickets</span></div></div>`;
        }).join("") : '<p class="analytics-empty-state">No agents available.</p>';
    }
}


// Run Analytics only when Analytics page exists

document.addEventListener("DOMContentLoaded", function() {

    if (document.getElementById("analyticsTotalTickets")) {

        updateAnalytics();

    }

});
function syncCustomerFeedbackToAdmin() {
    const storedFeedback = parseJson(localStorage.getItem("feedback"), []);
    const feedbackData = Array.isArray(storedFeedback) ? storedFeedback : [];
    let changed = false;

    Object.keys(localStorage).filter(function(key) {
        return key.indexOf("customerFeedback:") === 0;
    }).forEach(function(key) {
        const email = decodeURIComponent(key.slice("customerFeedback:".length)).toLowerCase();
        const customerItems = parseJson(localStorage.getItem(key), []);
        if (!Array.isArray(customerItems)) return;
        const customer = customers.find(function(item) { return String(item.email || "").toLowerCase() === email; });

        customerItems.forEach(function(item) {
            const identity = item.id || [email, item.ticketId || "", item.rating, item.time || item.date || "", item.message].join("|");
            const alreadyShared = feedbackData.some(function(feedback) {
                const sharedIdentity = feedback.id || [String(feedback.email || "").toLowerCase(), feedback.ticketId || "", feedback.rating, feedback.time || feedback.date || "", feedback.message].join("|");
                return sharedIdentity === identity || (
                    String(feedback.email || "").toLowerCase() === email &&
                    feedback.message === item.message &&
                    Number(feedback.rating) === Number(item.rating) &&
                    (feedback.ticketId || "") === (item.ticketId || "") &&
                    (feedback.time || feedback.date || "") === (item.time || item.date || "")
                );
            });
            if (alreadyShared) return;

            feedbackData.push({
                id: identity,
                name: item.name || (customer && customer.name) || "Customer",
                email: email,
                ticketId: item.ticketId || "",
                rating: Number(item.rating) || 0,
                message: item.message || "",
                time: item.time || "",
                date: item.date || item.time || "",
                source: "customer"
            });
            changed = true;
        });
    });

    if (changed) localStorage.setItem("feedback", JSON.stringify(feedbackData));
    return feedbackData;
}

function loadFeedback() {

    const feedbackList = document.getElementById("feedbackList");

    if (!feedbackList) {
        return;
    }

    let feedbackData = syncCustomerFeedbackToAdmin();

    const totalFeedback = feedbackData.length;

    let totalRating = 0;
    let positive = 0;
    let negative = 0;

    feedbackData.forEach(function(feedback) {

        totalRating += Number(feedback.rating);

        if (Number(feedback.rating) >= 4) {
            positive++;
        } else {
            negative++;
        }

    });

    let average = totalFeedback > 0
        ? (totalRating / totalFeedback).toFixed(1)
        : "0.0";

    document.getElementById("averageRating").textContent = average;
    document.getElementById("totalFeedback").textContent = totalFeedback;
    document.getElementById("positiveFeedback").textContent = positive;
    document.getElementById("negativeFeedback").textContent = negative;


    if (totalFeedback === 0) {

        feedbackList.innerHTML = `
            <div class="empty-feedback">
                <i class="fa-regular fa-comment-dots"></i>
                <h3>No feedback yet</h3>
                <p>Customer feedback will appear here.</p>
            </div>
        `;

        return;
    }


    feedbackList.innerHTML = "";

    feedbackData.forEach(function(feedback) {

        let stars = "";

        for (let i = 1; i <= 5; i++) {

            if (i <= feedback.rating) {
                stars += "★";
            } else {
                stars += "☆";
            }

        }

        feedbackList.innerHTML += `
            <div class="feedback-item">

                <div class="feedback-user">

                    <div>
                        <h4>${escapeHtml(feedback.name || "Customer")}</h4>
                        <small>${escapeHtml(feedback.email || "")}${feedback.date ? " · " + escapeHtml(feedback.date) : ""}</small>
                    </div>

                    <div class="feedback-rating">
                        ${stars}
                    </div>

                </div>

                <p class="feedback-message">${escapeHtml(feedback.message)}</p>
                ${feedback.ticketId ? `<small class="feedback-ticket-reference">Ticket ${escapeHtml(feedback.ticketId)}</small>` : ""}

            </div>
        `;

    });
}


function addFeedback(name, rating, message) {

    let feedbackData = JSON.parse(
        localStorage.getItem("feedback") || "[]"
    );

    feedbackData.push({
        name: name,
        rating: Number(rating),
        message: message,
        date: new Date().toLocaleDateString()
    });

    localStorage.setItem(
        "feedback",
        JSON.stringify(feedbackData)
    );

    loadFeedback();
}


document.addEventListener("DOMContentLoaded", function() {

    if (document.getElementById("feedbackList")) {
        loadFeedback();
    }

});
function openFeedbackForm() {

    const modal = document.getElementById("feedbackModal");

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeFeedbackForm() {

    const modal = document.getElementById("feedbackModal");

    if (modal) {
        modal.style.display = "none";
    }
}


function submitFeedback(event) {

    event.preventDefault();

    const name = document.getElementById("feedbackName").value;
    const rating = document.getElementById("feedbackRating").value;
    const message = document.getElementById("feedbackMessage").value;

    let feedbackData = JSON.parse(
        localStorage.getItem("feedback") || "[]"
    );

    feedbackData.push({
        name: name,
        rating: Number(rating),
        message: message,
        date: new Date().toLocaleDateString()
    });

    localStorage.setItem(
        "feedback",
        JSON.stringify(feedbackData)
    );

    alert("Feedback submitted successfully!");

    document.getElementById("feedbackName").value = "";
    document.getElementById("feedbackRating").value = "";
    document.getElementById("feedbackMessage").value = "";

    closeFeedbackForm();

    loadFeedback();
}
// ========================================
// REPORTS
// ========================================

function updateReports(showConfirmation) {

    let tickets = JSON.parse(localStorage.getItem("tickets") || "[]");
    let customers = JSON.parse(localStorage.getItem("customers") || "[]");
    let agents = JSON.parse(localStorage.getItem("agents") || "[]");

    // SUMMARY
    document.getElementById("reportTotalTickets").textContent = tickets.length;

    let resolved = tickets.filter(function(ticket) {
        return ticket.status === "Resolved" || ticket.status === "Closed";
    }).length;

    document.getElementById("reportResolvedTickets").textContent = resolved;
    document.getElementById("reportOpenTickets").textContent =
        tickets.length - resolved;

    document.getElementById("reportCustomers").textContent =
        customers.length;


    // STATUS
    let status = {
        "New": 0,
        "In Progress": 0,
        "Resolved": 0,
        "Closed": 0
    };

    tickets.forEach(function(ticket) {

        if (status[ticket.status] !== undefined) {
            status[ticket.status]++;
        }

    });

    let statusRows = document.getElementById("reportStatusRows");

    if (statusRows) {

        statusRows.innerHTML = "";

        for (let name in status) {

            statusRows.innerHTML += `
                <tr>
                    <td>${name}</td>
                    <td>${status[name]}</td>
                </tr>
            `;

        }
    }


    // CATEGORY
    let categories = {};

    tickets.forEach(function(ticket) {

        let category = ticket.category || "Other";

        if (!categories[category]) {
            categories[category] = 0;
        }

        categories[category]++;

    });

    let categoryRows = document.getElementById("reportCategoryRows");

    if (categoryRows) {

        categoryRows.innerHTML = "";

        for (let category in categories) {

            categoryRows.innerHTML += `
                <tr>
                    <td>${category}</td>
                    <td>${categories[category]}</td>
                </tr>
            `;

        }

    }


    // PRIORITY
    let priorities = {};

    tickets.forEach(function(ticket) {

        let priority = ticket.priority || "Normal";

        if (!priorities[priority]) {
            priorities[priority] = 0;
        }

        priorities[priority]++;

    });

    let priorityRows = document.getElementById("reportPriorityRows");

    if (priorityRows) {

        priorityRows.innerHTML = "";

        for (let priority in priorities) {

            priorityRows.innerHTML += `
                <tr>
                    <td>${priority}</td>
                    <td>${priorities[priority]}</td>
                </tr>
            `;

        }

    }


    // AGENTS
    let agentRows = document.getElementById("reportAgentRows");

    if (agentRows) {

        agentRows.innerHTML = "";

        agents.forEach(function(agent) {
            agentRows.innerHTML += `
                <tr>
                    <td>${escapeHtml(agent.name)}</td>
                    <td>${getAgentTicketCount(agent, tickets)}</td>
                </tr>
            `;

        });

    }

    if (showConfirmation !== false) alert("✅ Report generated successfully!");
}


// PRINT REPORT

function printReport() {
    window.print();
}


// LOAD REPORT

document.addEventListener("DOMContentLoaded", function() {

    if (document.getElementById("reportTotalTickets")) {
        updateReports(false);
    }

});
