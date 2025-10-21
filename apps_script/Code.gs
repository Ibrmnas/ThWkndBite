const SHEET_ID     = '1JK3ybIsYrMhb3PifwmedKbQcY5Jy6IZnucRjY_Xc5aw';
const SHEET_NAME   = 'Orders';
const NOTIFY_EMAIL = 'thewkndbitetorino@gmail.com';
const TZ = 'Europe/Rome';

function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ ok:true, ping:'TheWeekendBite', time:new Date() })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw  = (e && e.postData) ? e.postData.contents : '{}';
    const data = JSON.parse(raw || '{}');
    if (data.hp && String(data.hp).trim() !== '') return json({ok:false,error:'spam'});

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Missing sheet "' + SHEET_NAME + '"');

    const ts = new Date();
    const id = 'WB-' + Utilities.formatDate(ts, TZ, 'yyyyMMdd-HHmmss') + '-' +
               Math.floor(Math.random()*1000).toString().padStart(3,'0');

    const items = Array.isArray(data.items) ? data.items : [];
    const total = items.reduce((s, it) => s + (Number(it.price)||0) * (Number(it.qty)||0), 0);
    const allergies = (data.allergies || '').toString().trim();

    sheet.appendRow([
      Utilities.formatDate(ts, TZ, 'yyyy-MM-dd HH:mm:ss'), // Timestamp
      id,                                                  // Order ID
      data.name || '',                                     // Name
      data.phone || '',                                    // Phone
      data.address || '',                                  // Address
      JSON.stringify(items),                               // Items JSON
      Number(total.toFixed(2)),                            // EstimatedTotal
      data.notes || '',                                    // Notes
      allergies,                                           // Allergies
      data.lang || '',                                     // Language
      data.ua || ''                                        // UserAgent
    ]);

    const summary = items.map(it => `- ${it.name} — ${it.qty} kg @ €${it.price}/kg`).join('\n');
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: `New Order: ${id} (€${total.toFixed(2)})`,
      htmlBody: `
        <b>${id}</b><br>
        <b>Name:</b> ${escapeHtml(data.name)}<br>
        <b>Phone:</b> ${escapeHtml(data.phone)}<br>
        <b>Address:</b> ${escapeHtml(data.address)}<br>
        <b>Notes:</b> ${escapeHtml(data.notes || '')}<br>
        <b>Allergies:</b> ${escapeHtml(allergies)}<br>
        <pre>${escapeHtml(summary)}</pre>
        <b>Estimated Total:</b> €${total.toFixed(2)}
      `
    });

    return json({ ok:true, id });
  } catch (err) {
    return json({ ok:false, error:String(err) });
  }
}

function json(obj){ 
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
