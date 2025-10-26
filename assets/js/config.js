window.SITE_CONFIG = {
  "brand": "The Weekend Bite",
  "city": "Torino",
  "phone": "+39 320 177 5661",
  "wa": "https://wa.me/393201775661?text=",
  "delivery": {
    "minKg": 1,
    "fee": 2,
    "window": "Weekend"
  },
  "items": [
    {
      "key": "tawook",
      "price": 15,
      "img": "assets/img/tawook_wide.webp",
      "name_en": "Red Shish Tawook",
      "name_it": "Shish Tawook Rosso",
      "desc_en": "Tender chicken in yogurt, tomato, lemon, garlic & paprika.",
      "desc_it": "Pollo tenero in yogurt, pomodoro, limone, aglio e paprika."
    },
    {
      "key": "shawarma",
      "price": 15,
      "img": "assets/img/placeholder.svg",
      "name_en": "Lebanese Shawarma",
      "name_it": "Shawarma Libanese",
      "desc_en": "Classic marinade with garlic, lemon & warm spices.",
      "desc_it": "Marinatura classica con aglio, limone e spezie calde."
    },
    {
      "key": "fajita",
      "price": 16,
      "img": "assets/img/fajita_wide.webp",
      "name_en": "Lebanese Fajita",
      "name_it": "Fajita Libanese",
      "desc_en": "Chicken strips with peppers, onion & Lebanese spices.",
      "desc_it": "Straccetti di pollo con peperoni, cipolla e spezie libanesi."
    },
    {
      "key": "escalope",
      "price": 16,
      "img": "assets/img/placeholder.svg",
      "name_en": "Escalope",
      "name_it": "Escalope",
      "desc_en": "Thin marinated cutlets—cook fast, pan or air-fryer.",
      "desc_it": "Fettine sottili marinate — cottura veloce in padella o air-fryer."
    }
  ]
};

/* ---------------------------
   Payment config (Revolut/Satispay)
   Used by the payment buttons on Order page
--------------------------- */
window.PAY = {
  currency: 'EUR',

  // TODO: put your real handles here
  revolutUser: 'ibrahip44g',    // e.g. revolut.me/yourrevolut
  satispayTag: 'yoursatispay',   // e.g. tag.satispay.com/yoursatispay

  // URL templates — keep {amount}, {user}, {tag}, {cur}
  templates: {
    // Most personal Revolut links support the path format below:
    revolut: 'https://revolut.me/ibrahip44g/{amount}?currency={cur}',
    // If your link uses a query format, use this instead:
    // revolut: 'https://revolut.me/{user}?amount={amount}&currency={cur}',

    // Satispay tag link (adjust to satispay.me if your account uses that)
    satispay: 'https://tag.satispay.com/{tag}?amount={amount}'
    // satispay: 'https://satispay.me/{tag}?amount={amount}'
  }
};
