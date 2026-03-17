async function scrapeDoner() {
  return {
    name: 'DÖNER KEBAB HOUSE',
    source: 'https://menunet.cz/restaurace/ChIJ78awPAC9C0cRPWrWLiVLFyE/delivery-menu-id/',
    phone: '',
    menuDate: 'Stálé menu',
    scrapedAt: new Date().toISOString(),
    sections: [
      {
        title: 'DÖNER KEBAB',
        items: [
          { name: 'Döner kebab klasik', price: '165 Kč' },
          { name: 'Döner kebab se sýrem', price: '170 Kč' },
          { name: 'Döner kebab hawai', price: '170 Kč' },
          { name: 'Döner kebab jen maso', price: '180 Kč' }
        ]
      },
      {
        title: 'DÜRÜM KEBAB',
        items: [
          { name: 'Dürüm kebab klasik', price: '175 Kč' },
          { name: 'Dürüm kebab se sýrem', price: '180 Kč' },
          { name: 'Dürüm kebab hawai', price: '175 Kč' },
          { name: 'Mega dürüm', price: '210 Kč' },
          { name: 'Dürüm jen maso', price: '210 Kč' },
          { name: 'Dürüm s hranolkami', price: '210 Kč' }
        ]
      },
      {
        title: 'VELKÝ TALÍŘ KEBAB',
        items: [
          { name: 'Velký talíř kebab', price: '180 Kč' },
          { name: 'Velký talíř kebab se sýrem', price: '195 Kč' },
          { name: 'Velký talíř kebab s hranolky', price: '210 Kč' },
          { name: 'Velký talíř kebab s těstovinami', price: '195 Kč' },
          { name: 'Velký talíř kebab jen maso', price: '210 Kč' }
        ]
      },
      {
        title: 'MALÝ TALÍŘ KEBAB',
        items: [
          { name: 'Malý talíř kebab', price: '160 Kč' },
          { name: 'Malý talíř kebab se sýrem', price: '170 Kč' },
          { name: 'Malý talíř kebab s hranolky', price: '170 Kč' },
          { name: 'Malý talíř kebab s těstovinami', price: '165 Kč' },
          { name: 'Malý talíř kebab jen maso', price: '175 Kč' }
        ]
      },
      {
        title: 'VEGETARIÁNSKÁ JÍDLA',
        items: [
          { name: 'Vegetariánský Döner', price: '130 Kč' },
          { name: 'Vegetariánský dürüm', price: '135 Kč' },
          { name: 'Ziggaren Borek 4 ks', price: '145 Kč' },
          { name: 'Falafel dürüm', price: '140 Kč' },
          { name: 'Talíř falafel', price: '160 Kč' },
          { name: 'Halloumi twister', price: '145 Kč' },
          { name: 'Halloumi talíř', price: '165 Kč' }
        ]
      },
      {
        title: 'RYCHLÉ OBČERSTVENÍ',
        items: [
          { name: 'Smažený sýr v chlebu', price: '140 Kč' },
          { name: 'Smažený sýr s hranolky', price: '165 Kč' },
          { name: 'Kuřecí stripsy v tortile', price: '140 Kč' },
          { name: 'Kuřecí stripsy talíř', price: '160 Kč' }
        ]
      },
      {
        title: 'SALÁTY',
        items: [
          { name: 'Selský salát', price: '90 Kč' },
          { name: 'Míchaný salát', price: '100 Kč' },
          { name: 'Těstovinový salát', price: '95 Kč' },
          { name: 'Tuňákový salát', price: '110 Kč' },
          { name: 'Kuřecí salát', price: '135 Kč' }
        ]
      }
    ]
  };
}

module.exports = { scrapeDoner };
