// triggers-vars.js - Triggers & Variables Analysis Module
const TriggersVarsModule = (function() {
  let currentAnalysis = null;
  let currentFilters = {
    triggers: 'all',
    variables: 'all'
  };
  // Cache DOM elements
  let triggerList = null;
  let variableList = null;
  let mappingList = null;
  let triggerFilterContainer = null;
  let variableFilterContainer = null;
  let refreshBtn = null;
  let exportBtn = null;
  let consentDepsBtn = null;

  function init() {
    console.log('🔍 Initializing Triggers & Variables module...');
    // Cache DOM elements
    triggerList = document.getElementById('triggerList');
    variableList = document.getElementById('variableList');
    mappingList = document.getElementById('mappingList');
    triggerFilterContainer = document.querySelector('#triggers-vars-tab .filter-controls');
    variableFilterContainer = document.querySelector('#triggers-vars-tab .section:nth-child(2) .filter-controls');
    refreshBtn = document.getElementById('refreshAnalysis');
    exportBtn = document.getElementById('exportAnalysis');
    consentDepsBtn = document.getElementById('showConsentDependencies');
    setupEventListeners();
    loadAnalysis();
  }

  function setupEventListeners() {
    // Filter buttons for triggers
    if (triggerFilterContainer) {
      triggerFilterContainer.querySelectorAll('[data-trigger-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const filter = e.target.dataset.triggerFilter;
          setTriggerFilter(filter);
        });
      });
    }
    // Filter buttons for variables
    if (variableFilterContainer) {
      variableFilterContainer.querySelectorAll('[data-variable-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const filter = e.target.dataset.variableFilter;
          setVariableFilter(filter);
        });
      });
    }
    // Action buttons
    if (refreshBtn) refreshBtn.addEventListener('click', loadAnalysis);
    if (exportBtn) exportBtn.addEventListener('click', exportAnalysis);
    if (consentDepsBtn) consentDepsBtn.addEventListener('click', showConsentDependencies);
  }

  async function loadAnalysis() {
    try {
      console.log('🔍 Loading comprehensive tag analysis...');
      showLoading();
      const analysis = await ContentScriptInterface.sendMessage('getComprehensiveTagAnalysis');
      if (analysis && !analysis.error) {
        currentAnalysis = analysis;
        updateOverview(analysis);
        renderTriggers((analysis.triggers || []).slice(0, 100));
        renderVariables((analysis.variables || []).slice(0, 100));
        renderMappings((analysis.tagTriggerMap || []).slice(0, 100));
        hideLoading();
      } else {
        console.error('❌ Error loading analysis:', analysis?.error);
        showError('Failed to load analysis: ' + (analysis?.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error in loadAnalysis:', error);
      showError('Failed to load analysis: ' + error.message);
    }
  }

  function updateOverview(analysis) {
    const { summary } = analysis;
    document.getElementById('totalTagsValue').textContent = summary.totalTags;
    document.getElementById('totalTriggersValue').textContent = summary.totalTriggers;
    document.getElementById('totalVariablesValue').textContent = summary.totalVariables;
    document.getElementById('mappedTagsValue').textContent = summary.tagsWithTriggers;
  }

  function renderTriggers(triggers) {
    if (!triggerList) return;
    if (!triggers || triggers.length === 0) {
      triggerList.innerHTML = '<div class="event-item empty-state">No triggers detected...</div>';
      return;
    }
    const filteredTriggers = filterTriggers(triggers, currentFilters.triggers);
    triggerList.innerHTML = filteredTriggers.map(trigger => `
      <div class="event-item">
        <div class="event-header">
          <span class="event-time">[${trigger.dataLayerIndex !== undefined ? `Index: ${trigger.dataLayerIndex}` : 'N/A'}]</span>
          <span class="event-type ${trigger.type}">${getTriggerTypeLabel(trigger.type)}</span>
        </div>
        <div class="event-detail">
          <strong>${escapeHtml(trigger.name)}</strong>
          ${trigger.description ? `<br>${escapeHtml(trigger.description)}` : ''}
          ${trigger.consentType ? `<br><span class="consent-badge">Consent: ${trigger.consentType.replace('_', ' ')}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  function getTriggerTypeLabel(type) {
    const labels = {
      'page-view': 'Page View',
      'custom-event': 'Custom Event',
      'consent': 'Consent',
      'e-commerce': 'E-commerce',
      'user-engagement': 'User Engagement',
      'user-interaction': 'User Interaction'
    };
    return labels[type] || type;
  }

  function renderVariables(variables) {
    if (!variableList) return;
    if (!variables || variables.length === 0) {
      variableList.innerHTML = '<div class="event-item empty-state">No variables detected...</div>';
      return;
    }
    const filteredVariables = filterVariables(variables, currentFilters.variables);
    variableList.innerHTML = filteredVariables.map(variable => `
      <div class="event-item">
        <div class="event-header">
          <span class="event-time">[${variable.dataLayerIndex !== undefined ? `Index: ${variable.dataLayerIndex}` : variable.container || 'N/A'}]</span>
          <span class="event-type ${variable.type}">${getVariableTypeLabel(variable.type)}</span>
        </div>
        <div class="event-detail">
          <strong>${escapeHtml(variable.name)}</strong>
          <br>Value: ${escapeHtml(variable.value || 'N/A')}
          ${variable.source ? `<br>Source: ${escapeHtml(variable.source)}` : ''}
        </div>
      </div>
    `).join('');
  }

  function getVariableTypeLabel(type) {
    const labels = {
      'datalayer': 'DataLayer',
      'config': 'Config',
      'custom': 'Custom',
      'measurement': 'Measurement',
      'consent': 'Consent'
    };
    return labels[type] || type;
  }

  function renderMappings(mappings) {
    if (!mappingList) return;
    if (!mappings || mappings.length === 0) {
      mappingList.innerHTML = '<div class="event-item empty-state">No tag-trigger mappings detected...</div>';
      return;
    }
    mappingList.innerHTML = mappings.map(mapping => `
      <div class="event-item">
        <div class="event-header">
          <span class="event-time">[${mapping.container || 'GTM'}]</span>
          <span class="event-type mapping">Mapping</span>
        </div>
        <div class="event-detail">
          <strong>Tag:</strong> ${escapeHtml(mapping.tag || 'Unknown Tag')}
          <br><strong>Trigger:</strong> ${escapeHtml(mapping.trigger || 'Unknown Trigger')}
          ${mapping.consentType ? `<br><span class="consent-badge">Consent: ${mapping.consentType.replace('_', ' ')}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  function filterTriggers(triggers, filter) {
    if (filter === 'all') return triggers;
    return triggers.filter(trigger => {
      const name = trigger.name.toLowerCase();
      const type = trigger.type.toLowerCase();
      switch (filter) {
        case 'page-view':
          return type === 'page-view' || name.includes('page view') || name.includes('pageview');
        case 'custom-event':
          return type === 'custom-event' || name.includes('custom event') || name.includes('event');
        case 'consent':
          return type === 'consent' || name.includes('consent') || trigger.consentType;
        case 'e-commerce':
          return type === 'e-commerce' || name.includes('e-commerce') || name.includes('commerce') || 
                 (trigger.event && ['purchase', 'add_to_cart', 'view_item', 'begin_checkout', 'add_to_wishlist'].includes(trigger.event));
        case 'user-engagement':
          return type === 'user-engagement' || name.includes('login') || name.includes('signup') || name.includes('sign_up');
        case 'user-interaction':
          return type === 'user-interaction' || name.includes('scroll') || name.includes('click') || name.includes('form_submit');
        default:
          return true;
      }
    });
  }

  function filterVariables(variables, filter) {
    if (filter === 'all') return variables;
    return variables.filter(variable => {
      const type = variable.type.toLowerCase();
      const source = variable.source.toLowerCase();
      switch (filter) {
        case 'datalayer':
          return type === 'datalayer' || source === 'datalayer';
        case 'config':
          return type === 'config' || type === 'gtag_config';
        case 'custom':
          return type === 'custom' || type === 'gtag_set';
        case 'measurement':
          return type === 'measurement_id' || type === 'container_id' || type === 'conversion_id' || type === 'measurement';
        case 'consent':
          return type === 'consent' || source === 'consent_mode';
        default:
          return true;
      }
    });
  }

  function setTriggerFilter(filter) {
    currentFilters.triggers = filter;
    if (triggerFilterContainer) {
      triggerFilterContainer.querySelectorAll('[data-trigger-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.triggerFilter === filter);
      });
    }
    if (currentAnalysis) {
      renderTriggers((currentAnalysis.triggers || []).slice(0, 100));
    }
  }

  function setVariableFilter(filter) {
    currentFilters.variables = filter;
    if (variableFilterContainer) {
      variableFilterContainer.querySelectorAll('[data-variable-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.variableFilter === filter);
      });
    }
    if (currentAnalysis) {
      renderVariables((currentAnalysis.variables || []).slice(0, 100));
    }
  }

  function exportAnalysis() {
    if (!currentAnalysis) {
      showError('No analysis data to export');
      return;
    }
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        analysis: currentAnalysis,
        filters: currentFilters
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtm-analysis-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('✅ Analysis exported successfully');
    } catch (error) {
      console.error('❌ Error exporting analysis:', error);
      showError('Failed to export analysis: ' + error.message);
    }
  }

  function showConsentDependencies() {
    if (!currentAnalysis) {
      showError('No analysis data available');
      return;
    }
    const { consentDependencies, tags } = currentAnalysis;
    let message = 'Consent Dependencies:\n\n';
    if (consentDependencies && consentDependencies.length > 0) {
      consentDependencies.forEach(dep => {
        message += `• ${dep.tag}: ${dep.consentType}\n`;
      });
    } else {
      message += 'No explicit consent dependencies found.\n\n';
    }
    message += '\nTag Consent Requirements:\n';
    tags.forEach(tag => {
      message += `• ${tag.name}: ${tag.consentType} (${tag.allowed ? 'Allowed' : 'Blocked'})\n`;
    });
    alert(message);
  }

  function showLoading() {
    if (triggerList) triggerList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    if (variableList) variableList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    if (mappingList) mappingList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  }

  function hideLoading() {
    // Loading state is cleared when content is rendered
  }

  function showError(message) {
    console.error('❌ Error:', message);
    alert('Error: ' + message);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    init: init,
    loadAnalysis: loadAnalysis,
    refresh: loadAnalysis
  };
})();

// Make module available globally
window.TriggersVarsModule = TriggersVarsModule; 