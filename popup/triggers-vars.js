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
      triggerList.innerHTML = '<div class="trigger-item empty-state">No triggers detected...</div>';
      return;
    }
    const filteredTriggers = filterTriggers(triggers, currentFilters.triggers);
    triggerList.innerHTML = filteredTriggers.map(trigger => `
      <div class="trigger-item">
        <div class="trigger-header">
          <span class="trigger-name">${escapeHtml(trigger.name)}</span>
          <span class="trigger-type">${escapeHtml(trigger.type || 'unknown')}</span>
        </div>
        <div class="trigger-details">
          <strong>Event:</strong> ${escapeHtml(trigger.event || 'N/A')}<br>
          <strong>Source:</strong> ${escapeHtml(trigger.source || 'unknown')}<br>
          ${trigger.timestamp ? `<strong>Time:</strong> ${new Date(trigger.timestamp).toLocaleTimeString()}<br>` : ''}
          ${trigger.dataLayerIndex !== undefined ? `<strong>DataLayer Index:</strong> ${trigger.dataLayerIndex}<br>` : ''}
        </div>
        ${trigger.consentType ? `
          <div class="trigger-consent ${trigger.consentType}">
            <strong>Consent Required:</strong> ${trigger.consentType.replace('_', ' ')}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  function renderVariables(variables) {
    if (!variableList) return;
    if (!variables || variables.length === 0) {
      variableList.innerHTML = '<div class="variable-item empty-state">No variables detected...</div>';
      return;
    }
    const filteredVariables = filterVariables(variables, currentFilters.variables);
    variableList.innerHTML = filteredVariables.map(variable => `
      <div class="variable-item">
        <div class="variable-header">
          <span class="variable-name">${escapeHtml(variable.name)}</span>
          <span class="variable-type">${escapeHtml(variable.type || 'unknown')}</span>
        </div>
        <div class="variable-details">
          <strong>Source:</strong> ${escapeHtml(variable.source || 'unknown')}<br>
          <strong>Data Type:</strong> ${escapeHtml(variable.dataType || 'unknown')}<br>
          ${variable.container ? `<strong>Container:</strong> ${escapeHtml(variable.container)}<br>` : ''}
          ${variable.dataLayerIndex !== undefined ? `<strong>DataLayer Index:</strong> ${variable.dataLayerIndex}<br>` : ''}
        </div>
        <div class="variable-value">${escapeHtml(variable.value)}</div>
      </div>
    `).join('');
  }

  function renderMappings(mappings) {
    if (!mappingList) return;
    if (!mappings || mappings.length === 0) {
      mappingList.innerHTML = '<div class="mapping-item empty-state">No tag-trigger mappings detected...</div>';
      return;
    }
    mappingList.innerHTML = mappings.map(mapping => `
      <div class="mapping-item">
        <div class="mapping-header">
          <span class="mapping-name">Tag-Trigger Mapping</span>
          <span class="mapping-type">${escapeHtml(mapping.container || 'unknown')}</span>
        </div>
        <div class="mapping-details">
          <span class="mapping-tag">${escapeHtml(mapping.tag || 'Unknown Tag')}</span>
          <span class="mapping-trigger">${escapeHtml(mapping.trigger || 'Unknown Trigger')}</span>
        </div>
      </div>
    `).join('');
  }

  function filterTriggers(triggers, filter) {
    if (filter === 'all') return triggers;
    return triggers.filter(trigger => {
      const name = trigger.name.toLowerCase();
      switch (filter) {
        case 'page-view':
          return name.includes('page view') || name.includes('pageview');
        case 'custom-event':
          return name.includes('custom event') || name.includes('event');
        case 'consent':
          return name.includes('consent') || trigger.consentType;
        case 'e-commerce':
          return name.includes('e-commerce') || name.includes('commerce') || 
                 (trigger.event && ['purchase', 'add_to_cart', 'view_item'].includes(trigger.event));
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
          return type === 'measurement_id' || type === 'container_id' || type === 'conversion_id';
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