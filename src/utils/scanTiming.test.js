import {remainingMs,formatCountdown,retryDelay,advancePercent} from "./scanTiming";
const p={total:5,completed:0,gap:12000,average:1000,phase:"request",started:1000,until:0};
test("initial estimate includes five requests and four waits",()=>expect(remainingMs(p,1000)).toBe(53000));
test("active request elapsed time decreases estimate",()=>expect(remainingMs(p,1500)).toBe(52500));
test("wait countdown uses the actual deadline",()=>expect(remainingMs({...p,completed:1,phase:"waiting",until:14000},4000)).toBe(50000));
test("retry cooldown extends the estimate",()=>expect(remainingMs({...p,completed:1,phase:"retry",until:64000},4000)).toBe(100000));
test("completed or slow requests never show a negative countdown",()=>{expect(remainingMs({...p,completed:5},100000)).toBe(0);expect(remainingMs({...p,total:1},100000)).toBe(0);expect(formatCountdown(-1)).toBe("00:00");});
test("429 retry waits at least a minute and respects Retry-After",()=>{expect(retryDelay(429,12000,0,null,0)).toBe(60000);expect(retryDelay(429,12000,0,"90",0)).toBe(90000);expect(retryDelay(503,12000,1,null,0)).toBe(24000);});
test("countdown rounds up and supports durations beyond one minute",()=>expect(formatCountdown(61001)).toBe("01:02"));

const activeScan={...p,scanStarted:1000};
test("estimated progress moves between requests in small steps",()=>{
 const waiting={...activeScan,completed:1,phase:"waiting",until:14000};
 const first=advancePercent(0,waiting,3000);
 expect(first).toBeGreaterThan(0);
 expect(first).toBeLessThanOrEqual(1);
 expect(advancePercent(first,waiting,3100)).toBeGreaterThan(first);
});
test("ETA extensions do not reverse displayed progress",()=>{
 expect(advancePercent(45,{...activeScan,phase:"retry",until:90000},5000)).toBe(45);
});
test("only finalization reaches 100 percent, even with zero estimated remaining time",()=>{
 expect(advancePercent(99,{...activeScan,completed:5},90000)).toBe(99);
 expect(advancePercent(99,{...activeScan,completed:5,finished:true},90000)).toBe(100);
});
test("newly estimated progress is capped to one point per tick",()=>{
 expect(advancePercent(10,{...activeScan,completed:4,phase:"waiting",until:60000},59000)).toBe(11);
});
