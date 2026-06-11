// Application State
let allCompanies = [];
let filteredCompanies = [];
let currentPage = 1;
const pageSize = 48; // Divisible by 2, 3, and 4 for responsive grids

let currentSortCol = 'name';
let sortAscending = true;

// Dynamic Chart Configurations and Instances
const DEFAULT_CHARTS = [
  {
    id: 'industry',
    feature: 'industry',
    title: 'Top Industries',
    colorScheme: 'gray',
    maxBars: 10,
    sortBy: 'y',
    sortDescending: true,
    instance: null
  },
  {
    id: 'cohort',
    feature: 'founded_year',
    title: 'Startups Funded per Year',
    colorScheme: 'orange',
    maxBars: 23, // Capped at 23 bars by default
    sortBy: 'x',
    sortDescending: false,
    instance: null
  },
  {
    id: 'status',
    feature: 'status',
    title: 'Operating Status',
    colorScheme: 'violet',
    maxBars: 10,
    sortBy: 'y',
    sortDescending: true,
    instance: null
  }
];

let activeCharts = JSON.parse(JSON.stringify(DEFAULT_CHARTS));

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const companyTableBody = document.getElementById('companyTableBody');
const resultsCount = document.getElementById('resultsCount');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const resetChartsBtn = document.getElementById('resetChartsBtn');

// Filters
const searchInput = document.getElementById('searchInput');
const topCompanyCheckbox = document.getElementById('topCompanyCheckbox');
const hiringCheckbox = document.getElementById('hiringCheckbox');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// New Advanced Filters DOM Elements
const foundedMinSelect = document.getElementById('foundedMinSelect');
const foundedMaxSelect = document.getElementById('foundedMaxSelect');

// Custom Multiselect Instances
let countryMultiselect = null;
let teamSizeMultiselect = null;
let industryMultiselect = null;
let batchMultiselect = null;
let statusMultiselect = null;
let ycDealMultiselect = null;
let disclosedFundingMultiselect = null;
let tagsMultiselect = null;

// Modal Elements
const companyDialog = document.getElementById('companyDialog');
const closeDialogBtn = document.getElementById('closeDialogBtn');
const modalLogo = document.getElementById('modalLogo');
const modalName = document.getElementById('modalName');
const modalTopBadge = document.getElementById('modalTopBadge');
const modalOneLiner = document.getElementById('modalOneLiner');
const modalBatchBadge = document.getElementById('modalBatchBadge');
const modalStatusBadge = document.getElementById('modalStatusBadge');
const modalHiringBadge = document.getElementById('modalHiringBadge');
const modalLongDescription = document.getElementById('modalLongDescription');
const modalFormerNamesContainer = document.getElementById('modalFormerNamesContainer');
const modalFormerNames = document.getElementById('modalFormerNames');
const modalWebsiteLink = document.getElementById('modalWebsiteLink');
const modalYcLink = document.getElementById('modalYcLink');

// Modal details
const modalFoundedYear = document.getElementById('modalFoundedYear');
const modalExitYear = document.getElementById('modalExitYear');
const modalYcDeal = document.getElementById('modalYcDeal');
const modalFundingRaised = document.getElementById('modalFundingRaised');
const modalExitValue = document.getElementById('modalExitValue');
const modalTicker = document.getElementById('modalTicker');
const modalAcquiredBy = document.getElementById('modalAcquiredBy');
const modalProfit = document.getElementById('modalProfit');
const modalInvestors = document.getElementById('modalInvestors');
const modalIndustry = document.getElementById('modalIndustry');
const modalTeamSize = document.getElementById('modalTeamSize');
const modalStage = document.getElementById('modalStage');
const modalLocations = document.getElementById('modalLocations');
const modalTags = document.getElementById('modalTags');

// Chart Config Modal Elements & State
let editingChartId = null;
let previewChartInstance = null;
const chartConfigDialog = document.getElementById('chartConfigDialog');
const closeChartConfigBtn = document.getElementById('closeChartConfigBtn');
const cancelChartConfigBtn = document.getElementById('cancelChartConfigBtn');
const saveChartConfigBtn = document.getElementById('saveChartConfigBtn');
const configChartTitle = document.getElementById('configChartTitle');
const configChartFeature = document.getElementById('configChartFeature');
const configChartPalette = document.getElementById('configChartPalette');
const configChartMaxBars = document.getElementById('configChartMaxBars');
const configChartSortBy = document.getElementById('configChartSortBy');
const configChartSortOrder = document.getElementById('configChartSortOrder');

// Helper to format currency values cleanly (e.g. 500000 -> $500K, 1500000000 -> $1.5B)
function formatCurrency(val) {
  if (val === undefined || val === null || val === '') return 'Undisclosed';
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'undisclosed' || val.toLowerCase() === 'n/a') return val;
    const parsed = Number(val);
    if (!isNaN(parsed)) return formatCurrency(parsed);
    return val;
  }
  const num = Number(val);
  if (isNaN(num)) return 'Undisclosed';
  
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(1).replace('.0', '') + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(0) + 'K';
  return '$' + num.toLocaleString();
}

// Parse country from YC location text
function getCountryFromLocation(loc) {
  if (!loc) return '';
  // Take first location in list (delimited by semicolon)
  const primaryLoc = loc.split(';')[0].trim();
  const parts = primaryLoc.split(',');
  if (parts.length > 0) {
    const country = parts[parts.length - 1].trim();
    // Normalize abbreviations
    if (country === 'USA' || country === 'US' || country === 'United States') return 'United States';
    if (country === 'UK') return 'United Kingdom';
    return country;
  }
  return '';
}

