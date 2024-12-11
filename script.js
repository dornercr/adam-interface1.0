// Global variables
let articles = [];
let filteredArticles = [];
let currentPage = 1;
const resultsPerPage = 50;

// Helper function for generating unique IDs
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// DOM elements
const darkModeToggle = document.getElementById('darkModeToggle');
const languageSelect = document.getElementById('languageSelect');
const topicSearch = document.getElementById('topicSearch');
const ilrSelect = document.getElementById('ilrSelect');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const loadingSpinner = document.getElementById('loadingSpinner');
const pageInfo = document.getElementById('pageInfo');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');

// Event listeners
document.addEventListener('DOMContentLoaded', initializeApp);
darkModeToggle.addEventListener('change', toggleDarkMode);
languageSelect.addEventListener('change', loadLanguageData);
searchBtn.addEventListener('click', searchArticles);
prevPageBtn.addEventListener('click', () => changePage(-1));
nextPageBtn.addEventListener('click', () => changePage(1));

// Debounced search function
const debouncedSearch = debounce(searchArticles, 300);
topicSearch.addEventListener('input', debouncedSearch);
ilrSelect.addEventListener('change', debouncedSearch);

function initializeApp() {
    loadAvailableLanguages();
    checkDarkModePreference();
}

function loadAvailableLanguages() {
    fetch('available_files.json')
        .then(response => response.json())
        .then(availableFiles => {
            const languages = Object.keys(availableFiles);
            languages.forEach(lang => {
                const option = document.createElement('option');
                option.value = lang;
                option.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
                languageSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error("Error loading available languages:", error);
            showToast("Failed to load available languages. Please try again later.", 'danger');
        });
}

function checkDarkModePreference() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

function loadLanguageData() {
    const language = languageSelect.value;
    if (!language) return;

    showLoading();

    fetch('available_files.json')
        .then(response => response.json())
        .then(availableFiles => {
            const languageFiles = availableFiles[language];
            if (!languageFiles || languageFiles.length === 0) {
                throw new Error(`No CSV files found for language: ${language}`);
            }

            const promises = languageFiles.map(csvFile =>
                Papa.parsePromise(csvFile, { download: true, header: true })
            );

            return Promise.all(promises);
        })
        .then(results => {
            articles = results.flatMap(result => {
                // Add debug logging
                const firstArticle = result.data[0];
                console.log("Available fields:", Object.keys(firstArticle));
                
                return result.data.map(article => ({
                    ...article,
                    title: article.title || '',
                    summary: article.summary || '',
                    // Try both field names for translations
                    translated_summary: article.translated_summary || article.translated || '',
                    ilr_quantized: article.ilr_quantized || '',
                    link: article.link || '',
                    id: article.id || generateId()
                }));
            });
            console.log("Sample processed article:", articles[0]);
            populateILRDropdown();
            searchArticles();
            showToast(`Loaded ${articles.length} articles for ${language}`, 'success');
        })
        .catch(error => {
            console.error("Error loading data:", error);
            showToast("An error occurred while loading the data. Please try again.", 'danger');
        })
        .finally(hideLoading);
}

function populateILRDropdown() {
    const ilrLevels = [...new Set(articles.map(a => a.ilr_quantized))].sort();
    ilrSelect.innerHTML = '<option value="">All Levels</option>';
    ilrLevels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = `ILR ${level}`;
        ilrSelect.appendChild(option);
    });
}

function searchArticles() {
    const topic = topicSearch.value.toLowerCase();
    const ilr = ilrSelect.value;

    filteredArticles = articles.filter(article => {
        const titleMatch = article.title.toLowerCase().includes(topic);
        const summaryMatch = article.summary.toLowerCase().includes(topic);
        const translatedSummaryMatch = article.translated_summary.toLowerCase().includes(topic);
        const ilrMatch = ilr === '' || article.ilr_quantized === ilr;

        return (topic === '' || titleMatch || summaryMatch || translatedSummaryMatch) && ilrMatch;
    });

    currentPage = 1;
    displayResults();
}

function displayResults() {
    const startIndex = (currentPage - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    const paginatedResults = filteredArticles.slice(startIndex, endIndex);

    resultsDiv.innerHTML = '';

    if (paginatedResults.length === 0) {
        resultsDiv.innerHTML = '<div class="col-12"><div class="alert alert-info">No results found. Try adjusting your search criteria.</div></div>';
        return;
    }

    const selectedLanguage = languageSelect.options[languageSelect.selectedIndex].textContent;

    paginatedResults.forEach(article => {
        // Check for RTL text
        const isRTL = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(article.title + article.summary);
        const rtlStyle = isRTL ? 'text-align: right; direction: rtl;' : '';

        const articleDiv = document.createElement('div');
        articleDiv.className = 'col-md-6 mb-4';
        
        const card = document.createElement('div');
        card.className = 'card h-100';
        card.innerHTML = `
            <div class="card-body">
                <span class="badge bg-primary ilr-badge">ILR ${article.ilr_quantized || 'N/A'}</span>
                <h5 class="card-title mb-3" style="${rtlStyle}">${article.title}</h5>
                <h6 class="card-subtitle mb-2 text-muted">${selectedLanguage}</h6>
                
                <h6 class="card-subtitle mt-3 mb-2">Original Text</h6>
                <p class="card-text" style="${rtlStyle}">${article.summary || 'No summary available'}</p>
                
                <h6 class="card-subtitle mt-3 mb-2">English Translation</h6>
                <p class="card-text">${article.translated_summary || 'No translated summary available'}</p>
            </div>
            <div class="card-footer bg-transparent border-top-0">
                ${article.link ? `
                    <a href="${article.link}" class="btn btn-sm btn-outline-primary" target="_blank">
                        Read Full Article
                    </a>
                ` : ''}
                <button class="btn btn-sm btn-outline-secondary ms-2" onclick="saveForLater('${article.id}')">
                    Save for Later
                </button>
            </div>
        `;
        
        articleDiv.appendChild(card);
        resultsDiv.appendChild(articleDiv);
    });

    updatePaginationControls();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(filteredArticles.length / resultsPerPage);
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
}

function changePage(delta) {
    const newPage = currentPage + delta;
    const totalPages = Math.ceil(filteredArticles.length / resultsPerPage);
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayResults();
    }
}

function saveForLater(articleId) {
    showToast(`Article ${articleId} saved for later`, 'info');
}

function showLoading() {
    loadingSpinner.style.display = 'flex';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Utility function to extend Papa Parse with promise support
Papa.parsePromise = function(file, config) {
    return new Promise((complete, error) => {
        Papa.parse(file, { ...config, complete, error });
    });
};

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}