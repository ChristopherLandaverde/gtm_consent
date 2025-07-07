// injected-script.js - FIXED GTM container detection

// Prevent multiple injections
if (window.ConsentInspector) {
  // ConsentInspector already exists, skipping...
} else {
  // Creating ConsentInspector...
  
  // Create ConsentInspector in page context
  window.ConsentInspector = {
    version: 'external-v2-fixed',
    
    // Event storage
    eventLog: [],
    maxEvents: 100,
    
    // Helper function to add events
    addEvent: function(category, type, details, data = null) {
      const event = {
        timestamp: Date.now(),
        category: category,
        type: type,
        details: details,
        data: data
      };
      
      this.eventLog.push(event);
      
      // Keep only the latest events
      if (this.eventLog.length > this.maxEvents) {
        this.eventLog = this.eventLog.slice(-this.maxEvents);
      }
      
      console.log('📝 Event logged:', event);
    },
    
    // Initialize with some basic events
    init: function() {
      this.addEvent('system', 'init', 'ConsentInspector initialized', { 
        url: window.location.href,
        userAgent: navigator.userAgent.substring(0, 100)
      });
      
      // Log if GTM is already present
      if (window.google_tag_manager) {
        this.addEvent('gtm', 'found', 'GTM already present on page load');
      }
      
      if (window.dataLayer) {
        this.addEvent('datalayer', 'found', 'DataLayer already present on page load', { 
          length: window.dataLayer.length 
        });
      }
    },
    
    detectGTM: function() {
      
      // Log GTM detection event
      this.addEvent('gtm', 'detection_start', 'GTM detection started');
      
      const result = {
        hasGTM: false,
        gtmId: '',
        containers: [],
        hasConsentMode: false,
        consentState: {},
        detectionMethods: {},
        timestamp: Date.now()
      };
      
      // Method 1: Check window.google_tag_manager
      if (window.google_tag_manager && typeof window.google_tag_manager === 'object') {
        
        const allKeys = Object.keys(window.google_tag_manager);
        
        // FIXED: Better filtering for actual GTM containers
        const actualContainers = allKeys.filter(id => {
          // Must start with GTM- and be reasonably short (real containers are like GTM-ABC123)
          if (!id.startsWith('GTM-')) return false;
          
          // Exclude debug groups (they're usually very long)
          if (id.length > 15) return false;
          
          // Must match proper GTM container pattern: GTM-[alphanumeric]
          if (!/^GTM-[A-Z0-9]{6,8}$/.test(id)) return false;
          
          // Additional check: should be an object, not a string
          const containerData = window.google_tag_manager[id];
          if (typeof containerData !== 'object' || containerData === null) return false;
          
          return true;
        });
        

        
        if (actualContainers.length > 0) {
          result.hasGTM = true;
          result.gtmId = actualContainers[0]; // Primary container
          result.detectionMethods.google_tag_manager = true;
          
          // Build container info
          result.containers = actualContainers.map(id => {
            const containerData = window.google_tag_manager[id];
            return {
              id: id,
              source: 'google_tag_manager',
              isDebugGroup: false,
              hasConsentMode: this.detectConsentMode(),
              dataLayer: window.dataLayer ? window.dataLayer.length : 0,
              method: 'object_detection'
            };
          });
        }
        

      }
      
      // Method 2: Check for GTM script tags (fallback)
      const gtmScripts = document.querySelectorAll('script[src*="googletagmanager.com"]');
      
      if (gtmScripts.length > 0 && !result.hasGTM) {
        result.detectionMethods.scriptTags = gtmScripts.length;
        
        gtmScripts.forEach(script => {
          const match = script.src.match(/id=([^&]+)/);
          if (match && match[1]) {
            const id = match[1];
            if (/^GTM-[A-Z0-9]{6,8}$/.test(id)) {
              result.hasGTM = true;
              if (!result.gtmId) result.gtmId = id;
              
              if (!result.containers.some(c => c.id === id)) {
                result.containers.push({
                  id: id,
                  source: 'script_tag',
                  isDebugGroup: false,
                  hasConsentMode: this.detectConsentMode(),
                  dataLayer: window.dataLayer ? window.dataLayer.length : 0,
                  method: 'script_detection'
                });
              }
            }
          }
        });
      }
      
      // Method 3: Check for gtag function
      if (window.gtag && typeof window.gtag === 'function') {
        result.detectionMethods.gtag = true;
        if (!result.hasGTM) {
          result.hasGTM = true;
          result.gtmId = 'gtag-detected';
        }
      }
      
      // Method 4: Check dataLayer
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        result.detectionMethods.dataLayer = window.dataLayer.length;
        
        // Look for GTM-related events
        const hasGtmEvents = window.dataLayer.some(item => {
          return (typeof item === 'object' && item !== null && 
                  (item.event || item['gtm.start'] || item['gtm.uniqueEventId']));
        });
        
        if (hasGtmEvents && !result.hasGTM) {
          result.hasGTM = true;
          result.gtmId = 'datalayer-detected';
        }
      }
      
      // Check consent mode
      result.hasConsentMode = this.detectConsentMode();
      result.consentState = this.getCurrentConsentState();
      
      // Final validation: ensure we have a reasonable number of containers
      if (result.containers.length > 5) {
        // Keep only containers detected via object method (most reliable)
        const objectContainers = result.containers.filter(c => c.source === 'google_tag_manager');
        if (objectContainers.length > 0 && objectContainers.length <= 3) {
          result.containers = objectContainers;
          result.gtmId = objectContainers[0].id;
        }
      }
      
      return result;
    },
    
    detectConsentMode: function() {
      console.log('🔍 detectConsentMode called');
      
      // Check for actual consent mode implementation, not just presence of gtag
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        // Look for consent events that actually change the state
        const consentEvents = window.dataLayer.filter(item => 
          Array.isArray(item) && item[0] === 'consent'
        );
        
        console.log('🔍 Found consent events:', consentEvents);
        
        // Check if any consent events actually set non-default values
        for (const event of consentEvents) {
          if (event[1] === 'default' || event[1] === 'update') {
            const settings = event[2];
            if (settings) {
              // Check if any consent type is set to 'denied'
              const hasDenied = Object.values(settings).some(value => value === 'denied');
              if (hasDenied) {
                console.log('🔍 Found actual consent mode with denied permissions');
                return true;
              }
            }
          }
        }
        
        // If we have consent events but all are 'granted', it's not real consent mode
        if (consentEvents.length > 0) {
          console.log('🔍 Found consent events but all permissions are granted - not real consent mode');
          return false;
        }
      }
      
      // Check if gtag exists but no consent events - likely not using consent mode
      if (window.gtag && typeof window.gtag === 'function') {
        console.log('🔍 gtag exists but no consent events found - not using consent mode');
        return false;
      }
      
      console.log('🔍 No consent mode detected');
      return false;
    },
    
    getCurrentConsentState: function() {
      console.log('🔍 getCurrentConsentState called');
      
      const defaultState = {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        functionality_storage: 'granted',
        personalization_storage: 'granted',
        security_storage: 'granted'
      };
      
      // Check if GTM is in consent mode
      if (window.google_tag_manager) {
        console.log('🔍 GTM containers found:', Object.keys(window.google_tag_manager));
        
        // Try to get consent state from GTM directly
        for (const containerId in window.google_tag_manager) {
          const container = window.google_tag_manager[containerId];
          if (container && container.dataLayer) {
            console.log(`🔍 Container ${containerId} dataLayer:`, container.dataLayer);
          }
        }
      }
      
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        console.log('🔍 Checking dataLayer for consent events...');
        const consentEvents = window.dataLayer.filter(item => 
          Array.isArray(item) && item[0] === 'consent'
        );
        console.log('🔍 Found consent events:', consentEvents);
        
        for (let i = window.dataLayer.length - 1; i >= 0; i--) {
          const item = window.dataLayer[i];
          if (Array.isArray(item) && item[0] === 'consent' && 
              (item[1] === 'default' || item[1] === 'update') && item[2]) {
            console.log('🔍 Found consent state in dataLayer:', item[2]);
            return { ...defaultState, ...item[2] };
          }
        }
      }
      
      console.log('🔍 No consent events found, returning default state:', defaultState);
      return defaultState;
    },
    
    getTagInfo: function() {
      
      const tags = [];
      const consentState = this.getCurrentConsentState();
      
      // Comprehensive tag detection
      const detectors = [
        {
          name: 'Google Analytics 4',
          type: 'analytics',
          consentType: 'analytics_storage',
          check: () => window.gtag || document.querySelector('script[src*="gtag/js"]') || document.querySelector('script[src*="googletagmanager.com"]')
        },
        {
          name: 'Universal Analytics',
          type: 'analytics',
          consentType: 'analytics_storage',
          check: () => window.ga || document.querySelector('script[src*="google-analytics.com"]')
        },
        {
          name: 'Facebook Pixel',
          type: 'advertising',
          consentType: 'ad_storage',
          check: () => window.fbq || document.querySelector('script[src*="connect.facebook.net"]')
        },
        {
          name: 'Google Ads',
          type: 'advertising',
          consentType: 'ad_storage',
          check: () => document.querySelector('script[src*="googleadservices.com"]') || document.querySelector('script[src*="googlesyndication.com"]')
        },
        {
          name: 'Hotjar',
          type: 'analytics',
          consentType: 'analytics_storage',
          check: () => window.hj || document.querySelector('script[src*="hotjar.com"]')
        }
      ];
      
      detectors.forEach(detector => {
        if (detector.check()) {
          const allowed = consentState[detector.consentType] === 'granted';
          tags.push({
            name: detector.name,
            type: detector.type,
            consentType: detector.consentType,
            allowed: allowed,
            reason: `${detector.consentType}: ${consentState[detector.consentType]}`
          });
          
        }
      });
      
      return tags;
    },
    
    updateConsent: function(settings) {
      console.log('🔒 updateConsent called with settings:', settings);
      
      // Log the consent update event
      this.addEvent('consent', 'update', 'Consent settings updated', settings);
      
      try {
        if (window.gtag && typeof window.gtag === 'function') {
          console.log('🔒 Using gtag method');
          window.gtag('consent', 'update', settings);
          
          // Check if it was actually applied
          setTimeout(() => {
            const recentEvents = window.dataLayer ? window.dataLayer.slice(-5) : [];
            console.log('🔒 Recent dataLayer events after gtag call:', recentEvents);
          }, 100);
          
          this.addEvent('consent', 'gtag_call', 'gtag consent update called', { method: 'gtag', settings });
          return { success: true, method: 'gtag' };
        }
        
        if (window.dataLayer && Array.isArray(window.dataLayer)) {
          console.log('🔒 Using dataLayer method');
          window.dataLayer.push(['consent', 'update', settings]);
          this.addEvent('consent', 'datalayer_push', 'Consent update pushed to dataLayer', { method: 'dataLayer', settings });
          return { success: true, method: 'dataLayer' };
        }
        
        console.log('🔒 No consent mechanism available');
        this.addEvent('consent', 'error', 'No consent mechanism available');
        return { success: false, error: 'No consent mechanism available' };
      } catch (error) {
        console.error('🔒 Error in updateConsent:', error);
        this.addEvent('consent', 'error', 'Consent update failed: ' + error.message);
        return { success: false, error: error.message };
      }
    },
    
    detectTriggersAndVariables: function() {
      console.log('🔍 detectTriggersAndVariables called');
      
      const result = {
        triggers: [],
        variables: [],
        tagTriggerMap: [],
        summary: {
          totalTriggers: 0,
          totalVariables: 0,
          tagsWithTriggers: 0
        },
        timestamp: Date.now()
      };
      
      // Detect triggers from dataLayer events
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        const dataLayer = window.dataLayer;
        
        dataLayer.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            // Detect triggers based on event patterns
            if (item.event) {
              result.triggers.push({
                name: `Event: ${item.event}`,
                type: 'custom-event',
                event: item.event,
                source: 'dataLayer',
                timestamp: Date.now(),
                dataLayerIndex: index,
                consentType: this.getConsentTypeForEvent(item.event)
              });
            }
            
            // Detect page view triggers
            if (item['gtm.start'] || item.event === 'page_view') {
              result.triggers.push({
                name: 'Page View',
                type: 'page-view',
                event: 'page_view',
                source: 'dataLayer',
                timestamp: Date.now(),
                dataLayerIndex: index
              });
            }
            
            // Detect consent triggers
            if (item.event === 'consent_update' || item.event === 'consent_default') {
              result.triggers.push({
                name: 'Consent Update',
                type: 'consent',
                event: item.event,
                source: 'dataLayer',
                timestamp: Date.now(),
                dataLayerIndex: index,
                consentType: 'consent_update'
              });
            }
            
            // Detect e-commerce triggers
            if (item.event && ['purchase', 'add_to_cart', 'view_item', 'begin_checkout'].includes(item.event)) {
              result.triggers.push({
                name: `E-commerce: ${item.event}`,
                type: 'e-commerce',
                event: item.event,
                source: 'dataLayer',
                timestamp: Date.now(),
                dataLayerIndex: index,
                consentType: 'analytics_storage'
              });
            }
          }
        });
      }
      
      // Detect variables from dataLayer and GTM
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        const dataLayer = window.dataLayer;
        
        // Extract variables from dataLayer items
        dataLayer.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            Object.keys(item).forEach(key => {
              if (key !== 'event' && key !== 'gtm.start' && key !== 'gtm.uniqueEventId') {
                result.variables.push({
                  name: key,
                  type: 'datalayer',
                  value: JSON.stringify(item[key]),
                  source: 'dataLayer',
                  dataType: typeof item[key],
                  dataLayerIndex: index
                });
              }
            });
          }
        });
      }
      
      // Detect GTM configuration variables
      if (window.google_tag_manager) {
        Object.keys(window.google_tag_manager).forEach(containerId => {
          if (containerId.startsWith('GTM-')) {
            const container = window.google_tag_manager[containerId];
            
            // Add container ID as variable
            result.variables.push({
              name: 'Container ID',
              type: 'config',
              value: containerId,
              source: 'google_tag_manager',
              dataType: 'string',
              container: containerId
            });
            
            // Add dataLayer length as variable
            if (window.dataLayer) {
              result.variables.push({
                name: 'DataLayer Length',
                type: 'config',
                value: window.dataLayer.length.toString(),
                source: 'google_tag_manager',
                dataType: 'number',
                container: containerId
              });
            }
          }
        });
      }
      
      // Detect gtag configuration
      if (window.gtag) {
        result.variables.push({
          name: 'gtag Function',
          type: 'config',
          value: 'Available',
          source: 'gtag',
          dataType: 'function'
        });
      }
      
      // Create tag-trigger mappings
      const tags = this.getTagInfo();
      tags.forEach(tag => {
        const relatedTriggers = result.triggers.filter(trigger => 
          trigger.consentType === tag.consentType || 
          trigger.type === 'page-view' // Page view triggers are common
        );
        
        if (relatedTriggers.length > 0) {
          relatedTriggers.forEach(trigger => {
            result.tagTriggerMap.push({
              tag: tag.name,
              trigger: trigger.name,
              container: 'GTM',
              consentType: tag.consentType
            });
          });
        }
      });
      
      // Update summary
      result.summary.totalTriggers = result.triggers.length;
      result.summary.totalVariables = result.variables.length;
      result.summary.tagsWithTriggers = result.tagTriggerMap.length;
      
      console.log('🔍 Triggers and variables detection result:', result);
      return result;
    },
    
    getComprehensiveTagAnalysis: function() {
      console.log('🔍 getComprehensiveTagAnalysis called');
      
      const triggersAndVars = this.detectTriggersAndVariables();
      const tags = this.getTagInfo();
      const consentState = this.getCurrentConsentState();
      
      // Analyze consent dependencies
      const consentDependencies = tags.map(tag => ({
        tag: tag.name,
        consentType: tag.consentType,
        required: true,
        currentState: consentState[tag.consentType]
      }));
      
      const result = {
        ...triggersAndVars,
        tags: tags,
        consentState: consentState,
        consentDependencies: consentDependencies,
        summary: {
          ...triggersAndVars.summary,
          totalTags: tags.length,
          containers: this.detectGTM().containers.length
        },
        timestamp: Date.now()
      };
      
      console.log('🔍 Comprehensive analysis result:', result);
      return result;
    },
    
    getConsentTypeForEvent: function(eventName) {
      const event = eventName.toLowerCase();
      
      if (event.includes('purchase') || event.includes('add_to_cart') || event.includes('view_item')) {
        return 'analytics_storage';
      }
      
      if (event.includes('consent')) {
        return 'consent_update';
      }
      
      if (event.includes('page_view') || event.includes('pageview')) {
        return 'analytics_storage';
      }
      
      return 'analytics_storage'; // Default
    },
    
    detectIABTCF: function() {
      console.log('🔍 detectIABTCF called');
      
      const result = {
        detected: false,
        version: null,
        gdprApplies: false,
        consentString: null,
        purposeConsents: {},
        vendorConsents: {},
        timestamp: Date.now()
      };
      
      // Check for IAB TCF API
      if (window.__tcfapi) {
        result.detected = true;
        result.version = '2.2'; // Most common version
        
        // Try to get TCF data
        try {
          if (typeof window.__tcfapi === 'function') {
            // TCF v2.2
            window.__tcfapi('getTCData', 2, function(tcData, success) {
              if (success && tcData) {
                result.gdprApplies = tcData.gdprApplies || false;
                result.consentString = tcData.tcString || null;
                
                if (tcData.purpose && tcData.purpose.consents) {
                  result.purposeConsents = tcData.purpose.consents;
                }
                
                if (tcData.vendor && tcData.vendor.consents) {
                  result.vendorConsents = tcData.vendor.consents;
                }
              }
            });
          }
        } catch (error) {
          console.error('Error accessing TCF API:', error);
        }
      }
      
      // Check for older TCF versions
      if (!result.detected && window.__tcfapi) {
        result.detected = true;
        result.version = '2.0';
      }
      
      console.log('🔍 IAB TCF detection result:', result);
      return result;
    },
    
    detectCMP: function() {
      console.log('🔍 detectCMP called');
      
      const result = {
        detected: false,
        name: null,
        cmpId: null,
        timestamp: Date.now()
      };
      
      // Check for common CMPs
      if (window.OneTrust) {
        result.detected = true;
        result.name = 'OneTrust';
        result.cmpId = '1';
      } else if (window.Cookiebot) {
        result.detected = true;
        result.name = 'Cookiebot';
        result.cmpId = '2';
      } else if (window._paq) {
        result.detected = true;
        result.name = 'Matomo';
        result.cmpId = '3';
      } else if (window.consentmanager) {
        result.detected = true;
        result.name = 'ConsentManager';
        result.cmpId = '4';
      } else if (window.__tcfapi) {
        result.detected = true;
        result.name = 'IAB TCF';
        result.cmpId = '5';
      } else if (window.fbq) {
        result.detected = true;
        result.name = 'Facebook';
        result.cmpId = '6';
      } else if (window.gtag) {
        result.detected = true;
        result.name = 'Google Tag Manager';
        result.cmpId = '7';
      }
      
      console.log('🔍 CMP detection result:', result);
      return result;
    },
    
    parseTCFConsentString: function(consentString) {
      console.log('🔍 parseTCFConsentString called with:', consentString);
      
      if (!consentString) {
        return { error: 'No consent string provided' };
      }
      
      try {
        // Basic TCF consent string parsing
        const result = {
          raw: consentString,
          length: consentString.length,
          version: '2.2',
          decoded: 'Basic parsing - full decoding requires TCF library'
        };
        
        // Try to decode if we have the TCF API
        if (window.__tcfapi && typeof window.__tcfapi === 'function') {
          try {
            window.__tcfapi('getTCData', 2, function(tcData, success) {
              if (success && tcData) {
                result.decoded = JSON.stringify(tcData, null, 2);
              }
            });
          } catch (error) {
            console.error('Error decoding with TCF API:', error);
          }
        }
        
        console.log('🔍 Consent string parsing result:', result);
        return result;
      } catch (error) {
        console.error('Error parsing consent string:', error);
        return { error: 'Failed to parse consent string: ' + error.message };
      }
    },
    
    getEvents: function() {
      return this.eventLog;
    },
    
    clearEvents: function() {
      this.eventLog = [];
      this.addEvent('system', 'clear', 'Event log cleared');
      return { success: true };
    }
  };
  

}

