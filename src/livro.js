(() => {
"use strict";

const API="/api/revisions",LOCAL_KEY="hsia-dashboard-book-v1";
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const norm=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const human=value=>String(value||"Não informado").replaceAll("_"," ").replace(/^./,letter=>letter.toUpperCase());
const state={data:null,baseItems:null,overrides:[],remote:false,selectedItems:new Set(),filters:{chapter:"",classification:"",type:"",adherence:0,update:"",sort:"adherence"}};

function toast(message){const element=$("#toast");element.textContent=message;element.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove("show"),3500)}
function localPublicationRevisions(){try{return JSON.parse(localStorage.getItem("hsia-dashboard-revisions-v2"))||{}}catch{return {}}}
function mergeRevisionItems(revisions={}){
 const removed=new Set((revisions.removed||[]).map(entry=>typeof entry==="string"?entry:entry?.manifestacao_id).filter(Boolean));state.data.items={...state.baseItems};
 for(const raw of revisions.added||[]){if(!raw||removed.has(raw.manifestacao_id))continue;const itemId=raw.item_id||raw.manifestacao_id;if(!itemId)continue;const current=state.data.items[itemId]||{};state.data.items[itemId]={...current,item_id:itemId,title:raw.titulo||current.title||"Obra sem título",year:raw.ano||String(raw.data_publicacao||"").slice(0,4)||current.year||"",publication_date:raw.data_publicacao||current.publication_date||"",publication_type:raw.tipo_publicacao||raw.categoria_painel||current.publication_type||"",source:raw.fonte||current.source||"",url:raw.url_original||raw.url_principal||current.url||"",manifestation_id:raw.manifestacao_id||current.manifestation_id||""}}
}
async function refreshRevisionData(){
 let revisions;try{const response=await fetch(API,{cache:"no-store"});revisions=await response.json();if(!response.ok)throw Error();state.overrides=revisions.book_relations||[];state.remote=true}catch{revisions=localPublicationRevisions();try{state.overrides=JSON.parse(localStorage.getItem(LOCAL_KEY))||[]}catch{state.overrides=[]}state.remote=false}mergeRevisionItems(revisions);return revisions;
}
function chapterById(id){return state.data.chapters.find(chapter=>chapter.id===Number(id))}
function itemFor(relation){return state.data.items[relation.item_id]||{item_id:relation.item_id,title:"Obra não encontrada no acervo",year:"",publication_type:"",source:"",url:""}}
function currentRelations(){
 const relations=state.data.relations.map(relation=>({...relation})),byId=new Map(relations.map(relation=>[relation.relation_id,relation]));
 for(const override of state.overrides){
  if(!override?.relation_id||!state.data.items[override.item_id])continue;
  if(byId.has(override.relation_id))Object.assign(byId.get(override.relation_id),override);
  else{const relation={relation_id:override.relation_id,item_id:override.item_id,chapter:Number(override.chapter),classification:override.classification||"exclusivo",active:override.active!==false,observation:override.observation||"",source:override.source||"manual",nlp_chapter:override.nlp_chapter||"",nlp_classification:override.nlp_classification||"",adherence:0,ranking:0,justification:"",contribution:"",...override};relations.push(relation);byId.set(relation.relation_id,relation)}
 }
 return relations;
}
function updatesFor(relation){return state.data.updates.filter(update=>update.item_id===relation.item_id&&Number(update.chapter)===Number(relation.chapter))}
function activeChaptersForItem(itemId){return [...new Set(currentRelations().filter(relation=>relation.active!==false&&relation.item_id===itemId).map(relation=>Number(relation.chapter)))].sort((a,b)=>a-b)}
function relationPayload(relation,changes={}){return {relation_id:relation.relation_id,item_id:relation.item_id,chapter:Number(relation.chapter),classification:relation.classification,justification:relation.justification||"",contribution:relation.contribution||"",observation:relation.observation||"",active:relation.active!==false,source:relation.source||"nlp",nlp_chapter:relation.nlp_chapter||"",nlp_classification:relation.nlp_classification||"",...changes}}
function findRelation(id){return currentRelations().find(relation=>relation.relation_id===id)}
function emptyList(message){return `<div class="book-empty">${esc(message)}</div>`}

function chapterOptions(selected=""){return state.data.chapters.map(chapter=>`<option value="${chapter.id}" ${Number(selected)===chapter.id?"selected":""}>${chapter.id}. ${esc(chapter.title)}</option>`).join("")}
function populateControls(){
 const chapterOptionsHtml=chapterOptions();
 $("#book-filter-chapter").insertAdjacentHTML("beforeend",chapterOptionsHtml);
 $('#book-edit-form [name="chapter"]').innerHTML=chapterOptionsHtml;
 $('#book-add-form [name="chapter"]').innerHTML=chapterOptionsHtml;
 const types=[...new Set(Object.values(state.data.items).map(item=>item.publication_type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 $("#book-filter-type").insertAdjacentHTML("beforeend",types.map(type=>`<option value="${esc(type)}">${esc(human(type))}</option>`).join(""));
}
function renderSummary(){
 const active=currentRelations().filter(relation=>relation.active!==false);
 $("#book-relation-total").textContent=active.length.toLocaleString("pt-BR");
 $("#book-item-total").textContent=new Set(active.map(relation=>relation.item_id)).size.toLocaleString("pt-BR");
}
function renderParts(){
 const active=currentRelations().filter(relation=>relation.active!==false);
 $("#book-parts").innerHTML=state.data.parts.map(part=>`<section class="book-part"><header><span>${esc(part.label)}</span><small>Capítulos ${part.chapters[0]}–${part.chapters.at(-1)}</small></header><div class="book-chapter-grid">${part.chapters.map(id=>{const chapter=chapterById(id),relations=active.filter(relation=>Number(relation.chapter)===id),exclusive=relations.filter(relation=>relation.classification==="exclusivo").length,shared=relations.filter(relation=>relation.classification==="compartilhado").length;return `<button class="book-chapter-card ${Number(state.filters.chapter)===id?"active":""}" data-book-chapter="${id}" type="button"><span class="book-chapter-number">${String(id).padStart(2,"0")}</span><strong>${esc(chapter.title)}</strong><p>${esc(chapter.question)}</p><small><b>${exclusive}</b> exclusivos <i></i> <b>${shared}</b> compartilhados</small></button>`}).join("")}</div></section>`).join("");
 $$('[data-book-chapter]').forEach(button=>button.onclick=()=>openChapter(button.dataset.bookChapter,true));
}
function matchesFilters(relation){
 const item=itemFor(relation),filter=state.filters,hasUpdates=updatesFor(relation).length>0;
 if(filter.classification&&relation.classification!==filter.classification)return false;
 if(filter.type&&item.publication_type!==filter.type)return false;
 if(Number(relation.adherence||0)<Number(filter.adherence||0))return false;
 if(filter.update==="yes"&&!hasUpdates)return false;
 if(filter.update==="no"&&hasUpdates)return false;
 return true;
}
function sortRelations(relations){
 const sorted=[...relations],collator=new Intl.Collator("pt-BR",{sensitivity:"base"});
 sorted.sort((a,b)=>state.filters.sort==="year"?Number(itemFor(b).year||0)-Number(itemFor(a).year||0)||collator.compare(itemFor(a).title,itemFor(b).title):state.filters.sort==="title"?collator.compare(itemFor(a).title,itemFor(b).title):Number(b.adherence||0)-Number(a.adherence||0)||collator.compare(itemFor(a).title,itemFor(b).title));
 return sorted;
}
function workCard(relation,archived=false){
 const item=itemFor(relation),updates=updatesFor(relation),chapters=activeChaptersForItem(relation.item_id),changed=relation.source==="manual"||Number(relation.chapter)!==Number(relation.nlp_chapter)||relation.classification!==relation.nlp_classification||Boolean(relation.observation),url=/^https?:\/\//.test(item.url||"")?item.url:"";
 const origin=relation.source==="nlp"?`Sugestão inicial: capítulo ${relation.nlp_chapter} · ${human(relation.nlp_classification)}`:"Incluída pela curadoria";
 return `<article class="book-work-card ${archived?"archived":""}">
  <div class="book-work-top"><div class="book-work-tags"><span>${esc(human(item.publication_type))}</span><span>${esc(item.year||"s.d.")}</span>${changed?'<span class="book-human-tag">Decisão editorial</span>':""}</div><strong class="book-score">${relation.adherence?`${Number(relation.adherence).toFixed(1).replace(".",",")}%`:"Curadoria"}</strong></div>
  <h4>${esc(item.title)}</h4><p class="book-work-source">${esc(item.source||"Fonte não informada")}</p>
  <div class="book-relation-state"><span>${esc(origin)}</span><strong>Atual: ${esc(human(relation.classification))}</strong></div>
  ${chapters.length>1?`<div class="book-shared-note">Também presente nos capítulos ${chapters.join(", ")}</div>`:""}
  ${relation.observation?`<p class="book-observation"><b>Observação editorial</b>${esc(relation.observation)}</p>`:""}
  ${(relation.justification||relation.contribution)?`<details class="book-rationale"><summary>Por que esta obra entra</summary>${relation.justification?`<p><b>Relevância</b>${esc(relation.justification)}</p>`:""}${relation.contribution?`<p><b>Contribuição para a pergunta</b>${esc(relation.contribution)}</p>`:""}</details>`:""}
  <div class="book-work-actions">${updates.length?`<button class="book-update-badge" data-book-updates="${esc(relation.relation_id)}" type="button">${updates.length} ${updates.length===1?"dado potencialmente atualizável":"dados potencialmente atualizáveis"}</button>`:"<span></span>"}<div>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">Abrir origem ↗</a>`:""}${archived?`<button data-book-restore="${esc(relation.relation_id)}" type="button">Restaurar</button>`:`<button data-book-edit="${esc(relation.relation_id)}" type="button">Editar relação</button>`}</div></div>
 </article>`;
}
function renderWorkspace(){
 const chapter=chapterById(state.filters.chapter),workspace=$("#book-workspace");
 if(!chapter){workspace.hidden=true;return}
 workspace.hidden=false;$("#book-current-part").textContent=`${chapter.part_label} · CAPÍTULO ${chapter.id}`;$("#book-current-title").textContent=chapter.title;$("#book-current-question").textContent=chapter.question;
 const chapterRelations=currentRelations().filter(relation=>Number(relation.chapter)===chapter.id),active=sortRelations(chapterRelations.filter(relation=>relation.active!==false&&matchesFilters(relation))),archived=sortRelations(chapterRelations.filter(relation=>relation.active===false&&matchesFilters(relation))),exclusive=active.filter(relation=>relation.classification==="exclusivo"),shared=active.filter(relation=>relation.classification==="compartilhado");
 $("#book-exclusive-count").textContent=exclusive.length;$("#book-shared-count").textContent=shared.length;$("#book-archived-count").textContent=archived.length;$("#book-results-count").textContent=`${active.length} ${active.length===1?"obra visível":"obras visíveis"}`;
 $("#book-exclusive-list").innerHTML=exclusive.length?exclusive.map(relation=>workCard(relation)).join(""):emptyList("Nenhuma obra exclusiva neste recorte.");
 $("#book-shared-list").innerHTML=shared.length?shared.map(relation=>workCard(relation)).join(""):emptyList("Nenhuma obra compartilhada neste recorte.");
 $("#book-archived-list").innerHTML=archived.length?archived.map(relation=>workCard(relation,true)).join(""):emptyList("Nenhuma relação arquivada neste capítulo.");
 $$('[data-book-updates]',workspace).forEach(button=>button.onclick=()=>openUpdates(button.dataset.bookUpdates));
 $$('[data-book-edit]',workspace).forEach(button=>button.onclick=()=>openEdit(button.dataset.bookEdit));
 $$('[data-book-restore]',workspace).forEach(button=>button.onclick=()=>restoreRelation(button.dataset.bookRestore));
}
function renderAll(){renderSummary();renderParts();renderWorkspace()}
function publicRelationsForItem(itemId){
 return sortRelations(currentRelations().filter(relation=>relation.active!==false&&relation.item_id===itemId)).map(relation=>({...relation,chapter_title:chapterById(relation.chapter)?.title||""}));
}
function publishBridge(){
 window.HsiaBook={relationsForItem:publicRelationsForItem,editRelation:openEdit,openChapter:id=>openChapter(id,true)};
 window.dispatchEvent(new CustomEvent("hsia-book-ready"));
}
function openChapter(id,scroll=false){state.filters.chapter=String(id);$("#book-filter-chapter").value=state.filters.chapter;renderParts();renderWorkspace();if(scroll)$("#book-workspace").scrollIntoView({behavior:"smooth",block:"start"})}

function openUpdates(id){
 const relation=findRelation(id);if(!relation)return;const item=itemFor(relation),updates=updatesFor(relation);$("#book-updates-title").textContent=item.title;
 $("#book-updates-body").innerHTML=`<p class="book-modal-lead">${updates.length} ${updates.length===1?"dado merece":"dados merecem"} conferência individual nesta obra e neste capítulo.</p><div class="book-update-list">${updates.map((update,index)=>`<article class="book-update-card"><div><span>Dado ${index+1}</span><b>${esc(human(update.priority))}</b></div><h3>${esc(update.original_value||"Valor não informado")}</h3><dl><div><dt>Ano do dado</dt><dd>${esc(update.data_year||"A conferir")}</dd></div><div><dt>Tipo</dt><dd>${esc(human(update.indicator_type))}</dd></div><div class="full"><dt>Trecho</dt><dd>${esc(update.context||"Não informado")}</dd></div><div class="full"><dt>Por que conferir</dt><dd>${esc(update.reason||"Não informado")}</dd></div></dl>${update.url?`<a href="${esc(update.url)}" target="_blank" rel="noopener">${esc(update.source||"Abrir fonte original")} ↗</a>`:""}</article>`).join("")}</div>`;
 $("#book-updates-dialog").showModal();
}
function openEdit(id){
 const relation=findRelation(id);if(!relation)return;const form=$("#book-edit-form");form.elements.relation_id.value=id;form.elements.chapter.value=relation.chapter;form.elements.classification.value=relation.classification;form.elements.justification.value=relation.justification||"";form.elements.contribution.value=relation.contribution||"";form.elements.observation.value=relation.observation||"";form.elements.reviewer.value="";$("#book-restore-nlp").hidden=relation.source!=="nlp";$("#book-edit-dialog").showModal();
}
function duplicateRelation(itemId,chapter,exceptId=""){return currentRelations().find(relation=>relation.relation_id!==exceptId&&relation.item_id===itemId&&Number(relation.chapter)===Number(chapter))}
async function saveBookChange(type,relation,before,reviewer){
 const payload={type,relation,before,reviewer:reviewer||"Visitante"};
 if(state.remote){try{const response=await fetch(API,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}),data=await response.json();if(!response.ok)throw Error(data.error||"Não foi possível salvar a curadoria.");state.overrides=data.book_relations||[]}catch(error){toast(error.message||"Não foi possível salvar a curadoria no repositório.");return false}}
 else{const index=state.overrides.findIndex(entry=>entry.relation_id===relation.relation_id),next={...(index>=0?state.overrides[index]:before||{}),...relation,reviewer:reviewer||"Visitante",edited_at:new Date().toISOString()};if(index>=0)state.overrides[index]=next;else state.overrides.push(next);localStorage.setItem(LOCAL_KEY,JSON.stringify(state.overrides))}
 renderAll();publishBridge();toast(state.remote?"Decisão editorial publicada no repositório.":"Decisão salva neste navegador.");return true;
}
async function submitEdit(form){
 const before=findRelation(form.elements.relation_id.value);if(!before)return;const chapter=Number(form.elements.chapter.value),classification=form.elements.classification.value,justification=form.elements.justification.value.trim(),contribution=form.elements.contribution.value.trim(),observation=form.elements.observation.value.trim(),duplicate=duplicateRelation(before.item_id,chapter,before.relation_id);if(duplicate&&duplicate.active!==false){toast("Esta obra já está ativa nesse capítulo.");return}
 const after=relationPayload(before,{chapter,classification,justification,contribution,observation});if(Number(before.chapter)===chapter&&before.classification===classification&&(before.justification||"")===justification&&(before.contribution||"")===contribution&&(before.observation||"")===observation){toast("Nenhuma mudança para salvar.");return}
 if(await saveBookChange("book_update",after,relationPayload(before),form.elements.reviewer.value.trim()))$("#book-edit-dialog").close();
}
async function archiveCurrent(){const form=$("#book-edit-form"),before=findRelation(form.elements.relation_id.value);if(!before)return;const after=relationPayload(before,{active:false});if(await saveBookChange("book_archive",after,relationPayload(before),form.elements.reviewer.value.trim()))$("#book-edit-dialog").close()}
async function restoreRelation(id){const before=findRelation(id);if(!before)return;const duplicate=duplicateRelation(before.item_id,before.chapter,before.relation_id);if(duplicate&&duplicate.active!==false){toast("Já existe uma relação ativa dessa obra neste capítulo.");return}await saveBookChange("book_restore",relationPayload(before,{active:true}),relationPayload(before),"Visitante")}

function renderSelectedAddItems(){
 const selected=[...state.selectedItems].map(itemId=>state.data.items[itemId]).filter(Boolean),summary=$("#book-add-selected"),submit=$("#book-add-submit");summary.hidden=!selected.length;submit.disabled=!selected.length;submit.textContent=selected.length?`Adicionar ${selected.length} ${selected.length===1?"obra":"obras"} ao capítulo`:"Adicionar obras ao capítulo";if(!selected.length)return;summary.innerHTML=`<span>${selected.length} ${selected.length===1?"obra selecionada":"obras selecionadas"}</span><strong>${selected.slice(0,4).map(item=>esc(item.title)).join(" · ")}${selected.length>4?` · mais ${selected.length-4}`:""}</strong><small>Você pode continuar marcando outras obras na lista.</small>`;
}
function renderAddSearch(){
 const query=norm($("#book-add-search").value),chapter=Number($('#book-add-form [name="chapter"]').value),container=$("#book-add-results"),collator=new Intl.Collator("pt-BR",{sensitivity:"base"});
 const results=Object.values(state.data.items).filter(item=>item?.item_id&&item.title&&(!query||norm(`${item.title} ${item.source}`).includes(query))).sort((a,b)=>collator.compare(a.title,b.title));
 if(!results.length){container.innerHTML='<p>Nenhuma obra encontrada no acervo.</p>';renderSelectedAddItems();return}
 container.innerHTML=`<p class="book-add-result-count">${results.length.toLocaleString("pt-BR")} ${results.length===1?"obra disponível":"obras disponíveis"}</p>${results.map(item=>{const duplicate=duplicateRelation(item.item_id,chapter),checked=state.selectedItems.has(item.item_id)&&!duplicate;if(duplicate)state.selectedItems.delete(item.item_id);return `<label class="book-add-option ${duplicate?"unavailable":""}"><input type="checkbox" data-book-pick="${esc(item.item_id)}" ${checked?"checked":""} ${duplicate?"disabled":""}><span><strong>${esc(item.title)}</strong><small>${esc(item.year||"s.d.")} · ${esc(item.source||"Fonte não informada")}${duplicate?" · já está neste capítulo":""}</small></span></label>`}).join("")}`;
 $$('[data-book-pick]',container).forEach(input=>input.onchange=()=>{if(input.checked)state.selectedItems.add(input.dataset.bookPick);else state.selectedItems.delete(input.dataset.bookPick);renderSelectedAddItems()});renderSelectedAddItems();
}
async function openAdd(){
 const form=$("#book-add-form");form.reset();state.selectedItems.clear();form.elements.chapter.value=state.filters.chapter||"1";form.elements.classification.value="exclusivo";$("#book-add-search").value="";$("#book-add-results").innerHTML='<p>Atualizando a lista de obras…</p>';$("#book-add-selected").hidden=true;$("#book-add-dialog").showModal();renderSelectedAddItems();await refreshRevisionData();renderAddSearch();
}
async function saveBookAdditions(relations,reviewer,skipped=0){
 if(state.remote){try{const response=await fetch(API,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"book_add_many",relations,reviewer:reviewer||"Visitante"})}),data=await response.json();if(!response.ok)throw Error(data.error||"Não foi possível adicionar as obras.");state.overrides=data.book_relations||[]}catch(error){toast(error.message||"Não foi possível salvar a curadoria no repositório.");return false}}
 else{const editedAt=new Date().toISOString();for(const relation of relations)state.overrides.push({...relation,reviewer:reviewer||"Visitante",edited_at:editedAt});localStorage.setItem(LOCAL_KEY,JSON.stringify(state.overrides))}
 renderAll();publishBridge();const suffix=skipped?` ${skipped} ${skipped===1?"obra já estava":"obras já estavam"} no capítulo e não foram repetidas.`:"";toast(`${relations.length} ${relations.length===1?"obra adicionada":"obras adicionadas"}.${suffix}`);return true;
}
async function submitAdd(form){
 const chapter=Number(form.elements.chapter.value),selected=[...state.selectedItems].filter(itemId=>state.data.items[itemId]);if(!selected.length){toast("Marque pelo menos uma obra na lista.");return}const eligible=selected.filter(itemId=>!duplicateRelation(itemId,chapter)),skipped=selected.length-eligible.length;if(!eligible.length){toast("As obras selecionadas já estão ligadas a este capítulo.");renderAddSearch();return}
 const classification=form.elements.classification.value,observation=form.elements.observation.value.trim(),relations=eligible.map(itemId=>({relation_id:`manual:${crypto.randomUUID()}`,item_id:itemId,chapter,classification,justification:"",contribution:"",observation,active:true,source:"manual",nlp_chapter:"",nlp_classification:""})),submit=$("#book-add-submit");submit.disabled=true;submit.textContent="Salvando…";const saved=await saveBookAdditions(relations,form.elements.reviewer.value.trim(),skipped);if(saved){$("#book-add-dialog").close();openChapter(chapter,true)}else renderSelectedAddItems();
}
function bind(){
 const filterMap={"#book-filter-classification":"classification","#book-filter-type":"type","#book-filter-adherence":"adherence","#book-filter-update":"update","#book-filter-sort":"sort"};
 Object.entries(filterMap).forEach(([selector,key])=>$(selector).onchange=event=>{state.filters[key]=event.target.value;renderWorkspace()});
$("#book-filter-chapter").onchange=event=>{state.filters.chapter=event.target.value;renderParts();renderWorkspace()};
 $("#book-clear-filters").onclick=()=>{Object.assign(state.filters,{chapter:"",classification:"",type:"",adherence:0,update:"",sort:"adherence"});for(const id of ["#book-filter-chapter","#book-filter-classification","#book-filter-type","#book-filter-update"])$(id).value="";$("#book-filter-adherence").value="0";$("#book-filter-sort").value="adherence";renderParts();renderWorkspace()};
 $("#book-open-add").onclick=openAdd;$("#book-edit-form").onsubmit=event=>{event.preventDefault();submitEdit(event.currentTarget)};$("#book-archive-relation").onclick=archiveCurrent;$("#book-restore-nlp").onclick=()=>{const form=$("#book-edit-form"),relation=findRelation(form.elements.relation_id.value);if(!relation||relation.source!=="nlp")return;form.elements.chapter.value=relation.nlp_chapter;form.elements.classification.value=relation.nlp_classification;toast("Sugestão inicial recuperada. Clique em Salvar decisão.")};$("#book-add-form").onsubmit=event=>{event.preventDefault();submitAdd(event.currentTarget)};$("#book-add-search").oninput=renderAddSearch;$('#book-add-form [name="chapter"]').onchange=renderAddSearch; $$('[data-book-close]').forEach(button=>button.onclick=()=>$("#"+button.dataset.bookClose).close());
}
async function init(){
 try{const response=await fetch("data/livro.json",{cache:"no-store"});if(!response.ok)throw Error(`HTTP ${response.status}`);state.data=await response.json();state.baseItems={...state.data.items};await refreshRevisionData();populateControls();bind();renderAll();publishBridge();$("#book-loading").hidden=true;$("#book-content").hidden=false
 }catch(error){$("#book-loading").textContent="Não foi possível carregar a curadoria do livro.";console.error(error)}
}init();
})();