// Cookie Persistence Helpers
function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = name + "=" + encodeURIComponent(JSON.stringify(value)) + ";" + expires + ";path=/;SameSite=Strict";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      try {
        return JSON.parse(decodeURIComponent(c.substring(nameEQ.length, c.length)));
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

function deleteCookie(name) {
  document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;SameSite=Strict";
}

// Filter State Persistence
function saveFiltersToCookie() {
  const filtersState = {
    search: searchInput.value,
    foundedMin: foundedMinSelect.value,
    foundedMax: foundedMaxSelect.value,
    country: countryMultiselect ? countryMultiselect.getSelectedValues() : [],
    teamSize: teamSizeMultiselect ? teamSizeMultiselect.getSelectedValues() : [],
    industry: industryMultiselect ? industryMultiselect.getSelectedValues() : [],
    batch: batchMultiselect ? batchMultiselect.getSelectedValues() : [],
    status: statusMultiselect ? statusMultiselect.getSelectedValues() : [],
    ycDeal: ycDealMultiselect ? ycDealMultiselect.getSelectedValues() : [],
    disclosedFunding: disclosedFundingMultiselect ? disclosedFundingMultiselect.getSelectedValues() : [],
    tags: tagsMultiselect ? tagsMultiselect.getSelectedValues() : [],
    topCompany: topCompanyCheckbox.checked,
    hiring: hiringCheckbox.checked,
    currentSortCol: currentSortCol,
    sortAscending: sortAscending
  };
  setCookie('yc_explorer_filters', filtersState);
}

function loadFiltersFromCookie() {
  const filtersState = getCookie('yc_explorer_filters');
  if (!filtersState) return;

  if (filtersState.search !== undefined) searchInput.value = filtersState.search;
  if (filtersState.foundedMin !== undefined) foundedMinSelect.value = filtersState.foundedMin;
  if (filtersState.foundedMax !== undefined) foundedMaxSelect.value = filtersState.foundedMax;
  
  if (countryMultiselect && filtersState.country) countryMultiselect.setSelectedValues(filtersState.country);
  if (teamSizeMultiselect && filtersState.teamSize) teamSizeMultiselect.setSelectedValues(filtersState.teamSize);
  if (industryMultiselect && filtersState.industry) industryMultiselect.setSelectedValues(filtersState.industry);
  if (batchMultiselect && filtersState.batch) batchMultiselect.setSelectedValues(filtersState.batch);
  if (statusMultiselect && filtersState.status) statusMultiselect.setSelectedValues(filtersState.status);
  if (ycDealMultiselect && filtersState.ycDeal) ycDealMultiselect.setSelectedValues(filtersState.ycDeal);
  if (disclosedFundingMultiselect && filtersState.disclosedFunding) disclosedFundingMultiselect.setSelectedValues(filtersState.disclosedFunding);
  if (tagsMultiselect && filtersState.tags) tagsMultiselect.setSelectedValues(filtersState.tags);
  
  if (filtersState.topCompany !== undefined) topCompanyCheckbox.checked = filtersState.topCompany;
  if (filtersState.hiring !== undefined) hiringCheckbox.checked = filtersState.hiring;
  
  if (filtersState.currentSortCol !== undefined) currentSortCol = filtersState.currentSortCol;
  if (filtersState.sortAscending !== undefined) sortAscending = filtersState.sortAscending;

  // Restore active sorting header class
  document.querySelectorAll('.dense-table th').forEach(th => th.classList.remove('active-sort'));
  if (currentSortCol) {
    const activeTh = document.querySelector(`.dense-table th[data-sort="${currentSortCol}"]`);
    if (activeTh) activeTh.classList.add('active-sort');
  }
}

// Chart Layout State Persistence
function saveChartsToCookie() {
  const chartsState = activeCharts.map(c => ({
    id: c.id,
    feature: c.feature,
    title: c.title,
    colorScheme: c.colorScheme,
    maxBars: c.maxBars,
    sortBy: c.sortBy,
    sortDescending: c.sortDescending
  }));
  setCookie('yc_explorer_charts', chartsState);
}

function loadChartsFromCookie() {
  const chartsState = getCookie('yc_explorer_charts');
  if (chartsState && Array.isArray(chartsState)) {
    activeCharts = chartsState.map(c => ({
      ...c,
      instance: null
    }));
  }
}

// Init App
document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    // Fetch enriched minified dataset
    const response = await fetch('yc_startups_min.json');
    if (!response.ok) throw new Error('Failed to load enriched dataset');
    allCompanies = await response.json();
    
    // Default sorting (A-Z)
    sortCompanies(allCompanies, 'name_asc');
    
    // Initialize Custom Multiselects
    countryMultiselect = initMultiselect('countryMultiselect', 'All Countries', applyFiltersAndSearch);
    teamSizeMultiselect = initMultiselect('teamSizeMultiselect', 'All Sizes', applyFiltersAndSearch);
    industryMultiselect = initMultiselect('industryMultiselect', 'All Industries', applyFiltersAndSearch);
    batchMultiselect = initMultiselect('batchMultiselect', 'All Batches', applyFiltersAndSearch);
    statusMultiselect = initMultiselect('statusMultiselect', 'All Statuses', applyFiltersAndSearch);
    ycDealMultiselect = initMultiselect('ycDealMultiselect', 'Any YC Deal', applyFiltersAndSearch);
    disclosedFundingMultiselect = initMultiselect('disclosedFundingMultiselect', 'All Startups', applyFiltersAndSearch);
    tagsMultiselect = initMultiselect('tagsMultiselect', 'All Tags', applyFiltersAndSearch);

    // Initialize Filters
    populateFilterSelects(allCompanies);
    populateFeatureSelect();
    
    // Restore states from cookies
    loadFiltersFromCookie();
    loadChartsFromCookie();
    
    // Initialize dynamic charts grid structure
    initChartsGrid();
    
    // Set initial listings
    filteredCompanies = [...allCompanies];
    applyFiltersAndSearch();
    
    // Event Listeners
    setupEventListeners();
    
    // Initialize custom tooltip logic
    initCustomTooltip();
    
    // Hide Loader
    loadingOverlay.classList.add('hidden');
  } catch (error) {
    console.error('Initialization Error:', error);
    loadingOverlay.innerHTML = `
      <div class="loader-content">
        <h1 style="color: var(--primary);">Error Loading Dataset</h1>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="window.location.reload()" style="margin-top: 15px;">Retry</button>
      </div>
    `;
  }
}

// Event Listeners Setup
function setupEventListeners() {
  let debounceTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(applyFiltersAndSearch, 150);
  });
  
  [foundedMinSelect, foundedMaxSelect].forEach(select => {
    select.addEventListener('change', applyFiltersAndSearch);
  });
  
  [topCompanyCheckbox, hiringCheckbox].forEach(cb => {
    cb.addEventListener('change', applyFiltersAndSearch);
  });

  // Close multiselect dropdown panels when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-multiselect').forEach(m => m.classList.remove('open'));
  });
  
  resetChartsBtn.addEventListener('click', () => {
    // Clear cookies for charts
    deleteCookie('yc_explorer_charts');
    // Restore default activeCharts
    activeCharts = JSON.parse(JSON.stringify(DEFAULT_CHARTS));
    // Re-initialize and render
    initChartsGrid();
    applyFiltersAndSearch();
  });
  
  resetFiltersBtn.addEventListener('click', resetFilters);
  
  loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    renderCompanies(true);
  });
  
  closeDialogBtn.addEventListener('click', () => companyDialog.close());
  
  companyDialog.addEventListener('click', (e) => {
    const rect = companyDialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      companyDialog.close();
    }
  });

  // Chart Config Dialog listeners
  closeChartConfigBtn.addEventListener('click', () => chartConfigDialog.close());
  cancelChartConfigBtn.addEventListener('click', () => chartConfigDialog.close());
  
  chartConfigDialog.addEventListener('click', (e) => {
    const rect = chartConfigDialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      chartConfigDialog.close();
    }
  });

  // Keep track of change events to update the Live Preview Chart
  configChartTitle.addEventListener('input', updatePreviewChart);
  configChartPalette.addEventListener('change', updatePreviewChart);
  configChartMaxBars.addEventListener('input', updatePreviewChart);
  configChartSortBy.addEventListener('change', updatePreviewChart);
  configChartSortOrder.addEventListener('change', updatePreviewChart);

  // Automatically update the chart title to match the selected feature's default title
  configChartFeature.addEventListener('change', () => {
    const featureTitles = {
      industry: 'Top Industries',
      founded_year: 'Startups Funded per Year',
      status: 'Operating Status',
      batch: 'YC Batch',
      batch_year: 'YC Batch (Year)',
      team_size: 'Team Size Bracket',
      all_locations: 'Top Countries'
    };
    
    const mapped = featureTitles[configChartFeature.value];
    if (mapped) {
      configChartTitle.value = mapped;
    } else if (configChartFeature.selectedIndex !== -1) {
      configChartTitle.value = configChartFeature.options[configChartFeature.selectedIndex].text;
    } else {
      configChartTitle.value = 'New Chart';
    }

    if (configChartFeature.value.includes('year')) {
      configChartMaxBars.value = 23;
    } else {
      configChartMaxBars.value = 10;
    }

    updatePreviewChart();
  });

  // Create or Edit Config action (distinct behaviors)
  saveChartConfigBtn.addEventListener('click', () => {
    const titleVal = configChartTitle.value.trim() || 'New Chart';
    const featureVal = configChartFeature.value;
    const paletteVal = configChartPalette.value;
    const maxBarsVal = parseInt(configChartMaxBars.value, 10) || 10;
    const sortByVal = configChartSortBy.value;
    const sortDescendingVal = configChartSortOrder.checked;

    if (editingChartId === null) {
      // Create mode
      const newId = 'chart-' + Date.now();
      const newChart = {
        id: newId,
        title: titleVal,
        feature: featureVal,
        colorScheme: paletteVal,
        maxBars: maxBarsVal,
        sortBy: sortByVal,
        sortDescending: sortDescendingVal,
        instance: null
      };
      activeCharts.push(newChart);
      initChartsGrid();
      saveChartsToCookie();
      applyFiltersAndSearch();
    } else {
      // Edit mode
      const chart = activeCharts.find(c => c.id === editingChartId);
      if (chart) {
        chart.title = titleVal;
        chart.feature = featureVal;
        chart.colorScheme = paletteVal;
        chart.maxBars = maxBarsVal;
        chart.sortBy = sortByVal;
        chart.sortDescending = sortDescendingVal;
        
        initChartsGrid();
        saveChartsToCookie();
        applyFiltersAndSearch();
      }
    }
    chartConfigDialog.close();
  });

  // Table Column Header Click Sorting
  const tableHeaders = document.querySelectorAll('.dense-table th');
  
  tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (!col) return;
      
      if (currentSortCol === col) {
        sortAscending = !sortAscending;
      } else {
        currentSortCol = col;
        sortAscending = true;
      }
      
      // Update visual indicators
      tableHeaders.forEach(h => h.classList.remove('active-sort'));
      th.classList.add('active-sort');
      
      // Sort
      sortTableByColumn(col, sortAscending);
      
      currentPage = 1;
      renderCompanies(false);
      saveFiltersToCookie();
    });
  });
}

