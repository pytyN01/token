import {render,screen,fireEvent} from "@testing-library/react";
import App from "./App";
import {allocate} from "./utils/allocation";
import {ratio,tsv,scanStatuses} from "./utils/market";
const rows=Array.from({length:20},(_,i)=>({id:"coin-"+i,roi:100-i}));
test("renders scanner without the investment allocator",()=>{render(<App/>);expect(screen.getByRole("button",{name:"Run market scan"})).toBeInTheDocument();expect(screen.queryByText("Investment round allocator")).not.toBeInTheDocument();expect(screen.queryByLabelText("Whole-dollar round budget (USD)")).not.toBeInTheDocument();});
test("100 dollar allocation matches agreed tiers",()=>expect(allocate(100,rows).map(r=>r.amount)).toEqual([8,6,6,6,6,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4]));
test.each([20,21,75,99,101,125,250,1000])("integer budget %s",budget=>{const a=allocate(budget,rows);expect(a.reduce((s,r)=>s+r.amount,0)).toBe(budget);expect(a.every(r=>Number.isInteger(r.amount)&&r.amount>=1)).toBe(true);});
test("rejects invalid budgets and duplicate IDs",()=>{expect(()=>allocate(19,rows)).toThrow();expect(()=>allocate(100.5,rows)).toThrow();expect(()=>allocate(100,[...rows.slice(0,19),rows[0]])).toThrow();});
test("missing numbers stay blank and text formulas are escaped",()=>{expect(ratio(null,5)).toBeNull();expect(ratio(5,0)).toBeNull();expect(tsv(["a","b"],[[null,"=1+1"]])).toBe("a\tb\r\n\t'=1+1");});

const fullScan={canceled:false,stage:"watchlist",marketErrors:[],watchErrors:[],missing:[],pagesOK:4,pages:4,shortPages:0,duplicateCount:0,marketCount:1000,scope:1000,missingRanks:[],include:true};
test("missing watchlist IDs do not invalidate complete market coverage",()=>expect(scanStatuses({...fullScan,missing:["mxc"]})).toEqual({marketStatus:"Complete",watchStatus:"Partial"}));
test("missing market ranks remain partial",()=>expect(scanStatuses({...fullScan,missingRanks:[12]})).toEqual({marketStatus:"Partial",watchStatus:"Complete"}));
test("canceling watchlist preserves completed market scan",()=>expect(scanStatuses({...fullScan,canceled:true})).toEqual({marketStatus:"Complete",watchStatus:"Canceled"}));
test("disabled watchlist is skipped",()=>expect(scanStatuses({...fullScan,include:false})).toEqual({marketStatus:"Complete",watchStatus:"Skipped"}));
test("canceling market scan is not complete",()=>expect(scanStatuses({...fullScan,canceled:true,stage:"market",pagesOK:2})).toEqual({marketStatus:"Canceled",watchStatus:"Canceled"}));

const themeKey="crypto-research-theme";
afterEach(()=>{window.localStorage.removeItem(themeKey);delete document.documentElement.dataset.theme;});
test("defaults to dark mode and switches without remounting the scanner",()=>{
 window.localStorage.removeItem(themeKey);
 render(<App/>);
 expect(document.documentElement.dataset.theme).toBe("dark");
 const search=screen.getByPlaceholderText("Name, symbol or ID");
 fireEvent.change(search,{target:{value:"bitcoin"}});
 const toggle=screen.getByRole("button",{name:"Light mode"});
 expect(toggle).toHaveAttribute("aria-pressed","false");
 fireEvent.click(toggle);
 expect(document.documentElement.dataset.theme).toBe("light");
 expect(window.localStorage.getItem(themeKey)).toBe("light");
 expect(search).toHaveValue("bitcoin");
 expect(toggle).toHaveAttribute("aria-pressed","true");
 fireEvent.click(toggle);
 expect(document.documentElement.dataset.theme).toBe("dark");
});
test("restores a saved light theme",()=>{
 window.localStorage.setItem(themeKey,"light");
 render(<App/>);
 expect(document.documentElement.dataset.theme).toBe("light");
 expect(screen.getByRole("button",{name:"Light mode"})).toHaveAttribute("aria-pressed","true");
});

