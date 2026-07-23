(function () {
    'use strict';

    const API_BASE = '/api/auth';

    // DOM Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const loginPanel = document.getElementById('login-panel');
    const registerPanel = document.getElementById('register-panel');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');
    const passwordInput = document.getElementById('reg-password');
    const passwordStrength = document.getElementById('password-strength');
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    const roleSelect = document.getElementById('reg-role');
    const familyCodeHint = document.getElementById('family-code-hint');

    // Check if already logged in
    checkExistingSession();

    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            if (targetTab === 'login') {
                loginPanel.hidden = false;
                loginPanel.classList.add('active');
                registerPanel.hidden = true;
                registerPanel.classList.remove('active');
            } else {
                registerPanel.hidden = false;
                registerPanel.classList.add('active');
                loginPanel.hidden = true;
                loginPanel.classList.remove('active');
            }
        });
    });

    // Toggle password visibility
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🙈';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        });
    });

    // Password strength indicator
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const strength = calculatePasswordStrength(passwordInput.value);
            updateStrengthIndicator(strength);
        });
    }

    // Role selection hint update
    if (roleSelect) {
        roleSelect.addEventListener('change', () => {
            const familyCodeInput = document.getElementById('reg-family-code');
            if (roleSelect.value === 'child') {
                familyCodeHint.textContent = 'Required: Enter the family code your parent shared with you.';
                familyCodeInput.required = true;
            } else {
                familyCodeHint.textContent = 'Optional: Leave blank to auto-generate a code. Share it with your child.';
                familyCodeInput.required = false;
            }
        });
    }

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            loginError.textContent = 'Please fill in all fields.';
            return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Logging in...';

        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Store auth data securely
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('userData', JSON.stringify(data.user));

            // Redirect based on role
            redirectToDashboard(data.user.role);
        } catch (err) {
            loginError.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });

    // Register form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';
        registerSuccess.textContent = '';

        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const role = document.getElementById('reg-role').value;
        const familyCode = document.getElementById('reg-family-code').value.trim();

        // Client-side validation
        if (!username || !password || !role) {
            registerError.textContent = 'Please fill in all required fields.';
            return;
        }

        if (username.length < 3) {
            registerError.textContent = 'Username must be at least 3 characters.';
            return;
        }

        if (password.length < 8) {
            registerError.textContent = 'Password must be at least 8 characters.';
            return;
        }

        if (role === 'child' && !familyCode) {
            registerError.textContent = 'Children must enter a family code from their parent.';
            return;
        }

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Registering...';

        try {
            const body = { username, password, role };
            if (familyCode) body.familyCode = familyCode;

            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.errors?.[0]?.msg || 'Registration failed');
            }

            // Store auth data
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('userData', JSON.stringify(data.user));

            if (role === 'parent') {
                registerSuccess.textContent =
                    `Registration successful! Your family code is: ${data.user.familyCode}. Redirecting...`;
            } else {
                registerSuccess.textContent = 'Registration successful! Redirecting...';
            }

            setTimeout(() => redirectToDashboard(data.user.role), 2000);
        } catch (err) {
            registerError.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    });

    function calculatePasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        return Math.min(score, 5);
    }

    function updateStrengthIndicator(strength) {
        const colors = ['#e74c3c', '#e67e22', '#f39c12', '#27ae60', '#2ecc71'];
        const widths = ['20%', '40%', '60%', '80%', '100%'];
        const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

        passwordStrength.innerHTML = '';

        if (strength > 0) {
            const bar = document.createElement('div');
            bar.className = 'strength-bar';
            bar.style.width = widths[strength - 1];
            bar.style.backgroundColor = colors[strength - 1];
            bar.title = labels[strength - 1];
            passwordStrength.appendChild(bar);
        }
    }

    function redirectToDashboard(role) {
        if (role === 'parent') {
            window.location.href = '/parent';
        } else {
            window.location.href = '/child';
        }
    }

    async function checkExistingSession() {
        const token = sessionStorage.getItem('authToken');
        const userData = sessionStorage.getItem('userData');

        if (!token || !userData) return;

        try {
            const response = await fetch(`${API_BASE}/verify`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                const user = JSON.parse(userData);
                redirectToDashboard(user.role);
            } else {
                // Token expired
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('userData');
            }
        } catch (err) {
            // Network error, stay on login page
            console.error('Session check failed:', err);
        }
    }
})();