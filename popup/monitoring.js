// monitoring.js - Real-time Monitoring Module
const MonitoringModule = (function() {
  let isMonitoring = false;
  let monitoringInterval = null;
  let currentAlerts = [];
  let currentData = {
    status: 'Inactive',
    cmp: 'None',
    tags: 0,
    alerts: 0,
    lastUpdate: null
  };

  function init() {
    console.log('🔍 Initializing Monitoring module...');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    updateMonitoringData();
  }

  function setupEventListeners() {
    const startBtn = document.getElementById('startMonitoring');
    const stopBtn = document.getElementById('stopMonitoring');
    const validateBtn = document.getElementById('validateCompliance');
    const clearAlertsBtn = document.getElementById('clearAlerts');
    
    if (startBtn) {
      startBtn.addEventListener('click', startMonitoring);
    }
    
    if (stopBtn) {
      stopBtn.addEventListener('click', stopMonitoring);
    }
    
    if (validateBtn) {
      validateBtn.addEventListener('click', validateCompliance);
    }
    
    if (clearAlertsBtn) {
      clearAlertsBtn.addEventListener('click', clearAlerts);
    }
  }

  function startMonitoring() {
    if (isMonitoring) return;
    
    console.log('🚀 Starting real-time monitoring...');
    isMonitoring = true;
    
    // Update UI
    updateMonitoringStatus('Active');
    toggleMonitoringButtons(true);
    updateHeaderStatus(true);
    
    // Start monitoring interval (every 3 seconds)
    monitoringInterval = setInterval(async () => {
      try {
        await updateMonitoringData();
      } catch (error) {
        console.error('❌ Monitoring error:', error);
        addAlert('Monitoring error: ' + error.message, 'error');
      }
    }, 3000);
    
    // Initial update
    updateMonitoringData();
  }

  function stopMonitoring() {
    if (!isMonitoring) return;
    
    console.log('⏹️ Stopping real-time monitoring...');
    isMonitoring = false;
    
    // Clear interval
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
    
    // Update UI
    updateMonitoringStatus('Inactive');
    toggleMonitoringButtons(false);
    updateHeaderStatus(false);
  }

  async function updateMonitoringData() {
    try {
      console.log('🔍 Updating monitoring data...');
      
      // Get current GTM status
      const gtmStatus = await ContentScriptInterface.sendMessage('checkGTM');
      console.log('GTM Status:', gtmStatus);
      
      // Get current tag status
      const tagStatus = await ContentScriptInterface.sendMessage('getTagStatus');
      console.log('Tag Status:', tagStatus);
      
      // Get current consent state
      const consentState = await ContentScriptInterface.sendMessage('getCurrentConsentState');
      console.log('Consent State:', consentState);
      
      // Check for alerts first
      checkForAlerts(gtmStatus, tagStatus, consentState);
      
      // Update data after alerts are processed
      const tagCount = Array.isArray(tagStatus) ? tagStatus.length : 0;
      const alertCount = currentAlerts.length;
      
      console.log(`📊 Tag count: ${tagCount}, Alert count: ${alertCount}`);
      
      currentData = {
        status: isMonitoring ? 'Active' : 'Inactive',
        cmp: detectCMP(),
        tags: tagCount,
        alerts: alertCount,
        lastUpdate: new Date(),
        gtmStatus: gtmStatus,
        tagStatus: tagStatus,
        consentState: consentState
      };
      
      console.log('Current Data:', currentData);
      
      // Update display
      updateDisplay();
      
    } catch (error) {
      console.error('❌ Error updating monitoring data:', error);
      addAlert('Failed to update monitoring data: ' + error.message, 'error');
    }
  }

  function detectCMP() {
    // Basic CMP detection
    if (window.__tcfapi) return 'IAB TCF';
    if (window.OneTrust) return 'OneTrust';
    if (window.Cookiebot) return 'Cookiebot';
    if (window._paq) return 'Matomo';
    if (window.consentmanager) return 'ConsentManager';
    return 'None';
  }

  function checkForAlerts(gtmStatus, tagStatus, consentState) {
    const newAlerts = [];
    
    // Check GTM status
    if (!gtmStatus || !gtmStatus.hasGTM) {
      newAlerts.push({ 
        message: 'GTM not detected on page', 
        type: 'error', 
        severity: 'high',
        timestamp: new Date()
      });
    }
    
    // Check consent mode
    if (gtmStatus && gtmStatus.hasGTM && !gtmStatus.hasConsentMode) {
      newAlerts.push({ 
        message: 'GTM detected but Consent Mode not enabled', 
        type: 'warning', 
        severity: 'medium',
        timestamp: new Date()
      });
    }
    
    // Check tag blocking
    if (Array.isArray(tagStatus)) {
      const blockedTags = tagStatus.filter(tag => !tag.allowed);
      if (blockedTags.length > 0) {
        newAlerts.push({ 
          message: `${blockedTags.length} tags are blocked due to consent`, 
          type: 'info', 
          severity: 'low',
          details: blockedTags.map(tag => tag.name).join(', '),
          timestamp: new Date()
        });
      }
    }
    
    // Check consent state
    if (consentState) {
      const deniedConsents = Object.entries(consentState).filter(([key, value]) => value === 'denied');
      if (deniedConsents.length > 0) {
        newAlerts.push({ 
          message: `${deniedConsents.length} consent categories are denied`, 
          type: 'warning', 
          severity: 'medium',
          details: deniedConsents.map(([key]) => key).join(', '),
          timestamp: new Date()
        });
      }
    }
    
    // Update alerts
    currentAlerts = newAlerts;
    currentData.alerts = currentAlerts.length;
    
    // Update alert display
    updateAlertsDisplay();
    updateAlertBadge();
    
    // Log alerts
    if (currentAlerts.length > 0) {
      console.log('⚠️ Monitoring alerts:', currentAlerts);
    }
  }

  function addAlert(message, type = 'info') {
    const alert = {
      message: message,
      type: type,
      severity: type === 'error' ? 'high' : type === 'warning' ? 'medium' : 'low',
      timestamp: new Date()
    };
    
    currentAlerts.push(alert);
    currentData.alerts = currentAlerts.length;
    
    updateAlertsDisplay();
    updateAlertBadge();
    
    console.log('⚠️ Alert:', message);
  }

  function clearAlerts() {
    currentAlerts = [];
    currentData.alerts = 0;
    updateAlertsDisplay();
    updateAlertBadge();
  }

  function updateAlertsDisplay() {
    const alertsContainer = document.getElementById('alertsContainer');
    const alertsList = document.getElementById('alertsList');
    
    if (!alertsContainer || !alertsList) return;
    
    if (currentAlerts.length === 0) {
      alertsContainer.style.display = 'none';
      return;
    }
    
    alertsContainer.style.display = 'block';
    
    alertsList.innerHTML = currentAlerts.map(alert => {
      // Ensure alert has required properties with fallbacks
      const message = alert.message || 'Unknown alert';
      const type = alert.type || 'info';
      const severity = alert.severity || 'low';
      const details = alert.details || '';
      
      // Handle timestamp safely
      let timestamp;
      try {
        timestamp = alert.timestamp ? alert.timestamp.toLocaleTimeString() : new Date().toLocaleTimeString();
      } catch (error) {
        console.warn('⚠️ Error formatting timestamp:', error);
        timestamp = new Date().toLocaleTimeString();
      }
      
      return `
        <div class="alert-item ${type}">
          <div class="alert-severity ${severity}">${getSeverityIcon(severity)}</div>
          <div class="alert-message">
            <div class="alert-text">${message}</div>
            ${details ? `<div class="alert-details">${details}</div>` : ''}
            <div class="alert-time">${timestamp}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getSeverityIcon(severity) {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return 'ℹ️';
    }
  }

  function updateAlertBadge() {
    const alertBadge = document.getElementById('alertBadge');
    if (alertBadge) {
      if (currentAlerts.length > 0) {
        alertBadge.textContent = currentAlerts.length;
        alertBadge.style.display = 'inline-block';
      } else {
        alertBadge.style.display = 'none';
      }
    }
  }

  function updateHeaderStatus(active) {
    const monitoringStatus = document.getElementById('monitoringStatus');
    const monitoringIndicator = document.getElementById('monitoringIndicator');
    
    if (monitoringStatus) {
      monitoringStatus.style.display = 'block';
    }
    
    if (monitoringIndicator) {
      if (active) {
        monitoringIndicator.textContent = '🔴 ON';
        monitoringIndicator.className = 'status-active';
      } else {
        monitoringIndicator.textContent = '⚪ OFF';
        monitoringIndicator.className = 'status-inactive';
      }
    }
  }

  function updateDisplay() {
    console.log('🎨 Updating display with data:', currentData);
    
    // Update status values
    const statusEl = document.getElementById('monitoringStatusValue');
    const cmpEl = document.getElementById('cmpStatusValue');
    const tagsEl = document.getElementById('tagsMonitoredValue');
    const alertsEl = document.getElementById('activeAlertsValue');
    
    if (statusEl) statusEl.textContent = currentData.status;
    if (cmpEl) cmpEl.textContent = currentData.cmp;
    if (tagsEl) tagsEl.textContent = currentData.tags;
    if (alertsEl) alertsEl.textContent = currentData.alerts;
    
    console.log(`📱 UI Elements - Status: ${currentData.status}, CMP: ${currentData.cmp}, Tags: ${currentData.tags}, Alerts: ${currentData.alerts}`);
    
    // Update colors based on status
    if (statusEl) {
      statusEl.className = currentData.status === 'Active' ? 'value active' : 'value inactive';
    }
    
    if (alertsEl) {
      alertsEl.className = currentData.alerts > 0 ? 'value alert' : 'value';
    }
  }

  function updateMonitoringStatus(status) {
    currentData.status = status;
    updateDisplay();
  }

  function toggleMonitoringButtons(monitoring) {
    const startBtn = document.getElementById('startMonitoring');
    const stopBtn = document.getElementById('stopMonitoring');
    
    if (startBtn) {
      startBtn.style.display = monitoring ? 'none' : 'inline-block';
    }
    
    if (stopBtn) {
      stopBtn.style.display = monitoring ? 'inline-block' : 'none';
    }
  }

  async function validateCompliance() {
    console.log('🔍 Running compliance validation...');
    
    try {
      // Get comprehensive analysis
      const analysis = await ContentScriptInterface.sendMessage('getComprehensiveTagAnalysis');
      
      if (analysis && !analysis.error) {
        const complianceResults = checkCompliance(analysis);
        showComplianceResults(complianceResults);
      } else {
        showError('Failed to run compliance check: ' + (analysis?.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Compliance validation error:', error);
      showError('Compliance validation failed: ' + error.message);
    }
  }

  function checkCompliance(analysis) {
    const results = {
      overall: 'PASS',
      checks: [],
      issues: []
    };
    
    // Check 1: GTM presence
    if (analysis.summary && analysis.summary.containers > 0) {
      results.checks.push({ name: 'GTM Detection', status: 'PASS', details: `${analysis.summary.containers} container(s) detected` });
    } else {
      results.checks.push({ name: 'GTM Detection', status: 'FAIL', details: 'No GTM containers detected' });
      results.issues.push('GTM not detected');
      results.overall = 'FAIL';
    }
    
    // Check 2: Consent mode
    if (analysis.consentState) {
      const consentCategories = Object.keys(analysis.consentState);
      if (consentCategories.length > 0) {
        results.checks.push({ name: 'Consent Mode', status: 'PASS', details: `${consentCategories.length} consent categories configured` });
      } else {
        results.checks.push({ name: 'Consent Mode', status: 'WARN', details: 'No consent categories detected' });
        results.issues.push('Consent mode may not be properly configured');
      }
    } else {
      results.checks.push({ name: 'Consent Mode', status: 'FAIL', details: 'Consent mode not detected' });
      results.issues.push('Consent mode not implemented');
      results.overall = 'FAIL';
    }
    
    // Check 3: Tag consent requirements
    if (analysis.tags && analysis.tags.length > 0) {
      const tagsWithConsent = analysis.tags.filter(tag => tag.consentType);
      if (tagsWithConsent.length > 0) {
        results.checks.push({ name: 'Tag Consent', status: 'PASS', details: `${tagsWithConsent.length} tags have consent requirements` });
      } else {
        results.checks.push({ name: 'Tag Consent', status: 'WARN', details: 'Tags found but no consent requirements detected' });
        results.issues.push('Tags may not respect consent settings');
      }
    } else {
      results.checks.push({ name: 'Tag Consent', status: 'INFO', details: 'No tags detected' });
    }
    
    return results;
  }

  function showComplianceResults(results) {
    let message = `Compliance Check Results: ${results.overall}\n\n`;
    
    results.checks.forEach(check => {
      const icon = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : check.status === 'WARN' ? '⚠️' : 'ℹ️';
      message += `${icon} ${check.name}: ${check.status}\n`;
      message += `   ${check.details}\n\n`;
    });
    
    if (results.issues.length > 0) {
      message += 'Issues Found:\n';
      results.issues.forEach(issue => {
        message += `• ${issue}\n`;
      });
    }
    
    alert(message);
  }

  function showError(message) {
    console.error('❌ Error:', message);
    alert('Error: ' + message);
  }

  return {
    init: init,
    startMonitoring: startMonitoring,
    stopMonitoring: stopMonitoring,
    validateCompliance: validateCompliance,
    clearAlerts: clearAlerts
  };
})();

// Make module available globally
window.MonitoringModule = MonitoringModule; 