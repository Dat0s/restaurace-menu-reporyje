async function scrapePippiGrill() {
  return {
    name: 'HQ Pippi Grill',
    source: 'https://pippigrill-stodulky.choiceqr.com/section:menu/sendvice-s-pastrami',
    phone: '+420 774 304 494',
    menuDate: 'Stálé menu',
    scrapedAt: new Date().toISOString(),
    sections: [
      {
        title: 'Do křupava smažené',
        items: [
          { name: 'Kuřecí křídla Sriracha (12ks)', price: '245 Kč' },
          { name: 'Kuřecí křídla Teriyaki (12ks)', price: '245 Kč' },
          { name: 'Jižanské kuře', price: '155 Kč' }
        ]
      },
      {
        title: 'Sendvič s kuřecím masem',
        items: [
          { name: 'Klasik sendvič', price: '139 Kč' },
          { name: 'Kari sendvič', price: '185 Kč' },
          { name: 'Chilli sendvič', price: '185 Kč' },
          { name: 'Lanýžový sendvič', price: '199 Kč' }
        ]
      },
      {
        title: 'Sendviče s Pastrami',
        items: [
          { name: 'Chilli pastrami', price: '205 Kč' },
          { name: 'Lanýžové pastrami', price: '225 Kč' }
        ]
      },
      {
        title: 'Sendvič s vepřovým masem',
        items: [
          { name: 'Porchetta klasik', price: '175 Kč' },
          { name: 'Porchetta speciál', price: '195 Kč' }
        ]
      }
    ]
  };
}

module.exports = { scrapePippiGrill };
