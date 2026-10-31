"use client";
import {useMemo,useState} from "react";
import {Download,FileText,ScanText,ShieldAlert} from "lucide-react";
import * as XLSX from "xlsx";
import {Alert,AlertDescription,AlertTitle} from "@/components/ui/alert";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/card";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Progress} from "@/components/ui/progress";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Separator} from "@/components/ui/separator";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {createItradeText,createTextRows,extractTablesFromTextItems,invoiceHead,invoiceLines,invoiceReconciliation,linesFromText,tidyTable,type InvoiceLine,type PdfPage,type PdfTable} from "@/lib/engine/pdf-extraction";

type Doc={name:string;pages:PdfPage[];tables:PdfTable[];lines:InvoiceLine[];head:ReturnType<typeof invoiceHead>;ocr:number[]};
type Item={str:string;transform:number[];width:number};
const stem=(name:string)=>name.replace(/\.pdf$/i,"").replace(/[^A-Za-z0-9]+/g,"_").slice(0,40)||"document";
function save(data:BlobPart,name:string,mime:string){const url=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
function wb(sheets:Record<string,unknown[][]>){const book=XLSX.utils.book_new();for(const [name,rows] of Object.entries(sheets)){const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=(rows[0]??[]).map((v,i)=>({wch:Math.min(48,Math.max(12,String(v??"").length+2,...rows.slice(1,60).map(r=>String(r[i]??"").length+2)))}));XLSX.utils.book_append_sheet(book,ws,name.slice(0,31));}return XLSX.write(book,{bookType:"xlsx",type:"array"});}
const lineRows=(lines:InvoiceLine[])=>[["SL","Barcode","Description","Unit","Qty","UnitPrice","Amount","VatAmt","AfterVat"],...lines.map(x=>[x.SL,x.Barcode,x.Description,x.Unit,x.Qty,x.UnitPrice,x.Amount,x.VatAmt,x.AfterVat])];
export default function PdfTools(){
 const [files,setFiles]=useState<File[]>([]),[docs,setDocs]=useState<Doc[]>([]),[docName,setDocName]=useState("");
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[stage,setStage]=useState(""),[error,setError]=useState(""),[warning,setWarning]=useState("");
 const [dpi,setDpi]=useState("300"),[prefix,setPrefix]=useState("SML"),[dataOnly,setDataOnly]=useState(true),[merge,setMerge]=useState(true),[tableName,setTableName]=useState("");
 const [pagesSelected,setPagesSelected]=useState<number[]>([]),[breaks,setBreaks]=useState(false),[regex,setRegex]=useState(String.raw`\b\d{8,14}\b`);
 const doc=docs.find(x=>x.name===docName)??docs[0]??null;
 const check=useMemo(()=>doc?invoiceReconciliation(doc.lines,doc.head):null,[doc]);
 const allText=doc?.pages.map(p=>p.text).join("\n")??"";
 const importText=doc?createItradeText(doc.lines,prefix):"";
 const textResult=useMemo(()=>doc?createTextRows(doc.pages,pagesSelected,breaks):{text:"",rows:[] as {page:number;line:number;text:string}[]},[doc,pagesSelected,breaks]);
 const matches=useMemo(()=>{try{return [...new Set(allText.match(new RegExp(regex,"g"))??[])];}catch{return[]}},[allText,regex]);
 const regexError=useMemo(()=>{try{new RegExp(regex);return""}catch(e){return e instanceof Error?e.message:"Invalid regex"}},[regex]);
 const tables=useMemo(()=>{
  if(!doc)return[] as {name:string;columns:string[];rows:string[][]}[];
  const raw=doc.tables.map(t=>{const clean=tidyTable(t.rows,dataOnly?2:1);if(clean)return{name:`page ${t.page}`,columns:clean.columns,rows:clean.rows};if(dataOnly)return null;const n=Math.max(0,...t.rows.map(r=>r.length));return{name:`page ${t.page}`,columns:Array.from({length:n},(_,i)=>`col${i+1}`),rows:t.rows.map(r=>Array.from({length:n},(_,i)=>r[i]??""))}}).filter((x):x is {name:string;columns:string[];rows:string[]}=>!!x);
  if(!merge)return raw;
  const groups=new Map<string,{name:string;columns:string[];rows:string[][]}>();
  for(const t of raw){const key=t.columns.join("|");const old=groups.get(key);if(old){old.name+=`, ${t.name.replace("page ","")}`;old.rows.push(...t.rows)}else groups.set(key,{...t,rows:[...t.rows]})}
  return [...groups.values()];
 },[doc,dataOnly,merge]);
 const table=tables.find(t=>t.name===tableName)??tables[0]??null;

 async function extract(){
  if(!files.length)return;setBusy(true);setError("");setWarning("");setDocs([]);setProgress(0);
  const done:Doc[]=[];let worker:Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>|null=null;
  try{
   const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
   pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs",import.meta.url).toString();
   for(let fi=0;fi<files.length;fi++){
    const file=files[fi];setStage(`Reading ${file.name}`);
    const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    const pageData:PdfPage[]=[],raw:PdfTable[]=[];
    for(let n=1;n<=pdf.numPages;n++){
     const page=await pdf.getPage(n),content=await page.getTextContent();
     const items=(content.items as unknown[]).filter((x):x is Item=>!!x&&typeof x==="object"&&"str"in x&&"transform"in x).map(x=>({str:x.str,x:x.transform[4],y:x.transform[5],width:x.width}));
     const ys:number[]=[];const rows=new Map<number,{x:number;str:string}[]>();
     for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){const y=ys.find(v=>Math.abs(v-it.y)<=3)??it.y;if(!rows.has(y)){ys.push(y);rows.set(y,[])}rows.get(y)!.push({x:it.x,str:it.str})}
     const text=[...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,r])=>r.sort((a,b)=>a.x-b.x).map(x=>x.str).join(" ")).join("\n").trim();
     pageData.push({n,text});raw.push(...extractTablesFromTextItems(items,n));
     setProgress(Math.round(((fi+((n/pdf.numPages)*.5))/files.length)*100));
    }
    const needs=pageData.filter(p=>p.text.trim().length<40),ocr:number[]=[];
    if(needs.length){
     try{
      if(!worker){const tess=await import("tesseract.js");worker=await tess.createWorker("eng",1,{logger:m=>{if(m.status==="recognizing text"&&typeof m.progress==="number")setProgress(Math.round(((fi+.5+m.progress*.45)/files.length)*100))}})}
      for(const p of needs){
       const page=await pdf.getPage(p.n),viewport=page.getViewport({scale:Math.max(150,Math.min(400,Number(dpi)||300))/72});
       const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
       const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Could not create OCR canvas");
       await page.render({canvasContext:ctx,viewport,canvas} as never).promise;
       const result=await worker.recognize(canvas);p.text=result.data.text??"";
       if(p.text.trim()){p.ocr=true;ocr.push(p.n);const words=result.data.words??[];raw.push(...extractTablesFromTextItems(words.map(w=>({str:w.text,x:w.bbox.x0,y:-w.bbox.y0,width:Math.max(1,w.bbox.x1-w.bbox.x0)})),p.n))}
       canvas.width=0;canvas.height=0;
      }
     }catch(e){setWarning(e instanceof Error?`OCR incomplete: ${e.message}`:"OCR could not complete. Digital text remains available.")}
    }
    const full=pageData.map(p=>p.text).join("\n"),fromTables=invoiceLines(raw),fromText=linesFromText(full);
    let lines=fromTables;
    if(fromText.length){if(fromTables.length){const have=new Set(fromTables.map(x=>x.Barcode));lines=[...fromTables,...fromText.filter(x=>!have.has(x.Barcode))];if(lines.every(x=>x.SL!==null))lines.sort((a,b)=>(a.SL??0)-(b.SL??0))}else lines=fromText}
    done.push({name:file.name,pages:pageData,tables:raw,lines,head:invoiceHead(full),ocr});
    setProgress(Math.round((fi+1)/files.length*100));
   }
   setDocs(done);setDocName(done[0]?.name??"");setPagesSelected(done[0]?.pages.map(x=>x.n)??[]);setStage("Extraction complete");
  }catch(e){setError(e instanceof Error?e.message:"PDF extraction failed")}
  finally{if(worker)await worker.terminate();setBusy(false)}
 }
 function invoiceExcel(){if(!doc)return;save(wb({LINES:[lineRows(doc.lines)[0].slice(1),...lineRows(doc.lines).slice(1).map(row=>row.slice(1))],INVOICE:[["Field","Value"],...Object.entries(doc.head)]}),`${stem(doc.name)}.xlsx`,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
 function invoiceCsv(){if(!doc)return;save(XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(lineRows(doc.lines))),`${stem(doc.name)}.csv`,"text/csv")}
 function tableExport(kind:"xlsx"|"csv"|"txt"){if(!table||!doc)return;const rows=[table.columns,...table.rows];if(kind==="xlsx")save(wb({TABLE:rows}),`${stem(doc.name)}_table.xlsx`,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");else save(XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(rows),{FS:kind==="txt"?"\t":","}),`${stem(doc.name)}_table.${kind}`,kind==="txt"?"text/plain":"text/csv")}
 function allTables(){if(!doc)return;const sheets:Record<string,unknown[][]>={};tables.forEach((t,i)=>sheets[`T${i+1}_${t.name}`]=[t.columns,...t.rows]);save(wb(sheets),`${stem(doc.name)}_all_tables.xlsx`,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
 function textExport(kind:"txt"|"xlsx"){if(!doc)return;if(kind==="txt")save(textResult.text,`${stem(doc.name)}.txt`,"text/plain");else save(wb({LINES:[["page","line","text"],...textResult.rows.map(x=>[x.page,x.line,x.text])]}),`${stem(doc.name)}_lines.xlsx`,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
 const ocr=!!doc?.ocr.length,blocked=ocr&&!check?.totalMatches;
 return <div className="mx-auto w-full max-w-7xl space-y-6">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><Badge variant="secondary">PDF utilities</Badge><h1 className="mt-2 text-2xl font-semibold tracking-tight">PDF to Excel / TXT</h1><p className="mt-1 text-sm text-muted-foreground">Invoice extraction, table cleanup, scanned-page OCR and iTrade preparation. Processing stays in your browser.</p></div>
   {docs.length>0&&<Select value={doc?.name??""} onValueChange={setDocName}><SelectTrigger className="w-64"><SelectValue placeholder="Choose extracted PDF"/></SelectTrigger><SelectContent>{docs.map(d=><SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>)}</SelectContent></Select>}
  </div>
  <Card><CardHeader><CardTitle className="text-base">PDF input</CardTitle><CardDescription>Upload one or more PDFs. Pages with fewer than 40 selectable characters are automatically OCR'd.</CardDescription></CardHeader><CardContent className="space-y-4">
   <div className="grid gap-2"><Label htmlFor="pdf-files">PDF files</Label><Input id="pdf-files" type="file" accept=".pdf,application/pdf" multiple onChange={e=>{setFiles(Array.from(e.target.files??[]));setDocs([]);setError("");setWarning("")}}/>{files.length>0&&<p className="text-xs text-muted-foreground">{files.map(f=>f.name).join(" · ")}</p>}</div>
   <div className="grid gap-2 sm:max-w-xs"><Label>OCR resolution</Label><Select value={dpi} onValueChange={setDpi}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="200">200 DPI · faster</SelectItem><SelectItem value="300">300 DPI · recommended</SelectItem><SelectItem value="400">400 DPI · finer</SelectItem></SelectContent></Select></div>
   <div className="flex flex-wrap gap-2"><Button disabled={!files.length||busy} onClick={()=>void extract()}><ScanText/>{busy?"Extracting…":"Extract PDFs"}</Button><Button variant="outline" disabled={!docs.length} onClick={()=>{setDocs([]);setFiles([]);setDocName("")}}>Clear results</Button></div>
   {busy&&<div className="space-y-2"><div className="flex justify-between text-sm"><span>{stage}</span><span>{progress}%</span></div><Progress value={progress}/></div>}
   {error&&<Alert variant="destructive"><AlertTitle>Extraction failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
   {warning&&<Alert variant="destructive"><AlertTitle>OCR warning</AlertTitle><AlertDescription>{warning}</AlertDescription></Alert>}
  </CardContent></Card>
  {doc&&<>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[{k:"Pages",v:doc.pages.length,n:ocr?`${doc.ocr.length} OCR'd`:"Digital text"},{k:"Table blocks",v:doc.tables.length,n:"Position-based detection"},{k:"Invoice lines",v:doc.lines.length||"—",n:"Barcode + quantity rows"},{k:"Invoice no",v:doc.head["Invoice no"]??"—",n:doc.head.Date??"Not detected"}].map(x=><Card key={x.k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{x.k}</p><p className="mt-2 truncate text-xl font-semibold">{x.v}</p><p className="mt-1 text-xs text-muted-foreground">{x.n}</p></CardContent></Card>)}</div>
   <Tabs defaultValue={doc.lines.length?"invoice":"tables"} className="space-y-4"><TabsList><TabsTrigger value="invoice" disabled={!doc.lines.length}>Invoice</TabsTrigger><TabsTrigger value="tables">Tables</TabsTrigger><TabsTrigger value="text">Text</TabsTrigger></TabsList>
    <TabsContent value="invoice" className="space-y-4">{doc.lines.length>0&&<>
     <div className="grid gap-3 md:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Lines vs invoice Total</p><p className="mt-2 text-xl font-semibold">{check?.amountSum?.toFixed(2)??"—"}</p><p className="text-xs text-muted-foreground">Invoice {doc.head.Total?.toFixed(2)??"not detected"} · Δ {check?.totalDelta?.toFixed(2)??"—"}</p><Badge className="mt-2" variant={check?.totalMatches?"success":"destructive"}>{check?.totalMatches?"Matches ≤ AED 0.05":"Not reconciled"}</Badge></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">After VAT vs Net Total</p><p className="mt-2 text-xl font-semibold">{check?.grossSum?.toFixed(2)??"—"}</p><p className="text-xs text-muted-foreground">Net {doc.head["Net Total"]?.toFixed(2)??"not detected"} · Δ {check?.netDelta?.toFixed(2)??"—"}</p><Badge className="mt-2" variant={check?.netMatches?"success":"secondary"}>{check?.netMatches?"Matches ≤ AED 0.05":"Not matched / unavailable"}</Badge></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Qty × price ≠ amount</p><p className="mt-2 text-xl font-semibold">{check?.arithmeticIssues.length??0}</p><p className="text-xs text-muted-foreground">Tolerance AED 0.02 per line</p></CardContent></Card>
     </div>
     {check?.arithmeticIssues.length? <Card><CardHeader><CardTitle className="text-sm">Arithmetic exceptions</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>SL</TableHead><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Unit price</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody>{check.arithmeticIssues.map((x,i)=><TableRow key={x.Barcode+i}><TableCell>{x.SL}</TableCell><TableCell>{x.Description}</TableCell><TableCell>{x.Qty}</TableCell><TableCell>{x.UnitPrice}</TableCell><TableCell>{x.Amount}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>:null}
     <Card><CardHeader><CardTitle className="text-base">Invoice lines</CardTitle><CardDescription>Structured table rows take priority; text reconstruction adds missing barcodes.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="max-h-[440px] overflow-auto"><Table><TableHeader><TableRow>{["SL","Barcode","Description","Unit","Qty","Unit price","Amount","VAT","After VAT"].map(x=><TableHead key={x}>{x}</TableHead>)}</TableRow></TableHeader><TableBody>{doc.lines.map((x,i)=><TableRow key={x.Barcode+i}><TableCell>{x.SL??"—"}</TableCell><TableCell className="font-mono">{x.Barcode}</TableCell><TableCell className="min-w-48">{x.Description}</TableCell><TableCell>{x.Unit}</TableCell><TableCell>{x.Qty??"—"}</TableCell><TableCell>{x.UnitPrice?.toFixed(4)??"—"}</TableCell><TableCell>{x.Amount?.toFixed(2)??"—"}</TableCell><TableCell>{x.VatAmt?.toFixed(2)??"—"}</TableCell><TableCell>{x.AfterVat?.toFixed(2)??"—"}</TableCell></TableRow>)}</TableBody></Table></div>
      <Separator/><div className="grid gap-2 sm:max-w-xs"><Label htmlFor="prefix">Import prefix</Label><Input id="prefix" value={prefix} onChange={e=>setPrefix(e.target.value)} maxLength={20}/></div><p className="text-xs text-muted-foreground">Format: prefix, barcode, unit price, quantity · no header · no quotes · price up to 7 decimals.</p>
      {blocked&&<Alert variant="destructive"><ShieldAlert/><AlertTitle>Import file withheld</AlertTitle><AlertDescription>OCR was used but the extracted line Amount does not reconcile with the invoice Total within AED 0.05. The iTrade TXT export is disabled.</AlertDescription></Alert>}
      {ocr&&!blocked&&<Alert><AlertTitle>OCR totals reconcile</AlertTitle><AlertDescription>OCR figures reconcile within AED 0.05. Spot-check prices against the supplier document before importing.</AlertDescription></Alert>}
      <div className="flex flex-wrap gap-2"><Button onClick={()=>invoiceExcel()}><Download/>Excel</Button><Button variant="outline" onClick={()=>invoiceCsv()}>CSV</Button><Button variant="outline" disabled={blocked} onClick={()=>save(importText,`${stem(doc.name)}.txt`,"text/plain")}>iTrade import TXT</Button></div>
      <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Preview import file</summary><pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs">{importText}</pre></details><details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Copy barcodes</summary><pre className="mt-3 text-xs">{doc.lines.map(x=>x.Barcode).join("\n")}</pre></details>
     </CardContent></Card>
    </>}</TabsContent>
    <TabsContent value="tables"><Card><CardHeader><CardTitle className="text-base">Table extraction</CardTitle><CardDescription>Reconstruct tables from positioned PDF text. This is a browser-side approximation of the original pdfplumber table detection and must be validated against supplier layouts.</CardDescription></CardHeader><CardContent className="space-y-4">
     <div className="flex flex-wrap gap-5"><div className="flex items-center gap-2"><Checkbox id="data-only" checked={dataOnly} onCheckedChange={v=>setDataOnly(v===true)}/><Label htmlFor="data-only">Data tables only</Label></div><div className="flex items-center gap-2"><Checkbox id="merge" checked={merge} onCheckedChange={v=>setMerge(v===true)}/><Label htmlFor="merge">Join tables with matching columns</Label></div></div>
     <p className="text-sm text-muted-foreground">{tables.length} tables kept · {doc.tables.length-tables.length} blocks skipped</p>
     {tables.length>0?<><Select value={table?.name??""} onValueChange={setTableName}><SelectTrigger className="max-w-xl"><SelectValue placeholder="Select table"/></SelectTrigger><SelectContent>{tables.map(t=><SelectItem key={t.name} value={t.name}>{t.name} · {t.rows.length} rows × {t.columns.length} columns</SelectItem>)}</SelectContent></Select>
      {table&&<><div className="max-h-[400px] overflow-auto"><Table><TableHeader><TableRow>{table.columns.map((x,i)=><TableHead key={x+i}>{x}</TableHead>)}</TableRow></TableHeader><TableBody>{table.rows.map((r,i)=><TableRow key={i}>{r.map((x,j)=><TableCell key={j}>{x}</TableCell>)}</TableRow>)}</TableBody></Table></div><div className="flex flex-wrap gap-2"><Button onClick={()=>tableExport("xlsx")}>Excel</Button><Button variant="outline" onClick={()=>tableExport("csv")}>CSV</Button><Button variant="outline" onClick={()=>tableExport("txt")}>Text</Button>{tables.length>1&&<Button variant="outline" onClick={allTables}>Excel · all tables</Button>}</div></>}
     </>:<Alert><AlertTitle>No data tables detected</AlertTitle><AlertDescription>Untick Data tables only or use the Text tab. Complex ruled layouts may need table-column tuning.</AlertDescription></Alert>}
    </CardContent></Card></TabsContent>
    <TabsContent value="text"><Card><CardHeader><CardTitle className="text-base">Page text</CardTitle><CardDescription>Choose pages, preview extracted text, find patterns and export text or an Excel line index.</CardDescription></CardHeader><CardContent className="space-y-4">
     <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setPagesSelected(doc.pages.map(x=>x.n))}>Select all</Button><Button size="sm" variant="outline" onClick={()=>setPagesSelected([])}>Clear selection</Button><div className="flex items-center gap-2"><Checkbox id="breaks" checked={breaks} onCheckedChange={v=>setBreaks(v===true)}/><Label htmlFor="breaks">Mark page breaks</Label></div></div>
     <div className="flex flex-wrap gap-3">{doc.pages.map(p=><div key={p.n} className="flex items-center gap-2 rounded-md border px-3 py-2"><Checkbox id={`p${p.n}`} checked={pagesSelected.includes(p.n)} onCheckedChange={v=>setPagesSelected(old=>v===true?[...new Set([...old,p.n])].sort((a,b)=>a-b):old.filter(x=>x!==p.n))}/><Label htmlFor={`p${p.n}`}>Page {p.n}{p.ocr?" · OCR":""}</Label></div>)}</div>
     <div className="grid gap-2"><Label>Preview</Label><pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-xs">{textResult.text.slice(0,6000)}</pre><p className="text-xs text-muted-foreground">Showing {Math.min(6000,textResult.text.length)} of {textResult.text.length} characters.</p></div>
     <div className="flex gap-2"><Button disabled={!pagesSelected.length} onClick={()=>textExport("txt")}>Text</Button><Button variant="outline" disabled={!pagesSelected.length} onClick={()=>textExport("xlsx")}>Excel · one row per line</Button></div>
     <Separator/><div className="grid gap-2"><Label htmlFor="regex">Find barcodes or any pattern (regex)</Label><Input id="regex" value={regex} onChange={e=>setRegex(e.target.value)}/>{regexError?<p className="text-sm text-destructive">{regexError}</p>:matches.length?<><p className="text-xs text-muted-foreground">{matches.length} unique matches</p><pre className="max-h-40 overflow-auto rounded-md border p-3 text-xs">{matches.join("\n")}</pre></>:<p className="text-xs text-muted-foreground">No matches.</p>}</div>
    </CardContent></Card></TabsContent>
   </Tabs>
  </>}
  <Alert><FileText/><AlertTitle>Import safety rule</AlertTitle><AlertDescription>OCR-derived iTrade import remains blocked unless the extracted line Amount reconciles with the invoice Total within AED 0.05. Even when reconciled, manually spot-check OCR figures. Stocker never posts stock transactions.</AlertDescription></Alert>
 </div>;
}
