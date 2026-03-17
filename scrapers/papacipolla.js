async function scrapePapaCipolla() {
  return {
    name: 'Papa Cipolla',
    source: 'https://speedlo.cz/app/pizzacipolla/papa-cipolla-reporyje/wb/menu',
    phone: '+420 725 558 866',
    menuDate: 'Stálé menu',
    scrapedAt: new Date().toISOString(),
    sections: [{
      title: 'Nejprodávanější',
      items: [
        { name: 'Vesuvio 32', price: '219 Kč' },
        { name: 'Margherita 32', price: '179 Kč' },
        { name: 'Quattro Formaggi 32', price: '249 Kč' }
      ]
    }]
  };
}

module.exports = { scrapePapaCipolla };
