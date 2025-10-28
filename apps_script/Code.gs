/** ---- CONFIG ---- **/
const SHEET_ID     = '1JK3ybIsYrMhb3PifwmedKbQcY5Jy6IZnucRjY_Xc5aw';     // e.g. 1AbC... from the Sheet URL
const SHEET_NAME   = 'Orders';
const NOTIFY_EMAIL = 'thewkndbitetorino@gmail.com';
const TZ           = 'Europe/Rome';
const FROM_NAME = 'The Weekend Bite';  // shows as sender name in inbox
const REPLY_TO  = 'thewkndbitetorino@gmail.com'; // replies go here

// (Optional) for quick pay links in the email:
const REVOLUT_USER = 'yourrevolut';     // e.g. revolut.me/yourrevolut
const SATISPAY_TAG = 'yoursatispay';    // e.g. tag.satispay.com/yoursatispay
const CURRENCY     = 'EUR';

/** ---- HELPERS ---- **/
function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));
}
function appendByHeader_(sheet, obj){
  const lastCol = sheet.getLastColumn() || 1;
  const headers = sheet.getRange(1,1,1,lastCol).getValues()[0];
  const row = headers.map(h => (Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : ''));
  sheet.appendRow(row);
}
function ensureHeaders_(sheet, headersWanted){
  const lastCol = sheet.getLastColumn() || 0;
  const existing = lastCol ? sheet.getRange(1,1,1,lastCol).getValues()[0] : [];
  let col = existing.length;
  headersWanted.forEach(h => {
    if (!existing.includes(h)){
      sheet.insertColumnAfter(Math.max(col,1));
      col = sheet.getLastColumn();
      sheet.getRange(1, col).setValue(h);
      existing.push(h);
    }
  });
}

