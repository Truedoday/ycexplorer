// Application State
let allCompanies = [];
let filteredCompanies = [];
let currentPage = 1;
const pageSize = 48; // Divisible by 2, 3, and 4 for responsive grids

// Chart Instances
let industryChartInstance = null;
let cohortChartInstance = null;

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const companyGrid = document.getElementById('companyGrid');
const resultsCount = document.getElementById('resultsCount');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const sortSelect = document.getElementById('sortSelect');

// Filters
const searchInput = document.getElementById('searchInput');
const industrySelect = document.getElementById('industrySelect');
const batchSelect = document.getElementById('batchSelect');
const statusSelect = document.getElementById('statusSelect');
const ycDealSelect = document.getElementById('ycDealSelect');
const disclosedFundingSelect = document.getElementById('disclosedFundingSelect');
const topCompanyCheckbox = document.getElementById('topCompanyCheckbox');
const hiringCheckbox = document.getElementById('hiringCheckbox');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// New Advanced Filters DOM Elements
const foundedMinSelect = document.getElementById('foundedMinSelect');
const foundedMaxSelect = document.getElementById('foundedMaxSelect');
const countrySelect = document.getElementById('countrySelect');
const teamSizeSelect = document.getElementById('teamSizeSelect');

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
    
    // Initialize Metrics
    updateKPIs(allCompanies);
    updateStatusBar(allCompanies);
    
    // Initialize Filters
    populateFilterSelects(allCompanies);
    
    // Initialize Charts
    renderCharts(allCompanies);
    
    // Set initial listings
    filteredCompanies = [...allCompanies];
    applyFiltersAndSearch();
    
    // Event Listeners
    setupEventListeners();
    
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
  
  [
    industrySelect, batchSelect, statusSelect, ycDealSelect, 
    disclosedFundingSelect, foundedMinSelect, foundedMaxSelect, 
    countrySelect, teamSizeSelect
  ].forEach(select => {
    select.addEventListener('change', applyFiltersAndSearch);
  });
  
  [topCompanyCheckbox, hiringCheckbox].forEach(cb => {
    cb.addEventListener('change', applyFiltersAndSearch);
  });
  
  sortSelect.addEventListener('change', () => {
    sortCompanies(filteredCompanies, sortSelect.value);
    currentPage = 1;
    renderCompanies(false);
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
}

// KPI Dashboard Values
function updateKPIs(data) {
  // Total Startups
  document.querySelector('#metricTotal .metric-value').textContent = data.length.toLocaleString();
  
  // Public Companies
  const publicCount = data.filter(c => c.status === 'Public').length;
  document.querySelector('#metricPublic .metric-value').textContent = publicCount.toLocaleString();
  
  // Top Companies
  const topCount = data.filter(c => c.top_company === true).length;
  document.querySelector('#metricTop .metric-value').textContent = topCount.toLocaleString();
  
  // Exited Startups (Acquired + Public)
  const exitsTotalList = data.filter(c => c.status === 'Acquired' || c.status === 'Public');
  const exitsDisclosedList = exitsTotalList.filter(c => typeof c.exit_value === 'number' && c.exit_value > 0);
  const exitSum = exitsDisclosedList.reduce((sum, c) => sum + c.exit_value, 0);
  document.querySelector('#metricExits .metric-value').textContent = exitsTotalList.length.toLocaleString();
  document.querySelector('#metricExits .metric-subtext').textContent = `${exitsTotalList.length} exits (${exitsDisclosedList.length} disclosed: ${formatCurrency(exitSum)} total)`;
  
  // Total YC Capital Invested
  const totalCapital = data.reduce((sum, c) => sum + (c.standard_yc_deal || 20000), 0);
  document.querySelector('#metricCapital .metric-value').textContent = formatCurrency(totalCapital);
}

// Update Operating Status Progress Bar
function updateStatusBar(data) {
  const statusCounts = { Active: 0, Acquired: 0, Public: 0, Inactive: 0 };
  data.forEach(c => {
    if (c.status in statusCounts) {
      statusCounts[c.status]++;
    }
  });

  const total = data.length || 1;
  const statusBar = document.getElementById('statusBar');
  const statusLegend = document.getElementById('statusLegend');
  if (!statusBar || !statusLegend) return;

  statusBar.innerHTML = '';
  statusLegend.innerHTML = '';

  const colors = {
    Active: 'active',
    Acquired: 'acquired',
    Public: 'public',
    Inactive: 'inactive'
  };

  const labels = {
    Active: 'Active',
    Acquired: 'Acquired',
    Public: 'Public',
    Inactive: 'Inactive'
  };

  Object.entries(statusCounts).forEach(([status, count]) => {
    const pct = ((count / total) * 100).toFixed(1);
    if (count > 0) {
      const segment = document.createElement('div');
      segment.className = `status-segment ${colors[status]}`;
      segment.style.width = `${pct}%`;
      segment.title = `${labels[status]}: ${count.toLocaleString()} (${pct}%)`;
      statusBar.appendChild(segment);
    }

    // Add to legend
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `
      <span class="legend-dot ${colors[status]}"></span>
      <span class="legend-text"><strong>${labels[status]}</strong>: ${count.toLocaleString()} (${pct}%)</span>
    `;
    statusLegend.appendChild(legendItem);
  });
}

// Custom parser to sort YC batches chronologically (newest first)
function parseBatch(batchStr) {
  if (!batchStr) return { year: 0, seasonVal: 0 };
  const parts = batchStr.split(' ');
  if (parts.length !== 2) return { year: 0, seasonVal: 0 };
  const season = parts[0];
  const year = parseInt(parts[1], 10);
  const seasonVal = season === 'Winter' ? 1 : 2;
  return { year, seasonVal };
}

// Populate Dropdown Options
function populateFilterSelects(data) {
  // Industries
  const industries = [...new Set(data.map(c => c.industry).filter(Boolean))].sort();
  industries.forEach(ind => {
    const opt = document.createElement('option');
    opt.value = ind;
    opt.textContent = ind;
    industrySelect.appendChild(opt);
  });
  
  // Batches
  const batches = [...new Set(data.map(c => c.batch).filter(Boolean))];
  batches.sort((a, b) => {
    const pa = parseBatch(a);
    const pb = parseBatch(b);
    if (pa.year !== pb.year) return pb.year - pa.year;
    return pb.seasonVal - pa.seasonVal;
  });
  
  batches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    batchSelect.appendChild(opt);
  });

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
  sortedCountries.forEach(country => {
    const opt = document.createElement('option');
    opt.value = country;
    opt.textContent = country;
    countrySelect.appendChild(opt);
  });
}