// Sort dataset by column clicked (Airtable-style)
function sortTableByColumn(col, ascending) {
  const mult = ascending ? 1 : -1;
  
  if (col === 'name') {
    filteredCompanies.sort((a, b) => mult * (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  } else if (col === 'batch') {
    filteredCompanies.sort((a, b) => {
      const pa = parseBatch(a.batch);
      const pb = parseBatch(b.batch);
      if (pa.year !== pb.year) return mult * (pa.year - pb.year);
      return mult * (pa.seasonVal - pb.seasonVal);
    });
  } else if (col === 'status') {
    filteredCompanies.sort((a, b) => mult * (a.status || '').localeCompare(b.status || '', undefined, { sensitivity: 'base' }));
  } else if (col === 'industry') {
    filteredCompanies.sort((a, b) => mult * (a.industry || '').localeCompare(b.industry || '', undefined, { sensitivity: 'base' }));
  } else if (col === 'yc_deal') {
    filteredCompanies.sort((a, b) => mult * ((a.standard_yc_deal || 0) - (b.standard_yc_deal || 0)));
  } else if (col === 'funding') {
    filteredCompanies.sort((a, b) => {
      const fa = typeof a.other_funding_raised === 'number' ? a.other_funding_raised : 0;
      const fb = typeof b.other_funding_raised === 'number' ? b.other_funding_raised : 0;
      return mult * (fa - fb);
    });
  } else if (col === 'exit') {
    filteredCompanies.sort((a, b) => {
      const ea = typeof a.exit_value === 'number' ? a.exit_value : 0;
      const eb = typeof b.exit_value === 'number' ? b.exit_value : 0;
      return mult * (ea - eb);
    });
  } else if (col === 'founded') {
    filteredCompanies.sort((a, b) => {
      const fa = a.founded_year || 9999;
      const fb = b.founded_year || 9999;
      return mult * (fa - fb);
    });
  } else if (col === 'team') {
    filteredCompanies.sort((a, b) => {
      const ta = a.team_size === undefined || a.team_size === null ? (ascending ? 999999 : -1) : a.team_size;
      const tb = b.team_size === undefined || b.team_size === null ? (ascending ? 999999 : -1) : b.team_size;
      return mult * (ta - tb);
    });
  } else if (col === 'country') {
    filteredCompanies.sort((a, b) => {
      const ca = getCountryFromLocation(a.all_locations) || '';
      const cb = getCountryFromLocation(b.all_locations) || '';
      return mult * ca.localeCompare(cb, undefined, { sensitivity: 'base' });
    });
  }
}

// Custom parser to sort YC batches chronologically (newest first)
function parseBatch(batchStr) {
  if (!batchStr) return { year: 0, seasonVal: 0 };
  const parts = batchStr.split(' ');
  if (parts.length !== 2) return { year: 0, seasonVal: 0 };
  const season = parts[0];
  const year = parseInt(parts[1], 10);
  
  // Chronological order: Winter=1, Spring=2, Summer=3, Fall=4
  let seasonVal = 0;
  if (season === 'Winter') seasonVal = 1;
  else if (season === 'Spring') seasonVal = 2;
  else if (season === 'Summer') seasonVal = 3;
  else if (season === 'Fall') seasonVal = 4;
  
  return { year, seasonVal };
}

// Custom Multiselect Component Helper
function initMultiselect(id, defaultLabel, onChange) {
  const container = document.getElementById(id);
  if (!container) return null;
  const trigger = container.querySelector('.multiselect-trigger');
  const labelSpan = container.querySelector('.multiselect-label');
  const panel = container.querySelector('.multiselect-panel');

  // Toggle open
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close other multiselects first
    document.querySelectorAll('.custom-multiselect').forEach(m => {
      if (m !== container) m.classList.remove('open');
    });
    container.classList.toggle('open');
  });

  // Prevent closing when clicking inside panel
  panel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Update trigger label based on checked checkboxes
  function updateTriggerLabel() {
    const checked = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked'));
    if (checked.length === 0) {
      labelSpan.textContent = defaultLabel;
    } else if (checked.length === 1) {
      labelSpan.textContent = checked[0].parentElement.textContent.trim();
    } else {
      labelSpan.textContent = `${defaultLabel} (${checked.length})`;
    }
  }

  // Bind change listener to checkboxes
  panel.addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
      updateTriggerLabel();
      if (onChange) onChange();
    }
  });

  // Initial update
  updateTriggerLabel();

  return {
    updateLabel: updateTriggerLabel,
    getSelectedValues: () => {
      return Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);
    },
    setSelectedValues: (values) => {
      if (!values || !Array.isArray(values)) return;
      panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = values.includes(cb.value);
      });
      updateTriggerLabel();
    },
    reset: () => {
      panel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      updateTriggerLabel();
    },
    setOptions: (options) => {
      panel.innerHTML = '';
      options.forEach(opt => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const text = typeof opt === 'string' ? opt : opt.text;

        const label = document.createElement('label');
        label.className = 'checkbox-container';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = val;
        
        const span = document.createElement('span');
        span.className = 'checkmark';

        label.appendChild(input);
        label.appendChild(span);
        label.appendChild(document.createTextNode(text));

        panel.appendChild(label);
      });
      updateTriggerLabel();
    }
  };
}

