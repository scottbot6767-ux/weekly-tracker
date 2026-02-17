// Google Sheet Config
const SHEET_ID = '1mv6WnV4tRefxF6el3-p8hsS0lFsnS1Ah5QeEQqk9UgY';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

// Chart instances
let trendChart, repSetsChart, cumulativeChart;

// State
let allWeeks = [];
let currentWeek = 0;

// Animate number
function animateValue(element, start, end, duration = 800, suffix = '') {
  const startTime = performance.now();
  const isDecimal = end % 1 !== 0;
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * easeOut;
    
    element.textContent = (isDecimal ? current.toFixed(0) : Math.round(current)) + suffix;
    
    if (progress < 1) requestAnimationFrame(update);
  }
  
  requestAnimationFrame(update);
}

// Parse CSV
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  return lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else current += char;
    }
    result.push(current.trim());
    return result;
  });
}

// Parse currency
function parseCurrency(str) {
  if (!str || str === 'X' || str === '$0.00') return 0;
  return parseFloat(str.replace(/[$,]/g, '')) || 0;
}

// Format currency
function formatCurrency(num) {
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K';
  return '$' + num.toLocaleString();
}

// Extract all weeks data
function extractAllWeeks(rows) {
  const weeks = [];
  let currentSection = null;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // New section header
    if (row[0] === 'Rep' && row[1] === 'Weekly Sets') {
      if (currentSection && currentSection.reps.length > 0) {
        weeks.push(currentSection);
      }
      currentSection = { reps: [], totals: null };
      continue;
    }
    
    if (!currentSection) continue;
    
    const name = row[0];
    if (!name || name === '' || name === ',') continue;
    
    if (name === 'Totals') {
      currentSection.totals = {
        weeklySets: parseInt(row[1]) || 0,
        weeklyShows: parseInt(row[2]) || 0,
        monthlySets: parseInt(row[3]) || 0,
        monthlyShows: parseInt(row[4]) || 0,
        closedWon: parseCurrency(row[5])
      };
      continue;
    }
    
    if (name.includes('Deactivated') || row[1] === 'X' || row[1] === '') continue;
    
    const weeklySets = parseInt(row[1]) || 0;
    const weeklyShows = parseInt(row[2]) || 0;
    const monthlySets = parseInt(row[3]) || 0;
    const monthlyShows = parseInt(row[4]) || 0;
    
    if (weeklySets > 0 || weeklyShows > 0 || monthlySets > 0) {
      currentSection.reps.push({
        name: name.trim(),
        weeklySets,
        weeklyShows,
        monthlySets,
        monthlyShows,
        closedWon: parseCurrency(row[5]),
        showRate: weeklySets > 0 ? Math.round((weeklyShows / weeklySets) * 100) : 0
      });
    }
  }
  
  // Don't forget the last section
  if (currentSection && currentSection.reps.length > 0) {
    weeks.push(currentSection);
  }
  
  return weeks;
}

// Render week tabs
function renderWeekTabs() {
  const container = document.getElementById('weekTabs');
  container.innerHTML = allWeeks.map((_, i) => `
    <button class="week-tab ${i === currentWeek ? 'active' : ''}" onclick="selectWeek(${i})">
      Week ${i + 1}
    </button>
  `).join('');
}

// Select week
function selectWeek(index) {
  currentWeek = index;
  renderWeekTabs();
  renderCurrentWeek();
}

