
(() => {
"use strict";

const API="/api/revisions", LOCAL_KEY="hsia-dashboard-revisions-v2";
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
const state={data:null,revisions:{removed:[],added:[],history:[]},filters:{query:"",source:"",category:"",year:"",sort:"recent"},shown:PAGE_SIZE,sourceQuery:"",remote:false,syncError:""};
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3200)}
function fmtDate(value){const raw=String(value??"").trim();if(/^\d{4}$/.test(raw))return raw;const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);return iso?`${iso[3]}/${iso[2]}/${iso[1]}`:raw}
function dateForForm(value){const raw=String(value??"").trim(),iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);return iso?`${iso[3]}/${iso[2]}/${iso[1]}`:/^\d{2}\/\d{2}\/\d{4}$/.test(raw)?raw:""}
function normalizeFormDate(value){const match=String(value??"").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!match)return "";const [,day,month,year]=match,date=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));return date.getUTCFullYear()===Number(year)&&date.getUTCMonth()===Number(month)-1&&date.getUTCDate()===Number(day)?`${year}-${month}-${day}`:""}
function formValues(form){const values=Object.fromEntries(new FormData(form)),input=form.elements.namedItem("data_publicacao"),date=normalizeFormDate(values.data_publicacao);input.setCustomValidity(date?"":"Informe uma data válida no formato DD/MM/AAAA.");if(!date){input.reportValidity();return null}values.data_publicacao=date;values.ano=date.slice(0,4);return values}
function maskDateInput(input){const digits=input.value.replace(/\D/g,"").slice(0,8);input.value=digits.length>4?`${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`:digits.length>2?`${digits.slice(0,2)}/${digits.slice(2)}`:digits}
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
 return all.filter(x=>!isRemoved(x));
}
function revisionCount(){return state.revisions.removed.length+state.revisions.added.filter(x=>!isRemoved(x)).length}
function counts(items=activeItems()){const out={};for(const item of items){const s=item.fonte||"Fonte não informada",c=item.categoria_painel;out[s]??={};out[s][c]=(out[s][c]||0)+1;out[s].total=(out[s].total||0)+1}return out}
function officialMeta(){
 const items=activeItems();$("#hero-total").textContent=items.length.toLocaleString("pt-BR");$("#hero-works").textContent=new Set(items.map(x=>x.item_id).filter(Boolean)).size.toLocaleString("pt-BR");$("#hero-sources").textContent=new Set(items.map(x=>x.fonte).filter(Boolean)).size.toLocaleString("pt-BR");
 const d=new Date(state.revisions.updated_at||state.data.meta.gerado_em);$("#updated-at").textContent=`Atualizado em ${d.toLocaleDateString("pt-BR")}`;
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
 const categoryOptions=Object.entries(CATEGORY_LABELS).map(([x,l])=>`<option value="${x}">${esc(l)}</option>`).join("");$('#add-form [name="categoria_painel"]').innerHTML=categoryOptions;$('#edit-form [name="categoria_painel"]').innerHTML=categoryOptions;
}
function filtered(){
 let items=activeItems(),f=state.filters;if(f.source)items=items.filter(x=>x.fonte===f.source);if(f.category)items=items.filter(x=>x.categoria_painel===f.category);if(f.year)items=items.filter(x=>(x.ano||String(x.data_publicacao||"").slice(0,4))===f.year);
 if(f.query){const q=norm(f.query);items=items.filter(x=>norm([x.titulo,x.fonte,x.credito_exibicao,x.participacao_hsia,x.item_id,x.evidencia].join(" ")).includes(q))}
 const coll=new Intl.Collator("pt-BR",{sensitivity:"base"});items.sort((a,b)=>f.sort==="oldest"?(a.ano||9999)-(b.ano||9999):f.sort==="source"?coll.compare(a.fonte,b.fonte):f.sort==="title"?coll.compare(a.titulo,b.titulo):(b.ano||0)-(a.ano||0)||coll.compare(a.titulo,b.titulo));return items;
}
function bookRelationsFor(item){
 const bridge=window.HsiaBook;if(!bridge||typeof bridge.relationsForItem!=="function"||!item.item_id)return [];
 try{return bridge.relationsForItem(item.item_id)}catch{return []}
}
function bookRelationMeta(relation){
 const score=Number(relation.adherence||0),scoreLabel=score>0?score.toFixed(1).replace(".",",")+"% de aderência":"Sem percentual de aderência";
 return scoreLabel+" · "+(relation.classification==="exclusivo"?"Exclusivo":"Compartilhado");
}
function publicationBookHTML(item,compact=false){
 const relations=bookRelationsFor(item);if(!relations.length)return "";
 const rows=relations.map(relation=>'<button class="publication-book-relation" type="button" data-publication-book-relation="'+esc(relation.relation_id)+'"><strong>Cap. '+esc(relation.chapter)+(relation.chapter_title?" · "+esc(relation.chapter_title):"")+'</strong><span>'+esc(bookRelationMeta(relation))+'</span><small>Editar relação</small></button>').join("");
 return '<section class="publication-book'+(compact?" compact":"")+'"><div class="publication-book-head"><span>No Livro</span><b>'+relations.length+' '+(relations.length===1?"capítulo":"capítulos")+'</b></div><div class="publication-book-list">'+rows+'</div></section>';
}
function bindBookRelationButtons(root=document){
 [...root.querySelectorAll("[data-publication-book-relation]")].forEach(button=>button.onclick=()=>{const relationId=button.dataset.publicationBookRelation,dialog=button.closest("dialog");if(dialog?.open)dialog.close();window.HsiaBook?.editRelation(relationId)});
}
function cardHTML(item){
 const id=getId(item),removed=isRemoved(item),url=safeUrl(item.url_original||item.url_principal),year=item.ano||String(item.data_publicacao||"").slice(0,4)||"s.d.";
 return `<article class="card ${removed?"removed":""}" data-id="${esc(id)}"><div class="card-top"><span class="category-tag">${esc(item.categoria_label||CATEGORY_LABELS[item.categoria_painel])}</span><span class="card-year">${esc(year)}</span></div><h3>${esc(item.titulo||"Título não informado")}</h3><p class="card-source">${esc(item.fonte)}</p><div class="credit"><span>${esc(item.rotulo_credito)}</span><strong>${esc(item.credito_exibicao)}</strong><div class="participation">${esc(item.participacao_hsia)}</div></div>${publicationBookHTML(item,true)}<div class="card-actions"><button class="open-detail" data-id="${esc(id)}" type="button">Ver detalhes</button>${url?`<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener">Abrir origem</a>`:""}<button class="review-action" data-id="${esc(id)}" title="${removed?"Restaurar":"Marcar para remover"}" aria-label="${removed?"Restaurar":"Marcar para remover"}">${removed?"↶":"−"}</button></div></article>`;
}
function renderCards(){
 const items=filtered(),shown=items.slice(0,state.shown),f=state.filters;$("#results-title").textContent=f.source&&f.category?`${CATEGORY_LABELS[f.category]} — ${f.source}`:f.source?f.source:f.category?CATEGORY_LABELS[f.category]:"Todos os registros";
 $("#results-summary").textContent=`${items.length.toLocaleString("pt-BR")} ${items.length===1?"registro encontrado":"registros encontrados"} na base atualizada.`;
 const context=$("#active-context");context.hidden=!(f.source||f.category);context.innerHTML=(f.source||f.category)?`Recorte ativo: <strong>${esc([f.source,CATEGORY_LABELS[f.category]].filter(Boolean).join(" · "))}</strong>`:"";
 $("#cards").innerHTML=shown.map(cardHTML).join("");$("#empty").hidden=items.length>0;$("#load-more").hidden=shown.length>=items.length;
 $$(".open-detail").forEach(b=>b.onclick=()=>openDetail(b.dataset.id));$$(".review-action").forEach(b=>b.onclick=()=>toggleRemove(b.dataset.id));bindBookRelationButtons($("#cards"));
}
function findItem(id){return [...state.data.itens,...state.revisions.added.map(enrichAdded)].find(x=>getId(x)===id)}
function openDetail(id){
 const item=findItem(id);if(!item)return;$("#detail-title").textContent=item.titulo||"Publicação";
 const links=[item.url_original,item.url_principal,...(item.urls_secundarias_lista||[])].map(safeUrl).filter((x,i,a)=>x&&a.indexOf(x)===i);
 $("#detail-body").innerHTML=`<div class="detail-grid"><div class="detail-field"><span>Fonte</span><strong>${esc(item.fonte)}</strong></div><div class="detail-field"><span>Formato</span><strong>${esc(item.categoria_label||CATEGORY_LABELS[item.categoria_painel])}</strong></div><div class="detail-field"><span>${esc(item.rotulo_credito)}</span><strong>${esc(item.credito_exibicao)}</strong></div><div class="detail-field"><span>Papel de Hsia</span><strong>${esc(item.participacao_hsia)}</strong></div><div class="detail-field"><span>Data</span><strong>${esc(fmtDate(item.data_publicacao||item.ano)||"Não informada")}</strong></div><div class="detail-field"><span>Identificador</span><strong>${esc(item.item_id||"Em revisão")}</strong></div><div class="detail-field full"><span>Evidência preservada</span><p>${esc(item.evidencia||item.texto_ou_evidencia_disponivel||"Metadados e link original preservados.")}</p></div><div class="detail-field full"><span>Links</span><div class="detail-links">${links.length?links.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener">${i?"Fonte secundária":"Publicação original"} ↗</a>`).join(""):"Nenhum endereço disponível"}</div></div></div>${publicationBookHTML(item)}<div class="detail-actions"><button class="button dark" data-detail-edit="${esc(id)}">Editar publicação</button><button class="button subtle detail-remove" data-detail-remove="${esc(id)}">${isRemoved(item)?"Restaurar registro":"Marcar para remoção"}</button></div>`;
 bindBookRelationButtons($("#detail-body"));$("[data-detail-edit]").onclick=()=>{$("#detail-dialog").close();openEdit(id)};$("[data-detail-remove]").onclick=async()=>{await toggleRemove(id);$("#detail-dialog").close()};$("#detail-dialog").showModal();
}
function setFilters(next){Object.assign(state.filters,next);state.shown=PAGE_SIZE;$("#query").value=state.filters.query||"";$("#filter-source").value=state.filters.source||"";$("#filter-category").value=state.filters.category||"";$("#filter-year").value=state.filters.year||"";renderCards();$("#publicacoes").scrollIntoView({behavior:"smooth"})}
function renderReview(){
 const n=revisionCount();$("#change-count").textContent=n;$("#review-dot").classList.toggle("active",n>0);
 const removed=state.revisions.removed.map(x=>({type:"remove",id:x.manifestacao_id||x,title:x.titulo||x.manifestacao_id||x,meta:`Removido · ${x.reviewer||"Visitante"}`,canRestore:x.reason!=="substituido_por_edicao"}));
 const added=state.revisions.added.filter(x=>!isRemoved(x)).map(x=>({type:x.editado_de_manifestacao_id?"edit":"add",id:x.manifestacao_id,title:x.titulo,meta:`${x.editado_de_manifestacao_id?"Editado":"Adicionado"} · ${x.revisor||x.reviewer||"Visitante"}`}));
 const rows=[...removed,...added];
 $("#changes-list").innerHTML=rows.length?rows.map(x=>`<div class="change-row"><div><strong>${x.type==="remove"?"Removido":x.type==="edit"?"Editado":"Adicionado"}: ${esc(x.title)}</strong><p>${esc(x.meta)}</p></div>${x.canRestore?`<button type="button" data-restore="${esc(x.id)}">Restaurar</button>`:""}</div>`).join(""):`<div class="empty"><strong>Nenhuma alteração publicada.</strong><span>A base compartilhada está sem revisões adicionais.</span></div>`;
 $$("[data-restore]").forEach(button=>button.onclick=()=>saveChange({type:"restore",manifestacao_id:button.dataset.restore}));
 $("#sync-status").textContent=state.remote?"Sincronização automática ativa. Toda alteração é publicada no repositório.":`Sincronização indisponível. ${state.syncError||"As alterações ficam apenas neste navegador."}`;
}
async function loadRevisions(){
 let local={removed:[],added:[],history:[]};try{local=JSON.parse(localStorage.getItem(LOCAL_KEY))||local}catch{}
 try{const res=await fetch(API,{cache:"no-store"}),data=await res.json();if(!res.ok)throw Error(data.error||`HTTP ${res.status}`);state.revisions=data;state.remote=true;state.syncError="";localStorage.setItem(LOCAL_KEY,JSON.stringify(data))}
 catch(error){state.revisions=local;state.remote=false;state.syncError=error.message||"Servidor indisponível."}
}
function applyChange(target,change){
 target.history=target.history||[];target.removed=target.removed||[];target.added=target.added||[];
 if(change.type==="remove"&&!target.removed.some(x=>(x.manifestacao_id||x)===change.manifestacao_id))target.removed.push(change);
 if(change.type==="restore")target.removed=target.removed.filter(x=>(x.manifestacao_id||x)!==change.manifestacao_id);
 if(change.type==="add")target.added.push(change.item);
 if(change.type==="edit"){
  const index=target.added.findIndex(x=>getId(x)===change.manifestacao_id);
  if(index>=0){const current=target.added[index];target.added[index]={...current,...change.item,manifestacao_id:current.manifestacao_id,item_id:current.item_id,edited_at:change.changed_at};change.item=target.added[index]}
  else{const uid=crypto.randomUUID();if(!target.removed.some(x=>(x.manifestacao_id||x)===change.manifestacao_id))target.removed.push({type:"remove",manifestacao_id:change.manifestacao_id,item_id:change.item.item_id,titulo:change.item.titulo,fonte:change.item.fonte,reason:"substituido_por_edicao",reviewer:change.reviewer,changed_at:change.changed_at});change.item={...change.item,manifestacao_id:`manifestacao-edicao-${uid}`,editado_de_manifestacao_id:change.manifestacao_id,edited_at:change.changed_at};target.added.push(change.item)}
 }
 target.history.push(change);target.updated_at=change.changed_at;return target;
}
async function saveChange(change){
 const payload={...change,reviewer:change.item?.revisor||change.reviewer||"Visitante",changed_at:new Date().toISOString()};
 if(state.remote){try{const res=await fetch(API,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}),data=await res.json();if(!res.ok)throw Error(data.error||"Não foi possível publicar.");state.revisions=data;localStorage.setItem(LOCAL_KEY,JSON.stringify(data))}catch(error){toast(error.message||"Não foi possível publicar no repositório.");return false}}
 else{applyChange(state.revisions,payload);localStorage.setItem(LOCAL_KEY,JSON.stringify(state.revisions))}
 renderAll();toast(state.remote?"Alteração publicada. A base está sendo atualizada.":"Alteração salva apenas neste navegador.");return true;
}
async function toggleRemove(id){const item=findItem(id);if(!item)return;await saveChange({type:isRemoved(item)?"restore":"remove",manifestacao_id:id,item_id:item.item_id,titulo:item.titulo,fonte:item.fonte})}
async function addItem(form){
 const values=formValues(form);if(!values)return;const uid=crypto.randomUUID(),category=values.categoria_painel,role=["colunas_autorais","artigos_profissionais","artigos_academicos","livros_capitulos"].includes(category)?"autor_unico":category==="entrevistas_escritas_completas"?"entrevistado":"participante";
 const item={...Object.fromEntries(FIELDS.map(x=>[x,""])),...values,manifestacao_id:`manifestacao-revisao-${uid}`,item_id:`hsia-revisao-${uid}`,producao_principal_item_id:`hsia-revisao-${uid}`,papel_manifestacao:"origem",tipo_manifestacao:category==="videos_podcasts"?"audiovisual":"escrita",papel_hsia:role,url_principal:values.url_original,status_verificacao:"confirmado_por_revisao",contabilizado_na_volumetria:"sim",status_acesso:"a_verificar",conteudo_status:"evidencia_fornecida",created_at:new Date().toISOString()};
 if(await saveChange({type:"add",item})){form.reset();activateTab("changes")}
}
function openEdit(id){
 const item=findItem(id);if(!item)return;const form=$("#edit-form");
 form.elements.original_id.value=id;for(const field of ["fonte","categoria_painel","titulo","autores","url_original","evidencia","revisor"]){const input=form.elements.namedItem(field);if(input)input.value=item[field]||""}form.elements.data_publicacao.value=dateForForm(item.data_publicacao);const bookBox=$("#edit-book-relations"),bookHtml=publicationBookHTML(item);bookBox.hidden=!bookHtml;bookBox.innerHTML=bookHtml;if(bookHtml)bindBookRelationButtons(bookBox);
 $("#edit-dialog").showModal();
}
async function editItem(form){
 const values=formValues(form);if(!values)return;const originalId=values.original_id,current=findItem(values.original_id);delete values.original_id;if(!current)return;
 const category=values.categoria_painel,role=["colunas_autorais","artigos_profissionais","artigos_academicos","livros_capitulos"].includes(category)?"autor_unico":category==="entrevistas_escritas_completas"?"entrevistado":"participante";
 const item={...Object.fromEntries(FIELDS.map(x=>[x,""])),...current,...values,papel_hsia:role,tipo_manifestacao:category==="videos_podcasts"?"audiovisual":"escrita",url_principal:values.url_original,status_verificacao:"confirmado_por_revisao",contabilizado_na_volumetria:"sim"};
 if(await saveChange({type:"edit",manifestacao_id:originalId,item})){$("#edit-dialog").close();form.reset()}
}
function renderAll(){officialMeta();renderChart();renderMatrix();populateFilters();renderCards();renderReview()}function activateTab(name){$$(".review-tabs button").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));$$(".review-pane").forEach(x=>x.classList.toggle("active",x.dataset.pane===name))}
function csvText(rows,fields=FIELDS){const q=v=>`"${String(v??"").replaceAll('"','""')}"`;return "\ufeff"+[fields,...rows.map(r=>fields.map(f=>r[f]??""))].map(r=>r.map(q).join(",")).join("\r\n")}
function download(name,blob){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200)}
function exportRows(){return activeItems().map(x=>{const row=Object.fromEntries(FIELDS.map(f=>[f,x[f]??""]));if(norm(row.autores).includes("desconhecid"))row.autores="";return row})}
async function downloadOfficialXlsx(){
 const button=$("#download-xlsx");button.disabled=true;
 try{const response=await fetch(`data/acervo_hsia_atualizado.xlsx?v=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw Error("Não foi possível baixar o XLSX.");const blob=await response.blob(),signature=new Uint8Array(await blob.slice(0,4).arrayBuffer());if(blob.size<10000||signature[0]!==80||signature[1]!==75)throw Error("O arquivo XLSX recebido é inválido.");download("acervo_hsia_atualizado.xlsx",blob)}
 catch(error){toast(error.message||"Não foi possível baixar o XLSX.")}
 finally{button.disabled=false}
}function bind(){
 $("#source-search").oninput=e=>{state.sourceQuery=e.target.value;renderMatrix()};$("#query").oninput=e=>{state.filters.query=e.target.value;state.shown=PAGE_SIZE;renderCards()};
 [["#filter-source","source"],["#filter-category","category"],["#filter-year","year"],["#sort","sort"]].forEach(([s,k])=>$(s).onchange=e=>{state.filters[k]=e.target.value;state.shown=PAGE_SIZE;renderCards()});
 $("#clear-filters").onclick=()=>setFilters({query:"",source:"",category:"",year:"",sort:"recent"});$("#load-more").onclick=()=>{state.shown+=PAGE_SIZE;renderCards()};
 ["#open-review","#open-review-bottom"].forEach(s=>$(s).onclick=()=>{$("#review-dialog").showModal();renderReview()});$$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).close());
 $$(".review-tabs button").forEach(b=>b.onclick=()=>activateTab(b.dataset.tab));$("#add-form").onsubmit=e=>{e.preventDefault();addItem(e.currentTarget)};$("#edit-form").onsubmit=e=>{e.preventDefault();editItem(e.currentTarget)};$$('input[name="data_publicacao"]').forEach(input=>input.oninput=()=>{input.setCustomValidity("");maskDateInput(input)});
 $("#download-csv").onclick=()=>download("painel_itens_atualizado.csv",new Blob([csvText(exportRows())],{type:"text/csv;charset=utf-8"}));$("#download-xlsx").onclick=downloadOfficialXlsx;
}async function init(){
 try{const res=await fetch("data/dashboard.json",{cache:"no-store"});if(!res.ok)throw Error(`HTTP ${res.status}`);state.data=await res.json();await loadRevisions();bind();renderAll()}
 catch(error){document.body.innerHTML=`<main class="fatal"><h1>Não foi possível abrir o acervo.</h1><p>${esc(error.message)}</p><p>Gere <code>data/dashboard.json</code> antes de publicar.</p></main>`}
}
window.addEventListener("hsia-book-ready",()=>{if(state.data)renderCards()});
init();
})();