// Populate Dropdown Options
function populateFilterSelects(data) {
  // Industries
  const industries = [...new Set(data.map(c => c.industry).filter(Boolean))].sort();
  industryMultiselect.setOptions(industries);
  
  // Batches
  const batches = [...new Set(data.map(c => c.batch).filter(Boolean))];
  batches.sort((a, b) => {
    const pa = parseBatch(a);
    const pb = parseBatch(b);
    if (pa.year !== pb.year) return pb.year - pa.year;
    return pb.seasonVal - pa.seasonVal;
  });
  batchMultiselect.setOptions(batches);

  // Founded Years (2005 to 2026)
  const years = [...new Set(data.map(c => c.founded_year).filter(Boolean))].sort((a, b) => b - a);
  years.forEach(year => {
    const optMin = document.createElement('option');
    optMin.value = year;
    optMin.textContent = year;
    foundedMinSelect.appendChild(optMin);

    const optMax = document.createElement('option');
    optMax.value = year;
    optMax.textContent = year;
    foundedMaxSelect.appendChild(optMax);
  });

  // Countries
  const countries = new Set();
  data.forEach(c => {
    const country = getCountryFromLocation(c.all_locations);
    if (country) countries.add(country);
  });
  const sortedCountries = [...countries].sort();
  countryMultiselect.setOptions(sortedCountries);

  // Tags
  const tagsSet = new Set();
  data.forEach(c => {
    if (c.tags) {
      c.tags.forEach(t => tagsSet.add(t));
    }
  });
  const sortedTags = [...tagsSet].sort();
  tagsMultiselect.setOptions(sortedTags);
}

// Filtering and Searching
function applyFiltersAndSearch() {
  const query = searchInput.value.toLowerCase().trim();
  const selectedCountries = countryMultiselect ? countryMultiselect.getSelectedValues() : [];
  const selectedSizes = teamSizeMultiselect ? teamSizeMultiselect.getSelectedValues() : [];
  const selectedIndustries = industryMultiselect ? industryMultiselect.getSelectedValues() : [];
  const selectedBatches = batchMultiselect ? batchMultiselect.getSelectedValues() : [];
  const selectedStatuses = statusMultiselect ? statusMultiselect.getSelectedValues() : [];
  const selectedDeals = ycDealMultiselect ? ycDealMultiselect.getSelectedValues().map(Number) : [];
  const selectedFunding = disclosedFundingMultiselect ? disclosedFundingMultiselect.getSelectedValues() : [];
  const selectedTags = tagsMultiselect ? tagsMultiselect.getSelectedValues() : [];
  const isTop = topCompanyCheckbox.checked;
  const isHiring = hiringCheckbox.checked;

  // New Advanced Filters
  const foundedMin = foundedMinSelect.value ? Number(foundedMinSelect.value) : null;
  const foundedMax = foundedMaxSelect.value ? Number(foundedMaxSelect.value) : null;
  
  filteredCompanies = allCompanies.filter(c => {
    // 1. Text Search
    if (query) {
      const name = (c.name || '').toLowerCase();
      const pitch = (c.one_liner || '').toLowerCase();
      const desc = (c.long_description || '').toLowerCase();
      const tags = (c.tags || []).join(' ').toLowerCase();
      const ind = (c.industry || '').toLowerCase();
      const ticker = (c.ticker || '').toLowerCase();
      const investors = (c.investors || '').toLowerCase();
      
      const matchText = name.includes(query) || 
                        pitch.includes(query) || 
                        desc.includes(query) || 
                        tags.includes(query) || 
                        ind.includes(query) ||
                        ticker.includes(query) ||
                        investors.includes(query);
      if (!matchText) return false;
    }
    
    // 2. Multiselect filters
    if (selectedIndustries.length > 0 && !selectedIndustries.includes(c.industry)) return false;
    if (selectedBatches.length > 0 && !selectedBatches.includes(c.batch)) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(c.status)) return false;
    
    if (selectedDeals.length > 0) {
      const deal = c.standard_yc_deal || 0;
      const minThreshold = Math.min(...selectedDeals);
      if (deal < minThreshold) return false;
    }
    
    // 3. Disclosed funding status
    if (selectedFunding.length > 0 && selectedFunding.length < 2) {
      const hasFunding = c.other_funding_raised && c.other_funding_raised !== 'Undisclosed';
      if (selectedFunding.includes('has_funding') && !hasFunding) return false;
      if (selectedFunding.includes('undisclosed') && hasFunding) return false;
    }
    
    // 4. Founded year ranges
    if (foundedMin && (!c.founded_year || c.founded_year < foundedMin)) return false;
    if (foundedMax && (!c.founded_year || c.founded_year > foundedMax)) return false;

    // 5. Country matching
    if (selectedCountries.length > 0) {
      const companyCountry = getCountryFromLocation(c.all_locations);
      if (!selectedCountries.includes(companyCountry)) return false;
    }

    // 6. Team size brackets (multi-select checkboxes)
    if (selectedSizes.length > 0) {
      const size = c.team_size;
      if (size === undefined || size === null || isNaN(size)) return false;
      
      let matchesSize = false;
      if (selectedSizes.includes('1-10') && size >= 1 && size <= 10) matchesSize = true;
      if (selectedSizes.includes('11-50') && size >= 11 && size <= 50) matchesSize = true;
      if (selectedSizes.includes('51-200') && size >= 51 && size <= 200) matchesSize = true;
      if (selectedSizes.includes('201-500') && size >= 201 && size <= 500) matchesSize = true;
      if (selectedSizes.includes('500+') && size >= 501) matchesSize = true;
      
      if (!matchesSize) return false;
    }

    // 6.5. Tags matching (any of the selected tags)
    if (selectedTags.length > 0) {
      const companyTags = c.tags || [];
      const hasMatchingTag = companyTags.some(t => selectedTags.includes(t));
      if (!hasMatchingTag) return false;
    }

    // 7. Checkboxes
    if (isTop && c.top_company !== true) return false;
    if (isHiring && c.isHiring !== true) return false;
    
    return true;
  });
  
  sortTableByColumn(currentSortCol, sortAscending);
  currentPage = 1;
  renderCompanies(false);
  renderCharts(filteredCompanies);
  saveFiltersToCookie();
}

// Reset Filters
function resetFilters() {
  searchInput.value = '';
  foundedMinSelect.value = '';
  foundedMaxSelect.value = '';
  
  if (countryMultiselect) countryMultiselect.reset();
  if (teamSizeMultiselect) teamSizeMultiselect.reset();
  if (industryMultiselect) industryMultiselect.reset();
  if (batchMultiselect) batchMultiselect.reset();
  if (statusMultiselect) statusMultiselect.reset();
  if (ycDealMultiselect) ycDealMultiselect.reset();
  if (disclosedFundingMultiselect) disclosedFundingMultiselect.reset();
  if (tagsMultiselect) tagsMultiselect.reset();
  
  topCompanyCheckbox.checked = false;
  hiringCheckbox.checked = false;
  currentSortCol = 'name';
  sortAscending = true;
  
  // Clear table header sort styling and set default
  document.querySelectorAll('.dense-table th').forEach(th => th.classList.remove('active-sort'));
  const nameTh = document.querySelector('.dense-table th[data-sort="name"]');
  if (nameTh) nameTh.classList.add('active-sort');

  applyFiltersAndSearch();
}