/** ---- API ---- **/
function doPost(e){
  try{
    const raw  = (e && e.postData) ? e.postData.contents : '{}';
    const data = JSON.parse(raw || '{}');

    // honeypot
    if (data.hp && String(data.hp).trim() !== '') {
      return ContentService.createTextOutput(JSON.stringify({ok:false, error:'spam'})).setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Missing sheet "' + SHEET_NAME + '"');

    // columns we want to maintain
    const HEADERS = [
      'Timestamp','Order ID','Name','Phone','Email','Address',
      'Items JSON','Items (pretty)','Items Total','Delivery Fee','Include Delivery',
      'Payable Total','Currency','Payment Method','Notes','Allergies','Lang','UA'
    ];
    ensureHeaders_(sheet, HEADERS);

    // server ts & id
    const ts = new Date();
    const id = 'WB-' + Utilities.formatDate(ts, TZ, 'yyyyMMdd-HHmmss') + '-' +
               Math.floor(Math.random()*1000).toString().padStart(3,'0');

    const items = Array.isArray(data.items) ? data.items : [];
    // Recompute base items total on server (trust but verify)
    const itemsTotal = items.reduce((s,it)=> s + (Number(it.price)||0) * (Number(it.qty)||0), 0);
    const delFee = Number(data.delivery_fee || 0);
    const includeDelivery = !!data.include_delivery;
    const payable = includeDelivery ? (itemsTotal + delFee) : itemsTotal;

    // READABLE multi-line list (saved in the sheet, used in client email) — includes item notes when present
    const itemsPretty = items.map(it => {
      const lt   = (Number(it.price)||0) * (Number(it.qty)||0);
      const note = it.notes ? ` | note: ${it.notes}` : '';
      return `${it.name} — ${it.qty} kg @ €${it.price}/kg = €${lt.toFixed(2)}${note}`;
    }).join('\n');

    // write row by header name
    appendByHeader_(sheet, {
      'Timestamp'       : Utilities.formatDate(ts, TZ, 'yyyy-MM-dd HH:mm:ss'),
      'Order ID'        : id,
      'Name'            : data.name || '',
      'Phone'           : data.phone || '',
      'Email'           : data.email || '',
      'Address'         : data.address || '',
      'Items JSON'      : JSON.stringify(items),
      'Items (pretty)'  : itemsPretty,
      'Items Total'     : Number(itemsTotal.toFixed(2)),
      'Delivery Fee'    : Number(delFee.toFixed(2)),
      'Include Delivery': includeDelivery ? 'yes' : 'no',
      'Payable Total'   : Number(payable.toFixed(2)),
      'Currency'        : (data.currency || CURRENCY || 'EUR'),
      'Payment Method'  : (data.pay_method || 'none'),
      'Notes'           : data.notes || '',
      'Allergies'       : data.allergies || '',
      'Lang'            : data.lang || '',
      'UA'              : data.ua || ''
    });

    // Wrap the "Items (pretty)" cell so multiple lines are visible
    const lastRow = sheet.getLastRow();
    const hdrRow  = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const prettyCol = hdrRow.indexOf('Items (pretty)') + 1;
    if (prettyCol > 0) sheet.getRange(lastRow, prettyCol).setWrap(true);

    // ADMIN EMAIL: bullet list with per-item notes (if any)
    const itemsLines = items.map(it => {
      const base = `- ${escapeHtml(it.name)} — ${escapeHtml(it.qty)} kg @ €${escapeHtml(it.price)}/kg`;
      const note = it.notes ? ` <span style="color:#555;">(<b>note:</b> ${escapeHtml(it.notes)})</span>` : '';
      return base + note;
    }).join('<br>');

    const revolutLink = REVOLUT_USER
      ? `https://revolut.me/${encodeURIComponent(REVOLUT_USER)}?amount=${payable.toFixed(2)}&currency=${encodeURIComponent(CURRENCY)}`
      : '';
    const satispayLink = SATISPAY_TAG
      ? `https://tag.satispay.com/${encodeURIComponent(SATISPAY_TAG)}?amount=${payable.toFixed(2)}`
      : '';

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h3 style="margin:0 0 8px">New Order: ${escapeHtml(id)}</h3>
        <p><b>Name:</b> ${escapeHtml(data.name)}<br>
           <b>Phone:</b> ${escapeHtml(data.phone)}<br>
           <b>Email:</b> ${escapeHtml(data.email || '')}<br>
           <b>Address:</b> ${escapeHtml(data.address)}</p>

        <p><b>Items:</b><br>${itemsLines || '(none)'}</p>

        <p>
          <b>Items total:</b> €${itemsTotal.toFixed(2)}<br>
          <b>Delivery fee:</b> €${delFee.toFixed(2)} (${includeDelivery ? 'included' : 'not included'})<br>
          <b>Payable total:</b> €${payable.toFixed(2)} ${escapeHtml(data.currency || CURRENCY || 'EUR')}<br>
          <b>Payment method:</b> ${escapeHtml(data.pay_method || 'none')}
        </p>

        ${ (revolutLink || satispayLink) ? `
        <p><b>Quick pay:</b><br>
          ${revolutLink ? `<a href="${revolutLink}">Revolut for €${payable.toFixed(2)}</a><br>` : ``}
          ${satispayLink ? `<a href="${satispayLink}">Satispay for €${payable.toFixed(2)}</a>` : ``}
        </p>` : ``}

        <p><b>Notes:</b> ${escapeHtml(data.notes || '')}<br>
           <b>Allergies:</b> ${escapeHtml(data.allergies || '')}</p>

        <p style="color:#888"><b>Lang:</b> ${escapeHtml(data.lang || '')}<br>
           <b>UA:</b> ${escapeHtml(data.ua || '')}</p>
      </div>
    `;

    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: `New Order: ${id} (Payable €${payable.toFixed(2)})`,
      htmlBody: html,
      name: FROM_NAME,
      replyTo: REPLY_TO
    });

    // --- Customer confirmation (uses Items (pretty), which now includes notes)
    (function sendClientEmail(){
      var customerEmail = (data.email || '').trim();
      if (!customerEmail) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return;

      var revLink = REVOLUT_USER
        ? `https://revolut.me/${encodeURIComponent(REVOLUT_USER)}?amount=${payable.toFixed(2)}&currency=${encodeURIComponent(CURRENCY)}`
        : '';
      var satLink = SATISPAY_TAG
        ? `https://tag.satispay.com/${encodeURIComponent(SATISPAY_TAG)}?amount=${payable.toFixed(2)}`
        : '';

      var clientHtml = `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45">
          <h3 style="margin:0 0 8px">Thanks! We received your order.</h3>
          <p style="margin:0 0 8px"><b>Order ID:</b> ${escapeHtml(id)}</p>

          <p style="margin:0 0 8px">
            <b>Name:</b> ${escapeHtml(data.name)}<br>
            <b>Phone:</b> ${escapeHtml(data.phone)}<br>
            <b>Address:</b> ${escapeHtml(data.address)}
          </p>

          <p><b>Order summary</b></p>
          <div style="padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:10px;white-space:pre-line">
            ${escapeHtml(itemsPretty)}
          </div>

          <p style="margin:6px 0">
            <b>Items total:</b> €${itemsTotal.toFixed(2)}<br>
            <b>Delivery fee:</b> €${delFee.toFixed(2)} (${includeDelivery ? 'included' : 'not included'})<br>
            <b>To pay:</b> €${payable.toFixed(2)} ${escapeHtml(data.currency || CURRENCY || 'EUR')}
          </p>

          ${(revLink || satLink) ? `
            <p style="margin:12px 0 8px"><b>Pay now</b></p>
            ${revLink ? `<p style="margin:4px 0"><a href="${revLink}">Pay with Revolut (€${payable.toFixed(2)})</a></p>` : ``}
            ${satLink ? `<p style="margin:4px 0"><a href="${satLink}">Pay with Satispay (€${payable.toFixed(2)})</a></p>` : ``}
          ` : ``}

          <p style="margin-top:14px;color:#666">If any detail is wrong, just reply to this email.</p>
        </div>
      `;

      MailApp.sendEmail({
        to: customerEmail,
        subject: `We received your order – ${id}`,
        htmlBody: clientHtml,
        name: FROM_NAME,
        replyTo: REPLY_TO
      });
    })();

    return ContentService
      .createTextOutput(JSON.stringify({ ok:true, id }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err){
    return ContentService
      .createTextOutput(JSON.stringify({ ok:false, error:String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
