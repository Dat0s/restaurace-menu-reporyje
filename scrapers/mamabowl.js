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
          {
            name: "Mama Bowl Grilled Chicken",
            price: "229 Kč",
            description:
              "Kuřecí prso, rýže, wakame, edamame, okurka, čerstvá červená a nakládaná žlutá ředkev s Hoisin omáčkou",
          },
          {
            name: "Mama Bowl Crispy Chicken",
            price: "239 Kč",
            description:
              "Křupavé smažené kuře, rýže, wakame, edamame, okurka, čerstvá červená a nakládaná žlutá ředkev s domácí Hoisin omáčkou",
          },
          {
            name: "Mama Bowl Crispy Duck",
            price: "259 Kč",
            description:
              "Křupavá pečená kachna, rýže, wakame, edamame, okurka, čerstvá červená a nakládaná žlutá ředkev s Hoisin omáčkou",
          },
        ],
      },
      {
        title: "Viet Classics",
        items: [
          {
            name: "Bún Bò Nam Bộ",
            price: "199 Kč",
            description:
              "Restované hovězí maso s rýžovými nudlemi, čerstvým salátem, arašídy a asijskými bylinkami, podávané s rybí omáčkou",
          },
          {
            name: "Bún Nem",
            price: "189 Kč",
            description:
              "Rýžové nudle se smaženými jarními závitky, čerstvým salátem a rybí omáčkou",
          },
          {
            name: "Bún Chả",
            price: "219 Kč",
            description:
              "Grilovaný vepřový bůček s rýžovými nudlemi, čerstvým salátem a asijskými bylinkami, podávané s rybí omáčkou",
          },
          {
            name: "Mango Beef",
            price: "199 Kč",
            description:
              "Čerstvý mangový salát a hovězím masem s naším speciálním dresinkem a praženými arašídy",
          },
          {
            name: "Phởčko",
            price: "199 Kč",
            description:
              "Vietnamská polévka s plochými rýžovými nudlemi, hovězím nebo kuřecím masem, jarní cibulkou a koriandrem",
          },
        ],
      },
      {
        title: "Starters",
        items: [
          {
            name: "Nem Chay",
            price: "79 Kč",
            description:
              "křupavé vegetariánské jarní závitky se sladkokyselou omáčkou",
          },
          {
            name: "Nem Rán (2 ks)",
            price: "89 Kč",
            description:
              "domácí jarní závitky s masovo-zeleninovou náplní, podávané s rybí omáčkou",
          },
          {
            name: "Nem Cuốn",
            price: "89 Kč",
            description:
              "letní závitky s kuřecím masem, rýžovými nudlemi, křupavou zeleninou a bohatou hoisin omáčkou",
          },
          {
            name: "Khoai Lang Chiên",
            price: "99 Kč",
            description: "smažené batátové hranolky s chilli-mayo dipem",
          },
          {
            name: "Gyoza (4 ks)",
            price: "109 Kč",
            description:
              "křupavé taštičky s šťavnatou masovo-zeleninovou náplní, podávané se chilli-mayo a unagi omáčkou",
          },
          {
            name: "Ha Cảo Háp (4 ks)",
            price: "109 Kč",
            description:
              "napařované tapiokové knedličky plněné krevetami, podávané s unagi omáčkou",
          },
          {
            name: "Banh Bao – Tradiční",
            price: "149 Kč",
            description:
              "tradiční vietnamské dušené knedličky s vepřovým mletým masem a zeleninou a houbami (1ks)",
          },
          {
            name: "Banh Bao – Xa Xíu",
            price: "149 Kč",
            description:
              "tradiční vietnamské dušené knedličky s nasládlým BBQ vepřovým masem v kantonském stylu (3ks)",
          },
        ],
      },
      {
        title: "Domácí Drinky",
        items: [
          { name: "Domácí Limonáda", price: "68 Kč" },
          {
            name: "Časadá (trà sả đá)",
            price: "85 Kč",
            description: "domácí ledový čaj s příchutí citronové trávy",
          },
          {
            name: "Cafe Nâu Đá",
            price: "119 Kč",
            description:
              "vietnamská ledová káva s kondenzovaným mlékem, bohatá, silná, osvěžující",
          },
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
