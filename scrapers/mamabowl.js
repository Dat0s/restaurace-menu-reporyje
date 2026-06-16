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
      {
        title: "Domácí Drinky",
        items: [
          { name: "Domácí Limonáda", price: "68 Kč" },
          { name: "Časadá (trà sả đá)", price: "85 Kč" },
          { name: "Cafe Nâu Đá", price: "119 Kč" },
        ],
      },
      {
        title: "Daily Combos",
        items: [
          {
            name: "Saigon Combo",
            price: "239 Kč",
            description: "1x bún bò nam bộ, 1x domácí limonáda",
          },
          {
            name: "Saigon Street Combo",
            price: "299 Kč",
            description:
              "1x bún bò nam bộ, jarní závitky (2ks), 1x domácí limonáda",
          },
          {
            name: "Hanoi Combo",
            price: "319 Kč",
            description: "1x bún chả, jarní závitky (2ks), 1x domácí limonáda",
          },
          {
            name: "Hanoi Street Combo",
            price: "389 Kč",
            description:
              "gyozy (4ks), jarní závitky (2ks), ha cao (4ks), 1x batátové hranolky, 1x domácí limonáda",
          },
          {
            name: "Fresh Combo",
            price: "239 Kč",
            description: "1x mama chicken classic, 1x domácí limonáda",
          },
          {
            name: "Crispy Combo",
            price: "329 Kč",
            description:
              "1x mama crispy chicken, jarní závitky (2ks), 1x domácí limonáda",
          },
        ],
      },
      {
        title: "Combo pro 2",
        items: [
          {
            name: "Mama Pro 2 Classic",
            price: "559 Kč",
            description:
              "1x mama grilled chicken, 1x bún bò nam bộ, 1x batátové hranolky, 2x domácí limonáda 0,4l",
          },
          {
            name: "Mama Pro 2 Max",
            price: "619 Kč",
            description:
              "1x mama crispy chicken, 1x mama crispy duck, 2x letní závitky kuřecí (4ks), domácí limonáda 0,4l",
          },
        ],
      },
      {
        title: "Family Combo",
        items: [
          {
            name: "Mama Family Combo",
            price: "899 Kč",
            description:
              "1x mama crispy duck, 1x mango beef, 1x bún bò nam bộ, 1x letní závitky kuřecí (2ks), 1x jarní závitky (2ks), 1x batátové hranolky",
          },
          {
            name: "Mama Big Family",
            price: "1 299 Kč",
            description:
              "1x mama crispy chicken, 1x mama crispy duck, 1x bún chả, 1x bún nem, gyozy (4ks), 2x letní závitky kuřecí (4ks), 1x jarní závitky (2ks), 2x batátové hranolky, 3x domácí limonáda 0,4l",
          },
        ],
      },
    ],
  };
}

module.exports = { scrapeMamaBowl };
