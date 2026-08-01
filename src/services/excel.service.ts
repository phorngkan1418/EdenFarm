import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Order, OrderItem, PaymentStatus } from '../types/order';
const HEADERS=['No','Order Date','Delivered Date','Customer Name','Phone Number','Product','Quantity','Unit Price','Total','Status payment','Note'];
const argb={blue:'FF00B0F0',yellow:'FFFFFF00',red:'FFFF0000',orange:'FFFFC000',black:'FF000000',peach:'FFF4B183'};
const border={top:{style:'thin' as const,color:{argb:argb.black}},left:{style:'thin' as const,color:{argb:argb.black}},bottom:{style:'thin' as const,color:{argb:argb.black}},right:{style:'thin' as const,color:{argb:argb.black}}};
const excelDate=(s:string)=>s?(()=>{const[y,m,d]=s.split('-');return `${d}/${m}/${y}`})():'';
const isoDate=(v:unknown)=>{ if(v instanceof Date){const y=v.getFullYear(),m=String(v.getMonth()+1).padStart(2,'0'),d=String(v.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;} const s=String(v??'').trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s; const x=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/); if(!x)return ''; const day=Number(x[1]),month=Number(x[2]),year=x[3].length===2?2000+Number(x[3]):Number(x[3]); const date=new Date(year,month-1,day); if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return ''; return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`; };
const text=(c:ExcelJS.Cell)=>{const v=c.value;if(v==null)return'';if(typeof v==='object'&&'text'in v)return String(v.text).trim();if(typeof v==='object'&&'result'in v)return String(v.result??'').trim();return String(v).trim();};
const num=(c:ExcelJS.Cell)=>{if(typeof c.value==='number')return c.value;const n=Number(text(c).replace(/[$,]/g,''));return Number.isFinite(n)?n:0;};
const status=(s:string):PaymentStatus=>s.toLowerCase()==='paid'?'Paid':s.toLowerCase()==='partial'?'Partial':'Unpaid';
export async function exportOrders(orders:Order[]){
 if(!orders.length)throw new Error('There are no orders to export.');
 const wb=new ExcelJS.Workbook();wb.creator='Customer Order System';const ws=wb.addWorksheet('Customer Orders',{views:[{state:'frozen',ySplit:4}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
 ws.columns=[7,15,17,22,18,12,13,13,13,18,20].map(width=>({width}));ws.mergeCells('D2:H2');const title=ws.getCell('D2');title.value='Customer order list';title.font={name:'Arial',size:24};title.alignment={horizontal:'center',vertical:'middle'};title.fill={type:'pattern',pattern:'solid',fgColor:{argb:argb.peach}};ws.getRow(2).height=38;
 const hr=ws.getRow(4);HEADERS.forEach((h,i)=>hr.getCell(i+1).value=h);hr.height=28;hr.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:argb.blue}};c.font={name:'Arial',size:10,bold:true};c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.border=border;});
 let r=5;orders.forEach((o,index)=>{const start=r;const items=o.items.length?o.items:[{id:'',product:'',quantity:0,unit:'',unitPrice:0,total:0}];items.forEach(item=>{const row=ws.getRow(r++);row.values=[o.orderNumber||index+1,excelDate(o.orderDate),excelDate(o.deliveredDate),o.customerName,o.phoneNumber,item.product,`${item.quantity} ${item.unit}`.trim(),item.unitPrice,item.total,o.paymentStatus,o.note];row.height=22;for(let c=1;c<=11;c++){const cell=row.getCell(c);cell.border=border;cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};cell.font={name:'Arial',size:10};}row.getCell(8).numFmt='$0.00';row.getCell(9).numFmt='$0.00';});const end=r-1;if(end>start)[1,2,3,4,5,10,11].forEach(c=>ws.mergeCells(start,c,end,c));const number=ws.getCell(start,1);number.fill={type:'pattern',pattern:'solid',fgColor:{argb:(o.orderNumber>=8&&o.orderNumber<=10)?argb.red:o.orderNumber===11?argb.orange:argb.yellow}};for(let rr=start;rr<=end;rr++)for(let c=1;c<=11;c++)ws.getCell(rr,c).border=border;});
 ws.autoFilter={from:{row:4,column:1},to:{row:4,column:11}};ws.pageSetup.printTitlesRow='4:4';ws.pageSetup.printArea=`A1:K${r-1}`;const buffer=await wb.xlsx.writeBuffer();saveAs(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`customer-orders-${new Date().toISOString().slice(0,10)}.xlsx`);
}
export async function importOrders(file: File): Promise<Order[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Please choose an .xlsx file.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.getWorksheet('Customer Orders') ?? workbook.worksheets[0];
  if (!worksheet) throw new Error('Worksheet not found.');

  const cellText = (cell: ExcelJS.Cell): string => {
    const displayed = String(cell.text ?? '').trim();
    if (displayed) return displayed;
    return text(cell);
  };

  const isMergedChild = (cell: ExcelJS.Cell): boolean => {
    if (!cell.isMerged) return false;
    return cell.master.address !== cell.address;
  };

  const importDate = (cell: ExcelJS.Cell): string => {
    // Eden Farm's source workbook uses Day/Month/Year. Some ambiguous
    // Excel dates (for example 6/7/2026) are stored internally by Excel as
    // June 7 even though the farm means 6 July. For a true Date cell whose
    // day and month are both 12 or less, swap those two components.
    if (cell.value instanceof Date) {
      const nativeYear = cell.value.getFullYear();
      const nativeMonth = cell.value.getMonth() + 1;
      const nativeDay = cell.value.getDate();
      const day = nativeDay <= 12 && nativeMonth <= 12 ? nativeMonth : nativeDay;
      const month = nativeDay <= 12 && nativeMonth <= 12 ? nativeDay : nativeMonth;
      const candidate = `${nativeYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return isoDate(candidate);
    }

    // Text dates are always parsed as DD/MM/YYYY or DD/MM/YY.
    const displayed = cellText(cell);
    return isoDate(displayed) || isoDate(cell.value);
  };

  let header = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (
      cellText(row.getCell(1)).toLowerCase() === 'no' &&
      cellText(row.getCell(2)).toLowerCase() === 'order date'
    ) header = rowNumber;
  });
  if (!header) throw new Error('Header row was not found.');

  const orders: Order[] = [];
  let current: Order | null = null;

  for (let rowNumber = header + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const numberCell = row.getCell(1);
    const startsNewOrder = !isMergedChild(numberCell) && cellText(numberCell) !== '';
    const product = cellText(row.getCell(6));
    const quantityText = cellText(row.getCell(7));
    const unitPrice = num(row.getCell(8));
    const importedTotal = num(row.getCell(9));

    if (!startsNewOrder && !product && !quantityText && unitPrice === 0) continue;

    const quantityMatch = quantityText.match(/^(-?\d+(?:\.\d+)?)\s*(?:kg)?$/i);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : num(row.getCell(7));
    const item: OrderItem | null = product || quantityText || unitPrice
      ? {
          id: crypto.randomUUID(),
          product,
          quantity,
          unit: 'Kg',
          unitPrice,
          total: importedTotal || quantity * unitPrice,
        }
      : null;

    if (startsNewOrder) {
      const orderDate = importDate(row.getCell(2));
      const deliveredDate = importDate(row.getCell(3));
      if (!orderDate) {
        throw new Error(`Invalid order date on Excel row ${rowNumber}. Expected DD/MM/YYYY or DD/MM/YY.`);
      }
      const now = new Date().toISOString();
      current = {
        id: crypto.randomUUID(),
        orderNumber: Number(cellText(numberCell)) || orders.length + 1,
        orderDate,
        deliveredDate,
        customerName: cellText(row.getCell(4)),
        phoneNumber: cellText(row.getCell(5)),
        items: item ? [item] : [],
        paymentStatus: status(cellText(row.getCell(10))),
        note: cellText(row.getCell(11)),
        createdAt: now,
        updatedAt: now,
      };
      orders.push(current);
    } else if (current && item) {
      current.items.push(item);
    }
  }

  if (!orders.length) throw new Error('No valid orders found.');
  return orders;
}
