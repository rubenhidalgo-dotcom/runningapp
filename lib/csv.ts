export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i], n=text[i+1];
    if (quoted && c==='"' && n==='"') { field+='"'; i++; }
    else if (c==='"') quoted=!quoted;
    else if (c===',' && !quoted) { row.push(field.trim()); field=""; }
    else if ((c==='\n' || c==='\r') && !quoted) {
      if (c==='\r' && n==='\n') i++;
      row.push(field.trim()); field="";
      if (row.some(Boolean)) rows.push(row); row=[];
    } else field+=c;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  if (rows.length < 2) return [];
  const headers=rows[0].map(h=>h.replace(/^\uFEFF/, '').toLowerCase());
  return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
}
