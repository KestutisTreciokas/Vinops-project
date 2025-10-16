const sample = {
  photos: [],
  specs: {
    year: 2019,
    make: 'Toyota',
    model: 'Camry',
    body: 'Sedan',
    engine: '2.5L',
    transmission: 'AT',
    drive: 'FWD',
  },
  lot: {
    lotNumber: 80103945,
    auction: 'Copart',
    seller: 'Progressive Casualty Insurance',
    date: '2025-05-12',
    odometer: 49792,
    status: 'Sold',
    finalBid: 11500
  },
  history: [
    { date: '2025-05-12', auction: 'Copart', lot: '80103945', status: 'Sold', price: 11500 },
    { date: '2024-11-03', auction: 'IAA',   lot: '73900210', status: 'Sold', price: 8900  }
  ]
}
export default sample
