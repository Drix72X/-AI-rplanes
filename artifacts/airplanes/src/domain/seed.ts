import { DEFAULT_DATE, onDay, seasonDates } from './rules.ts';
import type { Airline, AirlineCode, Listing, Occurrence, Seed, SlotSeries } from './types.ts';
export function mulberry32(a: number) {
  return () => { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function createSeed(): Seed {
  const random = mulberry32(2026);
  const airlines: Airline[] = [
    {code:'B6',name:'JetBlue',color:'#245edb'}, {code:'DL',name:'Delta',color:'#a51d35'},
    {code:'AA',name:'American',color:'#557c9c'}, {code:'BA',name:'British Airways',color:'#303f70'},
    {code:'AS',name:'Alaska',color:'#25716c'}, {code:'LH',name:'Lufthansa',color:'#9a7a18'},
  ];
  const series: SlotSeries[] = [], occurrences: Occurrence[] = [];
  const make = (seq: number, holder: AirlineCode, direction: 'A'|'D', time: string, daysMask: string, prior = .82 + random()*.17) => {
    const s: SlotSeries = { id:`JFK-W26-${direction}-${time.replace(':','')}-${daysMask}-${String(seq).padStart(4,'0')}`, airport:'JFK',season:'W26', direction,time,daysMask,holder,operator:holder,flightNumber: `${holder} ${seq === 1 ? 1201 : 1000+seq}`,priorSeasonUtilization:prior };
    series.push(s); return s;
  };
  make(1,'B6','D','07:30','0010000',.84);
  make(2,'B6','A','12:00','1111111',.96);
  make(3,'AA','A','15:00','1111111',.95);
  make(4,'B6','A','21:30','1111100',.91);
  make(5,'B6','D','18:30','1111111',.89);
  make(6,'B6','A','08:00','1111111',.92);
  make(7,'B6','D','17:00','1111111',.91);
  make(8,'B6','D','09:00','1111111',.97);
  make(9,'DL','D','10:00','1111111',.96);
  make(10,'AS','D','11:00','1111111',.95);
  make(11,'DL','A','13:00','1111111',.86);
  make(12,'DL','D','16:00','1111111',.88);
  make(13,'AA','D','20:00','1111111',.85);
  let seq = 14;
  for (const [code,count] of Object.entries({B6:90,DL:90,AA:45,BA:27,AS:24,LH:24})) {
    const needed = count - series.filter(s => s.holder === code).length;
    for (let i=0;i<needed;i++) {
      const direction = i%2 === 0 ? 'A' : 'D';
      const lean = (code === 'BA' || code === 'LH') && random() < .75;
      const halfHours = lean ? (direction === 'A' ? 12+Math.floor(random()*11) : 34+Math.floor(random()*12)) : 12+Math.floor(random()*34);
      const time = `${String(Math.floor(halfHours/2)).padStart(2,'0')}:${halfHours%2 ? '30':'00'}`;
      const draw = random();
      let mask = draw < .7 ? '1111111' : '1111100';
      if (draw >= .9) {
        const selected = [0,1,2,3,4,5,6].map(day => ({day,sort:random()})).sort((a,b)=>a.sort-b.sort).slice(0,1+Math.floor(random()*3)).map(x=>x.day);
        mask = Array.from({length:7},(_,d)=>selected.includes(d)?'1':'0').join('');
      }
      make(seq++,code as AirlineCode,direction,time,mask);
    }
  }
  const heroCancels: Record<string,string> = {'2026-11-25':'Commercial','2026-12-23':'Crew','2027-01-13':'Commercial','2027-02-10':'Mechanical'};
  const weather = ['2026-12-18','2027-01-22','2027-02-05'];
  for (const s of series) {
    const n = Number(s.id.slice(-4)), dates = seasonDates.filter(d=>onDay(s.daysMask,d));
    const high = s.holder !== 'B6' && random() < .06;
    const rate = high ? .14+random()*.08 : .01+random()*.05;
    const rows: Occurrence[] = dates.map(date => ({seriesId:s.id,date,outcome:'operated',reason:'',operatedBy:s.holder}));
    // Stratified seeded cancellations keep low-rate sparse series healthy rather
    // than accidentally introducing additional planted JetBlue warnings.
    for (const period of [rows.filter(o=>o.date<=DEFAULT_DATE),rows.filter(o=>o.date>DEFAULT_DATE)]) {
      const chosen = period.map(o=>({o,sort:random()})).sort((a,b)=>a.sort-b.sort).slice(0,Math.round(period.length*rate));
      for (const {o} of chosen) { o.outcome='cancelled'; o.reason=['Commercial','Crew','Mechanical'][Math.floor(random()*3)]; }
    }
    for (const o of rows) {
      if ((weather.includes(o.date) && random()<.35) || (o.date==='2027-01-08' && random()<.12)) {
        o.outcome='justified'; o.reason=weather.includes(o.date)?'Weather':'ATC';
      }
    }
    if (n<=13) {
      rows.forEach(o=>{o.outcome='operated';o.reason='';});
      if (n===1) rows.forEach(o=>{if(heroCancels[o.date]) {o.outcome='cancelled';o.reason=heroCancels[o.date];}});
      else {
        const used: Record<number,number> = {2:108,3:107,4:55,5:93,6:94,7:95,8:110,9:109,10:108,11:86,12:88,13:89};
        const past = rows.filter(o=>o.date<=DEFAULT_DATE);
        const misses = past.length-used[n];
        // Evenly distribute prescribed misses; dates not prescribed by the PRD
        // are deterministic, avoiding a misleading block of early cancellations.
        for(let i=0;i<misses;i++) {const o=past[Math.floor((i+.5)*past.length/misses)];o.outcome='cancelled';o.reason=['Commercial','Crew','Mechanical'][i%3];}
        if ([5,6,7].includes(n)) {
          for (const date of weather) { const o=rows.find(o=>o.date===date)!; if(o.outcome==='cancelled') { const replacement=past.find(x=>x.outcome==='operated'&&!weather.includes(x.date))!;replacement.outcome='cancelled';replacement.reason=o.reason; } o.outcome='justified';o.reason='Weather'; }
        }
      }
    }
    occurrences.push(...rows);
  }
  const listings: Listing[] = [];
  const listing = (airline: AirlineCode, type: Listing['type'], seq?: number, wanted?: Listing['wanted'], priceUsd?:number) => {
    listings.push({id:`L${listings.length+1}`,airline,type,seriesId:seq?series.find(s=>Number(s.id.slice(-4))===seq)!.id:undefined,wanted,term:'Rest of season',priceUsd,status:'open',createdAt:'2026-10-25T09:00:00.000Z'});
  };
  const wanted = (direction:'A'|'D',timeFrom:string,timeTo:string,daysMask='1111111') => ({direction,timeFrom,timeTo,daysMask});
  listing('DL','lease_in',undefined,wanted('D','07:00','08:00','0010000'),120000);
  listing('B6','swap',2,wanted('A','14:30','15:30'));
  listing('AA','swap',3,wanted('A','11:30','12:30'));
  listing('B6','swap',8,wanted('D','10:00','10:00'));
  listing('DL','swap',9,wanted('D','11:00','11:00'));
  listing('AS','swap',10,wanted('D','09:00','09:00'));
  const background = series.filter(s=>Number(s.id.slice(-4))>13).map(s=>({s,sort:random()})).sort((a,b)=>a.sort-b.sort).slice(0,8);
  background.forEach(({s},i)=>listing(s.holder,i%3===0?'lease_in':'lease_out',i%3===0?undefined:Number(s.id.slice(-4)),i%3===0?wanted(s.direction,'16:00','19:00'):undefined,75000+i*5000));
  return {airlines,series,occurrences,listings};
}
export const seed = createSeed();
