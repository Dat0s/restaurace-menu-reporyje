async function scrapePapaCipolla() {
  return {
    name: 'Papa Cipolla',
    source: 'https://speedlo.cz/app/pizzacipolla/papa-cipolla-reporyje/wb/menu',
    phone: '+420 725 558 866',
    menuDate: 'Stálé menu',
    scrapedAt: new Date().toISOString(),
    sections: [
      {
        title: 'Nejprodávanější',
        items: [
          { name: 'Vesuvio 32', price: '219 Kč' },
          { name: 'Margherita 32', price: '179 Kč' },
          { name: 'Quattro Formaggi 32', price: '249 Kč' }
        ]
      },
      {
        title: 'Pizza 1/2',
        items: [
          { name: 'Margherita 1/2', price: '129,50 Kč' },
          { name: 'Quattro Formaggi 1/2', price: '174,50 Kč' },
          { name: 'Margherita Bufala 1/2', price: '169,50 Kč' },
          { name: 'Funghi 1/2', price: '134,50 Kč' },
          { name: 'Spinaci 1/2', price: '139,50 Kč' },
          { name: 'Vesuvio 1/2', price: '149,50 Kč' },
          { name: 'Alla Crema 1/2', price: '164,50 Kč' },
          { name: 'Capricciosa 1/2', price: '154,50 Kč' },
          { name: 'Hawai 1/2', price: '154,50 Kč' },
          { name: 'Al Capone 1/2', price: '154,50 Kč' },
          { name: 'Salame 1/2', price: '149,50 Kč' },
          { name: 'Piccante 1/2', price: '164,50 Kč' },
          { name: 'Mascarpone 1/2', price: '164,50 Kč' },
          { name: 'Mexicana 1/2', price: '164,50 Kč' },
          { name: 'Don Corleone 1/2', price: '164,50 Kč' },
          { name: 'Papa Cipolla 1/2', price: '174,50 Kč' },
          { name: 'Prosciutto Crudo 1/2', price: '164,50 Kč' },
          { name: 'Pollo e Cipolla 1/2', price: '164,50 Kč' },
          { name: 'Marco Polo 1/2', price: '164,50 Kč' },
          { name: 'Spinaci Pollo 1/2', price: '164,50 Kč' },
          { name: 'Broccoli Pollo 1/2', price: '164,50 Kč' },
          { name: 'Gorgonzola 1/2', price: '159,50 Kč' },
          { name: 'Siciliana Tonno 1/2', price: '169,50 Kč' },
          { name: 'Napoletana 1/2', price: '169,50 Kč' },
          { name: 'Diavola 1/2', price: '169,50 Kč' },
          { name: 'Spinaci Pancetta 1/2', price: '164,50 Kč' },
          { name: 'Bandiera 1/2', price: '144,50 Kč' },
          { name: 'Vegetariana 1/2', price: '139,50 Kč' }
        ]
      },
      {
        title: 'Pizza 32',
        items: [
          { name: 'Margherita 32', price: '179 Kč' },
          { name: 'Quattro Formaggi 32', price: '249 Kč' },
          { name: 'Margherita Bufala 32', price: '249 Kč' },
          { name: 'Funghi 32', price: '199 Kč' },
          { name: 'Vegetariana Verdure 32', price: '219 Kč' },
          { name: 'Spinaci 32', price: '209 Kč' },
          { name: 'Vesuvio 32', price: '219 Kč' },
          { name: 'Capricciosa 32', price: '229 Kč' },
          { name: 'Hawaii 32', price: '229 Kč' },
          { name: 'Al Capone 32', price: '229 Kč' },
          { name: 'Alla Crema 32', price: '239 Kč' },
          { name: 'Salame 32', price: '219 Kč' },
          { name: 'Piccante 32', price: '239 Kč' },
          { name: 'Mascarpone 32', price: '239 Kč' },
          { name: 'Mexicana 32', price: '239 Kč' },
          { name: 'Carbonara 32', price: '249 Kč' },
          { name: 'Pancetta 32', price: '249 Kč' },
          { name: 'Don Corleone 32', price: '239 Kč' },
          { name: 'Papa Cipolla 32', price: '249 Kč' },
          { name: 'Prosciutto Crudo 32', price: '239 Kč' },
          { name: 'Siciliana Tonno 32', price: '249 Kč' },
          { name: 'Pollo e Cipolla 32', price: '239 Kč' },
          { name: 'Broccoli Pollo 32', price: '239 Kč' },
          { name: 'Spinaci Pollo 32', price: '239 Kč' },
          { name: 'Marco Polo 32', price: '239 Kč' },
          { name: 'Bandiera 32', price: '219 Kč' },
          { name: 'Vegetariana 32', price: '219 Kč' },
          { name: 'Napoletana 32', price: '249 Kč' },
          { name: 'Diavola 32', price: '239 Kč' },
          { name: 'Spinaci Pancetta 32', price: '239 Kč' },
          { name: 'Bolognese 32', price: '249 Kč' },
          { name: 'Gorgonzola 32', price: '239 Kč' },
          { name: 'Dolce Banana 32', price: '259 Kč' }
        ]
      },
      {
        title: 'Pizza 40',
        items: [
          { name: 'Margherita 40', price: '259 Kč' },
          { name: 'Quattro Formaggi 40', price: '349 Kč' },
          { name: 'Margherita Bufala 40', price: '349 Kč' },
          { name: 'Funghi 40', price: '269 Kč' },
          { name: 'Vegetariana Verdure 40', price: '309 Kč' },
          { name: 'Spinaci 40', price: '279 Kč' },
          { name: 'Vesuvio 40', price: '299 Kč' },
          { name: 'Capricciosa 40', price: '309 Kč' },
          { name: 'Hawaii 40', price: '309 Kč' },
          { name: 'Al Capone 40', price: '309 Kč' },
          { name: 'Alla Crema 40', price: '329 Kč' },
          { name: 'Salame 40', price: '299 Kč' },
          { name: 'Piccante 40', price: '329 Kč' },
          { name: 'Mascarpone 40', price: '329 Kč' },
          { name: 'Mexicana 40', price: '329 Kč' },
          { name: 'Pancetta 40', price: '339 Kč' },
          { name: 'Carbonara 40', price: '339 Kč' },
          { name: 'Don Corleone 40', price: '329 Kč' },
          { name: 'Papa Cipolla 40', price: '349 Kč' },
          { name: 'Prosciutto Crudo 40', price: '329 Kč' },
          { name: 'Siciliana Tonno 40', price: '339 Kč' },
          { name: 'Pollo e Cipolla 40', price: '329 Kč' },
          { name: 'Spinaci Pollo 40', price: '329 Kč' },
          { name: 'Broccoli Pollo 40', price: '329 Kč' },
          { name: 'Marco Polo 40', price: '329 Kč' },
          { name: 'Bandiera 40', price: '289 Kč' },
          { name: 'Vegetariana 40', price: '279 Kč' },
          { name: 'Spinaci Pancetta 40', price: '329 Kč' },
          { name: 'Gorgonzola 40', price: '319 Kč' },
          { name: 'Diavola 40', price: '319 Kč' },
          { name: 'Napoletana 40', price: '339 Kč' },
          { name: 'Bolognese 40', price: '339 Kč' },
          { name: 'Dolce Banana 40', price: '349 Kč' }
        ]
      },
      {
        title: 'Vegan',
        items: [
          { name: 'Vegan Margherita', price: '189 Kč' },
          { name: 'Vegan Funghi', price: '199 Kč' },
          { name: 'Vegan Bandiera', price: '219 Kč' },
          { name: 'Vegan Marco e NoPollo', price: '259 Kč' },
          { name: 'Vegan Spinaci e NoPollo', price: '259 Kč' },
          { name: 'Vegan Hawaii', price: '259 Kč' },
          { name: 'Vegan Mexicana', price: '259 Kč' },
          { name: 'Vegan Diavola', price: '249 Kč' },
          { name: 'Focaccia Aglio e Olio', price: '69 Kč' }
        ]
      },
      {
        title: 'Pasta & Gnocchi',
        items: [
          { name: 'Carbonara l\'originale 1960', price: '219 Kč' },
          { name: 'Ragù alla Bolognese', price: '219 Kč' },
          { name: 'Aglio Olio e Peperoncino', price: '189 Kč' },
          { name: 'Puttanesca', price: '219 Kč' },
          { name: 'all\'Amatriciana', price: '219 Kč' },
          { name: 'Pasta s pestem a krevetami', price: '219 Kč' },
          { name: 'Pasta s pestem a kuřetem', price: '219 Kč' },
          { name: 'Pasta s rajčaty a krevetami', price: '219 Kč' },
          { name: 'Pasta Pomodoro e Mozzarella', price: '219 Kč' },
          { name: 'Pasta Prosciutto e Funghi', price: '219 Kč' },
          { name: 'Pasta Spinaci e Pollo', price: '219 Kč' }
        ]
      },
      {
        title: 'Saláty',
        items: [
          { name: 'Insalata di gamberi con rucola', price: '249 Kč' },
          { name: 'Insalata Caesar', price: '229 Kč' },
          { name: 'Insalata Caesar s krevetami', price: '229 Kč' },
          { name: 'Insalata Nicoise', price: '239 Kč' },
          { name: 'Insalata Caprese', price: '239 Kč' },
          { name: 'Focaccia samostatně', price: '89 Kč' }
        ]
      },
      {
        title: 'Brambory',
        items: [
          { name: 'Patate Spinaci', price: '249 Kč' },
          { name: 'Patate Broccoli', price: '249 Kč' },
          { name: 'Patate Prosciutto champignon', price: '249 Kč' },
          { name: 'Patate Pancetta', price: '249 Kč' },
          { name: 'Patate Formaggi', price: '249 Kč' }
        ]
      },
      {
        title: 'Focaccia',
        items: [
          { name: 'Focaccia Aglio e olio', price: '99 Kč' },
          { name: 'Focaccia Caprese', price: '209 Kč' },
          { name: 'Focaccia Pesto', price: '129 Kč' },
          { name: 'Focaccia Prosciutto Crudo', price: '209 Kč' }
        ]
      },
      {
        title: 'Dezerty',
        items: [
          { name: 'Tiramisu 100g', price: '89 Kč' },
          { name: 'Dolce Banana 32', price: '229 Kč' },
          { name: 'Dolce Banana 40', price: '309 Kč' }
        ]
      }
    ]
  };
}

module.exports = { scrapePapaCipolla };
