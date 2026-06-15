// Menu is rendered entirely as images (Zyro builder). Items hardcoded from visual inspection.
// Update this file when mamabowl.cz/menu changes.
async function scrapeMamaBowl() {
  const res = await fetch("https://mamabowl.cz/menu");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  return {
    name: "Mama Bowl",
    source: "https://mamabowl.cz/menu",
    phone: "+420 704 246 868",
    menuDate: "",
    scrapedAt: new Date().toISOString(),
    sections: [
      {
        title: "Mama Bowls",
        items: [
          { name: "Mama Bowl Grilled Chicken", price: "229 Kč" },
          { name: "Mama Bowl Crispy Chicken", price: "239 Kč" },
          { name: "Mama Bowl Crispy Duck", price: "259 Kč" },
        ],
      },
      {
        title: "Viet Classics",
        items: [
          { name: "Bún Bò Nam Bộ", price: "199 Kč" },
          { name: "Bún Nem", price: "189 Kč" },
          { name: "Bún Chả", price: "219 Kč" },
          { name: "Mango Beef", price: "199 Kč" },
          { name: "Phởčko", price: "199 Kč" },
        ],
      },
      {
        title: "Domácí Drinky",
        items: [
          { name: "Domácí Limonáda", price: "68 Kč" },
          { name: "Časadá (trà sả đá)", price: "85 Kč" },
          { name: "Cafe Nâu Đá", price: "119 Kč" },
        ],
      },
      {
        title: "Starters",
        items: [
          { name: "Nem Chay", price: "79 Kč" },
          { name: "Nem Rán (2 ks)", price: "89 Kč" },
          { name: "Nem Cuốn", price: "89 Kč" },
          { name: "Khoai Lang Chiên", price: "99 Kč" },
          { name: "Gyoza (4 ks)", price: "109 Kč" },
          { name: "Ha Cảo Háp (4 ks)", price: "109 Kč" },
          { name: "Banh Bao – Tradiční", price: "149 Kč" },
          { name: "Banh Bao – Xa Xíu", price: "149 Kč" },
        ],
      },
    ],
  };
}

module.exports = { scrapeMamaBowl };
