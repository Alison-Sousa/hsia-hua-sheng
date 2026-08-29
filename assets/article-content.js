(() => {
"use strict";

const cache=new Map();
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const isImage=line=>/^!\[[^\]]*\]\([^)]+\)$/.test(line.trim());
const isTableRow=line=>/^\s*\|.*\|\s*$/.test(line);
const cells=line=>line.trim().replace(/^\||\|$/g,"").split("|").map(cell=>cell.trim());
const isTableDivider=line=>isTableRow(line)&&cells(line).every(cell=>/^:?-{3,}:?$/.test(cell));
const nextContent=(lines,index)=>{while(index<lines.length&&!lines[index].trim())index++;return index};

function assetUrl(contentUrl,relative){
 const clean=String(relative||"").replaceAll("\\","/");
 if(!/^imagens\/[^/?#]+$/i.test(clean)||clean.includes(".."))return "";
 try{
  const content=new URL(contentUrl,document.baseURI),base=new URL("./",content),asset=new URL(clean,content);
  return asset.origin===base.origin&&asset.pathname.startsWith(base.pathname)?asset.href:"";
 }catch{return ""}
}
function renderImage(line,contentUrl){
 const match=line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/),src=match&&assetUrl(contentUrl,match[2]);
 if(!src)return '<p class="local-asset-error">Imagem preservada indisponível.</p>';
 return '<figure class="local-article-image"><img src="'+esc(src)+'" alt="'+esc(match[1]||"Imagem do artigo")+'" loading="lazy" decoding="async"></figure>';
}
function renderTable(header,rows){
 const width=header.length,valid=rows.filter(row=>row.length===width);
 return '<div class="local-article-table"><table><thead><tr>'+header.map(value=>'<th scope="col">'+esc(value)+'</th>').join("")+'</tr></thead><tbody>'+valid.map(row=>'<tr>'+row.map(value=>'<td>'+esc(value)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
}
function startsBlock(lines,index){
 const line=lines[index]?.trim()||"";if(!line||isImage(line)||/^#{1,6}\s+/.test(line))return true;
 if(isTableRow(line)){const divider=nextContent(lines,index+1);return divider<lines.length&&isTableDivider(lines[divider])}
 return false;
}
function renderMarkdown(markdown,contentUrl){
 const lines=String(markdown||"").replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").split("\n"),html=[];let index=0,titleSkipped=false;
 while(index<lines.length){
  const line=lines[index].trim();if(!line){index++;continue}
  if(/^#\s+/.test(line)&&!titleSkipped){titleSkipped=true;index++;continue}
  if(isImage(line)){html.push(renderImage(line,contentUrl));index++;continue}
  if(isTableRow(line)){
   const divider=nextContent(lines,index+1);
   if(divider<lines.length&&isTableDivider(lines[divider])){
    const header=cells(line),rows=[];let cursor=nextContent(lines,divider+1);
    while(cursor<lines.length&&isTableRow(lines[cursor].trim())){rows.push(cells(lines[cursor]));cursor=nextContent(lines,cursor+1)}
    html.push(renderTable(header,rows));index=cursor;continue;
   }
  }
  const heading=line.match(/^#{1,6}\s+(.+)$/);if(heading){html.push("<h3>"+esc(heading[1])+"</h3>");index++;continue}
  const paragraph=[line];let cursor=index+1;
  while(cursor<lines.length&&lines[cursor].trim()&&!startsBlock(lines,cursor)){paragraph.push(lines[cursor].trim());cursor++}
  const text=paragraph.join(" "),className=/^Autor\s*:/i.test(text)?"local-article-author":/^(Data\s+|Published on\s+)/i.test(text)?"local-article-date":"";
  html.push("<p"+(className?' class="'+className+'"':"")+">"+esc(text)+"</p>");index=cursor;
 }
 return html.join("");
}
async function load(item){
 const path=String(item?.conteudo_local||"");if(!path)throw Error("Conteúdo preservado não disponível.");
 let markdown=cache.get(path);
 if(markdown===undefined){const response=await fetch(path,{cache:"no-store"});if(!response.ok)throw Error("Não foi possível abrir o conteúdo preservado.");markdown=await response.text();cache.set(path,markdown)}
 return renderMarkdown(markdown,path);
}

window.HsiaLocalArticles={load,renderMarkdown};
})();