export function isCalendarDate(value: string): boolean {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(`${value}T00:00:00Z`);
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function calendarDayKey(value: string | Date): string {
 if(typeof value==='string'&&isCalendarDate(value))return value;
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
export function shiftCalendarMonth(month:string,amount:number):string {
 const date=new Date(`${month.slice(0,7)}-01T00:00:00Z`);
 date.setUTCMonth(date.getUTCMonth()+amount);
 return date.toISOString().slice(0,10);
}
export function calendarMonthCells(month:string):{date:string;day:number;inMonth:boolean}[]{
 const first=new Date(`${month.slice(0,7)}-01T00:00:00Z`);
 const offset=(first.getUTCDay()+6)%7;
 return Array.from({length:42},(_,index)=>{
  const date=new Date(first);date.setUTCDate(index-offset+1);
  return {date:date.toISOString().slice(0,10),day:date.getUTCDate(),inMonth:date.getUTCMonth()===first.getUTCMonth()};
 });
}
