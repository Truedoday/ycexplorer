// Application State
let allCompanies = [];
let filteredCompanies = [];
let currentPage = 1;
const pageSize = 48; // Divisible by 2, 3, and 4 for responsive grids

// Chart Instances
let industryChartInstance = null;
let cohortChartInstance = null;
let statusChartInstance = null;

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const companyTableBody = document.getElementById('companyTableBody');
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
    
    // Initialize Filters
    populateFilterSelects(allCompanies);
    
    // Initialize Charts
    renderCharts(allCompanies);
    
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
    
    // Clear active header sort styling if dropdown is used
    document.querySelectorAll('.dense-table th').forEach(h => h.classList.remove('active-sort'));
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

  // Table Column Header Click Sorting
  const tableHeaders = document.querySelectorAll('.dense-table th');
  let currentSortCol = 'name';
  let sortAscending = true;
  
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
      
      // Clear dropdown selector sync to avoid confusing UI states
      sortSelect.value = '';
      
      currentPage = 1;
      renderCompanies(false);
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
}

// Render Charts
function renderCharts(data) {
  if (industryChartInstance) industryChartInstance.destroy();
  if (cohortChartInstance) cohortChartInstance.destroy();
  if (statusChartInstance) statusChartInstance.destroy();

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
  const indColor = 'rgba(148, 163, 184, 0.75)'; // Slate 400 - monochromatic Slate Blue/Grey

  industryChartInstance = new Chart(indCtx, {
    type: 'bar',
    data: {
      labels: indLabels,
      datasets: [{
        label: 'Startups',
        data: indValues,
        backgroundColor: 'rgba(148, 163, 184, 0.7)',
        borderColor: 'rgba(148, 163, 184, 0.2)',
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
            maxRotation: 35,
            minRotation: 20
          }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'hsl(215,12%,65%)', font: { family: 'Inter', size: 9 } }
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
    const cohortColor = 'rgba(194, 65, 12, 0.7)'; // YC Terracotta/Rust (Desaturated Orange Accent)

    cohortChartInstance = new Chart(cohortCtx, {
      type: 'bar',
      data: {
        labels: cohortLabels,
        datasets: [{
          label: 'Startups Funded',
          data: cohortValues,
          backgroundColor: cohortColor,
          borderColor: 'rgba(194, 65, 12, 0.3)',
          borderWidth: 1,
          borderRadius: 3,
          barPercentage: 0.65,
          categoryPercentage: 0.8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
          axis: 'x'
        },
        hover: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 11 },
            borderColor: 'rgba(194, 65, 12, 0.2)',
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: 'hsl(215, 12%, 75%)', font: { family: 'Inter', size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: 'hsl(215, 12%, 75%)', font: { family: 'Inter', size: 9 } }
          }
        }
      }
    });
  }

  // 3. Operating Status (Vertical Bar Chart)
  const statusCounts = { Active: 0, Acquired: 0, Public: 0, Inactive: 0 };
  data.forEach(c => {
    if (c.status in statusCounts) {
      statusCounts[c.status]++;
    }
  });

  const statusCanvas = document.getElementById('statusChart');
  if (statusCanvas) {
    const statusCtx = statusCanvas.getContext('2d');
    statusChartInstance = new Chart(statusCtx, {
      type: 'pie',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: [
            'rgba(74, 222, 128, 0.82)',   // Active — soft green
            'rgba(250, 204, 21, 0.82)',   // Acquired — amber
            'rgba(96, 165, 250, 0.82)',   // Public — sky blue
            'rgba(148, 163, 184, 0.72)'   // Inactive — slate grey
          ],
          borderColor: 'rgba(15, 23, 42, 0.6)',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              color: 'hsl(215,12%,75%)',
              font: { family: 'Inter', size: 11 },
              boxWidth: 12,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 11 },
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
              }
            }
          }
        }
      }
    });
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
