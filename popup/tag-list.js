// tag-list.js - FIXED version with setActiveContainer
const TagList = (function() {
  let currentTags = [];
  let currentFilter = 'all';
  let activeContainer = null;
  let contentScriptInterface = null;
  // Cache DOM elements
  let tagListElement = null;
  let filterContainer = null;

  function initialize(contentInterface) {
    contentScriptInterface = contentInterface;
    tagListElement = document.getElementById('tagList');
    filterContainer = document.querySelector('#tags-tab .filter-controls');
    initializeTagFilters();
    initializeRefreshButton();
  }

  function initializeTagFilters() {
    if (!filterContainer) return;
    filterContainer.addEventListener('click', function(e) {
      if (!e.target.matches('.filter-btn[data-filter]')) return;
      const filterValue = e.target.getAttribute('data-filter');
      filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn === e.target);
      });
      currentFilter = filterValue;
      filterTags(filterValue);
    });
  }

  function initializeRefreshButton() {
    const refreshBtn = document.getElementById('refreshTags');
    if (!refreshBtn) return;
    refreshBtn.addEventListener('click', async function() {
      this.disabled = true;
      this.textContent = '🔄 Refreshing...';
      showLoading();
      try {
        await refresh();
      } finally {
        this.disabled = false;
        this.textContent = '🔄 Refresh Tags';
      }
    });
  }

  function showLoading() {
    if (tagListElement) {
      tagListElement.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    }
  }

  async function refresh() {
    if (!contentScriptInterface) return;
    try {
      const result = await contentScriptInterface.sendMessage('getTagStatus');
      if (result && Array.isArray(result)) {
        updateTags(result);
      } else {
        updateTags([]);
      }
    } catch (error) {
      updateTags([]);
    }
  }

  function updateTags(tags) {
    if (!tagListElement) return;
    // Cap to 100 tags for performance
    currentTags = (tags || []).slice(0, 100);
    if (!currentTags.length) {
      tagListElement.innerHTML = '<div class="tag-item empty-state">No tags detected</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    currentTags.forEach(tag => {
      const tagElement = createTagElement(tag);
      fragment.appendChild(tagElement);
    });
    tagListElement.innerHTML = '';
    tagListElement.appendChild(fragment);
    filterTags(currentFilter);
  }

  function createTagElement(tag) {
    const tagElement = document.createElement('div');
    tagElement.className = `tag-item ${tag.type || 'other'}`;
    const statusIcon = tag.allowed ? '✅' : '❌';
    const statusColor = tag.allowed ? '#28a745' : '#dc3545';
    tagElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <strong>${escapeHtml(tag.name)}</strong>
        <span style="color: ${statusColor}; font-weight: 600;">
          ${statusIcon} ${tag.allowed ? 'Allowed' : 'Blocked'}
        </span>
      </div>
      <div style="font-size: 12px; color: #666;">
        Type: ${escapeHtml(tag.type || 'Unknown')}
      </div>
      ${tag.reason ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">
        ${escapeHtml(tag.reason)}
      </div>` : ''}
    `;
    return tagElement;
  }

  function filterTags(category) {
    if (!tagListElement) return;
    const tagItems = tagListElement.querySelectorAll('.tag-item:not(.empty-state)');
    tagItems.forEach(item => {
      if (category === 'all') {
        item.style.display = 'block';
      } else {
        const hasCategory = item.classList.contains(category);
        item.style.display = hasCategory ? 'block' : 'none';
      }
    });
  }

  function setActiveContainer(containerId) {
    activeContainer = containerId;
    if (currentTags.length > 0) {
      const containerTags = currentTags.filter(tag =>
        !tag.container || tag.container === containerId
      );
      if (containerTags.length !== currentTags.length) {
        updateTagDisplay(containerTags);
      }
    }
  }

  function updateTagDisplay(tags) {
    if (!tagListElement) return;
    if (!tags || tags.length === 0) {
      tagListElement.innerHTML = '<div class="tag-item empty-state">No tags for this container</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    tags.forEach(tag => {
      const tagElement = createTagElement(tag);
      fragment.appendChild(tagElement);
    });
    tagListElement.innerHTML = '';
    tagListElement.appendChild(fragment);
    filterTags(currentFilter);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    initialize,
    refresh,
    updateTags,
    setActiveContainer
  };
})();

// Make available globally
window.TagList = TagList;