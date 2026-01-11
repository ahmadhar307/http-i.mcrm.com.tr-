/**
 * main.js - Core Logic for MikroTik Hotspot Login Page
 *
 * Handles user login, logout, status updates, and section visibility transitions.
 * Relies on helper scripts for configuration, cookies, blocking, etc.
 */

(function() {
    'use strict';

    // --- State Variables ---
    let isAnimating = false; // Prevents concurrent animations/submissions
    let isLoggedIn = false; // Tracks user login status
    let statusPollInterval = null; // Holds the interval ID for status polling
    let hotspotApiData = null; // Stores initial data from /login endpoint if needed

    // --- Configuration ---
    const TRANSITION_DURATION = 500; // Base duration for slide/fade effects (ms)
    const STATUS_POLL_INTERVAL = 1500; // How often to check status when logged in (ms) Adjust if needed (original was 1000)

    // API Endpoints (Assuming standard MikroTik var=callBack method)
    const API_ENDPOINT = {
        LOGIN_STATUS: '/login?var=callBack', // Initial check & login attempt
        DO_LOGIN: '/login?var=callBack',      // Actual login action (same endpoint, different params)
        STATUS: '/status?var=callBack',       // Get current session status
        LOGOUT: '/logout?var=callBack',       // Standard logout
        LOGOUT_ERASE: '/logout?erase-cookie=yes&var=callBack' // Logout and clear cookie
    };

    // --- DOM Element References ---
    const loginSection = document.getElementById('login');
    const statusSectionContainer = document.getElementById('user-status-section');
    const statusCard = document.getElementById('status');
    const loginForm = document.forms.login; // Access form by name
    const usernameInput = loginForm?.elements.username; // Use form elements collection
    const passwordInput = loginForm?.elements.password;
    const rememberCheckbox = loginForm?.elements.remember;
    const loginSubmitButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button'); // Specific logout button in status view
    const viewPlansButton = document.querySelector('button[parent-id="price"]'); // More specific selector
    const sellPointsButton = document.querySelector('button[parent-id="sell-point"]'); // More specific selector
    const limitedBundlesSection = document.getElementById('limited-bundles-section'); // Target for scroll


    // Optional Feature Sections & Buttons
    const optionalSections = {
        price: document.getElementById('price'),
        sellPoint: document.getElementById('sell-point'),
        loan: document.getElementById('loan')
    };
    const optionalSectionButtons = document.querySelectorAll('button[parent-id]'); // Buttons that show optional sections
    const backButtons = document.querySelectorAll('.back-button'); // Buttons within sections to go back

    // Error Display Elements
    const errorContainer = document.querySelector('.error-container');
    const jsErrorDisplay = document.getElementById('js-error-display');
    const jsErrorParagraph = document.getElementById('error');
    const mikrotikErrorDiv = errorContainer?.querySelector('.error:not(#js-error-display)'); // MikroTik's static error
    const mikrotikInfoDiv = errorContainer?.querySelector('.info'); // MikroTik's static info

    // Status Fields (Map IDs to properties for easier updates)
    const statusFields = {
        username: document.getElementById('username'),
        ip: document.getElementById('ip'),
        uptime: document.getElementById('uptime'),
        session_time_left: document.getElementById('session_time_left'),
        bytes_out: document.getElementById('bytes_out'),
        bytes_in: document.getElementById('bytes_in'),
        remain_bytes_total: document.getElementById('remain_bytes_total'),
        // Parent items for conditional visibility
        session_time_left_item: document.getElementById('status-time-left-item'),
        remain_bytes_total_item: document.getElementById('status-remain-item'),
        status_title: document.getElementById('status-title'),
        status_mac: document.getElementById('status-mac') // If needed
    };


    // =========================================================================
    // === UI Management Functions (Show/Hide Sections) ===
    // =========================================================================

    /** Hides all major content sections. */
    function hideAllSections() {
        loginSection.style.display = 'none';
        loginSection.classList.add('inactive'); // Mark as inactive

        statusSectionContainer.style.display = 'none';
        statusCard.classList.remove('active'); // Ensure status card animation reset

        Object.values(optionalSections).forEach(section => {
            if (section) section.style.display = 'none';
        });
    }

    /** Shows the main login section and hides others. */
    function showLoginSection() {
        hideAllSections();
        loginSection.style.display = 'block';
        // Slight delay to allow display:block before removing inactive for potential transition
        setTimeout(() => {
            loginSection.classList.remove('inactive');
            // Focus username field if available and section is visible
            if (usernameInput && window.getComputedStyle(loginSection).display === 'block') {
                 // Don't focus if blocker is active (handled by hotBlocker.js)
                const blocker = document.getElementById('block');
                if(!blocker || window.getComputedStyle(blocker).display === 'none') {
                    usernameInput.focus();
                }
            }
        }, 50); // Small delay
    }

    /** Shows the user status section and hides others. */
    function showStatusSection(triggerButton = null) {
        hideAllSections();

        if (triggerButton) {
            triggerButton.classList.add('processing'); // Show loading on button
        }

        // 1. Make the container visible
        statusSectionContainer.style.display = 'block';

        // 2. Force reflow before adding 'active' class for transition
        getComputedStyle(statusCard).opacity; // Reading a computed style forces reflow

        // 3. Add 'active' class to the card to trigger CSS animation/transition
        statusCard.classList.add('active');

        // 4. Clean up after transition
        setTimeout(() => {
            if (triggerButton) {
                triggerButton.classList.remove('processing');
                // Add success state briefly if it was the login button
                if (triggerButton === loginSubmitButton) {
                    triggerButton.classList.add('success');
                    setTimeout(() => triggerButton.classList.remove('success'), TRANSITION_DURATION * 1.5);
                }
            }
            isAnimating = false;
        }, TRANSITION_DURATION);
    }

    /** Shows a specific optional section (price, sell-point, loan) */
    function showOptionalSection(sectionId, triggerButton = null) {
        const sectionToShow = optionalSections[sectionId];
        if (!sectionToShow) {
            console.error(`Optional section with ID "${sectionId}" not found.`);
            isAnimating = false;
            return;
        }

        hideAllSections(); // Hide login/status

        if (triggerButton) {
            triggerButton.classList.add('processing');
        }

        sectionToShow.style.display = 'block';
        // Optional: Add an 'active' class for transitions if desired in CSS
        // getComputedStyle(sectionToShow).opacity;
        // sectionToShow.classList.add('active');

        // Reset animation state after a short delay
        setTimeout(() => {
             if (triggerButton) {
                triggerButton.classList.remove('processing');
            }
            isAnimating = false;
        }, TRANSITION_DURATION / 2); // Shorter delay as transitions might be simpler here
    }

    // =========================================================================
    // === Error Handling and Display ===
    // =========================================================================

    /** Clears any dynamic JS errors and hides static MikroTik messages. */
    function clearErrors() {
        if (jsErrorParagraph) jsErrorParagraph.innerText = '';
        if (jsErrorDisplay) jsErrorDisplay.style.display = 'none'; // Hide JS error container

        // Also hide static MikroTik errors/info if they were displayed
        if (mikrotikErrorDiv) mikrotikErrorDiv.style.display = 'none';
        if (mikrotikInfoDiv) mikrotikInfoDiv.style.display = 'none';

        // Trigger observer in inline script if needed (or rely on its automatic detection)
        errorContainer?.dispatchEvent(new Event('change'));
        hideErrorPopup(); // Hide the animated popup container if used
    }

    /** Displays an error message in the designated JS error area. */
    function displayJsError(message) {
       

        if (jsErrorParagraph && jsErrorDisplay && errorContainer) {
            jsErrorParagraph.innerText = message;
            jsErrorDisplay.style.display = 'block'; // Make the container visible
             // Trigger observer in inline script
            errorContainer.dispatchEvent(new Event('change'));
            showErrorPopup(); // Show the animated popup container
        } else {
            console.error("Error display elements not found. Message:", message);
            alert(message); // Fallback alert
        }
    }

    /** Shows the error popup container with animation (from original code). */
    function showErrorPopup() {
        if (!errorContainer) return;
        errorContainer.classList.add('active');
        // Using requestAnimationFrame for potentially smoother start
        requestAnimationFrame(() => {
            errorContainer.classList.add('zoom');
        });
    }

    /** Hides the error popup container (from original code). */
    function hideErrorPopup() {
        if (!errorContainer || !errorContainer.classList.contains('active')) return; // Don't hide if already hidden
    
        errorContainer.classList.remove('zoom');
        // Use timeout matching potential CSS transition duration for removing 'active'
        // Ensure this timeout is long enough for your CSS transition
        setTimeout(() => {
             errorContainer.classList.remove('active');
             // Also ensure JS container is hidden after animation
             if(jsErrorDisplay) jsErrorDisplay.style.display = 'none';
             if(errorContainer) errorContainer.dispatchEvent(new Event('change')); // Update margin observer
        }, 300); // Adjust timeout based on actual CSS transition duration
    }

    // =========================================================================
    // === Data Formatting Helpers (Copied from Original) ===
    // =========================================================================
    function toArabicTime(timeStr) {
        if (!timeStr) return "";
        let remaining = timeStr;
        let days = "", hours = "", minutes = "", seconds = "";
        if (remaining.includes("d")) [days, remaining] = remaining.split("d"); else days = "";
        if (remaining.includes("h")) [hours, remaining] = remaining.split("h"); else hours = "";
        if (remaining.includes("m")) [minutes, remaining] = remaining.split("m"); else minutes = "";
        if (remaining.includes("s")) [seconds] = remaining.split("s"); else seconds = "";

        let result = "";
        if (days.trim() !== "") result += `${days} يوم `;
        if (hours.trim() !== "") result += `${hours} ساعة `;
        if (minutes.trim() !== "") result += `${minutes} دقيقة `;
        if (seconds.trim() !== "") result += `${seconds} ثانية`;
        return result.trim() || timeStr; // Return original if parsing fails
    }

    function toArabicBytes(bytes) {
        const numBytes = Number(bytes);
        if (isNaN(numBytes)) return bytes; // Return original if not a number
        if (numBytes < 1024) return `${numBytes} بايت`;
        if (numBytes < 1048576) return `${Math.round(numBytes / 1024)} كيلوبايت`;
        if (numBytes < 1073741824) return `${Math.round(numBytes / 1048576)} ميغابايت`;
        return `${(numBytes / 1073741824).toFixed(2)} جيجابايت`;
    }

    function hideHalfCard(username) {
        if (!username || typeof username !== 'string') return "اشتراك"; // Default text
        username = username.toLowerCase();
        if (username.includes('t-')) return "تجربة مجانية"; // Free trial indicator
        // Keep subscriptions generic if they don't follow T- pattern
        // if (username.includes(':')) return "اشتراك";

        // Obfuscate other usernames (like tickets)
        const length = username.length;
        if (length < 2) return username; // Too short to hide
        const half = Math.ceil(length / 2);
        const firstPart = username.substring(0, length - half);
        return `${firstPart}${'*'.repeat(half)}`;
    }

    function toArabicError(errorMsg) {
        if (!errorMsg || typeof errorMsg !== 'string') return "حدث خطأ غير معروف.";
        const lowerError = errorMsg.toLowerCase();
        // Keep error mapping logic similar to original
        const errorMap = {
            "user not found": "هذا الحساب غير موجود أو قد انتهت صلاحيته، حاول مرة اخرى.",
            "simultaneous session limit reached": "المعذرة، هذا الكرت مستخدم حالياً في جهاز آخر.",
            "no more sessions are allowed": "المعذرة، هذا الكرت مستخدم حالياً في جهاز آخر.",
            "invalid password": "تأكد من كتابة كلمة المرور بشكل صحيح.",
            "uptime limit reached": "عذراً لقد انتهى الوقت المتاح لك.",
            "no more online time": "عذراً لقد انتهى الوقت المتاح لك.",
            "uptime limit": "عذراً لقد انتهى الوقت المتاح لك.",
            "traffic limit reached": "لقد انتهى رصيد هذا الحساب.",
            "transfer limit reached": "لقد انتهى رصيد هذا الحساب.",
            "invalid username or password": "اسم المستخدم أو كلمة المرور غير صحيحة، الرجاء المحاولة مرة اخرى.",
            "not found": "اسم المستخدم أو كلمة المرور غير صحيحة، الرجاء المحاولة مرة اخرى.",
            "no valid profile found": "لقد انتهت صلاحية هذا الكرت.",
            "invalid calling-station-id": "هذا الحساب مقترن بجهاز آخر!",
            "server&is¬&responding": "هذا الحساب غير موجود, يرجى التأكد والمحاولة مرة اخرى.", // Special case check
            "web&browser&did¬&send": "يرجى محاولة ادخال الكرت مرة اخرى.", // Special case check
            "allowed to log in from this mac": "لا يحق لك استخدام هذا الكرت, الكرت محجوز لمستخدم اخر!"
            // Add more specific mappings if needed
        };

        // Handle special '&' separated checks first
        if (lowerError.includes('server') && lowerError.includes('is') && lowerError.includes('responding')) {
            return errorMap["server&is¬&responding"];
        }
        if (lowerError.includes('web') && lowerError.includes('browser') && lowerError.includes('did') && lowerError.includes('send')) {
            return errorMap["web&browser&did¬&send"];
        }

        // Simple includes check for others
        for (const key in errorMap) {
            // Skip special keys already handled
            if (key.includes('&')) continue;

            if (key.includes('|')) { // Handle OR conditions
                if (key.split('|').some(part => lowerError.includes(part.trim()))) {
                    return errorMap[key];
                }
            } else if (lowerError.includes(key)) {
                return errorMap[key];
            }
        }

        // Fallback generic error
        return `حصل خطأ: ${errorMsg}`;
    }

    // =========================================================================
    // === AJAX Communication ===
    // =========================================================================

    /** Performs a GET request and handles the JSON response. */
    function getRequest(url, callbackSuccess, callbackError) {
        // Prevent requests in file:// protocol (common issue during development)
        if (window.location.protocol === "file:") {
            console.warn("AJAX requests blocked in file:// protocol. Assuming logged out.");
            handleLoggedOut(); // Assume not logged in
            showLoginSection(); // Show login page
            if (typeof HotCookie !== 'undefined') HotCookie.login(); // Attempt cookie login if available
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.timeout = 15000; // Set a timeout (e.g., 15 seconds)

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) { // Request finished
                 isAnimating = false; // Allow interactions again regardless of outcome (unless handled specifically)
                 loginSubmitButton?.classList.remove('processing'); // Ensure button state reset

                if (xhr.status === 200) { // Success
                    try {
                        const responseData = JSON.parse(xhr.responseText);
                        // Check if the response contains a known action
                        if (responseData && responseData.action && typeof apiActionHandlers[responseData.action] === 'function') {
                            apiActionHandlers[responseData.action](responseData); // Call the specific handler
                            if (callbackSuccess) callbackSuccess(responseData);
                        } else {
                            console.warn("Received response without a valid action:", responseData);
                            // Treat as error or handle based on context
                             if (callbackError) callbackError("Invalid response from server");
                             // If it was a status check that failed, assume logout
                             if (url.includes('/status')) {
                                 console.warn("Status poll returned invalid data, assuming logout.");
                                 handleLoggedOut();
                                 showLoginSection();
                             }
                        }
                    } catch (e) {
                        console.error("Failed to parse JSON response:", e, "\nResponse Text:", xhr.responseText);
                         // If status check fails parsing, assume logout
                         if (url.includes('/status')) {
                             console.warn("Status poll failed parsing, assuming logout.");
                             handleLoggedOut();
                             showLoginSection();
                         } else if (callbackError) {
                            callbackError("Error reading server response.");
                         } else {
                            displayJsError("Error reading server response.");
                         }
                    }
                } else { // Error
                    console.error(`Request to ${url} failed with status ${xhr.status}: ${xhr.statusText}`);
                     const errorMsg = `Server error (${xhr.status}). Please try again later.`;
                     if (callbackError) {
                        callbackError(errorMsg);
                     } else {
                        // If a status poll fails, assume logged out
                        if (url.includes('/status')) {
                           console.warn("Status poll failed with server error, assuming logout.");
                           handleLoggedOut();
                           showLoginSection();
                        } else {
                           // Show error for other failed requests (like login)
                           displayJsError(errorMsg);
                        }
                     }
                }
            }
        };

        xhr.onerror = function() {
            console.error(`Network error during request to ${url}`);
            isAnimating = false; // Reset animation state
            loginSubmitButton?.classList.remove('processing');
             const errorMsg = "Network error. Please check your connection.";
             if (callbackError) {
                callbackError(errorMsg);
             } else {
                 // If status poll fails network-wise, maybe just skip and retry later?
                 if (url.includes('/status')) {
                    console.warn("Status poll network error. Will retry.");
                 } else {
                    displayJsError(errorMsg);
                 }
             }
        };

        xhr.ontimeout = function() {
            console.error(`Request to ${url} timed out.`);
            isAnimating = false; // Reset animation state
            loginSubmitButton?.classList.remove('processing');
            const errorMsg = "The server is not responding. Please try again later.";
            if (callbackError) {
                callbackError(errorMsg);
            } else {
                 // If status poll times out, maybe assume logged out?
                 if (url.includes('/status')) {
                     console.warn("Status poll timed out, assuming logout.");
                     handleLoggedOut();
                     showLoginSection();
                 } else {
                    displayJsError(errorMsg);
                 }
            }
        };

        xhr.send();
    }

    // =========================================================================
    // === API Action Handlers ===
    // =========================================================================

    /** Handles the response from the initial /login request or cookie check. */
    function handleLoginStart(data) {
        hotspotApiData = data; // Store initial data if needed elsewhere
        isLoggedIn = data.logged_in === true;

        if (isLoggedIn) {
            console.log("User already logged in.");
            handleLoggedIn(data); // Treat as successful login
        } else {
            console.log("User not logged in. Showing login page.");
            handleLoggedOut(); // Ensure logged out state
            showLoginSection();
            // Attempt automatic login using cookies if HotCookie script is present
            if (typeof HotCookie !== 'undefined' && HotCookie.login) {
                console.log("Attempting cookie login...");
                HotCookie.login(); // This might fill the username field
            }
             // Focus username field after potential cookie fill
             setTimeout(() => {
                 if (usernameInput && window.getComputedStyle(loginSection).display === 'block') {
                    // Don't focus if blocker is active
                   const blocker = document.getElementById('block');
                   if(!blocker || window.getComputedStyle(blocker).display === 'none') {
                       usernameInput.focus();
                   }
                 }
             }, 100); // Delay slightly for cookie script
        }
    }

    /** Handles login errors from the API. */
    function handleLoginError(data) {
        console.error("Login failed:", data.error);
        isLoggedIn = false;
        isAnimating = false; // Ensure animation stops
        loginSubmitButton?.classList.remove('processing', 'success');
        // Don't reset form here - user might want to correct a typo
    
        // Skip specific error that indicates a temporary issue
        if (data.error && !data.error.toLowerCase().includes("already authorizing, retry later")) {
            const errorMessage = toArabicError(data.error);
            displayJsError(errorMessage); // This will now keep the error visible
    
            // --- Blocker Integration ---
            if (typeof hotspotConfig !== 'undefined' && hotspotConfig["enable-hot-blocker"] === 1) {
                 // ... (blocker logic as before) ...
                 if (typeof incrementCounter === 'function' && typeof checkFailsCount === 'function') {
                    const failCount = incrementCounter(data);
                    checkFailsCount(data, failCount);
                } else {
                    console.warn("hotBlocker functions not found.");
                }
            }
             // --- Cookie Clearing ---
             if (typeof clearCookies === 'function') {
                 clearCookies();
             } else {
                 console.warn("clearCookies function not found.");
             }
             // Focus the password field if username likely okay, otherwise username
             if (errorMessage.includes("كلمة المرور") && passwordInput) {
                 passwordInput.focus();
                 passwordInput.select();
             } else if (usernameInput) {
                 usernameInput.focus();
                 usernameInput.select();
             }
    
        } else if (data.error) {
            console.log("Temporary authorization issue, user should retry.");
            displayJsError("محاولة تسجيل الدخول متعارضة. يرجى الانتظار لحظة والمحاولة مرة أخرى."); // Keep visible
            if (usernameInput) usernameInput.focus();
        }
    
        // Do NOT automatically showLoginSection here if an error occurs, stay on the form.
    }

    /** Handles successful login response. */
    function handleLoggedIn(data) {
        console.log("Login successful for:", data.username);
        isLoggedIn = true;
        clearErrors(); // Clear the error text content
        hideErrorPopup(); // Explicitly hide the error popup container on success
        loginForm?.reset(); // Clear form after successful login
    
        // --- Remember Me / Cookie Handling ---
        // ... (cookie logic as before) ...
         if (rememberCheckbox?.checked && typeof remember === 'function') {
            remember();
        }
    
        // --- Blocker Integration ---
        if (typeof resetCounter === 'function') {
            resetCounter();
        }
    
        // Update status display immediately
        handleStatusQuery(data);
    
        // Transition to the status page
        showStatusSection(loginSubmitButton);
    
        // Start polling for status updates
        startStatusPolling();
    }

    /** Handles logout confirmation from the API. */
    function handleLoggedOut(data) {
        console.log("User logged out.");
        isLoggedIn = false;
        stopStatusPolling();
        clearErrors(); // Clear the error text content
        hideErrorPopup(); // Explicitly hide the error popup container on logout
        statusCard?.classList.remove('active');
    
        // Always return to the login page after logout
        showLoginSection();
    
        // Optional: Clear status fields visually
        // ... (status field clearing logic as before) ...
            Object.values(statusFields).forEach(field => {
                 if (field && field.tagName !== 'DIV' && field.tagName !== 'SPAN' && field.id !== 'status-title') {
                     field.innerText = 'N/A';
                 } else if (field && (field.id === 'status-time-left-item' || field.id === 'status-remain-item')) {
                     field.style.display = 'none';
                 }
            });
            if(statusFields.status_title) {
                const defaultTitleEn = "Connection Status";
                const defaultTitleAr = "حالة الاتصال";
                 statusFields.status_title.innerHTML = `<span class="en">${defaultTitleEn}</span><span class="ar">${defaultTitleAr}</span>`;
            }
    }    

    /** Handles periodic status updates from the API. */
    function handleStatusQuery(data) {
        if (!isLoggedIn && data.logged_in) {
            // If status check finds user is logged in unexpectedly (e.g., browser refresh)
            console.log("Re-established logged in state from status poll.");
            isLoggedIn = true;
            handleLoggedIn(data); // Re-run login success logic
            return;
        }

        if (isLoggedIn && !data.logged_in) {
             // If status check finds user is no longer logged in (e.g., session expired)
             console.log("User logged out detected by status poll.");
             handleLoggedOut(); // Run logout logic
             showLoginSection();
             return;
        }

        // Only update fields if still considered logged in
        if (isLoggedIn) {
             console.log("Status update received:", data); // Log status data for debugging
             for (const key in statusFields) {
                 const element = statusFields[key];
                 if (element && data.hasOwnProperty(key)) {
                     let value = data[key];

                     // Handle conditional visibility for time/data remaining
                      if (key === 'session_time_left' || key === 'remain_bytes_total') {
                          const itemElement = statusFields[`${key}_item`];
                          if (itemElement) {
                              // Show item only if value is present and not empty/zero (adjust logic if '0' is valid)
                              itemElement.style.display = (value && value !== '0' && value !== '0s') ? 'flex' : 'none';
                          }
                      }

                     // Apply specific formatting
                     if (value === null || value === undefined || value === '') {
                         element.innerText = 'N/A'; // Or keep previous value?
                         // If a field becomes empty, potentially hide its parent item? (e.g., time left)
                         if (key === 'session_time_left' || key === 'remain_bytes_total') {
                             const itemElement = statusFields[`${key}_item`];
                             if (itemElement) itemElement.style.display = 'none';
                         }
                     } else if (key === 'username') {
                         element.innerText = hideHalfCard(String(value));
                     } else if (key.includes('bytes')) {
                         element.innerText = toArabicBytes(value);
                     } else if (key.includes('time') || key === 'uptime') {
                         element.innerText = toArabicTime(String(value));
                     } else {
                         element.innerText = String(value); // Default: display as string
                     }
                 }
             }
              // Special handling for status title based on username/MAC (from original)
             try {
                 if (data.username && data.mac) {
                     const macFormatted = data.mac.split('%3A').join(':'); // Decode MAC if needed
                     let titleText = null;
                     if (data.username.includes(macFormatted)) {
                          titleText = "كرت مجاني من خدمة اجمع واربح!";
                     } else if (data.username.toLowerCase().includes('t-')) {
                          titleText = "أنت الان تستخدم الانترنت المجاني";
                     }

                     if (titleText && statusFields.status_title) {
                         // Keep dual language structure if possible
                         statusFields.status_title.innerHTML = `<span class="en">${titleText}</span><span class="ar">${titleText}</span>`;
                     }
                 }
             } catch (e) {
                 console.warn("Error updating status title:", e);
             }
         }
    }

    // Map action strings from API response to handler functions
    const apiActionHandlers = {
        onLoginStart: handleLoginStart,
        onLoginError: handleLoginError,
        onLoggedIn: handleLoggedIn,
        onLoggedOut: handleLoggedOut,
        onStatusQuery: handleStatusQuery
        // Add other actions here if the API uses them
    };

    // =========================================================================
    // === Login/Logout Actions ===
    // =========================================================================

    /** Initiates the user login process. */
    function doUserLogin() {
        if (!usernameInput || !passwordInput) {
            console.error("Login form inputs not found.");
            displayJsError("Internal page error. Cannot log in.");
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value; // No trim on password

        // Basic client-side validation
        if (username.length === 0) {
             displayJsError("يرجى إدخال اسم المستخدم أو رقم التذكرة.");
             isAnimating = false; // Allow retry
             loginSubmitButton?.classList.remove('processing');
             usernameInput.focus();
             return;
        }
        // Password validation (optional - perhaps just check if empty if required)
        // if (password.length === 0) {
        //    displayJsError("يرجى إدخال كلمة المرور.");
        //    isAnimating = false;
        //    loginSubmitButton?.classList.remove('processing');
        //    passwordInput.focus();
        //    return;
        // }


        clearErrors(); // Clear previous errors before attempting login
        loginSubmitButton?.classList.add('processing'); // Show loading state
        isAnimating = true; // Prevent other actions during login attempt

        // Construct login URL
        const loginUrl = `${API_ENDPOINT.DO_LOGIN}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

        // Make the request
        getRequest(loginUrl,
            null, // Success is handled by the action handlers (onLoggedIn)
            (errorMsg) => { // Error callback specific to login failure
                isAnimating = false; // Ensure animation flag is reset on specific error callback
                loginSubmitButton?.classList.remove('processing');
                // Error display is usually handled by onLoginError action, but provide fallback
                if (!document.getElementById('error').innerText) {
                     displayJsError(errorMsg || "Login failed. Please try again.");
                }
                showLoginSection(); // Ensure login section is shown on error
            }
        );
    }

    /** Initiates user logout. */
    function doUserLogout(eraseCookie = false) {
        console.log(`Initiating logout (erase cookie: ${eraseCookie})`);
        isAnimating = true; // Prevent other actions during logout

        const logoutUrl = eraseCookie ? API_ENDPOINT.LOGOUT_ERASE : API_ENDPOINT.LOGOUT;

        getRequest(logoutUrl,
           null, // Success handled by onLoggedOut action
           (errorMsg) => { // Error callback for logout failure
               isAnimating = false;
                // Still treat as logged out visually even if server call fails?
                console.error("Logout request failed:", errorMsg);
                displayJsError("Logout failed. Please check connection or try again.");
                // Optionally force UI to logged out state anyway
                handleLoggedOut();
                showLoginSection();
           }
        );

        // Immediately update UI optimistically? Or wait for onLoggedOut?
        // Waiting is safer. Add visual feedback to logout button if desired.
        logoutButton?.classList.add('processing'); // Example feedback
         setTimeout(() => {
             logoutButton?.classList.remove('processing');
             isAnimating = false; // Fallback reset
         }, TRANSITION_DURATION * 2); // Timeout just in case response fails
    }

    // =========================================================================
    // === Status Polling ===
    // =========================================================================

    /** Starts polling the /status endpoint periodically. */
    function startStatusPolling() {
        if (statusPollInterval !== null) {
            console.log("Status polling already active.");
            return; // Already polling
        }
        if (!isLoggedIn) {
            console.log("Not starting status poll: User not logged in.");
            return;
        }

        console.log("Starting status polling...");
        // Initial immediate check
        getRequest(API_ENDPOINT.STATUS);

        // Set up interval
        statusPollInterval = setInterval(() => {
            if (isLoggedIn) {
                getRequest(API_ENDPOINT.STATUS);
            } else {
                // Should not happen if interval is cleared correctly, but as safeguard:
                console.warn("Polling attempted while logged out. Stopping.");
                stopStatusPolling();
            }
        }, STATUS_POLL_INTERVAL);
    }

    /** Stops the periodic status polling. */
    function stopStatusPolling() {
        if (statusPollInterval !== null) {
            console.log("Stopping status polling.");
            clearInterval(statusPollInterval);
            statusPollInterval = null;
        }
    }

    // =========================================================================
    // === Event Listeners Setup ===
    // =========================================================================

    function setupEventListeners() {
        // --- Login Form Submission ---
        if (loginForm) {
            loginForm.addEventListener('submit', (event) => {
                event.preventDefault();
                if (!isAnimating) {
                    doUserLogin();
                } else {
                    console.log("Animation/request in progress, preventing login submission.");
                }
            });
        } else {
            console.error("Login form not found!");
        }
    
        // --- Logout Button in Status View ---
        if (logoutButton) {
            logoutButton.addEventListener('click', (event) => {
                if (!isAnimating) {
                    const erase = event.target.closest('button').hasAttribute('erase-cookie'); // Ensure check on button itself
                    event.target.closest('button').classList.add('clicked');
                    setTimeout(() => {
                       doUserLogout(erase);
                    }, 100);
                } else {
                    console.log("Animation/request in progress, preventing logout.");
                }
            });
        }
    
        // --- *** NEW: Specific Button Handlers for View Plans & Sell Points *** ---
    
        // 1. View Plans Button (Scrolls to Limited Bundles Section)
        if (viewPlansButton && limitedBundlesSection) {
            viewPlansButton.addEventListener('click', () => {
                console.log("View Plans button clicked - scrolling...");
                limitedBundlesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // No need to set isAnimating for a quick scroll usually
            });
        } else {
             if (!viewPlansButton) console.warn("View Plans button (with parent-id='price') not found.");
             if (!limitedBundlesSection) console.warn("Target section #limited-bundles-section not found.");
        }
    
        // 2. Sell Points Button (Shows Alert)
        if (sellPointsButton) {
            sellPointsButton.addEventListener('click', () => {
                console.log("Sell Points button clicked - showing alert...");
                // Get current language from HTML tag
                const currentLang = document.documentElement.getAttribute('lang') || 'ar';
                let title = '';
                let messageBody = '';
    
                // Define the selling points text (matches "How It Works" section)
                if (currentLang === 'ar') {
                    title = "نقاط البيع المعتمدة";
                    messageBody = "لشراء تذاكر الباقات المحدودة، يرجى زيارة:\n\n" +
                              "- سوبر ماركت وسيم الزعبي\n" +
                              "- سوبر ماركت مرتضى الزعبي\n" +
                              "- سوبر ماركت عماد الزعبي\n\n" +
                              "ثم استخدم التذكرة لتسجيل الدخول.";
                } else {
                    title = "Approved Selling Points";
                    messageBody = "To purchase tickets for Limited GB Bundles, please visit:\n\n" +
                              "- Waseem Al-Zoubi Supermarket\n" +
                              "- Murtada Al-Zoubi Supermarket\n" +
                              "- Imad Al-Zoubi Supermarket\n\n" +
                              "Then use the ticket to log in.";
                }
                alert(title + "\n\n" + messageBody); // Display standard browser alert
            });
        } else {
            console.warn("Sell Points button (with parent-id='sell-point') not found.");
        }
    
        // --- Generic Optional Section Buttons (Keep for Loan, etc.) ---
        // Select ALL buttons with parent-id initially
        document.querySelectorAll('button[parent-id]').forEach(button => {
            const targetSectionId = button.getAttribute('parent-id');
    
            // *** IMPORTANT: Skip the buttons we just handled specifically ***
            if (targetSectionId === 'price' || targetSectionId === 'sell-point') {
                return; // Skip, already handled above with specific logic
            }
    
            // --- Handle other buttons (like Loan) using the original show/hide logic ---
            const sectionToShow = optionalSections[targetSectionId]; // Get section from our map
    
            if (sectionToShow) {
                button.addEventListener('click', () => {
                    if (!isAnimating) {
                        console.log(`Generic optional button clicked for: ${targetSectionId}`);
                        isAnimating = true;
                        // Optional: Load script if needed (example)
                        // if (targetSectionId === 'app-store' && typeof loadScript === 'function') {
                        //     loadScript('js/store.min.js');
                        // }
                        showOptionalSection(targetSectionId, button); // Use the existing function
                    }
                });
            } else {
                // Warn if a button has a parent-id but no matching section is mapped or found
                 // Check if it's not one of the buttons we intentionally skipped
                 if (targetSectionId !== 'price' && targetSectionId !== 'sell-point') {
                    console.warn(`Button found with parent-id="${targetSectionId}", but no matching element mapped in optionalSections or section not found.`);
                 }
            }
        });
    
    
        // --- Back Buttons within Optional Sections (e.g., Loan) ---
        backButtons.forEach(button => {
             // Skip the main logout button
             if (button.id === 'logout-button') return;
    
             button.addEventListener('click', (event) => {
                if (!isAnimating) {
                     isAnimating = true;
                     const btn = event.target.closest('button');
                     btn.classList.add('clicked');
    
                     const parentSection = btn.closest('section'); // Find the parent <section>
    
                     setTimeout(() => {
                         if (parentSection) {
                             parentSection.style.display = 'none'; // Hide current section
                             // If you added 'active' class, remove it too
                             // parentSection.classList.remove('active');
                         }
                         showLoginSection(); // Show the main login area
                         isAnimating = false;
                         btn.classList.remove('clicked');
                     }, 150);
                 }
             });
         });
    
    
        // --- Error Popup Close Button/Clickaway ---
        if (errorContainer) {
            errorContainer.addEventListener('click', (event) => {
                if (event.target === errorContainer) {
                    hideErrorPopup(); // Manual dismissal still works
                }
            });
        }
    } // --- End of setupEventListeners ---

    // =========================================================================
    // === Initialization ===
    // =========================================================================

    function init() {
        console.log("Initializing Hotspot UI...");
        setupEventListeners();

        // Perform initial check to see if user is already logged in
        // This call will trigger either handleLoginStart (if not logged in)
        // or handleLoggedIn (if already logged in via server session)
        getRequest(API_ENDPOINT.LOGIN_STATUS);

        // Hide sections initially until the first request determines the state
        hideAllSections();
        // Show login section temporarily until response received? Or show a loading spinner?
        // For simplicity, we'll let the initial getRequest handle showing the correct section.
         // If file protocol, showLoginSection() is called within getRequest.
    }

    // --- Run Initialization ---
    // Use DOMContentLoaded to ensure HTML is parsed
    document.addEventListener('DOMContentLoaded', init);

})(); // End IIFE