(function () {
  const REQUEST_TIMEOUT_MS = 15000;

  /* ---------- helpers ---------- */
  function money(n) {
    return (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);
  }
  function itemsMap() {
    const m = {};
    (window.SITE_CONFIG.items || []).forEach(i => (m[i.key] = i));
    return m;
  }
  function snapToHalf(n) {
    const v = Number(n);
    if (!isFinite(v)) return 0.5;
    return Math.max(0.5, Math.round(v * 2) / 2);
  }
  function getTableHeaders() {
    const ths = document.querySelectorAll('table.table thead th');
    return Array.from(ths).map(th => th.textContent.trim());
  }
  function addLabelsToRow(tr, heads) {
    const tds = tr.querySelectorAll('td');
    tds.forEach((td, i) => td.setAttribute('data-label', heads[i] || ''));
  }

  // --- totals (base vs payable) ---
  function getBaseTotal() {
    const el = document.getElementById('grand');
    const n = el ? parseFloat(String(el.textContent).replace(/[^\d.,]/g, '').replace(',', '.')) : 0;
    return isNaN(n) ? 0 : n;
  }
  function getPayableTotal() {
    let total = getBaseTotal();
    const fee = Number(window.SITE_CONFIG?.delivery?.fee || 0);
    const cb = document.getElementById('include-delivery'); // optional checkbox
    if (cb && cb.checked) total += fee;
    return total;
  }

  // --- payments ---
  function togglePayButtons() {
    const disabled = getPayableTotal() <= 0;
    ['pay-revolut', 'pay-satispay'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.disabled = disabled;
    });
    const toPay = document.getElementById('to-pay'); // optional
    if (toPay) toPay.textContent = getPayableTotal().toFixed(2);
  }
function openRevolut() {
  const amt = getPayableTotal();
  if (amt <= 0) return alert('Please add items to your order first.');
  const user = window.PAY?.revolutUser;
  if (!user) return alert('Revolut handle is not configured.');

  const tpl = window.PAY?.templates?.revolut
            || 'https://revolut.me/{user}?amount={amount}&currency={cur}';
  const url = tpl
    .replace('{user}', encodeURIComponent(user))
    .replace('{amount}', amt.toFixed(2))
    .replace('{cur}', window.PAY?.currency || 'EUR');
  
  try {
    const toPay = amt.toFixed(2);
    console.log(`Opening Revolut for €${toPay}…`);
  } catch {}

  // redirect immediately
  window.location.href = url;
}


  function openSatispay() {
    const amt = getPayableTotal();
    if (amt <= 0) return alert('Please add items to your order first.');
    if (!window.PAY || !window.PAY.satispayTag) return alert('Satispay tag is not configured.');
    const t = window.PAY.templates?.satispay || 'https://tag.satispay.com/{tag}?amount={amount}';
    const url = t
      .replace('{tag}', window.PAY.satispayTag)
      .replace('{amount}', amt.toFixed(2));
    window.open(url, '_blank', 'noopener');
  }

  /* ---------- row builder ---------- */
  function addRow(tbody, row) {
    const map = itemsMap();
    const tr = document.createElement('tr');
    const td = () => document.createElement('td');

    // Item select
    const tdItem = td();
    const sel = document.createElement('select');
    (window.SITE_CONFIG.items || []).forEach(it => {
      const opt = document.createElement('option');
      opt.value = it.key;
      opt.textContent = it.name_en + ' / ' + it.name_it;
      sel.appendChild(opt);
    });
    tdItem.appendChild(sel);

    // Price
    const tdPrice = td();
    const price = document.createElement('input');
    price.type = 'number';
    price.step = '0.01';
    price.readOnly = true;
    tdPrice.appendChild(price);

    // Qty with ± stepper (0.5 kg)
    const tdQty = td();
    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'qty-wrap';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'qty-btn';
    minus.textContent = '–';

    const qty = document.createElement('input');
    qty.type = 'number';
    qty.step = '0.5';
    qty.min  = '0.5';
    qty.inputMode = 'decimal';
    qty.placeholder = '0.5';

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'qty-btn';
    plus.textContent = '+';

    qtyWrap.append(minus, qty, plus);
    tdQty.appendChild(qtyWrap);

    // Notes
    const tdNotes = td();
    const notes = document.createElement('input');
    notes.type = 'text';
    tdNotes.appendChild(notes);

    // Line total
    const tdTot = td();
    const tot = document.createElement('input');
    tot.type = 'number';
    tot.step = '0.01';
    tot.readOnly = true;
    tdTot.appendChild(tot);

    // Row actions
    const tdAct = td();
    const del = document.createElement('button');
    del.textContent = '✕';
    del.className = 'btn';
    del.addEventListener('click', () => { tr.remove(); recalc(); });
    tdAct.appendChild(del);

    [tdItem, tdPrice, tdQty, tdNotes, tdTot, tdAct].forEach(x => tr.appendChild(x));
    tbody.appendChild(tr);

    // labels for stacked mobile layout
    addLabelsToRow(tr, getTableHeaders());

    // sync calc
    function sync() {
      const it = map[sel.value];
      const p = it ? it.price : 0;
      price.value = money(p);
      const q = parseFloat(qty.value || 0);
      tot.value = money(p * q);
      recalc();
    }

    // stepper handlers (scoped)
    minus.addEventListener('click', () => {
      const current = Number(qty.value) || 0;
      const next = Math.max(0.5, current - 0.5);
      qty.value = next.toFixed(1);
      sync();
    });
    plus.addEventListener('click', () => {
      const current = Number(qty.value) || 0;
      const next = current + 0.5;
      qty.value = next.toFixed(1);
      sync();
    });
    qty.addEventListener('blur', () => { qty.value = snapToHalf(qty.value).toFixed(1); sync(); });
    qty.addEventListener('wheel', e => e.preventDefault(), { passive:false }); // prevent scroll change

    sel.addEventListener('change', sync);
    qty.addEventListener('input', sync);

    // defaults
    const firstKey = Object.keys(map)[0] || '';
    if (row) {
      sel.value = map[row.key] ? row.key : firstKey;
      qty.value = snapToHalf(row.qty ?? 0.5).toFixed(1);
    } else {
      sel.value = firstKey;
      qty.value = '0.5';
    }
    sync();
  }

  /* ---------- totals ---------- */
  function recalc() {
    let sum = 0;
    document.querySelectorAll('tbody tr').forEach(tr => {
      sum += parseFloat(tr.querySelector('td:nth-child(5) input').value || 0);
    });
    document.getElementById('grand').textContent = money(sum);

    // Enable/disable pay buttons based on PAYABLE total (items + optional delivery)
    togglePayButtons();
  }

  /* ---------- submit ---------- */
  async function sendToSheet() {
    const endpoint = window.WB_ENDPOINT || '';
    if (!endpoint) { alert('Admin: please set WB_ENDPOINT in assets/js/backend.js'); return; }

    // Build items from rows
    const items = [];
    document.querySelectorAll('tbody tr').forEach(tr => {
      const sel = tr.querySelector('select');
      const name = sel.options[sel.selectedIndex].text.split(' / ')[0];
      const key = sel.value;
      const price = parseFloat(tr.querySelector('td:nth-child(2) input').value || 0);
      const qty = parseFloat(tr.querySelector('td:nth-child(3) input').value || 0);
      const notes = tr.querySelector('td:nth-child(4) input').value || '';
      if (qty > 0) items.push({ key, name, price, qty, notes });
    });

    // Validate minimums
    const totalQty = items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
    if (totalQty < 1) { alert('Minimum order is 1 kg (you can mix items, e.g., 0.5 + 0.5).'); return; }
    for (const it of items) {
      if (it.qty > 0 && it.qty < 0.5) { alert('Minimum per item is 0.5 kg.'); return; }
      const multiple = Math.round(it.qty * 2) / 2;
      if (Math.abs(it.qty - multiple) > 1e-6) { alert('Quantities must be in 0.5 kg steps (e.g., 0.5, 1, 1.5).'); return; }
    }

    const emailEl = document.getElementById('c-email');
    if (!emailEl || !emailEl.value.trim() || !emailEl.checkValidity()) {
      emailEl?.reportValidity(); emailEl?.focus(); return;
    }

    const allergies = (document.getElementById('c-allergies')?.value || '').trim();

    const payload = {
      name: document.getElementById('c-name').value.trim(),
      phone: document.getElementById('c-phone').value.trim(),
      address: document.getElementById('c-addr').value.trim(),
      email: (document.getElementById('c-email')?.value || '').trim(),
      notes: (document.getElementById('c-notes').value || '').trim(),
      allergies,
      items,
      lang: document.documentElement.lang || 'en',
      ua: navigator.userAgent,
      hp: document.getElementById('hp-field')?.value || ''
    };

    if (!payload.name || !payload.phone || !payload.address || items.length === 0) {
      alert('Please fill your details and add at least one item.'); return;
    }

    const btn = document.getElementById('place-order');
    const prev = btn.textContent;
    btn.textContent = 'Sending...'; btn.disabled = true;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + ' ' + res.statusText + (txt ? ' — ' + txt.slice(0, 200) : ''));
      }

      let j;
      try { j = await res.json(); }
      catch { const txt = await res.text(); throw new Error('Invalid JSON: ' + txt.slice(0, 200)); }

      if (j && j.ok) {
        alert('Order received! Your ID: ' + j.id);
        localStorage.removeItem('cart');
        location.href = 'index.html';
      } else {
        throw new Error(j && j.error ? String(j.error) : 'Unknown error');
      }
    } catch (err) {
      console.error('Order submit failed:', err);
      alert('Network / submit error: ' + err.message);
    } finally {
      clearTimeout(t);
      btn.textContent = prev; btn.disabled = false;
    }
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    const tbody = document.getElementById('rows');
    addRow(tbody);
    recalc();

    document.getElementById('add').addEventListener('click', () => addRow(tbody));
    document.getElementById('clear').addEventListener('click', () => { tbody.innerHTML = ''; recalc(); });

    const csvBtn = document.getElementById('csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', () => {
        const allergies = (document.getElementById('c-allergies')?.value || '').trim();
        const rows = [['Item', 'Price_EUR_kg', 'Qty_kg', 'Notes', 'Line_Total_EUR', 'Allergies']];
        document.querySelectorAll('tbody tr').forEach(tr => {
          const sel = tr.querySelector('select');
          const price = tr.querySelector('td:nth-child(2) input').value;
          const qty = tr.querySelector('td:nth-child(3) input').value;
          const notes = tr.querySelector('td:nth-child(4) input').value;
          const total = tr.querySelector('td:nth-child(5) input').value;
          rows.push([sel.options[sel.selectedIndex].text, price, qty, notes, total, allergies]);
        });
        const csv = rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'order-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
        URL.revokeObjectURL(url);
      });
    }

    // refresh labels on first load and whenever language changes
    let HEADS = getTableHeaders();
    document.querySelectorAll('table.table tbody tr').forEach(tr => addLabelsToRow(tr, HEADS));
    window.addEventListener('wb:lang', () => {
      HEADS = getTableHeaders();
      document.querySelectorAll('table.table tbody tr').forEach(tr => addLabelsToRow(tr, HEADS));
    });

    // submit
    document.getElementById('place-order').addEventListener('click', sendToSheet);

    // payment buttons
    const payRev = document.getElementById('pay-revolut');
    if (payRev) payRev.addEventListener('click', openRevolut);
    const paySat = document.getElementById('pay-satispay');
    if (paySat) paySat.addEventListener('click', openSatispay);

    // delivery toggle re-compute (if present)
    const cb = document.getElementById('include-delivery');
    if (cb) cb.addEventListener('change', togglePayButtons);

    // reflect initial disabled state (0.00 total)
    togglePayButtons();
  });
})();
