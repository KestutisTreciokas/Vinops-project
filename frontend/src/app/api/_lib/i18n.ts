export type Lang = 'en'|'ru';
export function normLang(v: string|null|undefined): Lang {
  return v === 'ru' ? 'ru' : 'en';
}
const STATUS: Record<string, {en:string;ru:string}> = {
  'ACTIVE': {en: 'Active', ru: 'Активен'},
  'SOLD':   {en: 'Sold', ru: 'Продано'},
  'NO_SALE':{en: 'No sale', ru: 'Не продано'},
};
const DAMAGE: Record<string, {en:string;ru:string}> = {
  'FRONT_END': {en:'Front end', ru:'Передняя часть'},
  'REAR_END':  {en:'Rear end',  ru:'Задняя часть'},
};
const TITLE: Record<string, {en:string;ru:string}> = {
  'SALVAGE': {en:'Salvage', ru:'Утиль'},
  'CLEAR':   {en:'Clear',   ru:'Чистый'},
};
export function labelStatus(code: string|null|undefined, lang: Lang): string|null {
  if (!code) return null; const v = STATUS[code]; return v ? v[lang] : null;
}
export function labelDamage(code: string|null|undefined, lang: Lang): string|null {
  if (!code) return null; const v = DAMAGE[code]; return v ? v[lang] : null;
}
export function labelTitle(code: string|null|undefined, lang: Lang): string|null {
  if (!code) return null; const v = TITLE[code]; return v ? v[lang] : null;
}
