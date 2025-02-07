// Simple test to see if the script runs
console.log('Banner script loaded');

// Create banner with scrolling text
const banner = document.createElement('div');
banner.style.cssText = `
    position: fixed;
    top: 0 !important;
    left: 0;
    right: 0;
    height: 32px;
    background: #000;
    color: #fff;
    z-index: 2147483647;
    overflow: hidden;
    font-family: 'VT323', monospace;
    font-size: 24px;
    line-height: 32px;
    pointer-events: none;
    display: none;
`;

// Create scrolling text container
const textContainer = document.createElement('div');
textContainer.style.cssText = `
    white-space: nowrap;
    position: absolute;
    letter-spacing: 2px;
    font-weight: bold;
    color: #FFEB3B;
`;

// Add font and animation style
const style = document.createElement('style');
style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
    
    @keyframes scroll-left {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
    }
    
    body.banner-active {
        margin-top: 32px !important;
        transition: margin-top 0.3s ease;
    }

    .scroll-slow {
        animation: scroll-left 60s linear infinite !important;
    }

    .scroll-medium {
        animation: scroll-left 40s linear infinite !important;
    }

    .scroll-fast {
        animation: scroll-left 25s linear infinite !important;
    }
`;

// Function to handle page layout
function adjustPageLayout(enable) {
    if (!enable) {
        // Reset everything when disabled
        document.body.classList.remove('banner-active');
        const elements = document.querySelectorAll('[data-original-position]');
        elements.forEach(element => {
            const originalPosition = element.getAttribute('data-original-position');
            if (originalPosition) {
                Object.assign(element.style, JSON.parse(originalPosition));
                element.removeAttribute('data-original-position');
            }
        });
        return;
    }

    // Add margin to body for banner space
    document.body.classList.add('banner-active');

    // First pass: adjust fixed/sticky headers
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
        if (element === banner) return;
        
        const style = window.getComputedStyle(element);
        if (style.position === 'fixed' || style.position === 'sticky') {
            if (!element.hasAttribute('data-original-position')) {
                const originalPosition = {
                    position: style.position,
                    top: style.top,
                    transform: style.transform,
                    transition: style.transition
                };
                element.setAttribute('data-original-position', JSON.stringify(originalPosition));
            }

            const currentTop = parseInt(style.top) || 0;
            element.style.top = `${currentTop + 32}px`;
            element.style.transition = 'top 0.3s ease';
            element.style.position = style.position;
        }
    });

    // Second pass: adjust main content containers
    const mainContent = document.querySelector('#content, main, [role="main"]');
    if (mainContent && !mainContent.hasAttribute('data-original-position')) {
        const style = window.getComputedStyle(mainContent);
        const originalPosition = {
            marginTop: style.marginTop,
            paddingTop: style.paddingTop
        };
        mainContent.setAttribute('data-original-position', JSON.stringify(originalPosition));
        mainContent.style.marginTop = `${parseInt(style.marginTop || 0) + 32}px`;
        mainContent.style.transition = 'margin-top 0.3s ease';
    }
}

// Function to update banner message
function updateBannerMessage(message) {
    textContainer.textContent = message || 'Test Banner with Scrolling Text';
}

// Function to update scroll speed
function updateScrollSpeed(speed) {
    textContainer.className = `scroll-${speed}`;
}

// Initialize banner
function initializeBanner() {
    document.head.appendChild(style);
    textContainer.textContent = 'Test Banner with Scrolling Text';
    banner.appendChild(textContainer);
    document.body.insertBefore(banner, document.body.firstChild);
}

// Function to initialize banner with current settings
function initializeBannerWithSettings() {
    try {
        if (!document.body) {
            setTimeout(initializeBannerWithSettings, 50);
            return;
        }

        chrome.storage.sync.get(
            {
                isEnabled: false,
                message: '',
                speed: 'medium'
            },
            function(items) {
                if (chrome.runtime.lastError) {
                    console.log('Extension context invalid, reloading...');
                    return;
                }
                
                if (!document.body.contains(banner)) {
                    initializeBanner();
                }

                // Only adjust layout if banner state is changing
                const currentlyDisplayed = banner.style.display === 'block';
                const shouldDisplay = items.isEnabled;
                
                banner.style.display = shouldDisplay ? 'block' : 'none';
                updateBannerMessage(items.message);
                updateScrollSpeed(items.speed);
                
                // Only adjust layout if the display state is actually changing
                if (currentlyDisplayed !== shouldDisplay) {
                    adjustPageLayout(shouldDisplay);
                }
            }
        );
    } catch (e) {
        if (e.message.includes('Extension context invalidated')) {
            console.log('Extension context invalid, reloading...');
            return;
        }
        throw e;
    }
}

// Initialize immediately and also listen for DOM ready
initializeBannerWithSettings();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBannerWithSettings);
}

// Also initialize on visibility change (new tab focus)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        initializeBannerWithSettings();
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkState') {
        const currentState = banner.style.display === 'block';
        sendResponse({ needsUpdate: currentState !== message.expectedState });
        return true;
    }
    
    // Ensure banner is initialized
    if (!document.body.contains(banner)) {
        initializeBanner();
    }

    if (message.action === 'toggleBanner') {
        banner.style.display = message.isEnabled ? 'block' : 'none';
        if (message.isEnabled) {
            updateBannerMessage(message.message);
            updateScrollSpeed(message.speed);
            adjustPageLayout(true);
        } else {
            adjustPageLayout(false);
        }
    } else if (message.action === 'updateMessage') {
        const safeMessage = message.text.substring(0, 500);
        updateBannerMessage(safeMessage);
    } else if (message.action === 'updateSpeed') {
        updateScrollSpeed(message.speed);
    }
    sendResponse({ success: true });
    return true;
});

// Handle dynamically added fixed elements
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node !== banner) {
                const style = window.getComputedStyle(node);
                if (style.position === 'fixed' && banner.style.display === 'block') {
                    // Store original position
                    if (!node.hasAttribute('data-original-position')) {
                        const originalPosition = {
                            position: style.position,
                            top: style.top,
                            transform: style.transform,
                            transition: style.transition
                        };
                        node.setAttribute('data-original-position', JSON.stringify(originalPosition));
                    }
                    const currentTop = parseInt(style.top) || 0;
                    node.style.top = (currentTop + 32) + 'px';
                    node.style.transition = 'top 0.3s ease';
                }
            }
        });
    });
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
}); 