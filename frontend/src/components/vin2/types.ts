export type Photo = { id: number; title: string; url?: string };

export type Specs = {
  year: number; make: string; model: string;
  body: string; engine: string; transmission: string;
  drive: string; fuel: string;
};

export type LotInfo = {
  lotNumber: string; auction: string; seller: string;
  date: string; odometer: string; status: string; finalBid: number;
};

export type HistoryItem = {
  date: string; auction: string; lot: string; status: string; price: number;
};

export type VinData = {
  photos: Photo[]; specs: Specs; lot: LotInfo; history: HistoryItem[];
};