// Filtering and Searching
function applyFiltersAndSearch() {
  const query = searchInput.value.toLowerCase().trim();
  const industry = industrySelect.value;
  const batch = batchSelect.value;
  const status = statusSelect.value;
  const ycDeal = ycDealSelect.value;
  const disclosedFunding = disclosedFundingSelect.value;
  const isTop = topCompanyCheckbox.checked;
  const isHiring = hiringCheckbox.checked;

  // New Advanced Filters
  const foundedMin = foundedMinSelect.value ? Number(foundedMinSelect.value) : null;
  const foundedMax = foundedMaxSelect.value ? Number(foundedMaxSelect.value) : null;
  const country = countrySelect.value;
  const teamSize = teamSizeSelect.value;
  
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
    
    // 2. Select filters
    if (industry && c.industry !== industry) return false;
    if (batch && c.batch !== batch) return false;
    if (status && c.status !== status) return false;
    if (ycDeal && (c.standard_yc_deal || 0) < Number(ycDeal)) return false;
    
    // 3. Disclosed funding status
    if (disclosedFunding) {
      const hasFunding = c.other_funding_raised && c.other_funding_raised !== 'Undisclosed';
      if (disclosedFunding === 'has_funding' && !hasFunding) return false;
      if (disclosedFunding === 'undisclosed' && hasFunding) return false;
    }
    
    // 4. Founded year ranges
    if (foundedMin && (!c.founded_year || c.founded_year < foundedMin)) return false;
    if (foundedMax && (!c.founded_year || c.founded_year > foundedMax)) return false;

    // 5. Country matching
    if (country) {
      const companyCountry = getCountryFromLocation(c.all_locations);
      if (companyCountry !== country) return false;
    }

    // 6. Team size brackets
    if (teamSize) {
      const size = c.team_size;
      if (size === undefined || size === null || isNaN(size)) return false;
      if (teamSize === '1-10' && (size < 1 || size > 10)) return false;
      if (teamSize === '11-50' && (size < 11 || size > 50)) return false;
      if (teamSize === '51-200' && (size < 51 || size > 200)) return false;
      if (teamSize === '201-500' && (size < 201 || size > 500)) return false;
      if (teamSize === '500+' && size < 501) return false;
    }

    // 7. Checkboxes
    if (isTop && c.top_company !== true) return false;
    if (isHiring && c.isHiring !== true) return false;
    
    return true;
  });
  
  sortCompanies(filteredCompanies, sortSelect.value);
  currentPage = 1;
  renderCompanies(false);
}

