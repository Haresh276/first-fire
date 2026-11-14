(() => {
  'use strict';
  function elem(tag,text,cls) {
    const el=document.createElement(tag);
    if(text!==undefined) el.textContent=text;
    if(cls) el.className=cls;
    return el;
  }
  function anchor(text,href,cls) {
    const a=elem('a',text,cls);a.href=href;
    if(href.startsWith('https://')){a.target='_blank';a.rel='noopener noreferrer';}
    return a;
  }
  window.renderCodeReview=(root,params)=>{
    const data=window.FFRepoReadings;
    const breadcrumb=elem('div',undefined,'breadcrumb');breadcrumb.append(anchor('Sources & methods','#sources'),elem('span','/'),'Code review');
    const head=elem('header',undefined,'pagetitle');head.append(elem('h1','Repository code review'),elem('p','Explore the source behind each project. Each reading links to the file at the revision examined.','sub'));
    const links=elem('div',undefined,'actions');links.append(anchor('Review findings','#report/code-review','ghost'),anchor('Download repository readings','code-review-readings.csv','ghost'),anchor('Download file coverage (.csv.gz)','code-review-files.csv.gz','ghost'));
    const panel=elem('section',undefined,'panel stack section');const field=elem('label',undefined,'field'),input=elem('input');
    input.type='search';input.placeholder='Repository, topic or implementation detail';input.maxLength=180;input.value=(params.get('q')||'').slice(0,180);
    field.append(elem('span','Search the readings'),input);
    const count=elem('p',undefined,'small');count.setAttribute('role','status');
    const list=elem('div');const pager=elem('div',undefined,'actions');
    panel.append(field,count,list,pager);root.replaceChildren(breadcrumb,head,links,panel);
    let page=0;
    function render() {
      const terms=input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
      const filtered=data.filter(row=>terms.every(t=>(row[0]+' '+row[1]).toLocaleLowerCase().includes(t)));
      const pages=Math.max(1,Math.ceil(filtered.length/12));page=Math.min(page,pages-1);
      count.textContent=filtered.length?'Showing '+(page*12+1)+'–'+Math.min((page+1)*12,filtered.length)+' of '+filtered.length+' repositories.':'No matching repositories.';
      list.replaceChildren();pager.replaceChildren();
      for(const [name,note,url] of filtered.slice(page*12,page*12+12)){
        const card=elem('article',undefined,'result'),title=elem('h3');title.style.overflowWrap='anywhere';title.append(anchor(name,url));card.append(title,elem('p',note));list.append(card);
      }
      if(pages>1){
        for(const [label,step] of [['Previous',-1],['Next',1]]){
          const button=elem('button',label,'ghost');button.type='button';
          button.disabled=step<0?page===0:page===pages-1;
          button.onclick=()=>{page+=step;render();input.focus({preventScroll:true});panel.scrollIntoView({block:'start'});};
          pager.append(button);
        }
      }
    }
    input.addEventListener('input',()=>{page=0;render();});render();
  };
})();