// Comprehensive Sorting options
function sortCompanies(arr, type) {
  if (type === 'name_asc') {
    arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  } else if (type === 'name_desc') {
    arr.sort((a, b) => (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' }));
  } else if (type === 'founded_desc') {
    arr.sort((a, b) => (b.founded_year || 0) - (a.founded_year || 0));
  } else if (type === 'founded_asc') {
    arr.sort((a, b) => {
      const fa = a.founded_year || 9999;
      const fb = b.founded_year || 9999;
      return fa - fb;
    });
  } else if (type === 'team_desc') {
    arr.sort((a, b) => (b.team_size || 0) - (a.team_size || 0));
  } else if (type === 'team_asc') {
    arr.sort((a, b) => {
      const ta = a.team_size === undefined || a.team_size === null ? 999999 : a.team_size;
      const tb = b.team_size === undefined || b.team_size === null ? 999999 : b.team_size;
      return ta - tb;
    });
  } else if (type === 'yc_deal_desc') {
    arr.sort((a, b) => (b.standard_yc_deal || 0) - (a.standard_yc_deal || 0));
  } else if (type === 'yc_deal_asc') {
    arr.sort((a, b) => (a.standard_yc_deal || 0) - (b.standard_yc_deal || 0));
  } else if (type === 'funding_desc') {
    arr.sort((a, b) => {
      const fa = typeof b.other_funding_raised === 'number' ? b.other_funding_raised : 0;
      const fb = typeof a.other_funding_raised === 'number' ? a.other_funding_raised : 0;
      return fa - fb;
    });
  } else if (type === 'exit_desc') {
    arr.sort((a, b) => {
      const ea = typeof b.exit_value === 'number' ? b.exit_value : 0;
      const eb = typeof a.exit_value === 'number' ? a.exit_value : 0;
      return ea - eb;
    });
  }
}

// Render Grid (Table rows)
function renderCompanies(append = false) {
  if (!append) {
    companyTableBody.innerHTML = '';
  }
  
  resultsCount.textContent = `Found ${filteredCompanies.length.toLocaleString()} startups`;
  
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredCompanies.slice(start, end);
  
  if (filteredCompanies.length === 0) {
    companyTableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 48px; color: var(--text-muted);">
          <p style="font-size: 1.1rem; margin-bottom: 8px;">No YC startups match your filters.</p>
          <button class="btn btn-secondary" onclick="document.getElementById('resetFiltersBtn').click()">Clear Filters</button>
        </td>
      </tr>
    `;
    loadMoreBtn.style.display = 'none';
    return;
  }
  
  pageItems.forEach(c => {
    const row = document.createElement('tr');
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `View details for ${c.name}`);
    
    // Status Badge classes
    let statusClass = 'status-active';
    if (c.status === 'Acquired') statusClass = 'status-acquired';
    else if (c.status === 'Public') statusClass = 'status-public';
    else if (c.status === 'Inactive') statusClass = 'status-inactive';
    
    // Extra indicators for name column
    const topBadge = c.top_company ? '<span class="badge top-badge" data-tooltip="Top YC Company">🏆</span>' : '';
    const hiringBadge = c.isHiring ? '<span class="badge hiring-badge" data-tooltip="Actively Hiring">💼</span>' : '';
    const tickerBadge = c.ticker && c.ticker !== 'N/A' ? `<span class="badge ticker-badge" data-tooltip="Public Stock Ticker: ${c.ticker}">📈</span>` : '';
    
    // Normalize country
    const countryVal = getCountryFromLocation(c.all_locations) || 'Remote';
    
    // Formatted currencies
    const ycDeal = formatCurrency(c.standard_yc_deal);
    const extraCapital = c.other_funding_raised && c.other_funding_raised !== 'Undisclosed' ? formatCurrency(c.other_funding_raised) : 'Undisclosed';
    const exitVal = c.exit_value && c.exit_value !== 'Undisclosed' && c.exit_value !== 'N/A' ? formatCurrency(c.exit_value) : 'Undisclosed';
    
    row.innerHTML = `
      <td class="col-name">
        <div class="col-name-cell">
          <img class="table-logo" src="${c.small_logo_thumb_url || ''}" alt="${c.name} logo" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%2327272a%22/><text x=%2250%25%22 y=%2250%25%22 font-family=%22Inter, sans-serif%22 font-weight=%22800%22 font-size=%2220%22 fill=%22%23a1a1aa%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22>?</text></svg>'">
          <span class="col-name-text" data-tooltip="${c.name}">${c.name}</span>
          <div class="table-badge-row">
            ${topBadge}
            ${hiringBadge}
            ${tickerBadge}
          </div>
        </div>
      </td>
      <td class="col-batch">${c.batch || 'Stealth'}</td>
      <td class="col-status"><span class="badge status-badge ${statusClass}">${c.status || 'Active'}</span></td>
      <td class="col-industry dimmed" data-tooltip="${c.industry || 'Unspecified'}">${c.industry || 'Unspecified'}</td>
      <td class="col-yc-deal highlight">${ycDeal}</td>
      <td class="col-extra-capital dimmed">${extraCapital}</td>
      <td class="col-exit-value ${exitVal !== 'Undisclosed' ? 'success' : 'dimmed'}">${exitVal}</td>
      <td class="col-founded dimmed">${c.founded_year ? c.founded_year : 'N/A'}</td>
      <td class="col-team dimmed">${c.team_size ? c.team_size.toLocaleString() : 'N/A'}</td>
      <td class="col-country dimmed" title="${c.all_locations || ''}">${countryVal}</td>
    `;
    
    const triggerDialog = () => openCompanyModal(c);
    row.addEventListener('click', triggerDialog);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerDialog();
      }
    });
    
    companyTableBody.appendChild(row);
  });
  
  if (end >= filteredCompanies.length) {
    loadMoreBtn.style.display = 'none';
  } else {
    loadMoreBtn.style.display = 'inline-flex';
  }
}

// Open Dialog
function openCompanyModal(c) {
  modalLogo.src = c.small_logo_thumb_url || '';
  modalLogo.alt = `${c.name} logo`;
  modalName.textContent = c.name;
  
  modalTopBadge.style.display = c.top_company ? 'inline-block' : 'none';
  modalOneLiner.textContent = c.one_liner || '';
  modalBatchBadge.textContent = c.batch || 'Stealth';
  
  modalStatusBadge.textContent = c.status || 'Active';
  modalStatusBadge.className = 'badge status-badge';
  if (c.status === 'Active') modalStatusBadge.classList.add('status-active');
  else if (c.status === 'Acquired') modalStatusBadge.classList.add('status-acquired');
  else if (c.status === 'Public') modalStatusBadge.classList.add('status-public');
  else if (c.status === 'Inactive') modalStatusBadge.classList.add('status-inactive');
  
  modalHiringBadge.style.display = c.isHiring ? 'inline-block' : 'none';
  modalLongDescription.textContent = c.long_description || 'No detailed description available.';
  
  if (c.former_names && c.former_names.length > 0) {
    modalFormerNamesContainer.style.display = 'block';
    modalFormerNames.textContent = c.former_names.join(', ');
  } else {
    modalFormerNamesContainer.style.display = 'none';
  }
  
  modalWebsiteLink.href = c.website || '#';
  modalWebsiteLink.style.display = c.website ? 'inline-flex' : 'none';
  modalYcLink.href = c.url || '#';
  modalYcLink.style.display = c.url ? 'inline-flex' : 'none';
  
  // Financial Profiles
  modalFoundedYear.textContent = c.founded_year || 'Unknown';
  modalExitYear.textContent = c.exit_year || 'N/A';
  modalYcDeal.textContent = formatCurrency(c.standard_yc_deal);
  modalFundingRaised.textContent = formatCurrency(c.other_funding_raised);
  modalExitValue.textContent = formatCurrency(c.exit_value);
  modalTicker.textContent = c.ticker || 'N/A';
  modalAcquiredBy.textContent = c.acquired_by || 'N/A';
  modalProfit.textContent = c.profit || 'Undisclosed';
  modalInvestors.textContent = c.investors || 'Undisclosed';
  
  // Details
  modalIndustry.textContent = c.industry || 'Unspecified';
  modalTeamSize.textContent = c.team_size ? `${c.team_size} employees` : 'Not disclosed';
  modalStage.textContent = c.stage || 'Unknown';
  modalLocations.textContent = c.all_locations || 'Remote';
  
  // Tags
  modalTags.innerHTML = '';
  if (c.tags && c.tags.length > 0) {
    c.tags.forEach(t => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = t;
      modalTags.appendChild(span);
    });
  } else {
    modalTags.innerHTML = '<span class="text-dim">No tags available</span>';
  }
  
  companyDialog.showModal();
  
  // Reset scroll position after dialog is shown and focused
  const dialogBody = document.querySelector('.dialog-body');
  if (dialogBody) {
    dialogBody.scrollTop = 0;
  }
}

// Helpers for dynamic chart color generation (single solid base colors)
function getColorsForChart(labels, fullLabels, colorScheme) {
  const palettes = {
    gray: 'rgba(148, 163, 184, 0.85)',
    orange: 'rgba(234, 88, 12, 0.85)',
    violet: 'rgba(139, 92, 246, 0.85)',
    green: 'rgba(16, 185, 129, 0.85)',
    blue: 'rgba(14, 165, 233, 0.85)',
    red: 'rgba(244, 63, 94, 0.85)',
    amber: 'rgba(245, 158, 11, 0.85)'
  };
  
  const scheme = colorScheme === 'slate' ? 'gray' : colorScheme;
  return palettes[scheme] || palettes.gray;
}

// Bin company records into labels, fullLabels, and values for histograms (with dynamic capping and 9-char ellipsis labels)
function getChartData(companies, feature, colorScheme, maxBars = 10, sortBy = 'y', sortDescending = true) {
  let labels = [];
  let fullLabels = [];
  let values = [];
  
  // Detect base type of the field across companies
  let detectedType = 'string';
  const sampleCompany = companies.find(c => c[feature] !== undefined && c[feature] !== null);
  if (sampleCompany) {
    const val = sampleCompany[feature];
    if (Array.isArray(val)) {
      detectedType = 'array';
    } else if (typeof val === 'number') {
      detectedType = 'number';
    } else if (typeof val === 'boolean') {
      detectedType = 'boolean';
    }
  }

  let totalUniqueCount = 0;
  let isCapped = false;
  const counts = {};

  companies.forEach(c => {
    let val = c[feature];
    if (feature === 'country' || feature === 'all_locations') {
      detectedType = 'string';
      val = getCountryFromLocation(c.all_locations) || 'Remote';
    } else if (feature === 'batch_year') {
      detectedType = 'number';
      const p = parseBatch(c.batch);
      val = (p.year >= 2005 && p.year <= 2026) ? p.year : null;
    } else if (feature === 'team_size') {
      detectedType = 'string';
      const size = c.team_size;
      if (size !== undefined && size !== null && !isNaN(size)) {
        if (size >= 1 && size <= 10) val = '1-10';
        else if (size >= 11 && size <= 50) val = '11-50';
        else if (size >= 51 && size <= 200) val = '51-200';
        else if (size >= 201 && size <= 500) val = '201-500';
        else if (size >= 501) val = '500+';
      } else {
        val = null;
      }
    } else if (feature === 'founded_year') {
      detectedType = 'number';
      val = (c.founded_year >= 2005 && c.founded_year <= 2026) ? c.founded_year : null;
    }

    // Skip empty, null, undefined, or blank values entirely
    if (val === undefined || val === null || val === '' || String(val).trim() === '') {
      return;
    }

    if (Array.isArray(val)) {
      val.forEach(item => {
        const itemStr = String(item).trim();
        if (itemStr !== '') {
          counts[itemStr] = (counts[itemStr] || 0) + 1;
        }
      });
    } else {
      const valStr = String(val).trim();
      if (valStr !== '') {
        counts[valStr] = (counts[valStr] || 0) + 1;
      }
    }
  });

  // 1. Sort all unique values before capping
  let sorted = Object.entries(counts);
  if (sorted.length === 0) {
    throw new Error(`No plotable data found for feature "${feature}"`);
  }

  if (sortBy === 'x') {
    sorted.sort((a, b) => {
      const valA = a[0];
      const valB = b[0];
      // Numeric check for years
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDescending ? (numB - numA) : (numA - numB);
      }
      return sortDescending 
        ? valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' })
        : valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    });
  } else {
    // Sort by Y-axis (Frequency / Count)
    sorted.sort((a, b) => sortDescending ? (b[1] - a[1]) : (a[1] - b[1]));
  }
  
  totalUniqueCount = sorted.length;
  let binned = sorted;
  let hasOther = false;
  let otherSum = 0;
  
  if (totalUniqueCount > maxBars) {
    isCapped = true;
    binned = sorted.slice(0, maxBars);
    otherSum = sorted.slice(maxBars).reduce((sum, x) => sum + x[1], 0);
    hasOther = true;
  }

  // 3. Append 'Other' at the end if capped
  if (hasOther) {
    binned.push(['Other', otherSum]);
  }

  // Capping labels to 9 symbols and an ellipsis (if label is longer than 9 symbols)
  function formatLabel(label) {
    if (label === 'Other') return 'Other';
    const labelStr = String(label);
    if (labelStr.length > 9) {
      return labelStr.slice(0, 9) + '...';
    }
    return labelStr;
  }

  fullLabels = binned.map(x => x[0]);
  labels = binned.map(x => formatLabel(x[0]));
  values = binned.map(x => x[1]);

  const backgroundColors = getColorsForChart(labels, fullLabels, colorScheme);
  
  return {
    labels,
    fullLabels,
    values,
    backgroundColors,
    meta: {
      isCapped,
      uniqueCount: totalUniqueCount,
      fieldType: detectedType
    }
  };
}

// Open chart config modal and populate options (Create vs Edit modes)
function openChartConfigModal(chartId) {
  const modalHeaderTitle = document.getElementById('chartConfigHeaderTitle');
  
  if (chartId === null) {
    // Create Mode
    editingChartId = null;
    if (modalHeaderTitle) modalHeaderTitle.textContent = 'Create New Chart';
    if (saveChartConfigBtn) saveChartConfigBtn.textContent = 'Create Chart';
    
    configChartTitle.value = 'Top Industries';
    configChartFeature.value = 'industry';
    configChartPalette.value = 'gray';
    configChartMaxBars.value = 10;
    configChartSortBy.value = 'y';
    configChartSortOrder.checked = true;
  } else {
    // Edit Mode
    const chart = activeCharts.find(c => c.id === chartId);
    if (!chart) return;
    
    editingChartId = chartId;
    if (modalHeaderTitle) modalHeaderTitle.textContent = 'Edit Chart Settings';
    if (saveChartConfigBtn) saveChartConfigBtn.textContent = 'Apply Changes';
    
    configChartTitle.value = chart.title;
    configChartFeature.value = chart.feature;
    configChartPalette.value = chart.colorScheme === 'slate' ? 'gray' : chart.colorScheme;
    configChartMaxBars.value = chart.maxBars || 10;
    configChartSortBy.value = chart.sortBy || 'y';
    configChartSortOrder.checked = chart.sortDescending !== false;
  }
  
  // Update preview immediately
  updatePreviewChart();
  
  chartConfigDialog.showModal();
}

// Rebuild grid cards and setup Chart instances dynamically (with HTML5 Drag and Drop)
function initChartsGrid() {
  const gridContainer = document.getElementById('analyticsGrid');
  if (!gridContainer) return;
  
  // Destroy existing Chart.js instances to avoid memory leaks
  activeCharts.forEach(c => {
    if (c.instance) {
      c.instance.destroy();
      c.instance = null;
    }
  });
  
  gridContainer.innerHTML = '';
  
  activeCharts.forEach(chart => {
    const card = document.createElement('div');
    card.className = 'chart-container glass-panel';
    card.setAttribute('data-chart-id', chart.id);
    card.setAttribute('draggable', 'true');
    
    card.innerHTML = `
      <div class="chart-header">
        <h3 class="chart-card-title" data-chart-id="${chart.id}">${chart.title}</h3>
        <div class="chart-header-actions">
          <button class="chart-edit-btn" data-chart-id="${chart.id}" aria-label="Edit Chart Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; display: block;">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="chart-close-btn" data-chart-id="${chart.id}" aria-label="Delete Chart">&times;</button>
        </div>
      </div>

      <div class="chart-wrapper">
        <canvas id="canvas-${chart.id}"></canvas>
      </div>
    `;
    
    gridContainer.appendChild(card);
    
    const ctx = document.getElementById(`canvas-${chart.id}`).getContext('2d');
    chart.instance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderColor: 'rgba(255,255,255,0.03)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 11 },
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: 'hsl(215,12%,65%)',
              font: { family: 'Inter', size: 9 },
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { 
              color: 'hsl(215,12%,65%)', 
              font: { family: 'Inter', size: 9 },
              precision: 0
            }
          }
        }
      }
    });
  });
  
  // Add "+ Add Chart" card
  const addCard = document.createElement('div');
  addCard.className = 'chart-container glass-panel add-chart-placeholder';
  addCard.innerHTML = `
    <button class="add-chart-btn" id="addChartBtn" aria-label="Add new chart">
      <span class="plus-icon">+</span>
      <span class="add-text">Add Chart</span>
    </button>
  `;
  gridContainer.appendChild(addCard);
  
  setupChartGridEventListeners(gridContainer);
}

// Bind interactive event handlers to the custom chart card controls (including HTML5 drag-and-drop reordering)
function setupChartGridEventListeners(gridContainer) {
  const addBtn = gridContainer.querySelector('#addChartBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openChartConfigModal(null);
    });
  }


  
  gridContainer.querySelectorAll('.chart-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const chartId = btn.getAttribute('data-chart-id');
      const idx = activeCharts.findIndex(c => c.id === chartId);
      if (idx !== -1) {
        if (activeCharts[idx].instance) {
          activeCharts[idx].instance.destroy();
        }
        activeCharts.splice(idx, 1);
        initChartsGrid();
        saveChartsToCookie();
        applyFiltersAndSearch();
      }
    });
  });

  gridContainer.querySelectorAll('.chart-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const chartId = btn.getAttribute('data-chart-id');
      openChartConfigModal(chartId);
    });
  });

  // Setup HTML5 Drag and Drop reordering on chart-containers
  const cards = gridContainer.querySelectorAll('.chart-container:not(.add-chart-placeholder)');
  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      const chartId = card.getAttribute('data-chart-id');
      e.dataTransfer.setData('text/plain', chartId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      gridContainer.querySelectorAll('.chart-container').forEach(c => c.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragenter', (e) => {
      e.preventDefault();
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const srcId = e.dataTransfer.getData('text/plain');
      const targetId = card.getAttribute('data-chart-id');
      
      if (srcId && targetId && srcId !== targetId) {
        const srcIdx = activeCharts.findIndex(c => c.id === srcId);
        const targetIdx = activeCharts.findIndex(c => c.id === targetId);
        
        if (srcIdx !== -1 && targetIdx !== -1) {
          const [dragged] = activeCharts.splice(srcIdx, 1);
          activeCharts.splice(targetIdx, 0, dragged);
          initChartsGrid();
          saveChartsToCookie();
          applyFiltersAndSearch();
        }
      }
    });
  });
}

// Redraw charts with filtered data smoothly (includes robust error boundaries per card)
function renderCharts(data) {
  activeCharts.forEach(chart => {
    if (!chart.instance) return;
    
    const container = document.querySelector(`.chart-container[data-chart-id="${chart.id}"]`);
    if (!container) return;
    
    const wrapper = container.querySelector('.chart-wrapper');
    const canvas = container.querySelector('canvas');
    
    // Clear any previous error states
    const existingError = container.querySelector('.chart-error-state');
    if (existingError) {
      existingError.remove();
    }
    if (canvas) {
      canvas.style.display = 'block';
    }
    
    try {
      const chartData = getChartData(data, chart.feature, chart.colorScheme, chart.maxBars || 10, chart.sortBy || 'y', chart.sortDescending !== false);
      
      if (!chartData.labels || chartData.labels.length === 0) {
        throw new Error(`No plotable data found for feature "${chart.feature}"`);
      }
      
      chart.instance.data.labels = chartData.labels;
      chart.instance.data.datasets[0].data = chartData.values;
      chart.instance.data.datasets[0].backgroundColor = chartData.backgroundColors;
      chart.instance.data.datasets[0].label = chart.title;
      
      chart.instance.options.plugins.tooltip.callbacks.title = function(tooltipItems) {
        const idx = tooltipItems[0].dataIndex;
        return chartData.fullLabels[idx] || tooltipItems[0].label;
      };
      
      chart.instance.update();
    } catch (err) {
      console.error(`Error rendering chart "${chart.id}":`, err);
      if (canvas) {
        canvas.style.display = 'none';
      }
      
      const errDiv = document.createElement('div');
      errDiv.className = 'chart-error-state';
      errDiv.innerHTML = `
        <span class="error-icon">⚠️</span>
        <div class="error-message">Cannot plot feature: ${err.message}</div>
      `;
      if (wrapper) {
        wrapper.appendChild(errDiv);
      }
    }
  });
}

// Dynamically discover all attributes in the startup dataset and populate the Plot dropdown
function populateFeatureSelect() {
  const select = document.getElementById('configChartFeature');
  if (!select) return;
  select.innerHTML = '';
  
  const commonFields = [
    { value: 'industry', text: 'Industry' },
    { value: 'founded_year', text: 'Founded Year' },
    { value: 'status', text: 'Operating Status' },
    { value: 'batch', text: 'YC Batch' },
    { value: 'batch_year', text: 'YC Batch (Year)' },
    { value: 'team_size', text: 'Team Size' },
    { value: 'all_locations', text: 'Country / Location' },
    { value: 'standard_yc_deal', text: 'YC Seed Check' },
    { value: 'other_funding_raised', text: 'Disclosed Funding' },
    { value: 'exit_value', text: 'Exit Valuation' },
    { value: 'top_company', text: 'Top YC Company Flag' },
    { value: 'isHiring', text: 'Hiring Flag' },
    { value: 'ticker', text: 'Stock Ticker' },
    { value: 'exit_year', text: 'Exit Year' },
    { value: 'acquired_by', text: 'Acquired By' },
    { value: 'profit', text: 'Profitability Stage' },
    { value: 'investors', text: 'Lead Investors' },
    { value: 'stage', text: 'Growth Stage' }
  ];
  
  const processedKeys = new Set(commonFields.map(f => f.value));
  const otherKeys = [];
  
  if (allCompanies && allCompanies.length > 0) {
    allCompanies.forEach(c => {
      Object.keys(c).forEach(k => {
        if (!processedKeys.has(k) && !['small_logo_thumb_url', 'url', 'website', 'long_description', 'former_names', 'id'].includes(k)) {
          processedKeys.add(k);
          const label = k.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          otherKeys.push({ value: k, text: label });
        }
      });
    });
  }
  
  otherKeys.sort((a, b) => a.text.localeCompare(b.text));
  const allFields = [...commonFields, ...otherKeys];
  
  allFields.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.value;
    opt.textContent = f.text;
    select.appendChild(opt);
  });
}

// Live Preview rendering inside the configuration dialog (includes dynamic error feedback)
function updatePreviewChart() {
  const title = configChartTitle.value.trim() || 'Chart Preview';
  const feature = configChartFeature.value;
  const palette = configChartPalette.value;
  const maxBars = parseInt(configChartMaxBars.value, 10) || 10;
  const sortBy = configChartSortBy.value;
  const sortDescending = configChartSortOrder.checked;
  
  const previewTitleEl = document.getElementById('previewChartTitle');
  if (previewTitleEl) {
    previewTitleEl.textContent = title;
  }
  
  const errorBanner = document.getElementById('configChartError');
  const errorTextEl = document.getElementById('configChartErrorText');
  const saveBtn = document.getElementById('saveChartConfigBtn');
  
  try {
    const chartData = getChartData(filteredCompanies, feature, palette, maxBars, sortBy, sortDescending);
    
    if (!chartData.labels || chartData.labels.length === 0) {
      throw new Error(`No plotable data found for feature "${feature}"`);
    }
    
    if (errorBanner) errorBanner.style.display = 'none';
    if (saveBtn) saveBtn.disabled = false;
    
    // Field type & unique values banner
    const infoBanner = document.getElementById('configChartInfo');
    const infoTextEl = document.getElementById('configChartInfoText');
    if (infoBanner && infoTextEl) {
      const typeMapping = {
        'string': 'Text',
        'number': 'Number',
        'boolean': 'Boolean',
        'array': 'List/Array'
      };
      const friendlyType = typeMapping[chartData.meta.fieldType] || chartData.meta.fieldType;
      
      if (chartData.meta.isCapped) {
        infoBanner.style.display = 'flex';
        infoTextEl.textContent = `This chart is capped because the field has ${chartData.meta.uniqueCount} unique values (Type: ${friendlyType}). The top ${maxBars} are plotted individually; the remainder is grouped under "Other".`;
      } else {
        infoBanner.style.display = 'flex';
        infoTextEl.textContent = `Field "${feature}" (Type: ${friendlyType}) contains ${chartData.meta.uniqueCount} unique values.`;
      }
    }
    
    const ctx = document.getElementById('previewChartCanvas').getContext('2d');
    if (previewChartInstance) {
      previewChartInstance.data.labels = chartData.labels;
      previewChartInstance.data.datasets[0].data = chartData.values;
      previewChartInstance.data.datasets[0].backgroundColor = chartData.backgroundColors;
      previewChartInstance.data.datasets[0].label = title;
      previewChartInstance.options.plugins.tooltip.callbacks.title = function(tooltipItems) {
        const idx = tooltipItems[0].dataIndex;
        return chartData.fullLabels[idx] || tooltipItems[0].label;
      };
      previewChartInstance.update();
    } else {
      previewChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartData.labels,
          datasets: [{
            data: chartData.values,
            backgroundColor: chartData.backgroundColors,
            borderColor: 'rgba(255,255,255,0.03)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              titleFont: { family: 'Inter', size: 12, weight: 'bold' },
              bodyFont: { family: 'Inter', size: 11 },
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              padding: 10
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: 'hsl(215,12%,65%)',
                font: { family: 'Inter', size: 9 },
                maxRotation: 45,
                minRotation: 45
              }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { 
                color: 'hsl(215,12%,65%)', 
                font: { family: 'Inter', size: 9 },
                precision: 0
              }
            }
          }
        }
      });
    }
  } catch (err) {
    console.error('Preview error:', err);
    const infoBanner = document.getElementById('configChartInfo');
    if (infoBanner) infoBanner.style.display = 'none';
    
    if (errorBanner) {
      errorBanner.style.display = 'flex';
      errorTextEl.textContent = `Cannot plot feature: ${err.message}`;
    }
    if (saveBtn) saveBtn.disabled = true;
    
    if (previewChartInstance) {
      previewChartInstance.destroy();
      previewChartInstance = null;
    }
  }
}

// Global Custom Tooltip System for instant hovers
function initCustomTooltip() {
  const tooltip = document.createElement('div');
  tooltip.id = 'app-custom-tooltip';
  tooltip.className = 'custom-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    const text = target.getAttribute('data-tooltip');
    if (!text) return;

    // Check if it's a badge (we always show tooltips for badges)
    // or if the text is truncated (scrollWidth > clientWidth)
    const isBadge = target.classList.contains('badge');
    const isTruncated = target.scrollWidth > target.clientWidth;

    if (isBadge || isTruncated) {
      tooltip.textContent = text;
      tooltip.style.display = 'block';
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (tooltip.style.display === 'block') {
      const offset = 12;
      let left = e.pageX + offset;
      let top = e.pageY + offset;

      // Adjust to prevent tooltip going off the screen edge
      const tooltipRect = tooltip.getBoundingClientRect();
      if (left + tooltipRect.width > window.innerWidth) {
        left = e.pageX - tooltipRect.width - offset;
      }
      if (top + tooltipRect.height > window.pageYOffset + window.innerHeight) {
        top = e.pageY - tooltipRect.height - offset;
      }

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
      tooltip.style.display = 'none';
    }
  });
}
