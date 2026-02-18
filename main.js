const { Plugin, ItemView } = require('obsidian');

const VIEW_TYPE = 'ramadan-calendar-view';

module.exports = class RamadanPlugin extends Plugin {
  async onload() {
    console.log('Loading Ramadan 2026 Calendar plugin');
    this.settings = Object.assign({ dayStates: {}, startDate: '2026-02-17', location: 'London,UK' }, (await this.loadData()) || {});

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

    // Location input with dropdown
    const locationRow = this.containerEl.createEl('div', { cls: 'ramadan-location-container' });
    locationRow.createEl('label', { text: 'Location: ' });
    
    const inputWrapper = locationRow.createEl('div', { cls: 'ramadan-location-input-wrapper' });
    const locationInput = inputWrapper.createEl('input');
    locationInput.type = 'text';
    locationInput.placeholder = 'Search city...';
    locationInput.value = this.plugin.settings.location || 'London,UK';
    locationInput.classList.add('ramadan-location-input');
    
    const dropdown = inputWrapper.createEl('div', { cls: 'ramadan-location-dropdown' });
    
    // Get all available cities
    const allCities = this.getAllCities();
    
    // Function to show filtered dropdown
    const updateDropdown = () => {
      const query = locationInput.value.toLowerCase();
      dropdown.empty();
      
      if (!query) {
        dropdown.style.display = 'none';
        return;
      }
      
      const filtered = allCities.filter(city => 
        city.toLowerCase().includes(query)
      ).slice(0, 8); // Show max 8 matches
      
      if (filtered.length === 0) {
        dropdown.style.display = 'none';
        return;
      }
      
      dropdown.style.display = 'block';
      filtered.forEach(city => {
        const option = dropdown.createEl('div', { cls: 'ramadan-location-option', text: city });
        option.addEventListener('click', async () => {
          locationInput.value = city;
          this.plugin.settings.location = city;
          await this.plugin.saveSettings();
          dropdown.style.display = 'none';
          this.renderGrid();
        });
      });
    };
    
    locationInput.addEventListener('input', updateDropdown);
    locationInput.addEventListener('focus', updateDropdown);
    locationInput.addEventListener('blur', () => {
      // Delay to allow click on dropdown items
      setTimeout(() => {
        dropdown.style.display = 'none';
      }, 200);
    });

    // Progress bar container
    this.progressContainer = this.containerEl.createEl('div', { cls: 'ramadan-progress-container' });
    this.progressBar = this.progressContainer.createEl('div', { cls: 'ramadan-progress-bar' });
    this.progressFill = this.progressBar.createEl('div', { cls: 'ramadan-progress-fill' });
    const moonIcon = this.progressFill.createEl('div', { cls: 'ramadan-progress-icon' });
    // Use the same SVG as the ribbon icon
    moonIcon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" />
        <path d="M16.5 4.5l.9 2.1L19.5 7l-2.1.4-.9 2.1-.9-2.1L14 7l2.1-.4.9-2.1z" fill="currentColor" />
      </svg>
    `;
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

      // Fetch and display prayer times
      const timeEl = day.createEl('div', { cls: 'day-times', text: 'Loading...' });
      this.fetchPrayerTimes(d).then(times => {
        if (times) {
          timeEl.setText(`${times.sehri} ~ ${times.iftar}`);
        } else {
          timeEl.setText('--');
        }
      }).catch(() => {
        timeEl.setText('--');
      });

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

  getCoordinates(location) {
    // Major city coordinates for Ramadan prayer times
    const cities = {
      // USA
      'new york,usa': { lat: 40.7128, lon: -74.0060 },
      'los angeles,usa': { lat: 34.0522, lon: -118.2437 },
      'chicago,usa': { lat: 41.8781, lon: -87.6298 },
      'houston,usa': { lat: 29.7604, lon: -95.3698 },
      'miami,usa': { lat: 25.7617, lon: -80.1918 },
      'kissimmee,usa': { lat: 28.2906, lon: -81.3866 },
      'denver,usa': { lat: 39.7392, lon: -104.9903 },
      'phoenix,usa': { lat: 33.4484, lon: -112.0742 },
      'san francisco,usa': { lat: 37.7749, lon: -122.4194 },
      'seattle,usa': { lat: 47.6062, lon: -122.3321 },
      'dallas,usa': { lat: 32.7767, lon: -96.7970 },
      // Canada
      'toronto,canada': { lat: 43.6532, lon: -79.3832 },
      'vancouver,canada': { lat: 49.2827, lon: -123.1207 },
      'montreal,canada': { lat: 45.5017, lon: -73.5673 },
      // UK & Ireland
      'london,uk': { lat: 51.5074, lon: -0.1278 },
      'dublin,ireland': { lat: 53.3498, lon: -6.2603 },
      // Europe
      'paris,france': { lat: 48.8566, lon: 2.3522 },
      'berlin,germany': { lat: 52.5200, lon: 13.4050 },
      'madrid,spain': { lat: 40.4168, lon: -3.7038 },
      'rome,italy': { lat: 41.9028, lon: 12.4964 },
      'amsterdam,netherlands': { lat: 52.3676, lon: 4.9041 },
      // Middle East
      'dubai,uae': { lat: 25.2048, lon: 55.2708 },
      'abu dhabi,uae': { lat: 24.4539, lon: 54.3773 },
      'doha,qatar': { lat: 25.2854, lon: 51.5310 },
      'kuwait city,kuwait': { lat: 29.3759, lon: 47.9774 },
      'riyadh,saudi arabia': { lat: 24.7136, lon: 46.6753 },
      'jeddah,saudi arabia': { lat: 21.5433, lon: 39.1727 },
      'medina,saudi arabia': { lat: 24.4672, lon: 39.6028 },
      'mecca,saudi arabia': { lat: 21.4225, lon: 39.8262 },
      'beirut,lebanon': { lat: 33.8886, lon: 35.4955 },
      'baghdad,iraq': { lat: 33.3128, lon: 44.3615 },
      'tehran,iran': { lat: 35.6892, lon: 51.3890 },
      // Egypt
      'cairo,egypt': { lat: 30.0444, lon: 31.2357 },
      'alexandria,egypt': { lat: 31.2001, lon: 29.9187 },
      'giza,egypt': { lat: 30.0131, lon: 31.2089 },
      // Africa
      'lagos,nigeria': { lat: 6.5244, lon: 3.3792 },
      'johannesburg,south africa': { lat: -26.2023, lon: 28.0436 },
      'cape town,south africa': { lat: -33.9249, lon: 18.4241 },
      'nairobi,kenya': { lat: -1.2921, lon: 36.8219 },
      'casablanca,morocco': { lat: 33.5731, lon: -7.5898 },
      // South Asia
      'delhi,india': { lat: 28.6139, lon: 77.2090 },
      'mumbai,india': { lat: 19.0760, lon: 72.8777 },
      'karachi,pakistan': { lat: 24.8607, lon: 67.0011 },
      'lahore,pakistan': { lat: 31.5204, lon: 74.3587 },
      'dhaka,bangladesh': { lat: 23.8103, lon: 90.4125 },
      // Southeast Asia
      'bangkok,thailand': { lat: 13.7563, lon: 100.5018 },
      'jakarta,indonesia': { lat: -6.2088, lon: 106.8456 },
      'singapore,singapore': { lat: 1.3521, lon: 103.8198 },
      'kuala lumpur,malaysia': { lat: 3.1390, lon: 101.6869 },
      'manila,philippines': { lat: 14.5994, lon: 120.9842 },
      'ho chi minh city,vietnam': { lat: 10.8231, lon: 106.6297 },
      // East Asia
      'hong kong': { lat: 22.3193, lon: 114.1694 },
      'tokyo,japan': { lat: 35.6762, lon: 139.6503 },
      'seoul,south korea': { lat: 37.5665, lon: 126.9780 },
      'beijing,china': { lat: 39.9042, lon: 116.4074 },
      'shanghai,china': { lat: 31.2304, lon: 121.4737 },
      // Turkey
      'istanbul,turkey': { lat: 41.0082, lon: 28.9784 },
      // Australia & Pacific
      'sydney,australia': { lat: -33.8688, lon: 151.2093 },
      'melbourne,australia': { lat: -37.8136, lon: 144.9631 },
      'auckland,new zealand': { lat: -37.0882, lon: 174.7765 }
    };

    const key = (location || 'london,uk').toLowerCase().trim();
    return cities[key] || { lat: 51.5074, lon: -0.1278 }; // Default to London
  }

  getAllCities() {
    return [
      // USA
      'New York,USA',
      'Los Angeles,USA',
      'Chicago,USA',
      'Houston,USA',
      'Miami,USA',
      'Kissimmee,USA',
      'Denver,USA',
      'Phoenix,USA',
      'San Francisco,USA',
      'Seattle,USA',
      'Dallas,USA',
      // Canada
      'Toronto,Canada',
      'Vancouver,Canada',
      'Montreal,Canada',
      // UK & Ireland
      'London,UK',
      'Dublin,Ireland',
      // Europe
      'Paris,France',
      'Berlin,Germany',
      'Madrid,Spain',
      'Rome,Italy',
      'Amsterdam,Netherlands',
      // Middle East
      'Dubai,UAE',
      'Abu Dhabi,UAE',
      'Doha,Qatar',
      'Kuwait City,Kuwait',
      'Riyadh,Saudi Arabia',
      'Jeddah,Saudi Arabia',
      'Medina,Saudi Arabia',
      'Mecca,Saudi Arabia',
      'Beirut,Lebanon',
      'Baghdad,Iraq',
      'Tehran,Iran',
      // Egypt
      'Cairo,Egypt',
      'Alexandria,Egypt',
      'Giza,Egypt',
      // Africa
      'Lagos,Nigeria',
      'Johannesburg,South Africa',
      'Cape Town,South Africa',
      'Nairobi,Kenya',
      'Casablanca,Morocco',
      // South Asia
      'Delhi,India',
      'Mumbai,India',
      'Karachi,Pakistan',
      'Lahore,Pakistan',
      'Dhaka,Bangladesh',
      // Southeast Asia
      'Bangkok,Thailand',
      'Jakarta,Indonesia',
      'Singapore,Singapore',
      'Kuala Lumpur,Malaysia',
      'Manila,Philippines',
      'Ho Chi Minh City,Vietnam',
      // East Asia
      'Hong Kong',
      'Tokyo,Japan',
      'Seoul,South Korea',
      'Beijing,China',
      'Shanghai,China',
      // Turkey
      'Istanbul,Turkey',
      // Australia & Pacific
      'Sydney,Australia',
      'Melbourne,Australia',
      'Auckland,New Zealand'
    ];
  }

  async fetchPrayerTimes(date) {
    try {
      // Format date as DD-MM-YYYY for Aladhan API
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${day}-${month}-${year}`;

      // Get coordinates for the location
      const coords = this.getCoordinates(this.plugin.settings.location);

      // Use Aladhan API (reliable, no auth required, CORS-enabled)
      const response = await fetch(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${coords.lat}&longitude=${coords.lon}&method=2`
      );
      
      if (!response.ok) {
        console.warn('Failed to fetch from Aladhan API');
        return null;
      }

      const data = await response.json();
      
      // Extract Sehri (Fajr) and Iftar (Maghrib) times
      if (data && data.data && data.data.timings) {
        const timings = data.data.timings;
        const sehri = timings.Fajr ? this.formatTime(timings.Fajr) : '--';
        const iftar = timings.Maghrib ? this.formatTime(timings.Maghrib) : '--';
        return { sehri, iftar };
      }
      return null;
    } catch (err) {
      console.warn('Error fetching prayer times:', err);
      return null;
    }
  }

  formatTime(timeStr) {
    // Convert time string (HH:MM or HH:MM:SS) to simple HH:MM format
    if (!timeStr) return '--';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
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