// Initialize the ConsentInspector
if (window.ConsentInspector && window.ConsentInspector.init) {
  window.ConsentInspector.init();
}

// Listen for messages from content script
window.addEventListener('message', function(event) {
  if (event.data && event.data.source === 'gtm-inspector-content') {
    
    const { action, data, id } = event.data;
    let result = null;
    let error = null;
    
    try {
      switch (action) {
        case 'detectGTM':
          result = window.ConsentInspector.detectGTM();
          break;
          
        case 'getTagInfo':
          result = window.ConsentInspector.getTagInfo();
          break;
          
        case 'updateConsent':
          result = window.ConsentInspector.updateConsent(data);
          break;
          
        case 'getEvents':
          result = window.ConsentInspector.getEvents();
          break;
          
        case 'clearEventLog':
          result = window.ConsentInspector.clearEvents();
          break;
          
        case 'getComprehensiveTagAnalysis':
          result = window.ConsentInspector.getComprehensiveTagAnalysis();
          break;
          
        case 'getCurrentConsentState':
          result = window.ConsentInspector.getCurrentConsentState();
          break;
          
        case 'detectIABTCF':
          result = window.ConsentInspector.detectIABTCF();
          break;
          
        case 'detectCMP':
          result = window.ConsentInspector.detectCMP();
          break;
          
        case 'parseTCFConsentString':
          result = window.ConsentInspector.parseTCFConsentString(data);
          break;
          
        default:
          error = 'Unknown action: ' + action;
      }
    } catch (err) {
      error = err.message;
    }
    
    // Send response back to content script
    window.postMessage({
      source: 'gtm-inspector-page',
      id: id,
      result: result,
      error: error
    }, '*');
  }
});