import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

function loadSheet(file) {
  if (!fs.existsSync(file)) throw new Error('File not found: ' + file);
  const wb = XLSX.readFile(file, { cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  return { sheetName, rows };
}

function keyFromRow(row) {
  return row.join('||');
}

function compare(oldFile, newFile) {
  const oldData = loadSheet(oldFile);
  const newData = loadSheet(newFile);

  const [oldHeader, ...oldRows] = oldData.rows;
  const [newHeader, ...newRows] = newData.rows;

  const oldSet = new Set(oldRows.map(r => keyFromRow(r)));
  const newSet = new Set(newRows.map(r => keyFromRow(r)));

  let onlyOld = 0, onlyNew = 0, intersection = 0;
  for (const k of oldSet) {
    if (newSet.has(k)) intersection++; else onlyOld++;
  }
  for (const k of newSet) {
    if (!oldSet.has(k)) onlyNew++;
  }

  console.log('--- Report Comparison ---');
  console.log('Old file:', oldFile);
  console.log('New file:', newFile);
  console.log('Old header:', oldHeader);
  console.log('New header:', newHeader);
  console.log('Old data rows:', oldRows.length);
  console.log('New data rows:', newRows.length);
  console.log('Intersection rows:', intersection);
  console.log('Rows only in old:', onlyOld);
  console.log('Rows only in new:', onlyNew);

  if (oldHeader.length !== newHeader.length) {
    console.log('Header column count differs. Cannot do positional field mapping.');
  } else if (oldHeader.join('|') !== newHeader.join('|')) {
    console.log('Header names differ.');
  } else {
    console.log('Headers identical.');
  }

  // Sample differences
  if (onlyOld) {
    console.log('\nSample rows only in old:');
    let printed = 0;
    for (const r of oldRows) {
      const k = keyFromRow(r);
      if (!newSet.has(k)) { console.log(r); if (++printed >= 5) break; }
    }
  }
  if (onlyNew) {
    console.log('\nSample rows only in new:');
    let printed = 0;
    for (const r of newRows) {
      const k = keyFromRow(r);
      if (!oldSet.has(k)) { console.log(r); if (++printed >= 5) break; }
    }
  }
}

const oldFile = path.resolve('./components-report-old.xlsx');
const newFile = path.resolve('./components-report.xlsx');

compare(oldFile, newFile);
