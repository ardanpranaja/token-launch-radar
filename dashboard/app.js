// Token Radar 2.0 dashboard. Reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, a filterable table and a per-protocol detail drawer carrying the model's own
// arithmetic, drivers, risks and farm plan. No network: every byte it shows is in data.js, and the
// farm steps shown are exactly the strings board.json carries.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', tier: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('tier')) state.tier = params.get('tier');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.tier !== 'all') params.set('tier', state.tier);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.tier === 'watchlist' && !r.watchlist) return false;
      if (state.tier === 'early' && r.watchlist) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'score') { av = a.launch_score; bv = b.launch_score; }
      else if (key === 'potential') { av = a.potential_value_usd; bv = b.potential_value_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Pre-token protocols, ranked by probability-weighted launch value' }),
        el('p', { text: 'Implied value = potential launch value x launch likelihood. Potential value comes from TVL and a stated category multiple; likelihood comes from scale, time with no token on record, momentum, chain breadth and category behaviour. All ' + DATA.watchlist_size + ' watchlist protocols are covered, plus every other pre-token protocol that passes a conservative product screen. A launch is a scenario, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Board rows ranked' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows beyond watchlist' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token records screened out' }), el('b', { text: String(DATA.screened_out_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var tier = el('select', { id: 'tier', 'aria-label': 'Filter by radar tier' },
      el('option', { value: 'all', text: 'All tiers' }),
      el('option', { value: 'watchlist', text: 'Watchlist only', selected: state.tier === 'watchlist' ? 'selected' : null }),
      el('option', { value: 'early', text: 'Early radar only', selected: state.tier === 'early' ? 'selected' : null })
    );
    tier.addEventListener('change', function () { state.tier = tier.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'tier', text: 'Tier' }), tier),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function scoreCell(score) {
    return el('td', null, el('div', { class: 'scorecell' },
      el('div', { class: 'bar score', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, score) + '%' })),
      el('span', { class: 'num', text: String(score) })
    ));
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or tier to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.tier = 'all'; writeHash(); render(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        scoreCell(r.launch_score),
        el('td', { class: 'num', text: fmtUsd(r.potential_value_usd) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status' + (r.watchlist ? '' : ' early'), text: r.watchlist ? 'watchlist' : 'early radar' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols ranked by implied value (potential x launch likelihood). Select a row for its model, drivers, risks and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('score', 'Launch score'),
            sortHeader('potential', 'Potential'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Tier' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var w = m.weights;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How the radar scores a launch' }),
      el('p', { class: 'sub', text: 'Two questions, kept separate. Potential value asks what a first token could be worth at today\u2019s scale. Launch likelihood asks how strongly the snapshot supports a launch scenario. Implied value multiplies the two, so a huge but unlikely launch cannot outrank a likely one on size alone.' }),
      el('div', { class: 'formula' },
        'potential = tvl x category_multiple x momentum_mult x maturity_mult x breadth_mult x confidence_mult' + '\n' +
        'likelihood = ' + m.probability_floor + ' + ' + m.probability_range + ' x (' + w.scale + ' scale + ' + w.age + ' age + ' + w.momentum + ' momentum + ' + w.breadth + ' breadth + ' + w.category + ' category_prior + ' + w.confidence + ' confidence)' + '\n' +
        'implied_value = round(potential x likelihood)'
      ),
      el('p', { class: 'sub', text: 'Scale is log TVL between $' + Math.round(m.scale_floor_usd / 1e6) + 'M and $' + Math.round(m.scale_ceiling_usd / 1e9) + 'B. Age rewards a long record with no token on file and uses a neutral ' + m.unknown_age_score + ' when DefiLlama reports no listed date. Category multiples and priors are stated per category in MODEL.md. The screen removes exchanges, wrapped/staked/bridged products of assets that already trade, exchange-branded products and versioned pools: ' + DATA.screened_out_size + ' pre-token records are set aside that way, never silently ranked.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function scoreRow(label, value) {
    return el('div', null,
      el('span', { text: label }),
      el('span', { class: 'scorewrap' },
        el('span', { class: 'bar mini', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, Math.round(value * 100)) + '%' })),
        el('b', { class: 'num', text: value.toFixed(2) })
      )
    );
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var m = row.model;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' \u00b7 ' + row.tier }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Why it ranks here' }),
      el('p', { class: 'thesis', text: row.thesis })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Launch likelihood: score ' + row.launch_score + ' / 100' }),
      el('div', { class: 'equation' },
        scoreRow('Scale (log TVL)', m.scale_score),
        scoreRow('Age with no token on record', m.age_score),
        scoreRow('7-day momentum', m.momentum_score),
        scoreRow('Chain breadth', m.breadth_score),
        scoreRow('Category prior', m.category_prior),
        scoreRow('Data confidence', m.confidence_score),
        el('div', null, el('span', { text: 'Launch probability' }), el('b', { class: 'num', text: Math.round(row.launch_probability * 100) + '%' }))
      )
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Value model' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: m.category_multiple.toFixed(2) + 'x' })),
        el('div', null, el('span', { text: 'Momentum multiplier' }), el('b', { class: 'num', text: m.momentum_multiplier.toFixed(2) + 'x' })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: m.maturity_multiplier.toFixed(2) + 'x' })),
        el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { class: 'num', text: m.breadth_multiplier.toFixed(2) + 'x' })),
        el('div', null, el('span', { text: 'Potential launch value' }), el('b', { class: 'num', text: fmtUsd(row.potential_value_usd) })),
        el('div', null, el('span', { text: 'Implied value (x likelihood)' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Seven-day TVL change: ' + fmtPct(row.change_7d) + '. Age with no token on record: ' + fmtAge(row.age_days) + '. A scenario value from snapshot figures only, not a price forecast.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Drivers' }),
      el('ul', { class: 'points' }, row.drivers.map(function (d) { return el('li', { text: d }); }))
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Risks and gaps' }),
      el('ul', { class: 'points risks' }, row.risks.map(function (d) { return el('li', { text: d }); }))
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
