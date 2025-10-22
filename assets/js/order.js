(function () {
  const REQUEST_TIMEOUT_MS = 15000;

  function money(n) {
    return (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);
  }
  function itemsMap() {
    const m = {};
    (window.SITE_CONFIG.items || []).forEach(i => (m[i.key] = i));
    return m;
  }

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

    // Qty
    const tdQty = td();
    const qty = document.createElement('input');
    qty.type = 'number';
    qty.step = '0.5';
    qty.min = '0.5';
    tdQty.appendChild(qty);

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
    del.addEventListener('click', () => {
      tr.remove();
      recalc();
    });
    tdAct.appendChild(del);

    [tdItem, tdPrice, tdQty, tdNotes, tdTot, tdAct].forEach(x => tr.appendChild(x));
    tbody.appendChild(tr);

    function sync() {
      const it = map[sel.value];
      const p = it ? it.price : 0;
      price.value = money(p);
      const q = parseFloat(qty.value || 0);
      tot.value = money(p * q);
      recalc();
    }
    sel.addEventListener('change', sync);
    qty.addEventListener('input', sync);

    if (row) {
      sel.value = row.key;
      qty.value = row.qty;
    } else {
      const firstKey = Object.keys(map)[0];
      if (firstKey) sel.value = firstKey;
      qty.value = 1;
    }
    sync();
  }

  function recalc() {
    let sum = 0;
    document.querySelectorAll('tbody tr').forEach(tr => {
      sum += parseFloat(tr.querySelector('td:nth-child(5) input').value || 0);
    });
    document.getElementById('grand').textContent = money(sum);
  }

  async function sendToSheet() {
    const endpoint = window.WB_ENDPOINT || '';
    if (!endpoint) {
      alert('Admin: please set WB_ENDPOINT in assets/js/backend.js');
      return;
    }

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

    // Validate minimums: total >= 1kg; per line >= 0.5 in 0.5 steps
    const totalQty = items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
    if (totalQty < 1) {
      alert('Minimum order is 1 kg (you can mix items, e.g., 0.5 + 0.5).');
      return;
    }
    for (const it of items) {
      if (it.qty > 0 && it.qty < 0.5) {
        alert('Minimum per item is 0.5 kg.');
        return;
      }
      const multiple = Math.round(it.qty * 2) / 2;
      if (Math.abs(it.qty - multiple) > 1e-6) {
        alert('Quantities must be in 0.5 kg steps (e.g., 0.5, 1, 1.5).');
        return;
      }
    }

      const emailEl = document.getElementById('c-email');
      if (!emailEl || !emailEl.value.trim() || !emailEl.checkValidity()) {
        emailEl?.reportValidity();  // shows the built-in browser message
        emailEl?.focus();
      return;
    }
    
    const allergies = (document.getElementById('c-allergies')?.value || '').trim();

    const payload = {
      name: document.getElementById('c-name').value.trim(),
      phone: document.getElementById('c-phone').value.trim(),
      address: document.getElementById('c-addr').value.trim(),
      email: (document.getElementById('c-email')?.value || '').trim(),
      notes: (document.getElementById('c-notes').value || '').trim(),
      allergies, // <-- send as its own field (matches backend)
      items,
      lang: document.documentElement.lang || 'en',
      ua: navigator.userAgent,
      hp: document.getElementById('hp-field')?.value || '' // honeypot
    };

    if (!payload.name || !payload.phone || !payload.address || items.length === 0) {
      alert('Please fill your details and add at least one item.');
      return;
    }

    const btn = document.getElementById('place-order');
    const prev = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    // timeout support
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, // avoid CORS preflight
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + ' ' + res.statusText + (txt ? ' — ' + txt.slice(0, 200) : ''));
      }

      let j;
      try {
        j = await res.json();
      } catch {
        const txt = await res.text();
        throw new Error('Invalid JSON: ' + txt.slice(0, 200));
      }

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
      btn.textContent = prev;
      btn.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const tbody = document.getElementById('rows');
    addRow(tbody);
    recalc();

    document.getElementById('add').addEventListener('click', () => addRow(tbody));
    document.getElementById('clear').addEventListener('click', () => {
      tbody.innerHTML = '';
      recalc();
    });

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
        const csv = rows
          .map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(','))
          .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'order-' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    document.getElementById('place-order').addEventListener('click', sendToSheet);
  });
})();
