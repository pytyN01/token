// Estimate unfinished logical requests, including the current wait or in-flight attempt.
export function remainingMs(progress, now) {
 const {total, completed, gap, average, phase, until, started}=progress;
 const remaining=Math.max(0,total-completed);
 if(!remaining) return 0;
 const future=(remaining-1)*(gap+average);
 if(phase==="waiting"||phase==="retry") return Math.max(0,until-now)+average+future;
 if(phase==="request") return Math.max(0,average-Math.max(0,now-started))+future;
 return average+future;
}
export function formatCountdown(ms) {
 const seconds=Math.ceil(Math.max(0,ms)/1000);
 return String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
}
export function retryDelay(status, pause, attempt, retryAfter, now) {
 const seconds=Number(retryAfter);
 const server=retryAfter?(Number.isFinite(seconds)?seconds*1000:Date.parse(retryAfter)-now):0;
 return Math.max(status===429?60000:0,pause*2**attempt,Number.isFinite(server)?server:0);
}

// Estimated presentation progress; exact request counts remain separate.
export function advancePercent(previous, progress, now) {
 if(progress.finished)return 100;
 const elapsed=Math.max(0,now-progress.scanStarted);
 const eta=remainingMs(progress,now);
 const target=Math.min(99,100*elapsed/Math.max(1,elapsed+eta));
 // Do not regress when retries or additional batches extend the estimate.
 // Catch up in small steps rather than jumping to a newly estimated position.
 return Math.min(99,Math.max(previous,Math.min(previous+1,target)));
}
