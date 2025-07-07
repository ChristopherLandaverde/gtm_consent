// consent-simulator.js - Fixed UI update flow
const ConsentSimulator = (function() {
  let contentScriptInterface = null;
  // Cache DOM elements
  let applyBtn = null;
  let consentToggles = null;

  // Consent presets configuration  
  const CONSENT_PRESETS = {
    'all-granted': {
      name: 'All Granted',
      description: 'Allow all tracking and analytics',
      settings: {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        functionality_storage: 'granted',
        personalization_storage: 'granted',
        security_storage: 'granted'
      }
    },
    'all-denied': {
      name: 'All Denied',
      description: 'Block all tracking (privacy-first)',
      settings: {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        functionality_storage: 'denied',
        personalization_storage: 'denied',
        security_storage: 'denied'
      }
    },
    'analytics-only': {
      name: 'Analytics Only',
      description: 'Allow analytics but block advertising',
      settings: {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        functionality_storage: 'granted',
        personalization_storage: 'denied',
        security_storage: 'granted'
      }
    },
    'ads-only': {
      name: 'Ads Only',
      description: 'Allow advertising but block analytics',
      settings: {
        analytics_storage: 'denied',
        ad_storage: 'granted',
        functionality_storage: 'granted',
        personalization_storage: 'denied',
        security_storage: 'granted'
      }
    },
    'functional-only': {
      name: 'Functional Only',
      description: 'Essential functionality only',
      settings: {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        functionality_storage: 'granted',
        personalization_storage: 'denied',
        security_storage: 'granted'
      }
    }
  };

  function initialize(contentInterface) {
    console.log('⚙️ Initializing ConsentSimulator...');
    contentScriptInterface = contentInterface;
    applyBtn = document.getElementById('applyConsent');
    consentToggles = document.querySelectorAll('.consent-select');
    initializeConsentPresets();
    initializeApplyButton();
    // Show loading spinner
    showLoading();
    // Load current consent state on initialization
    loadCurrentConsentState();
  }

  function showLoading() {
    const container = document.getElementById('consent-tab');
    if (container) {
      const toggles = container.querySelector('.consent-categories');
      if (toggles) toggles.innerHTML = '';
    }
  }

  async function loadCurrentConsentState() {
    try {
      const result = await contentScriptInterface.sendMessage('checkGTM');
      if (result && result.consentState) {
        console.log('📊 Loading current consent state:', result.consentState);
        updateConsentToggles(result.consentState);
        checkConsentModeStatus(result);
      } else {
        console.log('⚠️ No consent state available, using privacy-first defaults');
        showConsentModeUnavailable();
        showConsentModeStatus(false);
      }
    } catch (error) {
      console.error('❌ Error loading consent state:', error);
      showConsentModeUnavailable();
      showConsentModeStatus(false);
    }
  }

  function showConsentModeUnavailable() {
    const container = document.getElementById('consent-tab');
    if (container) {
      const toggles = container.querySelector('.consent-categories');
      if (toggles) toggles.innerHTML = '<div class="empty-state">Consent mode not available on this site</div>';
    }
  }

  function initializeConsentPresets() {
    const presetItems = document.querySelectorAll('.dropdown-item[data-preset]');
    console.log('🎛️ Found preset buttons:', presetItems.length);
    presetItems.forEach(item => {
      item.addEventListener('click', function() {
        const preset = this.getAttribute('data-preset');
        console.log('🎯 Preset clicked:', preset);
        applyConsentPreset(preset);
      });
    });
  }

  function initializeApplyButton() {
    if (!applyBtn) {
      console.error('❌ Apply consent button not found');
      return;
    }
    applyBtn.addEventListener('click', async function() {
      console.log('⚡ Apply consent clicked');
      this.disabled = true;
      this.textContent = '⚡ Applying...';
      try {
        const settings = getConsentSettings();
        console.log('📤 Applying consent settings:', settings);
        const result = await contentScriptInterface.sendMessage('applyConsent', settings);
        if (result && result.success) {
          console.log('✅ Consent applied successfully');
          showNotification('✅ Consent applied!', 'success');
          setTimeout(async () => {
            await forceRefreshConsentState();
          }, 1500);
        } else {
          console.error('❌ Consent application failed:', result?.error);
          showNotification('❌ Failed: ' + (result?.error || 'Unknown error'), 'error');
        }
      } catch (error) {
        console.error('❌ Apply consent error:', error);
        showNotification('❌ Error applying consent', 'error');
      } finally {
        this.disabled = false;
        this.textContent = '⚡ Apply Settings';
      }
    });
  }

  // NEW: Force refresh consent state after changes
  async function forceRefreshConsentState() {
    try {
      console.log('🔄 Force refreshing consent state...');
      
      // Get fresh consent state from page
      const freshResult = await contentScriptInterface.sendMessage('checkGTM');
      console.log('🔄 Fresh consent state received:', freshResult);
      
      if (freshResult && freshResult.consentState) {
        // Update our UI to match the actual page state
        updateConsentToggles(freshResult.consentState);
      }
      
      // Refresh other components
      if (window.TagList) {
        await window.TagList.refresh();
      }
      
      // Update main status display
      if (window.updateGTMStatusDisplay) {
        window.updateGTMStatusDisplay(freshResult);
      }
      
    } catch (error) {
      console.error('❌ Failed to force refresh consent state:', error);
    }
  }

  function applyConsentPreset(preset) {
    const presetConfig = CONSENT_PRESETS[preset];
    if (!presetConfig) {
      console.warn('⚠️ Unknown preset:', preset);
      return;
    }
    
    console.log(`🎯 Applying: ${presetConfig.name} - ${presetConfig.description}`);
    console.log('Settings:', presetConfig.settings);
    
    // IMMEDIATELY update the UI toggles to show intended state
    updateConsentToggles(presetConfig.settings);
    
    // Apply the settings automatically after a brief delay
    setTimeout(() => {
      const applyBtn = document.getElementById('applyConsent');
      if (applyBtn && !applyBtn.disabled) {
        applyBtn.click();
      }
    }, 100);
  }

  function getConsentSettings() {
    const settings = {
      analytics_storage: getSelectValue('analytics_storage', 'denied'),
      ad_storage: getSelectValue('ad_storage', 'denied'),
      functionality_storage: getSelectValue('functionality_storage', 'granted'),
      personalization_storage: getSelectValue('personalization_storage', 'denied'),
      security_storage: getSelectValue('security_storage', 'granted')
    };
    
    console.log('📋 Current consent settings from UI:', settings);
    return settings;
  }

  function getSelectValue(id, defaultValue) {
    const element = document.getElementById(id);
    return element ? element.value : defaultValue;
  }

  function updateConsentToggles(consentState) {
    console.log('🔄 Updating consent toggles with state:', consentState);
    
    for (const [key, value] of Object.entries(consentState)) {
      const element = document.getElementById(key);
      if (element) {
        const oldValue = element.value;
        element.value = value;
        
        console.log(`✅ Updated ${key}: ${oldValue} → ${value}`);
        
        // Add visual feedback for ANY change (not just different values)
        element.style.backgroundColor = value === 'granted' ? '#d4edda' : '#f8d7da';
        element.style.transition = 'background-color 0.3s ease';
        
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
      } else {
        console.warn(`⚠️ Element not found for ${key}`);
      }
    }
  }

  function showNotification(message, type = 'info') {
    console.log(`📢 Notification [${type}]: ${message}`);
    
    // Use new UI utilities for better notifications
    if (window.UIUtils) {
      window.UIUtils.showNotification(message, type);
    }
    
    // Enhanced visual feedback for apply button
    const applyBtn = document.getElementById('applyConsent');
    if (applyBtn) {
      if (type === 'success') {
        window.UIUtils.setButtonLoading(applyBtn, true, '✅ Applied!');
        setTimeout(() => {
          window.UIUtils.setButtonLoading(applyBtn, false);
        }, 2000);
      } else if (type === 'error') {
        window.UIUtils.setButtonLoading(applyBtn, true, '❌ Failed');
        setTimeout(() => {
          window.UIUtils.setButtonLoading(applyBtn, false);
        }, 2000);
      }
    }
  }

  // NEW: Check if consent mode is actually working
  function checkConsentModeStatus(gtmResult) {
    const hasConsentMode = gtmResult.hasConsentMode;
    const hasConsentEvents = gtmResult.consentState && 
      Object.values(gtmResult.consentState).some(value => value !== 'granted');
    
    // If GTM says it has consent mode but all values are 'granted', 
    // it might not actually be working
    const consentModeWorking = hasConsentMode && hasConsentEvents;
    
    showConsentModeStatus(consentModeWorking);
  }

  // NEW: Display consent mode status to user
  function showConsentModeStatus(isWorking) {
    // Find or create status display
    let statusDisplay = document.getElementById('consentModeStatus');
    if (!statusDisplay) {
      statusDisplay = document.createElement('div');
      statusDisplay.id = 'consentModeStatus';
      statusDisplay.style.cssText = `
        margin: 10px 0;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        border-left: 4px solid;
      `;
      
      // Insert at the top of the consent simulator
      const consentContainer = document.querySelector('#consent-tab');
      if (consentContainer) {
        const firstChild = consentContainer.firstChild;
        consentContainer.insertBefore(statusDisplay, firstChild);
      }
    }
    
    if (isWorking) {
      statusDisplay.innerHTML = `
        <strong>✅ Consent Mode Active</strong><br>
        This website uses Google's Consent Mode. Your consent changes will affect tag firing.
      `;
      statusDisplay.style.cssText = `
        margin: 10px 0;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        border-left: 4px solid #28a745;
        background-color: #d4edda;
        color: #155724;
      `;
      
      // Enable all simulator controls
      enableSimulatorControls(true);
    } else {
      statusDisplay.innerHTML = `
        <strong>❌ Consent Mode Not Available</strong><br>
        This website doesn't use Google's Consent Mode. The consent simulator is disabled because it won't have any effect on tag firing.
      `;
      statusDisplay.style.cssText = `
        margin: 10px 0;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        border-left: 4px solid #dc3545;
        background-color: #f8d7da;
        color: #721c24;
      `;
      
      // Disable all simulator controls
      enableSimulatorControls(false);
    }
  }

  // NEW: Enable/disable simulator controls based on consent mode availability
  function enableSimulatorControls(enabled) {
    // Disable/enable all consent select dropdowns
    const consentSelects = document.querySelectorAll('#consent-tab select[id$="_storage"]');
    consentSelects.forEach(select => {
      select.disabled = !enabled;
      select.style.opacity = enabled ? '1' : '0.5';
      select.style.cursor = enabled ? 'pointer' : 'not-allowed';
    });
    
    // Disable/enable preset buttons
    const presetButtons = document.querySelectorAll('#consent-tab .dropdown-item[data-preset]');
    presetButtons.forEach(button => {
      button.disabled = !enabled;
      button.style.opacity = enabled ? '1' : '0.5';
      button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    });
    
    // Disable/enable apply button
    const applyButton = document.getElementById('applyConsent');
    if (applyButton) {
      applyButton.disabled = !enabled;
      applyButton.style.opacity = enabled ? '1' : '0.5';
      applyButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
      
      if (!enabled) {
        applyButton.textContent = '❌ Simulator Disabled';
      } else {
        applyButton.textContent = '⚡ Apply Settings';
      }
    }
    
    // Add visual overlay to show disabled state
    let overlay = document.getElementById('consentSimulatorOverlay');
    if (!enabled && !overlay) {
      overlay = document.createElement('div');
      overlay.id = 'consentSimulatorOverlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        z-index: 10;
        pointer-events: none;
        border-radius: 4px;
      `;
      
      const consentContainer = document.querySelector('#consent-tab');
      if (consentContainer) {
        consentContainer.style.position = 'relative';
        consentContainer.appendChild(overlay);
      }
    } else if (enabled && overlay) {
      overlay.remove();
    }
  }

  // Utility functions
  function getAvailablePresets() {
    return Object.keys(CONSENT_PRESETS).map(key => ({
      key,
      ...CONSENT_PRESETS[key]
    }));
  }

  function getPreset(presetKey) {
    return CONSENT_PRESETS[presetKey] || null;
  }

  // Public API
  return {
    initialize,
    updateConsentToggles,
    applyConsentPreset,
    loadCurrentConsentState,
    forceRefreshConsentState, // NEW: Expose for external calls
    getAvailablePresets,
    getPreset
  };
})();

// Make available globally
window.ConsentSimulator = ConsentSimulator;