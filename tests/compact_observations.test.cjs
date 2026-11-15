const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function read(name){const s=fs.readFileSync(path.resolve(__dirname,'../dist',name),'utf8'),env={window:{FF:{}}};vm.runInNewContext(s,env);return {size:Buffer.byteLength(s),data:JSON.parse(JSON.stringify(env.window.FF))};}
test('compact Lite transport reproduces every released observation and original table cell',()=>{
 const full=read('observation-rows.js'),lite=read('observation-rows-lite.js');assert.deepEqual(lite.data,full.data);assert(lite.size<full.size*.5);
});
