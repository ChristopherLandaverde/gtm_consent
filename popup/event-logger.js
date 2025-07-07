// event-logger.js - Fixed IIFE pattern
const EventLogger = (function() {
  const MAX_EVENTS = 50;
  let currentEvents = [];
  let currentEventFilter = 'all';
  let contentScriptInterface = null;
  // Cache DOM elements
  let eventLogElement = null;
  let filterContainer = null;
  let clearBtn = null;
  let exportBtn = null;

  function initialize(contentInterface) {
    console.log('📝 Initializing EventLogger...');
    contentScriptInterface = contentInterface;
    eventLogElement = document.getElementById('eventLog');
    filterContainer = document.querySelector('#events-tab .filter-controls');
    clearBtn = document.getElementById('clearLog');
    exportBtn = document.getElementById('exportLog');
    initializeEventFilters();
    initializeClearButton();
    initializeExportButton();
  }

  function initializeEventFilters() {
    if (!filterContainer) return;
    filterContainer.addEventListener('click', function(e) {
      if (!e.target.matches('.filter-btn[data-event-filter]')) return;
      const filterValue = e.target.getAttribute('data-event-filter');
      filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn === e.target);
      });
      currentEventFilter = filterValue;
      filterEvents(filterValue);
    });
  }

  function initializeClearButton() {
    if (!clearBtn) return;
    let clearTimeout = null;
    clearBtn.addEventListener('click', function() {
      if (clearTimeout) return;
      clearTimeout = setTimeout(async () => {
        await clearEventLog();
        clearTimeout = null;
      }, 300);
    });
  }

  function initializeExportButton() {
    if (!exportBtn) return;
    exportBtn.addEventListener('click', function() {
      exportEventLog();
    });
  }

  function showLoading() {
    if (eventLogElement) {
      eventLogElement.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    }
  }

  function filterEvents(category) {
    if (!eventLogElement) return;
    eventLogElement.className = `event-log filter-${category}`;
    if (!document.getElementById('event-filter-styles')) {
      const style = document.createElement('style');
      style.id = 'event-filter-styles';
      style.textContent = `
        .event-log.filter-all .event-item { display: block; }
        .event-log.filter-consent .event-item:not([data-event-type="consent"]) { display: none; }
        .event-log.filter-tag .event-item:not([data-event-type="tag"]) { display: none; }
        .event-log.filter-gtm .event-item:not([data-event-type="gtm"]) { display: none; }
      `;
      document.head.appendChild(style);
    }
  }

  function updateEventLog(events) {
    if (!eventLogElement) return;
    if (!events || events.length === 0) {
      eventLogElement.innerHTML = '<div class="event-item empty-state">No events recorded yet</div>';
      return;
    }
    const limitedEvents = events.slice(-MAX_EVENTS);
    if (JSON.stringify(limitedEvents) === JSON.stringify(currentEvents)) {
      return; // No changes
    }
    currentEvents = [...limitedEvents];
    const fragment = document.createDocumentFragment();
    limitedEvents.reverse().forEach(event => {
      const eventElement = createEventElement(event);
      fragment.appendChild(eventElement);
    });
    eventLogElement.innerHTML = '';
    eventLogElement.appendChild(fragment);
    filterEvents(currentEventFilter);
    eventLogElement.scrollTop = 0;
  }

  function createEventElement(event) {
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.setAttribute('data-event-type', event.category || 'other');
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    let eventData = '';
    if (event.data) {
      try {
        eventData = JSON.stringify(event.data, null, 2);
      } catch (e) {
        eventData = String(event.data);
      }
    }
    const details = event.details || event.eventName || 'Event';
    eventItem.innerHTML = `
      <div class="event-header">
        <span class="event-time">[${timestamp}]</span>
        <span class="event-type ${event.category || 'other'}">${escapeHtml(event.type || 'Event')}</span>
      </div>
      <div class="event-detail">${escapeHtml(details)}</div>
      ${eventData ? `<div class="event-data"><pre>${escapeHtml(eventData)}</pre></div>` : ''}
    `;
    return eventItem;
  }

  function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function refresh() {
    if (!contentScriptInterface) return;
    showLoading();
    try {
      const events = await contentScriptInterface.sendMessage('getEventLog');
      if (events) {
        updateEventLog(events);
      }
    } catch (error) {
      console.error('❌ Error refreshing events:', error);
    }
  }

  async function clearEventLog() {
    if (!contentScriptInterface) return;
    try {
      await contentScriptInterface.sendMessage('clearEventLog');
      currentEvents = [];
      if (eventLogElement) {
        eventLogElement.innerHTML = '<div class="event-item empty-state">Event log cleared</div>';
      }
    } catch (error) {
      console.error('❌ Error clearing event log:', error);
    }
  }

  function exportEventLog() {
    if (currentEvents.length === 0) {
      showNotification('No events to export', 'warning');
      return;
    }
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        url: location.href,
        events: currentEvents
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtm-events-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotification('Failed to export events', 'error');
    }
  }

  function showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      alert(message);
    }
  }

  // Public API
  return {
    initialize,
    updateEventLog,
    refresh,
    clearEventLog: clearEventLog,
    exportEventLog
  };
})();

// Make available globally
window.EventLogger = EventLogger;