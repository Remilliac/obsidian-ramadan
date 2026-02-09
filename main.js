const { Plugin, ItemView } = require('obsidian');

const VIEW_TYPE = 'ramadan-calendar-view';

module.exports = class RamadanPlugin extends Plugin {
  async onload() {
    console.log('Loading Ramadan 2026 Calendar plugin');
    this.settings = Object.assign({ dayStates: {}, startDate: '2026-02-17' }, (await this.loadData()) || {});

    // Migrate old checkedDays format to new dayStates format
    if (this.settings.checkedDays && Array.isArray(this.settings.checkedDays)) {
      this.settings.dayStates = {};
      this.settings.checkedDays.forEach(day => {
        this.settings.dayStates[day] = 1; // 1 = checked (green)
      });
      delete this.settings.checkedDays;
      await this.saveSettings();
    }

    // Register a right-sidebar view
    this.registerView(VIEW_TYPE, (leaf) => new RamadanView(leaf, this));

    this.addCommand({
      id: 'open-ramadan-calendar-side',
      name: 'Open Ramadan 2026 Calendar (side panel)',
      callback: async () => {
        const leaf = this.app.workspace.getRightLeaf(false);
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
        this.app.workspace.revealLeaf(leaf);
      }
    });

    // Keep a ribbon icon to open the side view — we'll replace its innerHTML with a crescent+star SVG
    const ribbonBtn = this.addRibbonIcon('calendar-with-clock', 'Ramadan 2026 Calendar', async () => {
      const leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    });

    // Replace default icon with a simple crescent + star SVG
    try {
      const svg = `
        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" />
          <path d="M16.5 4.5l.9 2.1L19.5 7l-2.1.4-.9 2.1-.9-2.1L14 7l2.1-.4.9-2.1z" fill="currentColor" />
        </svg>`;
      ribbonBtn.innerHTML = svg;
      ribbonBtn.setAttr && ribbonBtn.setAttr('aria-label', 'Ramadan 2026 Calendar');
      ribbonBtn.setAttribute && ribbonBtn.setAttribute('aria-label', 'Ramadan 2026 Calendar');
    } catch (e) {
      // ignore if we can't set innerHTML for some reason
      console.warn('Failed to set custom ribbon SVG', e);
    }
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    console.log('Unloading Ramadan 2026 Calendar plugin');
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};

class RamadanView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return 'Ramadan 2026';
  }

  // return an icon name for the workspace toolbar (uses Obsidian built-in icons)
  getIcon() {
    return 'moon';
  }

  async onOpen() {
    this.containerEl.empty();
    // add a class to scope styles to this view
    this.containerEl.addClass('ramadan-view-container');

    const header = this.containerEl.createEl('div', { cls: 'view-header' });
    header.createEl('h3', { text: 'Ramadan 2026 — 30 Days' });

    const startInputRow = this.containerEl.createEl('div', { cls: 'ramadan-settings' });
    startInputRow.createEl('label', { text: 'Start date: ' });
    const startInput = startInputRow.createEl('input');
    startInput.type = 'date';
    startInput.value = this.plugin.settings.startDate || '2026-02-17';
    startInput.addEventListener('change', async (e) => {
      this.plugin.settings.startDate = e.target.value;
      await this.plugin.saveSettings();
      this.renderGrid();
    });

    // Progress bar container
    this.progressContainer = this.containerEl.createEl('div', { cls: 'ramadan-progress-container' });
    this.progressBar = this.progressContainer.createEl('div', { cls: 'ramadan-progress-bar' });
    this.progressFill = this.progressBar.createEl('div', { cls: 'ramadan-progress-fill' });
    const moonIcon = this.progressFill.createEl('div', { cls: 'ramadan-progress-icon', text: '☾' });
    this.progressLabel = this.progressContainer.createEl('div', { cls: 'ramadan-progress-label' });

    this.gridEl = this.containerEl.createEl('div', { cls: 'ramadan-grid' });
    this.renderGrid();
  }

  onClose() {
    this.containerEl.empty();
  }

  renderGrid() {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    this.gridEl.empty();
    const startDateStr = this.plugin.settings.startDate || '2026-02-17';
    const base = new Date(startDateStr + 'T00:00:00');

    for (let i = 1; i <= 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + (i - 1));

      const day = this.gridEl.createEl('div', { cls: 'ramadan-day' });
      day.setAttr('data-day', String(i));

      const dateStr = months[d.getMonth()] + ' ' + d.getDate();
      day.createEl('div', { cls: 'day-date', text: dateStr });

      // create checkmark element (hidden by default via CSS)
      const check = day.createEl('div', { cls: 'checkmark', text: '\u2713' });
      // create X element (hidden by default)
      const xMark = day.createEl('div', { cls: 'x-mark', text: '✕' });

      // Get the state: 0 = unchecked, 1 = checked (green), 2 = double-checked (red)
      const state = parseInt(this.plugin.settings.dayStates[i]) || 0;
      if (state === 1) {
        day.addClass('checked');
      } else if (state === 2) {
        day.addClass('double-checked');
      }

      day.addEventListener('click', async () => {
        this.plugin.settings.dayStates = this.plugin.settings.dayStates || {};
        const currentState = parseInt(this.plugin.settings.dayStates[i]) || 0;
        const nextState = (currentState + 1) % 3; // Cycle: 0 → 1 → 2 → 0

        if (nextState === 0) {
          delete this.plugin.settings.dayStates[i];
          day.removeClass('checked');
          day.removeClass('double-checked');
        } else if (nextState === 1) {
          this.plugin.settings.dayStates[i] = 1;
          day.removeClass('double-checked');
          day.addClass('checked');
        } else if (nextState === 2) {
          this.plugin.settings.dayStates[i] = 2;
          day.removeClass('checked');
          day.addClass('double-checked');
        }

        await this.plugin.saveSettings();
        this.updateProgress();
      });
    }
    // Update progress bar
    this.updateProgress();
  }

  updateProgress() {
    const dayStates = this.plugin.settings.dayStates || {};
    let checkedCount = 0;
    Object.values(dayStates).forEach(state => {
      if (state === 1 || state === 2) {
        checkedCount++;
      }
    });
    const percentage = (checkedCount / 30) * 100;
    this.progressFill.style.width = percentage + '%';
    this.progressLabel.setText(`${checkedCount} / 30 days`);
  }
}
