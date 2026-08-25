
(() => {
"use strict";
const ALLOWED=["alison.sousa@usp.br","hsia.sheng@fgv.br"];
const API="/api/revisions", LOCAL_KEY="hsia-dashboard-revisions-v2", EMAIL_KEY="hsia-dashboard-email-v1";
const PAGE_SIZE=30;
const CATEGORY_LABELS={
 colunas_autorais:"Colunas autorais",entrevistas_escritas_completas:"Entrevistas escritas",
 transcricoes_palestras_aulas:"Transcrições e aulas",participacoes_em_reportagens:"Participações em reportagens",
 casos_relatorios_profissionais:"Casos e relatórios",artigos_profissionais:"Artigos profissionais",
 artigos_academicos:"Artigos acadêmicos",videos_podcasts:"Vídeos e podcasts",livros_capitulos:"Livros e capítulos"};
const FIELDS=["fonte","categoria_painel","manifestacao_id","item_id","producao_principal_item_id","manifestacao_derivada_de_item_id","papel_manifestacao","tipo_manifestacao","titulo","ano","data_publicacao","tipo_publicacao","autores","papel_hsia","url_original","url_principal","urls_secundarias","texto_ou_evidencia_disponivel","republicacao_de_item_id","status_verificacao","contabilizado_na_volumetria","papeis_da_fonte","status_acesso","conteudo_status","evidencia","rotulo_credito","credito_exibicao","participacao_hsia"];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const safeUrl=v=>{try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return ""}};
const state={data:null,revisions:{removed:[],added:[],history:[]},email:"",apply:true,filters:{query:"",source:"",category:"",year:"",sort:"recent"},shown:PAGE_SIZE,sourceQuery:"",remote:false};
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3200)}
function fmtDate(value){if(!value)return "";const d=new Date(value.length===4?value+"-01-01":value+"T12:00:00");return Number.isNaN(+d)?value:new Intl.DateTimeFormat("pt-BR",{day:value.length===4?undefined:"2-digit",month:value.length===4?undefined:"short",year:"numeric"}).format(d)}
function statusLabel(value){return String(value||"").replaceAll("_"," ").replace(/^./,x=>x.toUpperCase())}
function getId(item){return item.manifestacao_id||item.item_id}
function isRemoved(item){return state.revisions.removed.some(x=>(x.manifestacao_id||x)===getId(item))}
function enrichAdded(item){
 const category=item.categoria_painel,authors=item.autores||"";let label="Crédito",credit=authors||`Responsabilidade editorial de ${item.fonte}`,participation="Registro relacionado a Hsia Hua Sheng";
 if(["colunas_autorais","artigos_profissionais","artigos_academicos","livros_capitulos"].includes(category)){label="Autoria";credit=authors||"Hsia Hua Sheng";participation="Autor ou coautor"}
 else if(category==="entrevistas_escritas_completas"){label="Reportagem ou entrevista";credit=authors||`Redação de ${item.fonte}`;participation="Entrevistado: Hsia Hua Sheng"}
 else if(category==="participacoes_em_reportagens"){label="Reportagem";credit=authors||`Redação de ${item.fonte}`;participation="Participação de Hsia Hua Sheng"}
 else if(category==="videos_podcasts"){label="Produção";credit=authors||item.fonte;participation="Participação de Hsia Hua Sheng"}
 return {...item,contabilizado:true,origem_local:true,categoria_label:CATEGORY_LABELS[category]||category,rotulo_credito:label,credito_exibicao:credit,participacao_hsia:participation,urls_secundarias_lista:[]};
}
function activeItems(){
 const base=state.data.itens.filter(x=>x.contabilizado!==false),all=[...base,...state.revisions.added.map(enrichAdded)];
 return state.apply?all.filter(x=>!isRemoved(x)):all;
}
function revisionCount(){return state.revisions.removed.length+state.revisions.added.length}
function counts(items=activeItems()){const out={};for(const item of items){const s=item.fonte||"Fonte não informada",c=item.categoria_painel;out[s]??={};out[s][c]=(out[s][c]||0)+1;out[s].total=(out[s].total||0)+1}return out}
function officialMeta(){
 $("#hero-total").textContent=state.data.meta.total_manifestacoes.toLocaleString("pt-BR");$("#hero-works").textContent=state.data.meta.total_obras.toLocaleString("pt-BR");$("#hero-sources").textContent=state.data.meta.total_fontes.toLocaleString("pt-BR");
 const d=new Date(state.data.meta.gerado_em);$("#updated-at").textContent=`Atualizado em ${d.toLocaleDateString("pt-BR")}`;
}
function renderChart(){
 const items=activeItems(),max=Math.max(1,...Object.keys(CATEGORY_LABELS).map(c=>items.filter(x=>x.categoria_painel===c).length));
 $("#category-chart").innerHTML=Object.entries(CATEGORY_LABELS).map(([id,label])=>{const n=items.filter(x=>x.categoria_painel===id).length;return `<button class="bar-row" data-category="${esc(id)}"><span class="bar-label">${esc(label)}</span><span class="bar-track"><span class="bar-fill" style="width:${n/max*100}%"></span></span><strong class="bar-value">${n}</strong></button>`}).join("");
 $$("#category-chart [data-category]").forEach(b=>b.onclick=()=>setFilters({category:b.dataset.category,source:""}));
}
function renderMatrix(){
 const categories=Object.keys(CATEGORY_LABELS),sourceCounts=counts();let sources=[...new Set([...state.data.volumetria.map(x=>x.fonte),...Object.keys(sourceCounts)])].filter(Boolean);
 sources=sources.filter(x=>norm(x).includes(norm(state.sourceQuery))).sort((a,b)=>a.localeCompare(b,"pt-BR"));$("#source-count").textContent=`${sources.length} fontes`;
 $("#matrix-head").innerHTML=`<th scope="col">Fonte</th>${categories.map(c=>`<th scope="col">${esc(CATEGORY_LABELS[c])}</th>`).join("")}<th scope="col">Total</th><th scope="col">Situação</th>`;
 const volumeMap=Object.fromEntries(state.data.volumetria.map(x=>[x.fonte,x]));
 $("#matrix-body").innerHTML=sources.map(source=>{const row=sourceCounts[source]||{},v=volumeMap[source]||{};return `<tr><th scope="row">${esc(source)}</th>${categories.map(c=>{const n=row[c]||0;return `<td>${n?`<button class="count-button" data-source="${esc(source)}" data-category="${c}" aria-label="${n} ${esc(CATEGORY_LABELS[c])} em ${esc(source)}">${n}</button>`:`<span class="zero">—</span>`}</td>`}).join("")}<td class="source-total">${row.total||0}</td><td><span class="status-pill">${esc(statusLabel(v.status_reconciliacao||"incluído na revisão"))}</span></td></tr>`}).join("");
 $$("#matrix-body .count-button").forEach(b=>b.onclick=()=>setFilters({source:b.dataset.source,category:b.dataset.category,query:"",year:""}));
}
function populateFilters(){
 const items=[...state.data.itens,...state.revisions.added],sources=[...new Set(items.map(x=>x.fonte).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 const years=[...new Set(items.map(x=>x.ano||String(x.data_publicacao||"").slice(0,4)).filter(x=>/^\d{4}$/.test(x)))].sort((a,b)=>b-a);
 $("#filter-source").innerHTML=`<option value="">Todas</option>${sources.map(x=>`<option>${esc(x)}</option>`).join("")}`;
 $("#filter-category").innerHTML=`<option value="">Todos</option>${Object.entries(CATEGORY_LABELS).map(([x,l])=>`<option value="${x}">${esc(l)}</option>`).join("")}`;
 $("#filter-year").innerHTML=`<option value="">Todos</option>${years.map(x=>`<option>${x}</option>`).join("")}`;
 $('#add-form [name="categoria_painel"]').innerHTML=Object.entries(CATEGORY_LABELS).map(([x,l])=>`<option value="${x}">${esc(l)}</option>`).join("");
}
function filtered(){
 let items=activeItems(),f=state.filters;if(f.source)items=items.filter(x=>x.fonte===f.source);if(f.category)items=items.filter(x=>x.categoria_painel===f.category);if(f.year)items=items.filter(x=>(x.ano||String(x.data_publicacao||"").slice(0,4))===f.year);
 if(f.query){const q=norm(f.query);items=items.filter(x=>norm([x.titulo,x.fonte,x.credito_exibicao,x.participacao_hsia,x.item_id,x.evidencia].join(" ")).includes(q))}
 const coll=new Intl.Collator("pt-BR",{sensitivity:"base"});items.sort((a,b)=>f.sort==="oldest"?(a.ano||9999)-(b.ano||9999):f.sort==="source"?coll.compare(a.fonte,b.fonte):f.sort==="title"?coll.compare(a.titulo,b.titulo):(b.ano||0)-(a.ano||0)||coll.compare(a.titulo,b.titulo));return items;
}
function cardHTML(item){
 const id=getId(item),removed=isRemoved(item),url=safeUrl(item.url_original||item.url_principal),year=item.ano||String(item.data_publicacao||"").slice(0,4)||"s.d.";
 return `<article class="card ${removed?"removed":""}" data-id="${esc(id)}"><div class="card-top"><span class="category-tag">${esc(item.categoria_label||CATEGORY_LABELS[item.categoria_painel])}</span><span class="card-year">${esc(year)}</span></div><h3>${esc(item.titulo||"Título não informado")}</h3><p class="card-source">${esc(item.fonte)}</p><div class="credit"><span>${esc(item.rotulo_credito)}</span><strong>${esc(item.credito_exibicao)}</strong><div class="participation">${esc(item.participacao_hsia)}</div></div><div class="card-actions"><button class="open-detail" data-id="${esc(id)}" type="button">Ver detalhes</button>${url?`<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener">Abrir origem</a>`:""}<button class="review-action" data-id="${esc(id)}" title="${removed?"Restaurar":"Marcar para remover"}" aria-label="${removed?"Restaurar":"Marcar para remover"}">${removed?"↶":"−"}</button></div></article>`;
}
function renderCards(){
 const items=filtered(),shown=items.slice(0,state.shown),f=state.filters;$("#results-title").textContent=f.source&&f.category?`${CATEGORY_LABELS[f.category]} — ${f.source}`:f.source?f.source:f.category?CATEGORY_LABELS[f.category]:"Todos os registros";
 $("#results-summary").textContent=`${items.length.toLocaleString("pt-BR")} ${items.length===1?"registro encontrado":"registros encontrados"}${state.apply?" na base revisada":" na base publicada"}.`;
 const context=$("#active-context");context.hidden=!(f.source||f.category);context.innerHTML=(f.source||f.category)?`Recorte ativo: <strong>${esc([f.source,CATEGORY_LABELS[f.category]].filter(Boolean).join(" · "))}</strong>`:"";
 $("#cards").innerHTML=shown.map(cardHTML).join("");$("#empty").hidden=items.length>0;$("#load-more").hidden=shown.length>=items.length;
 $$(".open-detail").forEach(b=>b.onclick=()=>openDetail(b.dataset.id));$$(".review-action").forEach(b=>b.onclick=()=>toggleRemove(b.dataset.id));
}
function openDetail(id){
 const item=[...state.data.itens,...state.revisions.added.map(enrichAdded)].find(x=>getId(x)===id);if(!item)return;$("#detail-title").textContent=item.titulo||"Publicação";
 const links=[item.url_original,item.url_principal,...(item.urls_secundarias_lista||[])].map(safeUrl).filter((x,i,a)=>x&&a.indexOf(x)===i);
 $("#detail-body").innerHTML=`<div class="detail-grid"><div class="detail-field"><span>Fonte</span><strong>${esc(item.fonte)}</strong></div><div class="detail-field"><span>Formato</span><strong>${esc(item.categoria_label||CATEGORY_LABELS[item.categoria_painel])}</strong></div><div class="detail-field"><span>${esc(item.rotulo_credito)}</span><strong>${esc(item.credito_exibicao)}</strong></div><div class="detail-field"><span>Papel de Hsia</span><strong>${esc(item.participacao_hsia)}</strong></div><div class="detail-field"><span>Data</span><strong>${esc(fmtDate(item.data_publicacao||item.ano)||"Não informada")}</strong></div><div class="detail-field"><span>Identificador</span><strong>${esc(item.item_id||"Em revisão")}</strong></div><div class="detail-field full"><span>Evidência preservada</span><p>${esc(item.evidencia||item.texto_ou_evidencia_disponivel||"Metadados e link original preservados.")}</p></div><div class="detail-field full"><span>Links</span><div class="detail-links">${links.length?links.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener">${i?"Fonte secundária":"Publicação original"} ↗</a>`).join(""):"Nenhum endereço disponível"}</div></div></div><button class="button subtle detail-remove" data-detail-remove="${esc(id)}">${isRemoved(item)?"Restaurar registro":"Marcar para remoção"}</button>`;
 $("[data-detail-remove]").onclick=async()=>{await toggleRemove(id);$("#detail-dialog").close()};$("#detail-dialog").showModal();
}
function setFilters(next){Object.assign(state.filters,next);state.shown=PAGE_SIZE;$("#query").value=state.filters.query||"";$("#filter-source").value=state.filters.source||"";$("#filter-category").value=state.filters.category||"";$("#filter-year").value=state.filters.year||"";renderCards();$("#publicacoes").scrollIntoView({behavior:"smooth"})}
function renderReview(){
 const n=revisionCount();$("#change-count").textContent=n;$("#review-dot").classList.toggle("active",n>0);
 const rows=[...state.revisions.removed.map(x=>({type:"remove",title:x.titulo||x.manifestacao_id,meta:`Remoção · ${x.reviewer||""}`})),...state.revisions.added.map(x=>({type:"add",title:x.titulo,meta:`Inclusão · ${x.reviewer||""}`}))];
 $("#changes-list").innerHTML=rows.length?rows.map(x=>`<div class="change-row"><div><strong>${x.type==="add"?"Adicionado":"Removido"}: ${esc(x.title)}</strong><p>${esc(x.meta)}</p></div></div>`).join(""):`<div class="empty"><strong>Nenhuma alteração aplicada.</strong><span>A base publicada permanece como está.</span></div>`;
 $("#sync-status").textContent="Revisão salva neste navegador. Use a aba “Baixar dados” para guardar ou publicar as alterações.";
}
async function login(){state.email=localStorage.getItem(EMAIL_KEY)||"Revisão aberta";return true}
async function loadRevisions(){try{state.revisions=JSON.parse(localStorage.getItem(LOCAL_KEY))||state.revisions}catch{}state.remote=false}
function applyChange(target,change){
 target.history=target.history||[];target.removed=target.removed||[];target.added=target.added||[];
 if(change.type==="remove"&&!target.removed.some(x=>x.manifestacao_id===change.manifestacao_id))target.removed.push(change);
 if(change.type==="restore")target.removed=target.removed.filter(x=>x.manifestacao_id!==change.manifestacao_id);
 if(change.type==="add")target.added.push(change.item);target.history.push(change);return target;
}
async function saveChange(change){
 if(!confirm(`Confirmar esta alteração como ${state.email}?`))return false;const payload={...change,reviewer:change.item?.revisor||state.email,changed_at:new Date().toISOString()};
 if(state.remote){const res=await fetch(API,{method:"POST",headers:{"content-type":"application/json","x-reviewer-email":state.email},body:JSON.stringify(payload)});if(!res.ok){toast("Não foi possível salvar no servidor.");return false}state.revisions=await res.json()}
 else{applyChange(state.revisions,payload);localStorage.setItem(LOCAL_KEY,JSON.stringify(state.revisions))}
 renderAll();toast(state.remote?"Alteração salva e enviada ao GitHub.":"Alteração salva neste navegador.");return true;
}
async function toggleRemove(id){const item=[...state.data.itens,...state.revisions.added.map(enrichAdded)].find(x=>getId(x)===id);if(!item)return;await saveChange({type:isRemoved(item)?"restore":"remove",manifestacao_id:id,item_id:item.item_id,titulo:item.titulo,fonte:item.fonte})}
async function addItem(form){
 const values=Object.fromEntries(new FormData(form)),uid=crypto.randomUUID(),category=values.categoria_painel,role=["colunas_autorais","artigos_profissionais","artigos_academicos","livros_capitulos"].includes(category)?"autor_unico":category==="entrevistas_escritas_completas"?"entrevistado":"participante";
 const item={...Object.fromEntries(FIELDS.map(x=>[x,""])),...values,manifestacao_id:`manifestacao-revisao-${uid}`,item_id:`hsia-revisao-${uid}`,producao_principal_item_id:`hsia-revisao-${uid}`,papel_manifestacao:"origem",tipo_manifestacao:category==="videos_podcasts"?"audiovisual":"escrita",papel_hsia:role,url_principal:values.url_original,status_verificacao:"confirmado_por_revisao",contabilizado_na_volumetria:"sim",status_acesso:"a_verificar",conteudo_status:"evidencia_fornecida",reviewer:state.email,created_at:new Date().toISOString()};
 if(await saveChange({type:"add",item})){form.reset();activateTab("changes")}
}
function renderAll(){officialMeta();renderChart();renderMatrix();populateFilters();renderCards();renderReview();$("#apply-review").checked=state.apply}
function activateTab(name){$$(".review-tabs button").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));$$(".review-pane").forEach(x=>x.classList.toggle("active",x.dataset.pane===name))}
function csvText(rows,fields=FIELDS){const q=v=>`"${String(v??"").replaceAll('"','""')}"`;return "\ufeff"+[fields,...rows.map(r=>fields.map(f=>r[f]??""))].map(r=>r.map(q).join(",")).join("\r\n")}
function download(name,blob){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200)}
function exportRows(){return activeItems().filter(x=>state.apply?!isRemoved(x):true).map(x=>{const row=Object.fromEntries(FIELDS.map(f=>[f,x[f]??""]));if(norm(row.autores).includes("desconhecid"))row.autores="";return row})}
function volumeRows(){
 const c=counts(),base=Object.fromEntries(state.data.volumetria.map(x=>[x.fonte,x])),sources=[...new Set([...Object.keys(base),...Object.keys(c)])].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 return sources.map(source=>{const row={fonte:source,forma_de_acesso:base[source]?.forma_de_acesso||"Link informado na revisão"};for(const key of Object.keys(CATEGORY_LABELS))row[key]=c[source]?.[key]||0;row.total_producoes_unicas=c[source]?.total||0;row.pendentes=base[source]?.pendentes||0;row.status_reconciliacao=base[source]?.status_reconciliacao||"incluido_por_revisao";return row})
}
function xml(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).slice(0,32767)}
function column(n){let s="";while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function sheetXml(rows){
 const keys=rows.length?Object.keys(rows[0]):["sem_dados"],all=[Object.fromEntries(keys.map(k=>[k,k])),...rows];
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${all.map((r,ri)=>`<row r="${ri+1}">${keys.map((k,ci)=>{const v=r[k]??"",ref=column(ci+1)+(ri+1);return typeof v==="number"?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"${ri===0?' s="1"':""}><is><t>${xml(v)}</t></is></c>`}).join("")}</row>`).join("")}</sheetData><autoFilter ref="A1:${column(keys.length)}${all.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews></worksheet>`;
}
const crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function u16(v){return[v&255,v>>>8&255]}function u32(v){return[v&255,v>>>8&255,v>>>16&255,v>>>24&255]}
function makeZip(files){
 const enc=new TextEncoder(),local=[],central=[];let offset=0;
 for(const [name,text] of Object.entries(files)){const n=enc.encode(name),d=enc.encode(text),crc=crc32(d),lh=new Uint8Array([80,75,3,4,20,0,0,8,0,0,0,0,0,0,...u32(crc),...u32(d.length),...u32(d.length),...u16(n.length),0,0,...n,...d]);local.push(lh);const ch=new Uint8Array([80,75,1,2,20,0,20,0,0,8,0,0,0,0,0,0,...u32(crc),...u32(d.length),...u32(d.length),...u16(n.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(offset),...n]);central.push(ch);offset+=lh.length}
 const csize=central.reduce((a,b)=>a+b.length,0),end=new Uint8Array([80,75,5,6,0,0,0,0,...u16(local.length),...u16(local.length),...u32(csize),...u32(offset),0,0]);return new Blob([...local,...central,end],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
function xlsxBlob(){
 const items=exportRows(),volumes=volumeRows(),history=state.revisions.history||[],names=["Publicações","Volumetria","Histórico"];
 return makeZip({"[Content_Types].xml":`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
 "_rels/.rels":`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
 "xl/workbook.xml":`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n,i)=>`<sheet name="${n}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`,
 "xl/_rels/workbook.xml.rels":`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
 "xl/styles.xml":`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0D2832"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>`,
 "xl/worksheets/sheet1.xml":sheetXml(items),"xl/worksheets/sheet2.xml":sheetXml(volumes),"xl/worksheets/sheet3.xml":sheetXml(history.map(x=>({tipo:x.type,responsavel:x.reviewer,data:x.changed_at,item_id:x.item_id||x.item?.item_id,titulo:x.titulo||x.item?.titulo,fonte:x.fonte||x.item?.fonte})))});
}
function bind(){
 $("#source-search").oninput=e=>{state.sourceQuery=e.target.value;renderMatrix()};$("#query").oninput=e=>{state.filters.query=e.target.value;state.shown=PAGE_SIZE;renderCards()};
 [["#filter-source","source"],["#filter-category","category"],["#filter-year","year"],["#sort","sort"]].forEach(([s,k])=>$(s).onchange=e=>{state.filters[k]=e.target.value;state.shown=PAGE_SIZE;renderCards()});
 $("#clear-filters").onclick=()=>setFilters({query:"",source:"",category:"",year:"",sort:"recent"});$("#load-more").onclick=()=>{state.shown+=PAGE_SIZE;renderCards()};
 ["#open-review","#open-review-bottom"].forEach(s=>$(s).onclick=()=>{$("#review-dialog").showModal();renderReview()});$$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).close());
 $$(".review-tabs button").forEach(b=>b.onclick=()=>activateTab(b.dataset.tab));$("#apply-review").onchange=e=>{state.apply=e.target.checked;renderAll()};$("#add-form").onsubmit=e=>{e.preventDefault();addItem(e.currentTarget)};
 $("#download-csv").onclick=()=>download("painel_itens_atualizado.csv",new Blob([csvText(exportRows())],{type:"text/csv;charset=utf-8"}));$("#download-xlsx").onclick=()=>download("acervo_hsia_atualizado.xlsx",xlsxBlob());
 $("#download-review").onclick=()=>download("revisoes_dashboard.json",new Blob([JSON.stringify({...state.revisions,exportado_por:state.email,exportado_em:new Date().toISOString()},null,2)],{type:"application/json"}));
 $("#import-review").onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());state.revisions={removed:data.removed||[],added:data.added||[],history:data.history||[]};localStorage.setItem(LOCAL_KEY,JSON.stringify(state.revisions));state.remote=false;renderAll();toast("Pacote de revisão importado.")}catch{toast("Arquivo de revisão inválido.")}};
 $("#load-pending").onclick=()=>toast("Baixe o JSON e envie-o para dashboard/data/revisoes_aprovadas.json no GitHub.");
}
async function init(){
 try{await login();const res=await fetch("data/dashboard.json",{cache:"no-store"});if(!res.ok)throw Error(`HTTP ${res.status}`);state.data=await res.json();await loadRevisions();bind();renderAll()}
 catch(error){document.body.innerHTML=`<main class="fatal"><h1>Não foi possível abrir o acervo.</h1><p>${esc(error.message)}</p><p>Gere <code>dashboard/data/dashboard.json</code> antes de publicar.</p></main>`}
}
init();
})();
