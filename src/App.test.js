import {render,screen,fireEvent,act,cleanup} from "@testing-library/react";
import React from "react";
import axios from "axios";
jest.mock("axios",()=>({get:jest.fn()}));
beforeEach(()=>{jest.useFakeTimers();axios.get.mockReset();axios.get.mockImplementation(()=>new Promise(()=>{}));});
afterEach(()=>{cleanup();jest.clearAllTimers();jest.useRealTimers();});
import App from "./App";
import {allocate} from "./utils/allocation";
import {ratio,tsv,scanStatuses} from "./utils/market";
const rows=Array.from({length:20},(_,i)=>({id:"coin-"+i,roi:100-i}));
test("renders scanner without the investment allocator",()=>{render(<App/>);expect(screen.getByRole("button",{name:"Reload market data"})).toBeInTheDocument();expect(screen.queryByText("Investment round allocator")).not.toBeInTheDocument();expect(screen.queryByLabelText("Whole-dollar round budget (USD)")).not.toBeInTheDocument();});
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
 const toggle=screen.getByRole("button",{name:"Light mode"});
 expect(toggle).toHaveAttribute("aria-pressed","false");
 fireEvent.click(toggle);
 expect(document.documentElement.dataset.theme).toBe("light");
 expect(window.localStorage.getItem(themeKey)).toBe("light");
 expect(screen.getByRole("button",{name:"Reload market data"})).toBeDisabled();
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


test("renders only the header actions; copy and reload are initially disabled",()=>{
 render(<App/>);
 expect(screen.getByRole("button",{name:"Copy all to Excel"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"Reload market data"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"Light mode"})).toBeEnabled();
 expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
 expect(screen.queryByRole("textbox",{name:"Search"})).not.toBeInTheDocument();
 expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
 expect(screen.queryByText("Watchlist coin IDs (editable)")).not.toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Run market scan"})).not.toBeInTheDocument();
});
test("automatically starts exactly one request in StrictMode and ignores disabled actions",()=>{
 render(<React.StrictMode><App/></React.StrictMode>);
 act(()=>{jest.advanceTimersByTime(1);});
 expect(axios.get).toHaveBeenCalledTimes(1);
 expect(axios.get).toHaveBeenCalledWith("/api/crypto",expect.objectContaining({params:{page:1}}));
 fireEvent.click(screen.getByRole("button",{name:"Reload market data"}));
 fireEvent.click(screen.getByRole("button",{name:"Copy all to Excel"}));
 fireEvent.click(screen.getByRole("button",{name:"Light mode"}));
 expect(axios.get).toHaveBeenCalledTimes(1);
 expect(screen.getByRole("button",{name:"Reload market data"})).toBeDisabled();
});
test("failed scan enables retry but does not enable copying incomplete records",async()=>{
 axios.get.mockRejectedValue({response:{status:400}});
 render(<App/>);
 await act(async()=>{await jest.advanceTimersByTimeAsync(1);});
 for(let i=0;i<4;i++){await act(async()=>{await jest.advanceTimersByTimeAsync(12000);});}
 expect(screen.getByRole("button",{name:"Reload market data"})).toBeEnabled();
 expect(screen.getByRole("button",{name:"Copy all to Excel"})).toBeDisabled();
 expect(screen.getByRole("alert")).toHaveTextContent("Scan incomplete");
 fireEvent.click(screen.getByRole("button",{name:"Reload market data"}));
 expect(screen.getByRole("button",{name:"Reload market data"})).toBeDisabled();
});
