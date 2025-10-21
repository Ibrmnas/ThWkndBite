/** Apps Script backend for The Weekend Bite orders -> Google Sheets **/
const SHEET_ID     = '1JK3ybIsYrMhb3PifwmedKbQcY5Jy6IZnucRjY_Xc5aw'; // your sheet
const SHEET_NAME   = 'Orders';                                         // tab name
const NOTIFY_EMAIL = 'thewkndbitetorino@gmail.com';                    // your Gmail
const TZ = 'Europe/Rome';

/** HTML-escape helper (for safe email HTML) */
function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":"&#39;"
  }[m]));
}

/** (Optional) Ensure 'Allergies' column exists (adds it at the far right if missing) */
function ensureAllergiesColumn_(sheet){
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!headers.includes('Allergies')) {
    const lastCol = sheet.getLastColumn();
    sheet.insertColumnAfter(lastCol);
    sheet.getRange(1, lastCol + 1).setValue('Allergies');
  }
}

/** Simple GET so you can open the /exec URL in a browser to test */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, ping: 'TheWeekendBite', time: new Date() }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Receive orders from the website (POST) */
function doPost(e) {
  try {
    const raw  = (e && e.postData) ? e.postData.contents : '{}';   // we post text/plain from the site
    const data = JSON.parse(raw || '{}');

    // Honeypot anti-spam: hidden field must be empty
    if (data.hp && String(data.hp).trim() !== '') {
      return json({ ok:false, error:'spam' }, 400);
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Missing sheet "' + SHEET_NAME + '"');

    // (Optional) make sure 'Allergies' column exists (will append at the end if missing)
    ensureAllergiesColumn_(sheet);

    const ts = new Date();
    const id = 'WB-' + Utilities.formatDate(ts, TZ, 'yyyyMMdd-HHmmss') + '-' +
               Math.floor(Math.random()*1000).toString().padStart(3,'0');

    const items = Array.isArray(data.items) ? data.items : [];
    const total = items.reduce((s, it) => s + (Number(it.price)||0) * (Number(it.qty)||0), 0);

    const allergies = (data.allergies || '').toString().trim();

    // IMPORTANT: The array order must match your sheet columns.
    sheet.appendRow([
      Utilities.formatDate(ts, TZ, 'yyyy-MM-dd HH:mm:ss'), // Timestamp
      id,                                                  // Order ID
      data.name || '',                                     // Name
      data.phone || '',                                    // Phone
      data.address || '',                                  // Address
      JSON.stringify(items),                               // Items JSON
      Number(total.toFixed(2)),                            // Total €
      data.notes || '',                                    // Notes
      allergies,                                           // Allergies  <-- NEW
      data.lang || '',                                     // Lang
      data.ua || ''                                        // UA
    ]);

    // Email summary
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

    return json({ ok:true, id }, 200);
  } catch (err) {
    return json({ ok:false, error:String(err) }, 400);
  }
}

/** Minimal JSON response helper (Apps Script web apps ignore status code; we return JSON only) */
function json(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
