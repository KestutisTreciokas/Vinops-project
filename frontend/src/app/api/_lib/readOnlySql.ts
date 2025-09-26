/**
 * Разрешаем только одиночные SELECT/WITH (без ; и срезов DML/DDL).
 */
export function isReadonlySQL(sql: string): boolean {
  const s = sql.trim()
    .replace(/--.*$/gm,'')      // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g,'') // strip block comments
    .trim();
  if (s.length === 0) return false;
  if (s.includes(';')) return false; // одна команда за вызов
  const head = s.slice(0, 16).toUpperCase();
  return head.startsWith('SELECT') || head.startsWith('WITH ');
}