// Render current week data
function renderCurrentWeek() {
  const week = allWeeks[currentWeek];
  if (!week) return;
  
  const prevWeek = currentWeek > 0 ? allWeeks[currentWeek - 1] : null;
  
  // Sort reps by weekly sets
  week.reps.sort((a, b) => b.weeklySets - a.weeklySets);
  
  // Calculate totals
  const weeklySets = week.totals?.weeklySets || week.reps.reduce((s, r) => s + r.weeklySets, 0);
  const weeklyShows = week.totals?.weeklyShows || week.reps.reduce((s, r) => s + r.weeklyShows, 0);
  const monthlySets = week.totals?.monthlySets || week.reps.reduce((s, r) => s + r.monthlySets, 0);
  const monthlyShows = week.totals?.monthlyShows || week.reps.reduce((s, r) => s + r.monthlyShows, 0);
  const closedWon = week.totals?.closedWon || week.reps.reduce((s, r) => s + r.closedWon, 0);
  
  const showRate = weeklySets > 0 ? Math.round((weeklyShows / weeklySets) * 100) : 0;
  
  // Previous week for trends
  const prevSets = prevWeek?.totals?.weeklySets || (prevWeek?.reps.reduce((s, r) => s + r.weeklySets, 0) || 0);
  const prevShows = prevWeek?.totals?.weeklyShows || (prevWeek?.reps.reduce((s, r) => s + r.weeklyShows, 0) || 0);
  
  // Update stats
  animateValue(document.getElementById('weeklySets'), 0, weeklySets);
  animateValue(document.getElementById('weeklyShows'), 0, weeklyShows);
  document.getElementById('weeklyRate').textContent = showRate + '%';
  document.getElementById('weeklyClosed').textContent = closedWon > 0 ? formatCurrency(closedWon) : '$0';
  
  // Month summary
  document.getElementById('monthSets').textContent = monthlySets + ' Sets';
  document.getElementById('monthShows').textContent = monthlyShows + ' Shows';
  document.getElementById('monthClosed').textContent = closedWon > 0 ? formatCurrency(closedWon) : '$0';
  
  // Trends
  const setsTrend = document.getElementById('setsTrend');
  const showsTrend = document.getElementById('showsTrend');
  
  if (prevWeek) {
    const setsDiff = weeklySets - prevSets;
    const showsDiff = weeklyShows - prevShows;
    
    setsTrend.textContent = (setsDiff >= 0 ? '+' : '') + setsDiff;
    setsTrend.className = 'stat-trend ' + (setsDiff > 0 ? 'up' : setsDiff < 0 ? 'down' : 'neutral');
    
    showsTrend.textContent = (showsDiff >= 0 ? '+' : '') + showsDiff;
    showsTrend.className = 'stat-trend ' + (showsDiff > 0 ? 'up' : showsDiff < 0 ? 'down' : 'neutral');
  } else {
    setsTrend.textContent = '';
    showsTrend.textContent = '';
  }
  
  // Progress bars
  setTimeout(() => {
    document.getElementById('setsBar').style.width = Math.min(100, (weeklySets / 40) * 100) + '%';
    document.getElementById('showsBar').style.width = Math.min(100, (weeklyShows / 25) * 100) + '%';
    document.getElementById('rateBar').style.width = Math.min(100, showRate) + '%';
    document.getElementById('closedBar').style.width = Math.min(100, (closedWon / 100000) * 100) + '%';
  }, 100);
  
  // Week label
  document.getElementById('weekLabel').textContent = `Week ${currentWeek + 1}`;
  
  // Leaderboard
  updateLeaderboard(week.reps);
  
  // Charts
  updateRepChart(week.reps);
  updateCumulativeChart();
}

// Update leaderboard
function updateLeaderboard(reps) {
  const leaderboard = document.getElementById('leaderboard');
  
  leaderboard.innerHTML = reps.map((rep, i) => {
    const rateClass = rep.showRate >= 50 ? 'good' : rep.showRate >= 30 ? 'warning' : 'low';
    
    return `
      <div class="lb-item ${i === 1 ? 'rank-2' : ''} ${i === 2 ? 'rank-3' : ''}">
        <div class="lb-rank">
          <div class="lb-rank-num">${i + 1}</div>
        </div>
        <div class="lb-name">${rep.name}</div>
        <div class="lb-sets">${rep.weeklySets}</div>
        <div class="lb-shows">${rep.weeklyShows}</div>
        <div class="lb-rate">
          <span class="rate-indicator ${rateClass}"></span>
          ${rep.showRate}%
        </div>
        <div class="lb-monthly">${rep.monthlySets}</div>
      </div>
    `;
  }).join('');
}

