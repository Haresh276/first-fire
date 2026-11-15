/* Join the builder's standard single-disk ZIPs without inflating or recompressing their files. */
(() => {
  'use strict';
  const hashPattern = /^[a-f0-9]{64}$/;
  const packName = /^first-fire-[a-z0-9-]+\.zip$/;
  function check(condition, reason) { if (!condition) throw Error(reason); }
  function view(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  const le16 = (data, offset) => data.getUint16(offset, true);
  const le32 = (data, offset) => data.getUint32(offset, true);

  function plan(manifest, hostedHashes, editionHashes = hostedHashes) {
    check(manifest?.schema === 'first-fire.offline-packs.v1' && manifest.folder === 'FIRST-FIRE' &&
      manifest.core === 'first-fire-offline.zip' && manifest.supplements && typeof manifest.supplements === 'object',
      'Unrecognized offline edition manifest.');
    check(hashPattern.test(hostedHashes[manifest.core]),'This installed edition contains the dashboard and files. Open the public downloads page for a new complete copy.');
    check(editionHashes[manifest.core] === hostedHashes[manifest.core], 'The hosted core and the offline release manifest describe different packages.');
    const entries = [{name:manifest.core, hash:hostedHashes[manifest.core], files:null}];
    const supplemental=new Set();
    for (const [name, item] of Object.entries(manifest.supplements)) {
      check(packName.test(name) && name !== manifest.core && item && Number.isSafeInteger(item.bytes) &&
        item.bytes > 0 && item.files && Object.keys(item.files).length > 0 && hostedHashes[name] === item.sha256 && editionHashes[name] === item.sha256,
        'Package manifest and hosted checksums disagree for ' + name + '.');
      for(const [file,hash] of Object.entries(item.files)){
        check(!supplemental.has(file) && hashPattern.test(hash) && editionHashes[file]===hash,
          'Supplement file checksum or membership differs for '+file+'.');
        supplemental.add(file);
      }
      entries.push({name, hash:item.sha256, bytes:item.bytes, files:Object.keys(item.files)});
    }
    check(entries.length > 1 && entries.every(p=>hashPattern.test(p.hash)), 'An offline package checksum is missing.');
    const hostedOnly=new Set(['model.js','checksums.json',...entries.map(p=>p.name)]);
    // The live host can ship extra pages. Membership is defined by the packaged release.
    entries[0].files=['checksums.json',...Object.keys(editionHashes).filter(n=>!hostedOnly.has(n)&&!supplemental.has(n))];
    check(['index.html','offline-packs.json'].every(n=>entries[0].files.includes(n)), 'Missing core dashboard or integrity manifest.');
    return entries;
  }

  function parseZip(bytes, offset, seen, expectedFiles) {
    const decoder = new TextDecoder('utf-8', {fatal:true});
    const d = view(bytes), end = bytes.length - 22;
    // Python's packager writes unencrypted, seekable ZIP32 streams with uncompressed local headers.
    check(end >= 0 && le32(d,end) === 0x06054b50 && le16(d,end+20) === 0 &&
      le16(d,end+4) === 0 && le16(d,end+6) === 0, 'Unsupported or truncated ZIP directory.');
    const count = le16(d,end+10), start = le32(d,end+16);
    check(count > 0 && le16(d,end+8) === count && start + le32(d,end+12) === end, 'ZIP directory bounds disagree.');
    const central = bytes.slice(start,end), modified = view(central), names = [], ranges = [];
    let at = start;
    for(let i=0;i<count;i++) {
      check(at+46 <= end && le32(d,at) === 0x02014b50, 'Invalid ZIP directory record.');
      const flags=le16(d,at+8), method=le16(d,at+10), size=le32(d,at+20);
      const local=le32(d,at+42), length=le16(d,at+28);
      const next=at+46+length+le16(d,at+30)+le16(d,at+32);
      check(next<=end && local+30<=start && (flags & ~0x800)===0 && (method===0||method===8) &&
        le16(d,at+34)===0 && le32(d,local)===0x04034b50, 'Unsupported ZIP entry layout.');
      const name=decoder.decode(bytes.subarray(at+46,at+46+length));
      const parts=name.split('/');
      check(parts.length>1 && parts[0]==='FIRST-FIRE' && parts.every(p=>p&&p!=='.'&&p!=='..'&&!/[\\:\u0000-\u001f]/.test(p)) &&
        ((le32(d,at+38)>>>28)===0 || (le32(d,at+38)>>>28)===8) && !seen.has(name),
        'Unsafe or duplicate package path: '+name);
      const payload=local+30+le16(d,local+26)+le16(d,local+28);
      check(payload+size<=start && le16(d,local+6)===flags && le16(d,local+8)===method &&
        le32(d,local+14)===le32(d,at+16) && le32(d,local+18)===size && le32(d,local+22)===le32(d,at+24) &&
        decoder.decode(bytes.subarray(local+30,local+30+le16(d,local+26)))===name,
        'ZIP header mismatch for '+name);
      const newOffset=local+offset;
      check(newOffset<0xffffffff,'Complete edition exceeds the browser ZIP32 limit.');
      modified.setUint32(at-start+42,newOffset,true);
      seen.add(name);names.push(parts.slice(1).join('/'));ranges.push([local,payload+size]);at=next;
    }
    check(at===end,'Unexpected ZIP directory trailer.');
    ranges.sort((a,b)=>a[0]-b[0]);
    check(ranges[0][0]===0 && ranges.at(-1)[1]===start && ranges.every((r,i)=>!i||r[0]===ranges[i-1][1]),
      'Unexpected gap or overlap among ZIP records.');
    if(expectedFiles){
      const expected=new Set(expectedFiles);
      check(expected.size===names.length && names.every(n=>expected.has(n)), 'The package file list differs from its manifest.');
    } else {
      check(names.includes('index.html') && names.includes('checksums.json') && names.includes('offline-packs.json'),
        'Core edition is missing its dashboard or integrity manifests.');
    }
    return {length:start,central,count};
  }

  async function combine(entries, read, progress = () => {}) {
    const records=[], directory=[], names=new Set();
    let offset=0,totalEntries=0,directoryBytes=0;
    for(const [i,entry] of entries.entries()){
      progress(`Downloading package ${i+1} of ${entries.length} · ${entry.name}`);
      const bytes=await read(entry.name);
      check(bytes instanceof Uint8Array && (!entry.bytes || bytes.length===entry.bytes),'Incorrect download size for '+entry.name);
      progress(`Checking package ${i+1} of ${entries.length} · ${entry.name}`);
      const sum=await globalThis.crypto.subtle.digest('SHA-256',bytes);
      const hash=Array.from(new Uint8Array(sum),b=>b.toString(16).padStart(2,'0')).join('');
      check(hash===entry.hash,'SHA-256 verification failed for '+entry.name+'.');
      const zip=parseZip(bytes,offset,names,entry.files);
      records.push(new Blob([bytes.subarray(0,zip.length)]));directory.push(zip.central);
      offset+=zip.length;totalEntries+=zip.count;directoryBytes+=zip.central.length;
    }
    check(totalEntries<65535 && offset+directoryBytes+22<0xffffffff,'Complete edition exceeds the browser ZIP32 limit.');
    const end=new Uint8Array(22), d=view(end);
    d.setUint32(0,0x06054b50,true);d.setUint16(8,totalEntries,true);d.setUint16(10,totalEntries,true);
    d.setUint32(12,directoryBytes,true);d.setUint32(16,offset,true);
    return {blob:new Blob([...records,...directory,end],{type:'application/zip'}),files:totalEntries};
  }

  if(typeof module!=='undefined' && module.exports) module.exports={plan,parseZip,combine};
  if(typeof document==='undefined')return;
  function attach(){
    const button=document.querySelector('[data-ff-offline-combine]'),status=document.querySelector('[data-ff-offline-status]');
    if(!button||!status)return;
    if(location.protocol==='file:'){button.disabled=true;status.textContent='For another complete copy, open the hosted download page. This extracted edition can run from this folder.';return;}
    if(!globalThis.crypto?.subtle){button.disabled=true;status.textContent='This browser needs a secure connection to verify the combined download. The individual ZIP links below are available.';return;}
    let working=false,downloadURL='';
    button.disabled=false;
    const notify=text=>{status.textContent=text;};
    const get=async (name,optional=false)=>{
      const response=await fetch(new URL(name,location.href),{credentials:'same-origin',mode:'same-origin',redirect:'error',cache:'no-cache'});
      if(optional && response.status===404)return null;
      check(response.ok,'Could not download '+name+' (HTTP '+response.status+').');return response;
    };
    button.addEventListener('click',async()=>{
      if(working)return;working=true;button.disabled=true;button.setAttribute('aria-busy','true');
      if(downloadURL){URL.revokeObjectURL(downloadURL);downloadURL='';}
      notify('Reading package sizes and checksums…');
      try{
        const [manifest,hashes,edition]=await Promise.all([
          get('offline-packs.json').then(r=>r.json()), get('checksums.json').then(r=>r.json()),
          get('offline-edition-checksums.json',true)
        ]);
        let editionHashes=hashes;
        if(edition){
          const bytes=await edition.arrayBuffer();
          const expected=hashes['offline-edition-checksums.json'];
          if(expected){
            const digest=await crypto.subtle.digest('SHA-256',bytes);
            const value=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
            check(value===expected,'Offline release manifest checksum differs. Reload to obtain one release.');
          }
          editionHashes=JSON.parse(new TextDecoder().decode(bytes));
        }else{
          check(!hashes['offline-edition-checksums.json'],'Offline release manifest is missing. Reload to obtain one release.');
        }
        const full=await combine(plan(manifest,hashes,editionHashes),async name=>new Uint8Array(await(await get(name)).arrayBuffer()),notify);
        downloadURL=URL.createObjectURL(full.blob);
        const anchor=document.createElement('a');anchor.download='FIRST-FIRE-complete-offline.zip';anchor.href=downloadURL;
        anchor.textContent='Save the verified ZIP';status.replaceChildren(`Verified ${full.files} files. `,anchor);
        anchor.click();
      }catch(error){notify((error?.message||'Unable to create the complete ZIP.')+' You can retry or use the individual ZIP links.');}
      finally{working=false;button.disabled=false;button.removeAttribute('aria-busy');}
    });
    window.addEventListener('pagehide',event=>{if(!event.persisted&&downloadURL)URL.revokeObjectURL(downloadURL);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();