// Reset Filters
function resetFilters() {
  searchInput.value = '';
  industrySelect.value = '';
  batchSelect.value = '';
  statusSelect.value = '';
  ycDealSelect.value = '';
  disclosedFundingSelect.value = '';
  foundedMinSelect.value = '';
  foundedMaxSelect.value = '';
  countrySelect.value = '';
  teamSizeSelect.value = '';
  topCompanyCheckbox.checked = false;
  hiringCheckbox.checked = false;
  sortSelect.value = 'name_asc';
  
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

// Render Grid
function renderCompanies(append = false) {
  if (!append) {
    companyGrid.innerHTML = '';
  }
  
  resultsCount.textContent = `Found ${filteredCompanies.length.toLocaleString()} startups`;
  
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredCompanies.slice(start, end);
  
  if (filteredCompanies.length === 0) {
    companyGrid.innerHTML = `
      <div class="glass-panel" style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted);">
        <p style="font-size: 1.2rem; margin-bottom: 8px;">No YC startups match your filters.</p>
        <button class="btn btn-secondary" onclick="document.getElementById('resetFiltersBtn').click()">Clear Filters</button>
      </div>
    `;
    loadMoreBtn.style.display = 'none';
    return;
  }
  
  pageItems.forEach(c => {
    const card = document.createElement('article');
    card.className = 'company-card glass-panel';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View details for ${c.name}`);
    
    // Status Badge classes
    let statusClass = 'status-active';
    if (c.status === 'Acquired') statusClass = 'status-acquired';
    else if (c.status === 'Public') statusClass = 'status-public';
    else if (c.status === 'Inactive') statusClass = 'status-inactive';
    
    // Header badges
    const badgesHtml = `
      <span class="badge batch-badge">${c.batch || 'Stealth'}</span>
      <span class="badge status-badge ${statusClass}">${c.status || 'Active'}</span>
      ${c.ticker && c.ticker !== 'N/A' ? `<span class="badge ticker-badge" title="Stock symbol">${c.ticker}</span>` : ''}
      ${c.top_company ? '<span class="badge top-badge" title="Top YC Company">🏆 Top</span>' : ''}
      ${c.isHiring ? '<span class="badge hiring-badge" title="Actively Hiring">💼 Hiring</span>' : ''}
    `;
    
    // Financial metrics preview on card
    const extraFunding = c.other_funding_raised && c.other_funding_raised !== 'Undisclosed';
    const exitDisclosed = c.exit_value && c.exit_value !== 'Undisclosed' && c.exit_value !== 'N/A';
    
    const financialHtml = `
      <div class="card-financials">
        <div class="card-financials-row">
          <span class="card-financials-label">YC Seed</span>
          <span class="card-financials-val highlight">${formatCurrency(c.standard_yc_deal)}</span>
        </div>
        <div class="card-financials-row">
          <span class="card-financials-label">Extra Capital</span>
          <span class="card-financials-val">${extraFunding ? formatCurrency(c.other_funding_raised) : '<span style="opacity:0.5; font-size:0.75rem;">Undisclosed</span>'}</span>
        </div>
        ${exitDisclosed ? `
        <div class="card-financials-row" style="margin-top: 2px; padding-top: 2px; border-top: 1px dashed rgba(255,255,255,0.06);">
          <span class="card-financials-label" style="font-weight: 500;">Exit Valuation</span>
          <span class="card-financials-val success">${formatCurrency(c.exit_value)}</span>
        </div>` : ''}
      </div>
    `;

    // Map country for card footer
    const countryVal = getCountryFromLocation(c.all_locations) || 'Remote';

    card.innerHTML = `
      <div class="card-top">
        <img class="card-logo" src="${c.small_logo_thumb_url || ''}" alt="${c.name} logo" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%2327272a%22/><text x=%2250%25%22 y=%2250%25%22 font-family=%22Inter, sans-serif%22 font-weight=%22800%22 font-size=%2228%22 fill=%22%23a1a1aa%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22>?</text></svg>'">
        <div class="card-badges">${badgesHtml}</div>
      </div>
      <h3 class="card-title">${c.name}</h3>
      <p class="card-one-liner">${c.one_liner || 'No description available.'}</p>
      ${financialHtml}
      <div class="card-footer" style="margin-top: auto; padding-top: 8px;">
        <span class="card-industry">${c.industry || 'Unspecified'}</span>
        <span class="card-location" title="${c.all_locations || ''}">${countryVal} (${c.founded_year ? c.founded_year : 'N/A'})</span>
      </div>
    `;
    
    const triggerDialog = () => openCompanyModal(c);
    card.addEventListener('click', triggerDialog);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerDialog();
      }
    });
    
    companyGrid.appendChild(card);
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
}

// Render Charts
function renderCharts(data) {
  if (industryChartInstance) industryChartInstance.destroy();
  if (cohortChartInstance) cohortChartInstance.destroy();

  // 1. Industry Distribution (Top 10)
  const industryCounts = {};
  data.forEach(c => {
    if (c.industry) {
      industryCounts[c.industry] = (industryCounts[c.industry] || 0) + 1;
    }
  });
  const sortedIndustries = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const indLabels = sortedIndustries.map(x => x[0]);
  const indValues = sortedIndustries.map(x => x[1]);

  const indCtx = document.getElementById('industryChart').getContext('2d');
  const indGradient = indCtx.createLinearGradient(0, 0, 400, 0);
  indGradient.addColorStop(0, 'rgba(124, 58, 237, 0.85)'); // Purple
  indGradient.addColorStop(1, 'rgba(59, 130, 246, 0.85)'); // Blue

  industryChartInstance = new Chart(indCtx, {
    type: 'bar',
    data: {
      labels: indLabels,
      datasets: [{
        label: 'Startups Count',
        data: indValues,
        backgroundColor: indGradient,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderRadius: 6,
        barThickness: 16
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleFont: { family: 'Inter', size: 13, weight: 'bold' },
          bodyFont: { family: 'Inter', size: 12 },
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          padding: 12
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'hsl(215, 15%, 72%)', font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { display: false },
          ticks: { color: 'hsl(210, 20%, 98%)', font: { family: 'Inter', size: 11, weight: '500' } }
        }
      }
    }
  });

  // 2. Startups Funded per Year (Cohort Volume)
  const cohortCounts = {};
  for (let y = 2005; y <= 2026; y++) {
    cohortCounts[y] = 0;
  }

  data.forEach(c => {
    const p = parseBatch(c.batch);
    if (p.year >= 2005 && p.year <= 2026) {
      cohortCounts[p.year]++;
    }
  });

  const cohortLabels = Object.keys(cohortCounts);
  const cohortValues = Object.values(cohortCounts);

  const cohortCanvas = document.getElementById('cohortYearChart');
  if (cohortCanvas) {
    const cohortCtx = cohortCanvas.getContext('2d');
    const cohortGradient = cohortCtx.createLinearGradient(0, 280, 0, 0);
    cohortGradient.addColorStop(0, 'rgba(255, 102, 0, 0.15)'); // Soft YC Orange
    cohortGradient.addColorStop(1, 'rgba(255, 102, 0, 0.85)'); // Bright YC Orange

    cohortChartInstance = new Chart(cohortCtx, {
      type: 'bar',
      data: {
        labels: cohortLabels,
        datasets: [{
          label: 'Startups Funded',
          data: cohortValues,
          backgroundColor: cohortGradient,
          borderColor: 'rgba(255, 102, 0, 0.4)',
          borderWidth: 1.5,
          borderRadius: 4,
          barThickness: 'flex'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleFont: { family: 'Inter', size: 13, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 12 },
            borderColor: 'rgba(255, 102, 0, 0.3)',
            borderWidth: 1,
            padding: 12
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: 'hsl(215, 15%, 72%)', font: { family: 'Inter', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: 'hsl(215, 15%, 72%)', font: { family: 'Inter', size: 10 } }
          }
        }
      }
    });
  }
}
