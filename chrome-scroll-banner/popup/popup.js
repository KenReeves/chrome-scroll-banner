// Store DOM elements
document.addEventListener('DOMContentLoaded', function() {
    const bannerToggle = document.getElementById('bannerToggle');
    const bannerText = document.getElementById('bannerText');
    const scrollSpeed = document.getElementById('scrollSpeed');
    const charCount = document.getElementById('charCount');

    // Load saved settings when popup opens
    chrome.storage.sync.get(
        {
            isEnabled: false,
            message: '',
            speed: 'medium'
        },
        function(items) {
            bannerToggle.checked = items.isEnabled;
            bannerText.value = items.message;
            scrollSpeed.value = items.speed;
            updateCharCount();
            
            // Only send initial state if banner is not in the expected state
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs && tabs[0] && tabs[0].url && 
                    !tabs[0].url.startsWith('chrome://') && 
                    !tabs[0].url.startsWith('edge://')) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'checkState',
                        expectedState: items.isEnabled
                    }, function(response) {
                        if (chrome.runtime.lastError) {
                            // Content script not loaded, no need to update
                            return;
                        }
                        if (response && response.needsUpdate) {
                            updateAllTabs({
                                action: 'toggleBanner',
                                isEnabled: items.isEnabled,
                                message: items.message,
                                speed: items.speed
                            });
                        }
                    });
                }
            });
        }
    );

    // Update character count display
    function updateCharCount() {
        const count = bannerText.value.length;
        charCount.textContent = `${count}/500`;
    }

    // Function to send message to all tabs
    function updateAllTabs(message) {
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                try {
                    chrome.tabs.sendMessage(tab.id, message, response => {
                        if (chrome.runtime.lastError) {
                            // Silently ignore errors for tabs that don't have our content script
                            return;
                        }
                    });
                } catch (e) {
                    // Ignore any errors from invalid tabs
                    console.debug(`Could not send message to tab ${tab.id}`);
                }
            });
        });
    }

    // Save settings when toggle changes
    bannerToggle.addEventListener('change', function() {
        chrome.storage.sync.set({ isEnabled: this.checked });
        
        // Get current settings to send complete state
        chrome.storage.sync.get(
            {
                message: '',
                speed: 'medium'
            },
            function(items) {
                updateAllTabs({
                    action: 'toggleBanner',
                    isEnabled: bannerToggle.checked,
                    message: items.message,
                    speed: items.speed
                });
            }
        );
    });

    // Save message when text changes
    bannerText.addEventListener('input', function() {
        const message = this.value;
        updateCharCount();
        
        // Save to storage
        chrome.storage.sync.set({ message: message });
        
        // Update all tabs
        updateAllTabs({
            action: 'updateMessage',
            text: message
        });
    });

    // Save speed when selection changes
    scrollSpeed.addEventListener('change', function() {
        const speed = this.value;
        
        // Save to storage
        chrome.storage.sync.set({ speed: speed });
        
        // Update all tabs
        updateAllTabs({
            action: 'updateSpeed',
            speed: speed
        });
    });
}); 