// Update trend chart (all weeks)
function updateTrendChart() {
  const labels = allWeeks.map((_, i) => `Week ${i + 1}`);
  const setsData = allWeeks.map(w => w.totals?.weeklySets || w.reps.reduce((s, r) => s + r.weeklySets, 0));
  const showsData = allWeeks.map(w => w.totals?.weeklyShows || w.reps.reduce((s, r) => s + r.weeklyShows, 0));
  
  if (trendChart) trendChart.destroy();
  
  trendChart = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Sets',
          data: setsData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointBackgroundColor: '#3b82f6'
        },
        {
          label: 'Shows',
          data: showsData,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointBackgroundColor: '#8b5cf6'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#a1a1aa', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 16 }
        },
        tooltip: {
          backgroundColor: '#1a1a24',
          titleColor: '#fff',
          bodyColor: '#a1a1aa',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#52525b', font: { family: 'Inter', size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#52525b', font: { family: 'Inter', size: 11 } }, beginAtZero: true }
      }
    }
  });
}

// Update rep chart for current week
function updateRepChart(reps) {
  const names = reps.map(r => r.name.split(' ')[0]);
  const setsData = reps.map(r => r.weeklySets);
  
  if (repSetsChart) repSetsChart.destroy();
  
  repSetsChart = new Chart(document.getElementById('repSetsChart'), {
    type: 'bar',
    data: {
      labels: names,
      datasets: [{
        data: setsData,
        backgroundColor: (ctx) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
          gradient.addColorStop(0, '#3b82f6');
          gradient.addColorStop(1, '#8b5cf6');
          return gradient;
        },
        borderRadius: 6,
        barThickness: 20
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#52525b', font: { family: 'Inter', size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#52525b' }, beginAtZero: true }
      }
    }
  });
}

// Update cumulative chart
function updateCumulativeChart() {
  // Get all unique rep names
  const allReps = new Set();
  allWeeks.forEach(w => w.reps.forEach(r => allReps.add(r.name)));
  
  // Get cumulative data (monthly sets from latest week for each rep)
  const latestWeek = allWeeks[allWeeks.length - 1];
  const repData = Array.from(allReps).map(name => {
    const rep = latestWeek.reps.find(r => r.name === name);
    return { name, monthlySets: rep?.monthlySets || 0 };
  }).sort((a, b) => b.monthlySets - a.monthlySets);
  
  if (cumulativeChart) cumulativeChart.destroy();
  
  cumulativeChart = new Chart(document.getElementById('cumulativeChart'), {
    type: 'bar',
    data: {
      labels: repData.map(r => r.name.split(' ')[0]),
      datasets: [{
        data: repData.map(r => r.monthlySets),
        backgroundColor: '#10b981',
        borderRadius: 6,
        barThickness: 20
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#52525b' }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { family: 'Inter', size: 11 } } }
      }
    }
  });
}

// Fetch and render
async function fetchData() {
  try {
    const response = await fetch(SHEET_URL);
    const csv = await response.text();
    const rows = parseCSV(csv);
    
    allWeeks = extractAllWeeks(rows);
    currentWeek = allWeeks.length - 1; // Start with latest week
    
    renderWeekTabs();
    renderCurrentWeek();
    updateTrendChart();
    
    document.getElementById('lastUpdated').textContent = 
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('lastUpdated').textContent = 'Error';
  }
}

function refreshData() {
  document.getElementById('lastUpdated').textContent = '...';
  fetchData();
}

// Initialize
fetchData();
setInterval(fetchData, 5 * 60 * 1000);
